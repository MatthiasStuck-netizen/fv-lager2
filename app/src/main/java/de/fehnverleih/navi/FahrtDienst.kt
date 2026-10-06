package de.fehnverleih.navi

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper

/**
 * Laeuft im Vordergrund, solange die App offen ist: liefert den Standort und zaehlt die gefahrenen
 * Kilometer – auch wenn der Bildschirm aus ist. Oben am Handy steht dabei „Fahrt wird aufgezeichnet“.
 */
class FahrtDienst : Service(), LocationListener {

    companion object {
        private const val KANAL = "fahrt"
        private const val PREFS = "fv_fahrt"

        @Volatile
        var hoerer: ((Location) -> Unit)? = null

        @Volatile
        var laeuft = false

        @Volatile
        var letzter: Location? = null

        @Volatile
        private var meter = -1.0

        @Volatile
        private var anker: Location? = null

        fun meter(c: Context): Double {
            if (meter < 0) meter = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getFloat("meter", 0f).toDouble()
            return meter
        }

        fun nullen(c: Context) {
            meter = 0.0
            anker = letzter
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putFloat("meter", 0f).apply()
        }
    }

    private var ungespeichert = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        meter(this)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val k = NotificationChannel(KANAL, "Fahrt", NotificationManager.IMPORTANCE_LOW)
            k.description = "Zeigt an, dass die Fahrt aufgezeichnet wird"
            k.setShowBadge(false)
            nm.createNotificationChannel(k)
        }
        val oeffnen = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val hinweis: Notification = Notification.Builder(this, KANAL)
            .setSmallIcon(R.drawable.ic_fahrt)
            .setContentTitle("Fehnverleih Navi")
            .setContentText("Fahrt wird aufgezeichnet")
            .setOngoing(true)
            .setContentIntent(oeffnen)
            .build()
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(1, hinweis, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            else startForeground(1, hinweis)
        } catch (e: Exception) {
            stopSelf()
            return
        }
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            if (lm.allProviders.contains(LocationManager.GPS_PROVIDER)) lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
        } catch (_: SecurityException) {
        } catch (_: Exception) {
        }
        try {
            if (lm.allProviders.contains(LocationManager.NETWORK_PROVIDER)) lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000L, 0f, this, Looper.getMainLooper())
        } catch (_: SecurityException) {
        } catch (_: Exception) {
        }
        try {
            val alt = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER) ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            if (alt != null && System.currentTimeMillis() - alt.time < 120000) {
                letzter = alt
                hoerer?.invoke(alt)
            }
        } catch (_: SecurityException) {
        } catch (_: Exception) {
        }
        laeuft = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onTaskRemoved(rootIntent: Intent?) {
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        laeuft = false
        try {
            (getSystemService(Context.LOCATION_SERVICE) as LocationManager).removeUpdates(this)
        } catch (_: Exception) {
        }
        speichern()
        super.onDestroy()
    }

    private fun speichern() {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putFloat("meter", meter.toFloat()).apply()
        ungespeichert = 0
    }

    override fun onLocationChanged(ort: Location) {
        val gps = ort.provider == LocationManager.GPS_PROVIDER
        val alt = letzter
        // Ungenaue Netz-Positionen nicht weitergeben, solange frische GPS-Positionen da sind
        if (!gps && alt != null && alt.provider == LocationManager.GPS_PROVIDER && ort.time - alt.time < 10000) return
        letzter = ort
        if (gps && ort.hasAccuracy() && ort.accuracy <= 30f) {
            val a = anker
            if (a == null) {
                anker = ort
            } else {
                val d = a.distanceTo(ort)
                val schwelle = maxOf(10f, ort.accuracy)
                val faehrt = !ort.hasSpeed() || ort.speed >= 1.0f
                if (d >= schwelle && faehrt && d < 5000f) {
                    if (meter < 0) meter = 0.0
                    meter += d.toDouble()
                    anker = ort
                    if (++ungespeichert >= 15) speichern()
                } else if (d >= 5000f) {
                    anker = ort   // Sprung (z. B. nach langer Pause ohne Empfang): nicht mitzaehlen
                }
            }
        }
        hoerer?.invoke(ort)
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {
    }

    override fun onProviderEnabled(provider: String) {
    }

    override fun onProviderDisabled(provider: String) {
    }
}
