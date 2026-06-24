package com.poptify.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder

/**
 * Foreground service that listens for SCREEN_ON (must be registered at runtime)
 * and, while logged in, raises the lock-screen now-playing UI via a full-screen
 * intent notification — the sanctioned way to show an Activity over the keyguard.
 */
class LockService : Service() {

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (intent.action == Intent.ACTION_SCREEN_ON && Spotify.isAuthed(ctx)) {
                showLockScreen()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannels()
        startForeground(FGS_ID, ongoingNotification())
        registerReceiver(screenReceiver, IntentFilter(Intent.ACTION_SCREEN_ON))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun showLockScreen() {
        val intent = Intent(this, LockScreenActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(
            this, 1, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notif = Notification.Builder(this, LOCK_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Poptify")
            .setContentText("Reproduciendo ahora")
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setFullScreenIntent(pi, true)
            .setAutoCancel(true)
            .build()
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(LOCK_NOTIF_ID, notif)
        // best-effort direct launch as well (some OEMs allow it from a FGS)
        try { startActivity(intent) } catch (_: Exception) {}
    }

    private fun ongoingNotification(): Notification =
        Notification.Builder(this, FGS_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Poptify activo")
            .setContentText("Mostrará la canción al encender la pantalla")
            .setOngoing(true)
            .build()

    private fun createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(FGS_CHANNEL, "Servicio Poptify", NotificationManager.IMPORTANCE_LOW)
            )
            nm.createNotificationChannel(
                NotificationChannel(LOCK_CHANNEL, "Pantalla de bloqueo", NotificationManager.IMPORTANCE_HIGH)
            )
        }
    }

    companion object {
        private const val FGS_CHANNEL = "poptify_fgs"
        private const val LOCK_CHANNEL = "poptify_lock"
        private const val FGS_ID = 1001
        private const val LOCK_NOTIF_ID = 1002

        fun start(ctx: Context) {
            val i = Intent(ctx, LockService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i)
            else ctx.startService(i)
        }
    }
}
