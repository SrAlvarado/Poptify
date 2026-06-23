# 🎵 Poptify

Un popup flotante para macOS que muestra lo que suena **ahora mismo** en Spotify, con
estética de **pantalla de bloqueo de iOS**, fondo reactivo al color de la portada, y
varios "displays" (iOS, iPod, Game Boy, PSP, MP4, Vinilo, Notch). La ventana es flotante,
sin marco, transparente, siempre encima y **se arrastra desde cualquier punto**.

- App de escritorio con **Tauri v2** (ventana Rust + frontend web).
- Autenticación **OAuth 2.0 con PKCE** (sin client secret) contra la Spotify Web API.
- Diseño y skins en `src/` (ver también el prototipo en `design/prototype.html`).

> ⚠️ Controlar la reproducción (play/pausa/siguiente/anterior/seek) requiere **Spotify Premium**.
> Ver la canción y marcar favoritos funciona también con cuenta gratuita.

## 1. Requisitos

- macOS, **Node 18+** y **Rust** (`rustup`).
- En la primera compilación, Tauri descarga muchas dependencias (tarda unos minutos).

## 2. Crear una app en Spotify Developer

1. Entra en <https://developer.spotify.com/dashboard> y crea una app.
2. Copia el **Client ID**.
3. En *Edit settings → Redirect URIs* añade **exactamente**:
   ```
   http://127.0.0.1:14528/callback
   ```
4. Guarda.

## 3. Instalar y ejecutar

```bash
npm install
npm run tauri dev
```

La primera vez, la app te pedirá el **Client ID** (se guarda en el directorio de
configuración de la app). También puedes fijarlo por variable de entorno:

```bash
POPTIFY_SPOTIFY_CLIENT_ID=tu_client_id npm run tauri dev
```

Pulsa **Conectar con Spotify**, autoriza en el navegador, y el popup empezará a mostrar
la canción en curso.

## 4. Compilar la app

```bash
npm run tauri build
```

## Estructura

```
index.html            # entrada del frontend (Vite)
src/
  main.js             # lógica del popup: skins, ajustes, drag, polling a Spotify
  styles.css          # estilos de todas las skins (ventana transparente)
src-tauri/
  src/lib.rs          # estado + comandos Tauri (auth, now_playing, controles)
  src/spotify.rs      # OAuth PKCE + llamadas a la Web API + servidor loopback
  tauri.conf.json     # ventana flotante/transparente/always-on-top
  capabilities/       # permisos (start-dragging, opener, etc.)
design/
  prototype.html      # prototipo de diseño (sin backend) para iterar skins
```

## Comandos del backend (IPC)

| Comando        | Qué hace                                            |
|----------------|-----------------------------------------------------|
| `has_client_id`| ¿Hay Client ID configurado?                         |
| `set_client_id`| Guarda el Client ID                                 |
| `auth_status`  | ¿Sesión iniciada?                                   |
| `login`        | Flujo OAuth PKCE (abre navegador + loopback)        |
| `logout`       | Borra los tokens                                    |
| `now_playing`  | Canción actual + portada (data URL) + liked         |
| `set_playing`  | Play / pausa                                         |
| `next_track` / `prev_track` | Siguiente / anterior                   |
| `seek`         | Saltar a una posición (ms)                          |
| `set_like`     | Añadir / quitar de favoritos                         |

## Limitaciones conocidas

- **Letra** y **vídeo** son placeholders: la API pública de Spotify no expone letras ni
  vídeo/canvas. Se integrarían con un proveedor externo de letras más adelante.
- La skin **Notch** se ancla arriba de la ventana; para pegarla al notch físico del Mac,
  arrastra la ventana al borde superior de la pantalla.
