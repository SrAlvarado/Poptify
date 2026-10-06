//! Géneros para el modo Avatar. Spotify no los da a las apps en modo desarrollo (`genres: []`), así que:
//!   0. Last.fm (si el usuario puso su clave): etiquetas de LA CANCIÓN, también de ambiente ("chill", "mellow")
//!   1. MusicBrainz: etiquetas del artista (finas: trap, drill, reggaeton…), sin clave
//!   2. Deezer: género del álbum de la canción (más grueso, pero casi siempre existe), sin clave

const UA: &str = "Poptify/0.2 (https://github.com/SrAlvarado/Poptify)";

/// Etiquetas de MusicBrainz del artista más probable, ordenadas por votos.
pub async fn musicbrainz(client: &reqwest::Client, artist: &str) -> Vec<String> {
    let q = format!("artist:\"{}\"", artist.replace('"', ""));
    let url = format!("https://musicbrainz.org/ws/2/artist/?query={}&fmt=json&limit=3", urlencoding::encode(&q));
    let Ok(resp) = client.get(url).header("User-Agent", UA).send().await else { return vec![] };
    if !resp.status().is_success() { return vec![]; }
    let Ok(v) = resp.json::<serde_json::Value>().await else { return vec![] };
    let Some(a) = v["artists"].as_array().and_then(|a| a.iter().find(|x| x["score"].as_i64().unwrap_or(0) >= 90 && x["tags"].as_array().map_or(false, |t| !t.is_empty()))) else { return vec![] };
    let mut tags: Vec<(i64, String)> = a["tags"].as_array().map(|t| t.iter()
        .filter_map(|x| Some((x["count"].as_i64().unwrap_or(0), x["name"].as_str()?.to_string()))).collect()).unwrap_or_default();
    tags.sort_by(|a, b| b.0.cmp(&a.0));
    tags.into_iter().map(|(_, n)| n).take(8).collect()
}

/// minúsculas, sin acentos ni signos: "ROSALÍA" y "Rosalia" comparan igual
fn norm(s: &str) -> String {
    s.to_lowercase().chars().map(|c| match c {
        'á' | 'à' | 'ä' | 'â' => 'a', 'é' | 'è' | 'ë' | 'ê' => 'e', 'í' | 'ì' | 'ï' | 'î' => 'i',
        'ó' | 'ò' | 'ö' | 'ô' => 'o', 'ú' | 'ù' | 'ü' | 'û' => 'u', 'ñ' => 'n', 'ç' => 'c', c => c,
    }).filter(|c| c.is_alphanumeric()).collect()
}

/// Géneros de Deezer del álbum de esta canción (o de una canción del artista).
/// OJO: la sintaxis avanzada `artist:"X"` de Deezer devuelve canciones de OTROS artistas
/// (con "Rels B" daba un tema de EDM → bailaba techno). Se usa la búsqueda normal y se
/// exige que el artista del resultado coincida.
pub async fn deezer(client: &reqwest::Client, artist: &str, title: &str) -> Vec<String> {
    let want = norm(artist);
    if want.is_empty() { return vec![]; }
    for q in [format!("{artist} {title}"), artist.to_string()] {
        if q.trim().is_empty() { continue; }
        let url = format!("https://api.deezer.com/search?q={}&limit=10", urlencoding::encode(q.trim()));
        let Ok(resp) = client.get(url).send().await else { continue };
        let Ok(v) = resp.json::<serde_json::Value>().await else { continue };
        let album = v["data"].as_array().and_then(|d| d.iter().find(|t| {
            let got = norm(t["artist"]["name"].as_str().unwrap_or(""));
            !got.is_empty() && (got == want || got.contains(&want) || want.contains(&got))
        })).and_then(|t| t["album"]["id"].as_i64());
        let Some(album) = album else { continue };
        let Ok(resp) = client.get(format!("https://api.deezer.com/album/{album}")).send().await else { continue };
        let Ok(v) = resp.json::<serde_json::Value>().await else { continue };
        let g: Vec<String> = v["genres"]["data"].as_array().map(|g| g.iter().filter_map(|x| x["name"].as_str().map(String::from)).collect()).unwrap_or_default();
        if !g.is_empty() { return g; }
    }
    vec![]
}

/// Etiquetas de Last.fm de esta canción (las más votadas primero). Sin clave o sin datos → vacío.
pub async fn lastfm_track(client: &reqwest::Client, key: &str, artist: &str, title: &str) -> Vec<String> {
    if key.is_empty() || artist.is_empty() || title.is_empty() { return vec![]; }
    let url = format!(
        "https://ws.audioscrobbler.com/2.0/?method=track.gettoptags&autocorrect=1&format=json&api_key={}&artist={}&track={}",
        urlencoding::encode(key), urlencoding::encode(artist), urlencoding::encode(title));
    let Ok(resp) = client.get(url).header("User-Agent", UA).send().await else { return vec![] };
    let Ok(v) = resp.json::<serde_json::Value>().await else { return vec![] };
    // con pocos votos las etiquetas son ruido ("seen live", "favorites"…): se quedan las que tienen peso
    v["toptags"]["tag"].as_array().map(|t| t.iter()
        .filter(|x| x["count"].as_i64().unwrap_or(0) >= 5)
        .filter_map(|x| x["name"].as_str().map(String::from)).take(10).collect()).unwrap_or_default()
}
