package de.fehnverleih.navi

import android.text.SpannableString
import android.text.Spanned
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarColor
import androidx.car.app.model.ForegroundCarColorSpan
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/** Auftragsliste auf dem Autobildschirm (Android Auto) – naechster Auftrag oben, Uhrzeit in Fehnverleih-Gold. */
class OrdersScreen(carContext: CarContext) : Screen(carContext) {

    private val executor = Executors.newSingleThreadExecutor()
    private val gold = CarColor.createCustom(0xFFEAB94A.toInt(), 0xFFEAB94A.toInt())

    private var loading = true
    private var error: String? = null
    private var orders: JSONArray? = null

    init {
        load()
    }

    private fun load() {
        loading = true
        error = null
        invalidate()
        executor.execute {
            try {
                if (!Server.loggedIn(carContext)) {
                    error = "Bitte zuerst auf dem Handy in der Fehnverleih-Navi-App anmelden."
                } else {
                    val r = Server.api(carContext, "navi_liste")
                    when (r.optString("typ")) {
                        "ok" -> {
                            orders = heute(r.optJSONArray("auftraege") ?: JSONArray())
                            error = null
                        }
                        "abgemeldet" -> error = "Abgemeldet. Bitte auf dem Handy neu anmelden."
                        "gesperrt" -> error = r.optString("msg", "Nicht eingestempelt.")
                        else -> error = r.optString("msg", "Serverfehler")
                    }
                }
            } catch (e: Exception) {
                error = "Keine Verbindung zum Server."
            }
            loading = false
            carContext.mainExecutor.execute { invalidate() }
        }
    }

    /** Wie auf dem Handy: Lieferungen am Liefertag, ausgegebene Auftraege am Rueckgabetag; Ueberfaelliges steht bei heute. */
    private fun heute(alle: JSONArray): JSONArray {
        val tag = SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).format(Date())
        val aus = JSONArray()
        for (i in 0 until alle.length()) {
            val o = alle.getJSONObject(i)
            val raus = o.optString("status") == "ausgegeben"
            val bis = o.optString("bis", "")
            val d = if (raus && bis.isNotEmpty()) bis else o.optString("datum", tag)
            if (d <= tag) aus.put(o)
        }
        return aus
    }

    override fun onGetTemplate(): Template {
        val actionStrip = ActionStrip.Builder()
            .addAction(
                Action.Builder()
                    .setTitle("Aktualisieren")
                    .setOnClickListener { load() }
                    .build()
            )
            .build()

        if (loading) {
            return MessageTemplate.Builder("Lade Aufträge …")
                .setTitle("Fehnverleih Navi")
                .setLoading(true)
                .setHeaderAction(Action.APP_ICON)
                .build()
        }

        error?.let {
            return MessageTemplate.Builder(it)
                .setTitle("Fehnverleih Navi")
                .setHeaderAction(Action.APP_ICON)
                .setActionStrip(actionStrip)
                .build()
        }

        val arr = orders ?: JSONArray()
        val listBuilder = ItemList.Builder()
        if (arr.length() == 0) {
            listBuilder.setNoItemsMessage("Heute keine Aufträge.")
        } else {
            val max = minOf(arr.length(), 6) // Auto zeigt nur eine begrenzte Anzahl
            for (i in 0 until max) {
                listBuilder.addItem(buildRow(arr.getJSONObject(i)))
            }
        }

        return ListTemplate.Builder()
            .setSingleList(listBuilder.build())
            .setTitle("Fehnverleih · Aufträge heute")
            .setHeaderAction(Action.APP_ICON)
            .setActionStrip(actionStrip)
            .build()
    }

    private fun buildRow(o: JSONObject): Row {
        val time = o.optString("ankunft_geplant", "").ifBlank { "--:--" }
        val kunde = o.optString("kunde", "Kunde")
        val title = SpannableString("$time  ·  $kunde")
        title.setSpan(ForegroundCarColorSpan.create(gold), 0, time.length, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
        val art = if (o.optString("status") == "ausgegeben") "Abholung" else o.optString("typ", "Auftrag")
        val adr = o.optString("adresse", "").replace("\n", ", ")
        return Row.Builder()
            .setTitle(title)
            .addText(art + " · " + o.optString("nr", ""))
            .addText(adr)
            .setOnClickListener { screenManager.push(OrderDetailScreen(carContext, o)) }
            .setBrowsable(true)
            .build()
    }
}
