//! Ajustes en la barra de menús de macOS (icono de Chupits), como Notion o Docker.
//! La web manda el estado actual con `tray_sync` y aquí se reconstruye el menú con las opciones
//! marcadas. Cada clic se reenvía a la web como evento `tray` con el id de la opción
//! ("skin:ios", "bg:dark", "avo:rap"…); solo "Mostrar/ocultar" y "Salir" se resuelven aquí.

use serde::Deserialize;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Wry};

const TRAY_ID: &str = "poptify";

#[derive(Deserialize, Default)]
pub struct Opt {
    id: String,
    name: String,
}

/// Estado que pinta la web (sus nombres de campo vienen de main.js → syncTray)
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct TrayState {
    skins: Vec<Opt>,
    skin: String,
    bgs: Vec<Opt>,
    bg: String,
    sources: Vec<Opt>,
    source: String,
    mode: String,
    outfits: Vec<Opt>,
    outfit: String,
    dances: Vec<Opt>,
    dance: String,
    audio: bool,
    authed: bool,
    version: String,
    lastfm: bool,
}

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    let menu = build(app, &TrayState::default())?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Poptify")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, ev| on_click(app, ev.id().as_ref()))
        .build(app)?;
    Ok(())
}

fn on_click(app: &AppHandle, id: &str) {
    let win = app.get_webview_window("main");
    match id {
        "quit" => app.exit(0),
        "toggle" => {
            if let Some(w) = win {
                if w.is_visible().unwrap_or(true) { let _ = w.hide(); } else { let _ = w.show(); let _ = w.set_focus(); }
            }
            let _ = app.emit("tray", "visibility");   // la web vuelve a sincronizar el texto de la opción
        }
        _ if id.starts_with("mon:") => {
            // mover la ventana al centro de otra pantalla (plan B al arrastre, siempre funciona)
            let idx: usize = id[4..].parse().unwrap_or(0);
            if let (Some(w), Ok(mons)) = (win, app.available_monitors()) {
                if let Some(m) = mons.get(idx) {
                    let (mp, ms) = (m.position(), m.size());
                    let ws = w.outer_size().unwrap_or_default();
                    let k = m.scale_factor() / w.scale_factor().unwrap_or(1.0);   // el tamaño cambia de escala al cambiar de pantalla
                    let (ww, wh) = ((ws.width as f64 * k) as i32, (ws.height as f64 * k) as i32);
                    let x = mp.x + (ms.width as i32 - ww) / 2;
                    let y = mp.y + (ms.height as i32 - wh) / 2;
                    let _ = w.show();
                    let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
                }
            }
        }
        _ => {
            // abrir ajustes con la ventana oculta no tendría sentido: se muestra primero
            if id == "settings" { if let Some(w) = &win { let _ = w.show(); let _ = w.set_focus(); } }
            let _ = app.emit("tray", id);
        }
    }
}

/// grupo de opciones excluyentes: un submenú con la activa marcada
fn group(app: &AppHandle, title: &str, prefix: &str, opts: &[Opt], current: &str) -> tauri::Result<Submenu<Wry>> {
    let items: Vec<CheckMenuItem<Wry>> = opts.iter()
        .map(|o| CheckMenuItem::with_id(app, format!("{prefix}:{}", o.id), &o.name, true, o.id == current, None::<&str>))
        .collect::<tauri::Result<_>>()?;
    let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
    Submenu::with_items(app, title, !opts.is_empty(), &refs)
}

fn build(app: &AppHandle, s: &TrayState) -> tauri::Result<Menu<Wry>> {
    let visible = app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(true);
    let toggle = MenuItem::with_id(app, "toggle", if visible { "Ocultar Poptify" } else { "Mostrar Poptify" }, true, None::<&str>)?;
    let skins = group(app, "Display", "skin", &s.skins, &s.skin)?;
    let bgs = group(app, "Fondo", "bg", &s.bgs, &s.bg)?;
    let sources = group(app, "Fuente", "src", &s.sources, &s.source)?;
    let modes = group(app, "Modo (iOS)", "mode", &[Opt { id: "expanded".into(), name: "Expandido".into() }, Opt { id: "mini".into(), name: "Mini".into() }], &s.mode)?;
    let sep = || PredefinedMenuItem::separator(app);
    let (s1, s2, s3, s4) = (sep()?, sep()?, sep()?, sep()?);

    let avatar_on = s.skin == "avatar";
    let outfits = group(app, "Outfit de Chupits", "avo", &s.outfits, &s.outfit)?;
    let dances = group(app, "Baile de Chupits", "avd", &s.dances, &s.dance)?;
    let audio = CheckMenuItem::with_id(app, "audio", "Audio reactivo (tempo real)", true, s.audio, None::<&str>)?;

    let more = MenuItem::with_id(app, "settings", "Más ajustes…", true, None::<&str>)?;
    // "Mover a pantalla": una opción por monitor conectado
    let mons = app.available_monitors().unwrap_or_default();
    let mon_items: Vec<MenuItem<Wry>> = mons.iter().enumerate()
        .map(|(i, m)| MenuItem::with_id(app, format!("mon:{i}"), m.name().cloned().unwrap_or_else(|| format!("Pantalla {}", i + 1)), true, None::<&str>))
        .collect::<tauri::Result<_>>()?;
    let mon_refs: Vec<&dyn IsMenuItem<Wry>> = mon_items.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
    let move_to = Submenu::with_items(app, "Mover a pantalla", mons.len() > 1, &mon_refs)?;
    let lastfm = MenuItem::with_id(app, "lastfm", if s.lastfm { "Last.fm: conectado ✓" } else { "Conectar Last.fm…" }, true, None::<&str>)?;
    let lyrics = MenuItem::with_id(app, "lyrics", "Ver letra", true, None::<&str>)?;
    let update = MenuItem::with_id(app, "update", if s.version.is_empty() { "Buscar actualizaciones".to_string() } else { format!("Buscar actualizaciones (v{})", s.version) }, true, None::<&str>)?;
    let logout = MenuItem::with_id(app, "logout", "Cerrar sesión de Spotify", s.authed, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Salir de Poptify", true, Some("CmdOrCtrl+Q"))?;

    let mut items: Vec<&dyn IsMenuItem<Wry>> = vec![&toggle, &move_to, &s1, &skins, &bgs];
    if s.skin == "ios" { items.push(&modes); }
    if avatar_on { items.push(&outfits); items.push(&dances); }
    items.extend([&audio as &dyn IsMenuItem<Wry>, &lastfm, &sources, &s2, &lyrics, &more, &s3, &update, &logout, &s4, &quit]);
    Menu::with_items(app, &items)
}

/// La web avisa de su estado; se reconstruye el menú (son pocas opciones, es instantáneo)
#[tauri::command]
pub fn tray_sync(app: AppHandle, state: TrayState) -> Result<(), String> {
    let menu = build(&app, &state).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) { tray.set_menu(Some(menu)).map_err(|e| e.to_string())?; }
    Ok(())
}
