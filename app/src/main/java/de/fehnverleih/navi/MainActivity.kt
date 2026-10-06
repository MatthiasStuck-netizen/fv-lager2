package de.fehnverleih.navi

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.location.Location
import android.media.AudioAttributes
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Base64
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Fehnverleih Navi – Rahmen der App.
 * Die Oberflaeche liegt als Webseite in der App (assets/www) und laeuft in einem WebView.
 * Diese Klasse liefert ihr alles, was nur Android kann: Standort, Sprachansage, Kamera, Speicher, Internet.
 */
class MainActivity : ComponentActivity() {

    companion object {
        const val START = "https://appassets.androidplatform.net/assets/www/index.html"
        const val KENNUNG = "FehnverleihNavi/3.0 (Android; +https://www.fehnverleih.de)"
    }

    private lateinit var web: WebView
    private val netz = Executors.newFixedThreadPool(4)
    private val arbeit = Executors.newSingleThreadExecutor()
    private var tts: TextToSpeech? = null
    private var ttsBereit = false
    private var ansageNr = 0
    private var scanId: String? = null
    private var fotoId: String? = null
    private var fotoDatei: File? = null
    private var nachErlaubnis: (() -> Unit)? = null
    private var seiteBereit = false

    private val scanStarter = registerForActivityResult(ScanContract()) { ergebnis ->
        val id = scanId
        scanId = null
        if (id != null) {
            val text = ergebnis.contents
            if (text != null) antwort("ok", id, text) else antwort("fehler", id, "abgebrochen")
        }
    }

    private val fotoStarter = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val id = fotoId
        val datei = fotoDatei
        fotoId = null
        if (id != null) {
            if (ok && datei != null && datei.exists()) {
                arbeit.execute {
                    try {
                        antwort("ok", id, fotoVerkleinern(datei))
                    } catch (e: Throwable) {
                        antwort("fehler", id, "Das Foto konnte nicht gelesen werden.")
                    }
                    datei.delete()
                }
            } else {
                antwort("fehler", id, "abgebrochen")
            }
        }
    }

    private val erlaubnisStarter = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        val f = nachErlaubnis
        nachErlaubnis = null
        f?.invoke()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.rgb(6, 9, 13)
        window.navigationBarColor = Color.rgb(6, 9, 13)

        val rahmen = FrameLayout(this)
        rahmen.setBackgroundColor(Color.rgb(6, 9, 13))
        web = WebView(this)
        web.setBackgroundColor(Color.rgb(6, 9, 13))
        rahmen.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(rahmen)

        // Platz fuer Statusleiste, Navigationsleiste und Tastatur freihalten
        ViewCompat.setOnApplyWindowInsetsListener(rahmen) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        WindowInsetsControllerCompat(window, rahmen).isAppearanceLightStatusBars = false

        val lader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        val e = web.settings
        e.javaScriptEnabled = true
        e.domStorageEnabled = true
        e.mediaPlaybackRequiresUserGesture = false
        e.allowFileAccess = false
        e.allowContentAccess = false
        e.textZoom = 100
        e.userAgentString = e.userAgentString + " " + KENNUNG
        web.overScrollMode = WebView.OVER_SCROLL_NEVER
        web.isVerticalScrollBarEnabled = false
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return lader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == "appassets.androidplatform.net") return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                seiteBereit = true
                autoAuftragUebergeben()
            }
        }
        web.addJavascriptInterface(Bruecke(), "FVNative")
        web.loadUrl(START)

        FahrtDienst.hoerer = { ort -> ortSenden(ort) }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(window.FV&&FV.app&&FV.app.zurueck)?FV.app.zurueck():false") { r ->
                    if (r != "true") moveTaskToBack(true)
                }
            }
        })

        tts = TextToSpeech(applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                try {
                    tts?.language = Locale.GERMANY
                    tts?.setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    ttsBereit = true
                } catch (_: Exception) {
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        if (seiteBereit) {
            js("FV._nativ('sichtbar','',true)")
            autoAuftragUebergeben()
        }
    }

    override fun onDestroy() {
        FahrtDienst.hoerer = null
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {
        }
        netz.shutdownNow()
        arbeit.shutdownNow()
        if (isFinishing) stopService(Intent(this, FahrtDienst::class.java))
        web.destroy()
        super.onDestroy()
    }

    /* ---------- Hilfen ---------- */

    private fun js(code: String) {
        web.post {
            try {
                web.evaluateJavascript(code, null)
            } catch (_: Exception) {
            }
        }
    }

    private fun q(text: String): String = JSONObject.quote(text)

    private fun antwort(typ: String, id: String, wert: String) {
        js("FV._nativ(" + q(typ) + "," + q(id) + "," + q(wert) + ")")
    }

    private fun ortSenden(o: Location) {
        val j = JSONObject()
        j.put("lat", o.latitude)
        j.put("lon", o.longitude)
        j.put("genau", if (o.hasAccuracy()) o.accuracy.toDouble() else 999.0)
        j.put("tempo", if (o.hasSpeed()) o.speed.toDouble() else -1.0)
        j.put("kurs", if (o.hasBearing() && o.hasSpeed() && o.speed > 1.0f) o.bearing.toDouble() else -1.0)
        j.put("zeit", System.currentTimeMillis())
        js("FV._nativ('ort','',$j)")
    }

    private fun erlaubt(name: String): Boolean =
        ContextCompat.checkSelfPermission(this, name) == PackageManager.PERMISSION_GRANTED

    /** Fragt fehlende Erlaubnisse ab und fuehrt danach [dann] aus (auch wenn abgelehnt wurde). */
    private fun mitErlaubnis(namen: List<String>, dann: () -> Unit) {
        val fehlt = namen.filter { !erlaubt(it) }
        if (fehlt.isEmpty()) {
            dann()
            return
        }
        nachErlaubnis = dann
        try {
            erlaubnisStarter.launch(fehlt.toTypedArray())
        } catch (_: Exception) {
            nachErlaubnis = null
            dann()
        }
    }

    private fun dienstStarten() {
        if (!erlaubt(Manifest.permission.ACCESS_FINE_LOCATION) && !erlaubt(Manifest.permission.ACCESS_COARSE_LOCATION)) return
        try {
            ContextCompat.startForegroundService(this, Intent(this, FahrtDienst::class.java))
        } catch (_: Exception) {
        }
    }

    /** Auftrag, der auf dem Autobildschirm (Android Auto) angetippt wurde, an die Oberflaeche geben */
    private fun autoAuftragUebergeben() {
        val p = getSharedPreferences(Server.PREFS, MODE_PRIVATE)
        val id = p.getString("auto_auftrag", "") ?: ""
        if (id.isNotEmpty()) {
            p.edit().remove("auto_auftrag").apply()
            js("if(window.FV&&FV.app&&FV.app.autoAuftrag)FV.app.autoAuftrag(" + q(id) + ")")
        }
    }

    private fun fotoVerkleinern(datei: File): String {
        val masse = BitmapFactory.Options()
        masse.inJustDecodeBounds = true
        BitmapFactory.decodeFile(datei.absolutePath, masse)
        var teiler = 1
        while (masse.outWidth / (teiler * 2) >= 1700 || masse.outHeight / (teiler * 2) >= 1700) teiler *= 2
        val o = BitmapFactory.Options()
        o.inSampleSize = teiler
        var bild: Bitmap = BitmapFactory.decodeFile(datei.absolutePath, o) ?: throw IllegalStateException("leer")
        val drehung = try {
            when (ExifInterface(datei.absolutePath).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } catch (_: Exception) {
            0f
        }
        val lang = maxOf(bild.width, bild.height)
        val faktor = if (lang > 1700) 1700f / lang else 1f
        if (drehung != 0f || faktor < 1f) {
            val m = Matrix()
            m.postScale(faktor, faktor)
            m.postRotate(drehung)
            bild = Bitmap.createBitmap(bild, 0, 0, bild.width, bild.height, m, true)
        }
        val aus = ByteArrayOutputStream()
        bild.compress(Bitmap.CompressFormat.JPEG, 78, aus)
        return Base64.encodeToString(aus.toByteArray(), Base64.NO_WRAP)
    }

    /* ---------- Was die Oberflaeche aufrufen kann (window.FVNative) ---------- */

    inner class Bruecke {

        @JavascriptInterface
        fun http(id: String, methode: String, adresse: String, kopf: String, daten: String, zeit: Int) {
            netz.execute {
                var c: HttpURLConnection? = null
                try {
                    c = URL(adresse).openConnection() as HttpURLConnection
                    c.requestMethod = methode
                    c.connectTimeout = minOf(zeit, 15000)
                    c.readTimeout = zeit
                    c.useCaches = false
                    c.setRequestProperty("User-Agent", KENNUNG)
                    c.setRequestProperty("Accept-Language", "de")
                    val k = JSONObject(if (kopf.isEmpty()) "{}" else kopf)
                    for (name in k.keys()) c.setRequestProperty(name, k.getString(name))
                    if (methode != "GET" && daten.isNotEmpty()) {
                        c.doOutput = true
                        val b = daten.toByteArray(Charsets.UTF_8)
                        c.setFixedLengthStreamingMode(b.size)
                        c.outputStream.use { it.write(b) }
                    }
                    val code = c.responseCode
                    val strom = if (code >= 400) c.errorStream else c.inputStream
                    val text = strom?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                    js("FV._nativ('http'," + q(id) + "," + code + "," + q(text) + ")")
                } catch (e: java.net.SocketTimeoutException) {
                    antwort("fehler", id, "Zeitüberschreitung")
                } catch (e: Throwable) {
                    antwort("fehler", id, "Keine Verbindung")
                } finally {
                    c?.disconnect()
                }
            }
        }

        @JavascriptInterface
        fun lesen(schluessel: String): String =
            getSharedPreferences("fv_daten", MODE_PRIVATE).getString(schluessel, "") ?: ""

        @JavascriptInterface
        fun schreiben(schluessel: String, wert: String) {
            val e = getSharedPreferences("fv_daten", MODE_PRIVATE).edit()
            if (wert.isEmpty()) e.remove(schluessel) else e.putString(schluessel, wert)
            e.apply()
        }

        @JavascriptInterface
        fun anmeldung(): String {
            val p = getSharedPreferences(Server.PREFS, MODE_PRIVATE)
            val j = JSONObject()
            j.put("token", p.getString("token", "") ?: "")
            j.put("rolle", p.getString("rolle", "") ?: "")
            j.put("name", p.getString("name", "") ?: "")
            return j.toString()
        }

        @JavascriptInterface
        fun anmeldungSetzen(token: String, rolle: String, name: String) {
            getSharedPreferences(Server.PREFS, MODE_PRIVATE).edit()
                .putString("token", token).putString("rolle", rolle).putString("name", name).apply()
        }

        @JavascriptInterface
        fun ortStart() {
            runOnUiThread {
                val namen = ArrayList<String>()
                namen.add(Manifest.permission.ACCESS_FINE_LOCATION)
                namen.add(Manifest.permission.ACCESS_COARSE_LOCATION)
                if (Build.VERSION.SDK_INT >= 33) namen.add(Manifest.permission.POST_NOTIFICATIONS)
                if (FahrtDienst.laeuft) {
                    FahrtDienst.letzter?.let { ortSenden(it) }
                } else {
                    mitErlaubnis(namen) { dienstStarten() }
                }
            }
        }

        @JavascriptInterface
        fun ortStopp() {
            // Der Dienst laeuft weiter, damit die Kilometer bis „Ziel erreicht“ gezaehlt werden.
        }

        @JavascriptInterface
        fun zaehler(): String {
            val j = JSONObject()
            j.put("meter", FahrtDienst.meter(this@MainActivity))
            j.put("laeuft", FahrtDienst.laeuft)
            return j.toString()
        }

        @JavascriptInterface
        fun zaehlerNull() {
            FahrtDienst.nullen(this@MainActivity)
        }

        @JavascriptInterface
        fun sprich(text: String) {
            if (!ttsBereit) return
            try {
                tts?.speak(text, TextToSpeech.QUEUE_ADD, null, "fv" + (++ansageNr))
            } catch (_: Exception) {
            }
        }

        @JavascriptInterface
        fun still() {
            try {
                tts?.stop()
            } catch (_: Exception) {
            }
        }

        @JavascriptInterface
        fun wach(an: Boolean) {
            runOnUiThread {
                if (an) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }

        @JavascriptInterface
        fun vollbild(an: Boolean) {
            runOnUiThread {
                val c = WindowInsetsControllerCompat(window, window.decorView)
                if (an) {
                    c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    c.hide(WindowInsetsCompat.Type.systemBars())
                } else {
                    c.show(WindowInsetsCompat.Type.systemBars())
                }
            }
        }

        @JavascriptInterface
        fun kartenApp(ziel: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(ziel))))
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun anrufen(nummer: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(nummer))))
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun oeffnen(adresse: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(adresse)))
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun appStarten(paket: String, ersatz: String): Boolean {
            val start = packageManager.getLaunchIntentForPackage(paket)
            runOnUiThread {
                try {
                    if (start != null) startActivity(start)
                    else if (ersatz.isNotEmpty()) startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ersatz)))
                } catch (_: Exception) {
                }
            }
            return start != null
        }

        @JavascriptInterface
        fun scan(id: String) {
            runOnUiThread {
                mitErlaubnis(listOf(Manifest.permission.CAMERA)) {
                    if (!erlaubt(Manifest.permission.CAMERA)) {
                        antwort("fehler", id, "Die Kamera wurde nicht erlaubt.")
                    } else {
                        try {
                            scanId = id
                            val o = ScanOptions()
                            o.setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                            o.setPrompt("Ausweis vor die Kamera halten")
                            o.setBeepEnabled(false)
                            o.setOrientationLocked(false)
                            scanStarter.launch(o)
                        } catch (e: Exception) {
                            scanId = null
                            antwort("fehler", id, "Der Scanner konnte nicht gestartet werden.")
                        }
                    }
                }
            }
        }

        @JavascriptInterface
        fun foto(id: String) {
            runOnUiThread {
                mitErlaubnis(listOf(Manifest.permission.CAMERA)) {
                    if (!erlaubt(Manifest.permission.CAMERA)) {
                        antwort("fehler", id, "Die Kamera wurde nicht erlaubt.")
                    } else {
                        try {
                            val ordner = File(cacheDir, "belege")
                            ordner.mkdirs()
                            val datei = File(ordner, "beleg-" + System.currentTimeMillis() + ".jpg")
                            fotoDatei = datei
                            fotoId = id
                            fotoStarter.launch(FileProvider.getUriForFile(this@MainActivity, "$packageName.dateien", datei))
                        } catch (e: Exception) {
                            fotoId = null
                            antwort("fehler", id, "Die Kamera konnte nicht gestartet werden.")
                        }
                    }
                }
            }
        }

        @JavascriptInterface
        fun info(): String {
            val j = JSONObject()
            val version = try {
                packageManager.getPackageInfo(packageName, 0).versionName ?: ""
            } catch (_: Exception) {
                ""
            }
            j.put("version", version)
            j.put("geraet", (Build.MANUFACTURER + " " + Build.MODEL).trim())
            return j.toString()
        }
    }
}
