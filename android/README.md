# 📱 Poptify Android (lock-screen now-playing)

App Android nativa (Kotlin) que muestra lo que suena en Spotify con la estética de Poptify
(**fondo difuminado** de la portada), **sobre la pantalla de bloqueo** al encender la pantalla,
y también como app a pantalla completa. La UI es la web de Poptify cargada en un `WebView`.

> ⚠️ Android **no permite** reestilizar el popup de medios del sistema ni dibujar overlays
> sobre el lock screen. La vía usada aquí es una **Activity `setShowWhenLocked`** lanzada por
> un servicio en primer plano cuando enciendes la pantalla (mecanismo legítimo, el mismo que
> usan apps de alarma/llamada). En fabricantes agresivos (Honor/Xiaomi/Huawei) requiere
> permitir autoarranque y quitar la optimización de batería (ver abajo).

## Cómo se controla / de dónde saca los datos
- **Spotify Web API** con OAuth **PKCE**. Redirect por deep link `poptify://callback`.
- Controlar la reproducción (play/pausa/siguiente/seek/like) requiere **Spotify Premium** y que
  Spotify esté activo en el teléfono (es el "device" de Spotify Connect).

## Configurar Spotify
En <https://developer.spotify.com/dashboard>, en tu app, añade el Redirect URI:
```
poptify://callback
```
El Client ID se compila dentro del APK (se toma del que ya usas en escritorio). Es un client
**público** (PKCE, sin secreto), por eso puede ir embebido.

## Compilar el APK
Requiere JDK 17 + Android SDK (no hace falta Android Studio):
```bash
cd android
JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
./gradlew assembleDebug
```
APK resultante: `android/app/build/outputs/apk/debug/app-debug.apk`

## Instalar en el móvil
- **Por cable (adb)**: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- **Sin cable**: copia el `.apk` al teléfono (USB/Drive), ábrelo y permite "instalar apps de
  origen desconocido".

## Ajustes necesarios en Honor / MagicOS (¡importante!)
Sin esto, no aparecerá al encender la pantalla porque el sistema mata el servicio:
1. **Ajustes → Apps → Poptify → Batería → permitir actividad en segundo plano / "no optimizar"**.
2. **Inicio automático**: actívalo para Poptify (Gestor de teléfono / Ajustes de inicio).
3. **Bloquear en recientes**: abre Poptify, en la vista de apps recientes "bloquéala" (candado).
4. Concede **notificaciones** y, si lo pide, **pantalla completa** (USE_FULL_SCREEN_INTENT).
5. La primera vez, **conéctate a Spotify** abriendo la app (botón "Conectar con Spotify").

## Estado / limitaciones
- v0: funciona abrir la app y ver el now-playing; el lanzamiento sobre el bloqueo depende de
  los permisos del fabricante (full-screen intent / autoarranque).
- No hay letras ni Hydra aquí (es la versión "lock screen" enfocada al fondo difuminado).
