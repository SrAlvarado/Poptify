package com.poptify.app

import android.annotation.SuppressLint
import android.app.Activity
import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Wires a WebView to the Poptify web UI: JS bridge for controls + polling pushes. */
class WebPlayer(
    private val activity: Activity,
    private val web: WebView,
    private val scope: CoroutineScope,
    private val onConnect: () -> Unit,
) {
    private var pollJob: Job? = null

    @SuppressLint("SetJavaScriptEnabled")
    fun attach() {
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.setBackgroundColor(android.graphics.Color.BLACK)
        web.addJavascriptInterface(Bridge(), "AndroidBridge")
        web.loadUrl("file:///android_asset/web/index.html")
    }

    fun startPolling() {
        pollJob?.cancel()
        pollJob = scope.launch {
            while (isActive) {
                if (!Spotify.isAuthed(activity)) {
                    push("window.poptifyAuth && window.poptifyAuth(false)")
                } else {
                    val json = Spotify.nowPlayingJson(activity)
                    push("window.poptifyUpdate && window.poptifyUpdate(${JSONObject.quote(json)})")
                }
                delay(2500)
            }
        }
    }

    fun stopPolling() { pollJob?.cancel(); pollJob = null }

    private fun push(js: String) {
        web.post { web.evaluateJavascript(js, null) }
    }

    inner class Bridge {
        @JavascriptInterface fun connect() { activity.runOnUiThread { onConnect() } }
        @JavascriptInterface fun play() { scope.launch { Spotify.setPlaying(activity, true) } }
        @JavascriptInterface fun pause() { scope.launch { Spotify.setPlaying(activity, false) } }
        @JavascriptInterface fun next() { scope.launch { Spotify.next(activity) } }
        @JavascriptInterface fun prev() { scope.launch { Spotify.prev(activity) } }
        @JavascriptInterface fun seek(ms: Long) { scope.launch { Spotify.seek(activity, ms) } }
        @JavascriptInterface fun like(liked: Boolean) {
            val id = Spotify.lastTrackId ?: return
            scope.launch { Spotify.setLike(activity, id, liked) }
        }
    }
}
