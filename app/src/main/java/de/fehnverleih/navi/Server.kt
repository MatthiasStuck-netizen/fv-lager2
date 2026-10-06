package de.fehnverleih.navi

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Server-Verbindung fuer Android Auto. Die Anmeldung teilt sich das Auto mit der Handy-Oberflaeche. */
object Server {
    const val URL = "https://www.fehnverleih.de/?lagerapp"
    const val PREFS = "fehnverleih_navi"
    private const val KEY_TOKEN = "token"

    fun token(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TOKEN, "") ?: ""

    fun loggedIn(context: Context): Boolean = token(context).isNotBlank()

    /** Ruft eine Aktion mit dem gespeicherten Token auf. */
    fun api(context: Context, action: String): JSONObject =
        post(JSONObject().apply {
            put("aktion", action)
            put("token", token(context))
        })

    fun post(payload: JSONObject): JSONObject {
        val conn = (URL(URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", MainActivity.KENNUNG)
        }
        conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
        conn.disconnect()
        if (body.isBlank()) throw IllegalStateException("Leere Serverantwort ($code).")
        return JSONObject(body)
    }
}
