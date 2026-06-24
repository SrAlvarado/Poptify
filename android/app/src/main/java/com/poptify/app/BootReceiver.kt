package com.poptify.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restart the lock-screen service after a reboot. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && Spotify.isAuthed(context)) {
            LockService.start(context)
        }
    }
}
