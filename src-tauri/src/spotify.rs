//! Spotify OAuth (Authorization Code + PKCE) and Web API helpers.

use base64::Engine;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const REDIRECT_PORT: u16 = 14528;
pub const REDIRECT_URI: &str = "http://127.0.0.1:14528/callback";
pub const SCOPES: &str = "user-read-currently-playing user-read-playback-state user-modify-playback-state user-library-read user-library-modify";

const AUTH_URL: &str = "https://accounts.spotify.com/authorize";
const TOKEN_URL: &str = "https://accounts.spotify.com/api/token";
const API: &str = "https://api.spotify.com/v1";

#[derive(Clone, Serialize, Deserialize)]
pub struct Tokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64, // unix seconds
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    #[serde(default)]
    refresh_token: Option<String>,
}

#[derive(Serialize)]
pub struct NowPlaying {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub image: String, // data: URL
    pub duration_ms: i64,
    pub progress_ms: i64,
    pub is_playing: bool,
    pub liked: bool,
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// ---------- PKCE ----------
pub fn gen_verifier() -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let mut rng = rand::thread_rng();
    (0..64).map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char).collect()
}

pub fn challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

pub fn build_auth_url(client_id: &str, challenge: &str) -> String {
    format!(
        "{AUTH_URL}?response_type=code&client_id={}&scope={}&redirect_uri={}&code_challenge_method=S256&code_challenge={}",
        urlencoding::encode(client_id),
        urlencoding::encode(SCOPES),
        urlencoding::encode(REDIRECT_URI),
        challenge
    )
}

/// Blocks until the browser redirects back with `?code=...`, returns the code.
/// Runs a tiny single-shot HTTP server on the loopback redirect port.
pub fn wait_for_code() -> Result<String, String> {
    let server = tiny_http::Server::http(("127.0.0.1", REDIRECT_PORT))
        .map_err(|e| format!("no se pudo abrir el servidor local: {e}"))?;
    for request in server.incoming_requests() {
        let url = request.url().to_string();
        // url looks like /callback?code=XXarbi or /callback?error=...
        let query = url.split('?').nth(1).unwrap_or("");
        let mut code = None;
        let mut error = None;
        for pair in query.split('&') {
            let mut it = pair.splitn(2, '=');
            match (it.next(), it.next()) {
                (Some("code"), Some(v)) => code = Some(v.to_string()),
                (Some("error"), Some(v)) => error = Some(v.to_string()),
                _ => {}
            }
        }
        let body = "<html><body style=\"font-family:-apple-system,sans-serif;background:#0c0c12;color:#fff;display:flex;height:100vh;align-items:center;justify-content:center\"><div style=\"text-align:center\"><h2>✅ Poptify conectado</h2><p>Ya puedes cerrar esta pestaña.</p></div></body></html>";
        let header = tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..])
            .expect("valid header");
        let response = tiny_http::Response::from_string(body).with_header(header);
        let _ = request.respond(response);

        if let Some(e) = error {
            return Err(format!("autorización denegada: {e}"));
        }
        if let Some(c) = code {
            return Ok(c);
        }
        // ignore favicon / other requests, keep waiting
    }
    Err("el servidor local se cerró sin recibir el código".into())
}

// ---------- token exchange / refresh ----------
pub async fn exchange(client: &reqwest::Client, client_id: &str, code: &str, verifier: &str) -> Result<Tokens, String> {
    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", REDIRECT_URI),
            ("client_id", client_id),
            ("code_verifier", verifier),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("token exchange falló: {}", resp.text().await.unwrap_or_default()));
    }
    let tr: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Tokens {
        access_token: tr.access_token,
        refresh_token: tr.refresh_token.unwrap_or_default(),
        expires_at: now_secs() + tr.expires_in,
    })
}

pub async fn refresh(client: &reqwest::Client, client_id: &str, refresh_token: &str) -> Result<Tokens, String> {
    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("refresh falló: {}", resp.text().await.unwrap_or_default()));
    }
    let tr: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Tokens {
        access_token: tr.access_token,
        // Spotify may omit a new refresh token — keep the old one then.
        refresh_token: tr.refresh_token.unwrap_or_else(|| refresh_token.to_string()),
        expires_at: now_secs() + tr.expires_in,
    })
}

// ---------- API ----------
pub async fn currently_playing(client: &reqwest::Client, token: &str) -> Result<Option<serde_json::Value>, String> {
    let resp = client
        .get(format!("{API}/me/player/currently-playing"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if resp.status().as_u16() == 204 || !resp.status().is_success() {
        return Ok(None);
    }
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Some(v))
}

pub async fn is_saved(client: &reqwest::Client, token: &str, id: &str) -> Result<bool, String> {
    let resp = client
        .get(format!("{API}/me/tracks/contains?ids={id}"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let arr: Vec<bool> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(arr.first().copied().unwrap_or(false))
}

pub async fn fetch_image_data_url(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{b64}"))
}

/// Simple PUT/POST helper for player controls; returns Ok even on 204/202.
pub async fn player_command(client: &reqwest::Client, token: &str, method: &str, path: &str) -> Result<(), String> {
    let url = format!("{API}{path}");
    let req = match method {
        "PUT" => client.put(url),
        "POST" => client.post(url),
        "DELETE" => client.delete(url),
        _ => client.get(url),
    };
    let resp = req.bearer_auth(token).header("Content-Length", "0").send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    if status.is_success() || status.as_u16() == 204 || status.as_u16() == 202 {
        Ok(())
    } else {
        Err(format!("Spotify {}: {}", status, resp.text().await.unwrap_or_default()))
    }
}
