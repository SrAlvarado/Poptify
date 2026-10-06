//! Géneros de un artista para el modo Avatar cuando Spotify no los da
//! (las apps en modo desarrollo reciben `genres: []`). Dos fuentes públicas, sin clave:
//!   1. MusicBrainz: etiquetas del artista (finas: trap, drill, reggaeton…)
//!   2. Deezer: género del álbum de la canción (más grueso, pero casi siempre existe)

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

/// Géneros de Deezer del álbum de esta canción (o de la primera canción del artista).
pub async fn deezer(client: &reqwest::Client, artist: &str, title: &str) -> Vec<String> {
    let q = if title.is_empty() { format!("artist:\"{artist}\"") } else { format!("artist:\"{artist}\" track:\"{title}\"") };
    let url = format!("https://api.deezer.com/search?q={}&limit=1", urlencoding::encode(&q));
    let Ok(resp) = client.get(url).send().await else { return vec![] };
    let Ok(v) = resp.json::<serde_json::Value>().await else { return vec![] };
    let Some(album) = v["data"][0]["album"]["id"].as_i64() else {
        // sin coincidencia exacta de canción: prueba solo con el artista
        return if title.is_empty() { vec![] } else { Box::pin(deezer(client, artist, "")).await };
    };
    let Ok(resp) = client.get(format!("https://api.deezer.com/album/{album}")).send().await else { return vec![] };
    let Ok(v) = resp.json::<serde_json::Value>().await else { return vec![] };
    v["genres"]["data"].as_array().map(|g| g.iter().filter_map(|x| x["name"].as_str().map(String::from)).collect()).unwrap_or_default()
}
