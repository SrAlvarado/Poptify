package com.poptify.app

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope

/** Shown on top of the lock screen (setShowWhenLocked) when the screen turns on. */
class LockScreenActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private lateinit var player: WebPlayer

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        web = WebView(this)
        setContentView(web)
        player = WebPlayer(this, web, lifecycleScope) {
            // not connected: send the user to the main app to log in
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        player.attach()
    }

    override fun onResume() { super.onResume(); player.startPolling() }
    override fun onPause() { super.onPause(); player.stopPolling() }
}
