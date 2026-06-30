mod spotify;

use spotify::{NowPlaying, Tokens};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

/// Shared app state: an HTTP client, the OAuth tokens, the Spotify client id,
/// and where we persist things on disk.
pub struct AppState {
    client: reqwest::Client,
    tokens: Mutex<Option<Tokens>>,
    client_id: Mutex<String>,
    data_dir: Mutex<PathBuf>,
    // cache the per-track liked flag + album-art data URL so we don't hammer the
    // Spotify API (contains / image) on every poll (caused 429 Too Many Requests)
    np_cache: Mutex<Option<(String, bool, String)>>,
}

impl AppState {
    fn tokens_path(&self) -> PathBuf {
        self.data_dir.lock().unwrap().join("tokens.json")
    }
    fn client_id_path(&self) -> PathBuf {
        self.data_dir.lock().unwrap().join("client_id.txt")
    }
}

fn save_tokens(state: &AppState, t: &Tokens) {
    if let Ok(json) = serde_json::to_string(t) {
        let _ = std::fs::create_dir_all(&*state.data_dir.lock().unwrap());
        let _ = std::fs::write(state.tokens_path(), json);
    }
}

fn load_tokens(state: &AppState) -> Option<Tokens> {
    std::fs::read_to_string(state.tokens_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

/// Returns a valid access token, refreshing it if it is about to expire.
async fn ensure_token(state: &AppState) -> Result<String, String> {
    let (access, refresh, exp) = {
        let g = state.tokens.lock().unwrap();
        let t = g.as_ref().ok_or("no autenticado")?;
        (t.access_token.clone(), t.refresh_token.clone(), t.expires_at)
    };
    if spotify::now_secs() < exp.saturating_sub(30) {
        return Ok(access);
    }
    let client_id = state.client_id.lock().unwrap().clone();
    let fresh = spotify::refresh(&state.client, &client_id, &refresh).await?;
    {
        let mut g = state.tokens.lock().unwrap();
        *g = Some(fresh.clone());
    }
    save_tokens(state, &fresh);
    Ok(fresh.access_token)
}

// ============ commands ============

#[tauri::command]
fn auth_status(state: State<'_, AppState>) -> bool {
    state.tokens.lock().unwrap().is_some()
}

#[tauri::command]
fn has_client_id(state: State<'_, AppState>) -> bool {
    !state.client_id.lock().unwrap().is_empty()
}

#[tauri::command]
fn set_client_id(client_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let id = client_id.trim().to_string();
    if id.is_empty() {
        return Err("client id vacío".into());
    }
    let _ = std::fs::create_dir_all(&*state.data_dir.lock().unwrap());
    std::fs::write(state.client_id_path(), &id).map_err(|e| e.to_string())?;
    *state.client_id.lock().unwrap() = id;
    Ok(())
}

#[tauri::command]
async fn login(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let client_id = state.client_id.lock().unwrap().clone();
    if client_id.is_empty() {
        return Err("falta el Client ID de Spotify".into());
    }

    let verifier = spotify::gen_verifier();
    let challenge = spotify::challenge(&verifier);

    // grab a free loopback port BEFORE building the URL so the redirect matches
    let (server, port) = spotify::bind_server()?;
    let redirect_uri = spotify::redirect_uri(port);
    let url = spotify::build_auth_url(&client_id, &challenge, &redirect_uri);

    // open the system browser for the consent screen
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("no se pudo abrir el navegador: {e}"))?;

    // block (off the async runtime) until the loopback redirect arrives
    let code = tokio::task::spawn_blocking(move || spotify::wait_for_code(server))
        .await
        .map_err(|e| e.to_string())??;

    let tokens = spotify::exchange(&state.client, &client_id, &code, &verifier, &redirect_uri).await?;
    {
        let mut g = state.tokens.lock().unwrap();
        *g = Some(tokens.clone());
    }
    save_tokens(&state, &tokens);
    Ok(())
}

#[tauri::command]
fn logout(state: State<'_, AppState>) {
    *state.tokens.lock().unwrap() = None;
    let _ = std::fs::remove_file(state.tokens_path());
}

#[tauri::command]
async fn now_playing(state: State<'_, AppState>) -> Result<Option<NowPlaying>, String> {
    let token = ensure_token(&state).await?;
    let Some(v) = spotify::currently_playing(&state.client, &token).await? else {
        return Ok(None);
    };
    let item = &v["item"];
    if item.is_null() {
        return Ok(None);
    }
    // Spotify "track relinking": the playing item can be a market-specific id that
    // differs from the original track saved in the user's library. Prefer linked_from.id
    // so the "saved" check and like/unlike target the same track the user has.
    let id = item["linked_from"]["id"]
        .as_str()
        .filter(|s| !s.is_empty())
        .or_else(|| item["id"].as_str())
        .unwrap_or("")
        .to_string();
    let title = item["name"].as_str().unwrap_or("").to_string();
    let artist = item["artists"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|x| x["name"].as_str())
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();
    let album = item["album"]["name"].as_str().unwrap_or("").to_string();
    let img_url = item["album"]["images"]
        .get(0)
        .and_then(|i| i["url"].as_str())
        .unwrap_or("")
        .to_string();
    let duration_ms = item["duration_ms"].as_i64().unwrap_or(0);
    let progress_ms = v["progress_ms"].as_i64().unwrap_or(0);
    let is_playing = v["is_playing"].as_bool().unwrap_or(false);

    // reuse cached liked/image while the same track is playing (avoids 429)
    let cached = state.np_cache.lock().unwrap().clone();
    let (liked, image) = match cached {
        Some((cid, l, img)) if !id.is_empty() && cid == id => (l, img),
        _ => {
            let l = if id.is_empty() {
                false
            } else {
                spotify::is_saved(&state.client, &token, &id).await.unwrap_or(false)
            };
            let img = if img_url.is_empty() {
                String::new()
            } else {
                spotify::fetch_image_data_url(&state.client, &img_url).await.unwrap_or_default()
            };
            *state.np_cache.lock().unwrap() = Some((id.clone(), l, img.clone()));
            (l, img)
        }
    };

    Ok(Some(NowPlaying {
        id,
        title,
        artist,
        album,
        image,
        duration_ms,
        progress_ms,
        is_playing,
        liked,
    }))
}

#[tauri::command]
async fn set_playing(play: bool, state: State<'_, AppState>) -> Result<(), String> {
    let token = ensure_token(&state).await?;
    let path = if play { "/me/player/play" } else { "/me/player/pause" };
    spotify::player_command(&state.client, &token, "PUT", path).await
}

#[tauri::command]
async fn next_track(state: State<'_, AppState>) -> Result<(), String> {
    let token = ensure_token(&state).await?;
    spotify::player_command(&state.client, &token, "POST", "/me/player/next").await
}

#[tauri::command]
async fn prev_track(state: State<'_, AppState>) -> Result<(), String> {
    let token = ensure_token(&state).await?;
    spotify::player_command(&state.client, &token, "POST", "/me/player/previous").await
}

#[tauri::command]
async fn seek(position_ms: i64, state: State<'_, AppState>) -> Result<(), String> {
    let token = ensure_token(&state).await?;
    spotify::player_command(&state.client, &token, "PUT", &format!("/me/player/seek?position_ms={position_ms}")).await
}

#[tauri::command]
async fn set_like(track_id: String, liked: bool, state: State<'_, AppState>) -> Result<(), String> {
    let token = ensure_token(&state).await?;
    let method = if liked { "PUT" } else { "DELETE" };
    let r = spotify::player_command(&state.client, &token, method, &format!("/me/tracks?ids={track_id}")).await;
    if r.is_ok() {
        if let Some(entry) = state.np_cache.lock().unwrap().as_mut() {
            if entry.0 == track_id { entry.1 = liked; }
        }
    }
    r
}

/// Fetch any image URL and return it as a data: URL (sidesteps canvas CORS taint).
/// Used for SoundCloud artwork so reactive colors still work.
#[tauri::command]
async fn fetch_image(url: String, state: State<'_, AppState>) -> Result<String, String> {
    spotify::fetch_image_data_url(&state.client, &url).await
}

#[derive(serde::Serialize)]
struct Lyrics {
    synced: Option<String>,
    plain: Option<String>,
}

fn pick_lyrics(v: &serde_json::Value) -> Lyrics {
    let nz = |s: Option<&str>| s.map(|x| x.to_string()).filter(|x| !x.is_empty());
    Lyrics {
        synced: nz(v["syncedLyrics"].as_str()),
        plain: nz(v["plainLyrics"].as_str()),
    }
}

/// Fetch lyrics (synced LRC when available) from LRCLIB — free, no API key.
#[tauri::command]
async fn fetch_lyrics(
    artist: String,
    title: String,
    album: Option<String>,
    duration: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Lyrics, String> {
    let enc = urlencoding::encode;
    let ua = "Poptify (https://github.com/SrAlvarado/Poptify)";

    // exact match first
    let mut url = format!(
        "https://lrclib.net/api/get?artist_name={}&track_name={}",
        enc(&artist), enc(&title)
    );
    if let Some(a) = album.as_ref().filter(|s| !s.is_empty()) { url += &format!("&album_name={}", enc(a)); }
    if let Some(d) = duration { url += &format!("&duration={}", d); }

    let resp = state.client.get(&url).header("User-Agent", ua).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        return Ok(pick_lyrics(&v));
    }

    // fallback: search and take the first result
    let surl = format!("https://lrclib.net/api/search?q={}", enc(&format!("{artist} {title}")));
    let sresp = state.client.get(&surl).header("User-Agent", ua).send().await.map_err(|e| e.to_string())?;
    if sresp.status().is_success() {
        let arr: serde_json::Value = sresp.json().await.map_err(|e| e.to_string())?;
        if let Some(first) = arr.as_array().and_then(|a| a.first()) {
            return Ok(pick_lyrics(first));
        }
    }
    Ok(Lyrics { synced: None, plain: None })
}

/// Raise the window above the menu bar (so the Notch skin sits around the camera),
/// or restore the normal floating level.
#[tauri::command]
fn set_notch_overlay(enable: bool, window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc::runtime::Object;
        use objc::{msg_send, sel, sel_impl};
        let ns = window.ns_window().map_err(|e| e.to_string())? as *mut Object;
        unsafe {
            if enable {
                let level: i64 = 25; // above NSMainMenuWindowLevel (24)
                let _: () = msg_send![ns, setLevel: level];
                let behavior: u64 = (1 << 0) | (1 << 8); // canJoinAllSpaces | fullScreenAuxiliary
                let _: () = msg_send![ns, setCollectionBehavior: behavior];
            } else {
                let level: i64 = 3; // floating (always-on-top default)
                let _: () = msg_send![ns, setLevel: level];
                let behavior: u64 = 0;
                let _: () = msg_send![ns, setCollectionBehavior: behavior];
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    { let _ = (enable, &window); }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let _ = std::fs::create_dir_all(&data_dir);

            // client id: env var first, then a saved file
            let id_path = data_dir.join("client_id.txt");
            let client_id = std::env::var("POPTIFY_SPOTIFY_CLIENT_ID")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .or_else(|| std::fs::read_to_string(&id_path).ok())
                .map(|s| s.trim().to_string())
                .unwrap_or_default();

            let state = AppState {
                client: reqwest::Client::new(),
                tokens: Mutex::new(None),
                client_id: Mutex::new(client_id),
                data_dir: Mutex::new(data_dir),
                np_cache: Mutex::new(None),
            };
            // load persisted tokens
            if let Some(t) = load_tokens(&state) {
                *state.tokens.lock().unwrap() = Some(t);
            }
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth_status,
            has_client_id,
            set_client_id,
            login,
            logout,
            now_playing,
            set_playing,
            next_track,
            prev_track,
            seek,
            set_like,
            fetch_image,
            fetch_lyrics,
            set_notch_overlay
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar Poptify");
}
