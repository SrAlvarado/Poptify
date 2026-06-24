package com.poptify.app

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private lateinit var player: WebPlayer

    private val notifPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        player = WebPlayer(this, web, lifecycleScope) { startAuth() }
        player.attach()

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) notifPerm.launch(android.Manifest.permission.POST_NOTIFICATIONS)

        LockService.start(this)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        if (data.scheme == "poptify") {
            lifecycleScope.launch {
                if (Spotify.handleRedirect(this@MainActivity, data)) {
                    web.evaluateJavascript("window.poptifyAuth && window.poptifyAuth(true)", null)
                    player.startPolling()
                }
            }
        }
    }

    private fun startAuth() {
        val url = Spotify.buildAuthUrl(this)
        try {
            CustomTabsIntent.Builder().build().launchUrl(this, Uri.parse(url))
        } catch (e: Exception) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    override fun onResume() { super.onResume(); player.startPolling() }
    override fun onPause() { super.onPause(); player.stopPolling() }
}
