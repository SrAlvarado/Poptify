package com.poptify.app

import android.content.Context
import android.net.Uri
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom

/** Spotify Web API + OAuth (Authorization Code with PKCE). */
object Spotify {
    private const val SCOPES =
        "user-read-currently-playing user-read-playback-state user-modify-playback-state user-library-read user-library-modify"
    private const val AUTH = "https://accounts.spotify.com/authorize"
    private const val TOKEN = "https://accounts.spotify.com/api/token"
    private const val API = "https://api.spotify.com/v1"

    private val http = OkHttpClient()
    @Volatile var lastTrackId: String? = null
        private set

    private fun prefs(c: Context) = c.getSharedPreferences("poptify", Context.MODE_PRIVATE)
    private fun clientId() = BuildConfig.SPOTIFY_CLIENT_ID
    private fun redirect() = BuildConfig.REDIRECT_URI

    fun isAuthed(c: Context): Boolean = !prefs(c).getString("refresh", null).isNullOrEmpty()

    // ---------- PKCE ----------
    private fun randomVerifier(): String {
        val bytes = ByteArray(48); SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }
    private fun challenge(verifier: String): String {
        val d = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())
        return Base64.encodeToString(d, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    fun buildAuthUrl(c: Context): String {
        val verifier = randomVerifier()
        prefs(c).edit().putString("verifier", verifier).apply()
        return Uri.parse(AUTH).buildUpon()
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("client_id", clientId())
            .appendQueryParameter("scope", SCOPES)
            .appendQueryParameter("redirect_uri", redirect())
            .appendQueryParameter("code_challenge_method", "S256")
            .appendQueryParameter("code_challenge", challenge(verifier))
            .build().toString()
    }

    suspend fun handleRedirect(c: Context, uri: Uri): Boolean = withContext(Dispatchers.IO) {
        val code = uri.getQueryParameter("code") ?: return@withContext false
        val verifier = prefs(c).getString("verifier", null) ?: return@withContext false
        val body = FormBody.Builder()
            .add("grant_type", "authorization_code")
            .add("code", code)
            .add("redirect_uri", redirect())
            .add("client_id", clientId())
            .add("code_verifier", verifier)
            .build()
        val resp = http.newCall(Request.Builder().url(TOKEN).post(body).build()).execute()
        resp.use {
            if (!it.isSuccessful) return@withContext false
            val j = JSONObject(it.body!!.string())
            saveTokens(c, j)
        }
        true
    }

    private fun saveTokens(c: Context, j: JSONObject) {
        val e = prefs(c).edit()
        e.putString("access", j.getString("access_token"))
        if (j.has("refresh_token")) e.putString("refresh", j.getString("refresh_token"))
        e.putLong("expires_at", System.currentTimeMillis() / 1000 + j.getLong("expires_in"))
        e.apply()
    }

    fun logout(c: Context) { prefs(c).edit().clear().apply(); lastTrackId = null }

    private suspend fun ensureToken(c: Context): String? = withContext(Dispatchers.IO) {
        val p = prefs(c)
        val exp = p.getLong("expires_at", 0)
        val access = p.getString("access", null)
        if (access != null && System.currentTimeMillis() / 1000 < exp - 30) return@withContext access
        val refresh = p.getString("refresh", null) ?: return@withContext null
        val body = FormBody.Builder()
            .add("grant_type", "refresh_token")
            .add("refresh_token", refresh)
            .add("client_id", clientId())
            .build()
        val resp = http.newCall(Request.Builder().url(TOKEN).post(body).build()).execute()
        resp.use {
            if (!it.isSuccessful) return@withContext null
            val j = JSONObject(it.body!!.string())
            saveTokens(c, j)
            j.getString("access_token")
        }
    }

    // ---------- now playing ----------
    /** Returns a JSON string for the WebView, or "{}" when nothing is playing. */
    suspend fun nowPlayingJson(c: Context): String = withContext(Dispatchers.IO) {
        val token = ensureToken(c) ?: return@withContext "{}"
        val resp = http.newCall(
            Request.Builder().url("$API/me/player/currently-playing").header("Authorization", "Bearer $token").build()
        ).execute()
        resp.use {
            if (it.code == 204 || !it.isSuccessful) return@withContext "{}"
            val v = JSONObject(it.body!!.string())
            val item = v.optJSONObject("item") ?: return@withContext "{}"
            val id = item.optString("id")
            lastTrackId = id
            val artists = item.optJSONArray("artists")
            val artist = buildString {
                if (artists != null) for (i in 0 until artists.length()) {
                    if (i > 0) append(", "); append(artists.getJSONObject(i).optString("name"))
                }
            }
            val images = item.optJSONObject("album")?.optJSONArray("images")
            val image = if (images != null && images.length() > 0) images.getJSONObject(0).optString("url") else ""
            val liked = isSaved(token, id)
            val (c1, c2) = colorsFor(image, id)
            val track = JSONObject()
                .put("title", item.optString("name"))
                .put("artist", artist)
                .put("image", image)
                .put("durMs", item.optLong("duration_ms"))
                .put("posMs", v.optLong("progress_ms"))
                .put("isPlaying", v.optBoolean("is_playing"))
                .put("liked", liked)
                .put("c1", c1)
                .put("c2", c2)
            JSONObject().put("track", track).toString()
        }
    }

    // dominant colors from the album art (via Palette) — reactive background, cached per track
    private val colorCache = java.util.concurrent.ConcurrentHashMap<String, Pair<String, String>>()
    private fun hex(c: Int) = String.format("#%06X", 0xFFFFFF and c)
    private fun colorsFor(url: String, id: String): Pair<String, String> {
        val def = Pair("#8b2bff", "#00e5ff")
        colorCache[id]?.let { return it }
        if (url.isEmpty()) return def
        return try {
            http.newCall(Request.Builder().url(url).build()).execute().use { r ->
                val bytes = r.body?.bytes() ?: return def
                val opts = android.graphics.BitmapFactory.Options().apply { inSampleSize = 4 }
                val bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts) ?: return def
                val p = androidx.palette.graphics.Palette.from(bmp).generate()
                val c1 = p.getVibrantColor(p.getLightVibrantColor(0xFF8B2BFF.toInt()))
                val c2 = p.getDarkVibrantColor(p.getMutedColor(0xFF00E5FF.toInt()))
                val res = Pair(hex(c1), hex(c2))
                colorCache[id] = res
                res
            }
        } catch (e: Exception) { def }
    }

    private fun isSaved(token: String, id: String): Boolean {
        if (id.isEmpty()) return false
        return try {
            http.newCall(
                Request.Builder().url("$API/me/tracks/contains?ids=$id").header("Authorization", "Bearer $token").build()
            ).execute().use { r ->
                if (!r.isSuccessful) false
                else org.json.JSONArray(r.body!!.string()).optBoolean(0, false)
            }
        } catch (e: Exception) { false }
    }

    // ---------- controls ----------
    private suspend fun command(c: Context, method: String, path: String): Boolean = withContext(Dispatchers.IO) {
        val token = ensureToken(c) ?: return@withContext false
        val empty = okhttp3.RequestBody.create(null, ByteArray(0))
        val b = Request.Builder().url("$API$path").header("Authorization", "Bearer $token")
        when (method) {
            "PUT" -> b.put(empty); "POST" -> b.post(empty); "DELETE" -> b.delete(empty)
        }
        try { http.newCall(b.build()).execute().use { it.isSuccessful || it.code == 204 || it.code == 202 } }
        catch (e: Exception) { false }
    }

    suspend fun setPlaying(c: Context, play: Boolean) =
        command(c, "PUT", if (play) "/me/player/play" else "/me/player/pause")
    suspend fun next(c: Context) = command(c, "POST", "/me/player/next")
    suspend fun prev(c: Context) = command(c, "POST", "/me/player/previous")
    suspend fun seek(c: Context, ms: Long) = command(c, "PUT", "/me/player/seek?position_ms=$ms")
    suspend fun setLike(c: Context, id: String, liked: Boolean) =
        command(c, if (liked) "PUT" else "DELETE", "/me/tracks?ids=$id")
}
