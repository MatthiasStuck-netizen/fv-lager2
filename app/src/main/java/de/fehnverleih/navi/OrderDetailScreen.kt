package de.fehnverleih.navi

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.text.SpannableString
import android.text.Spanned
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.CarColor
import androidx.car.app.model.ForegroundCarColorSpan
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import org.json.JSONObject

/** Ein Auftrag auf dem Autobildschirm. Die Navigation selbst laeuft in der Fehnverleih-Navi-App auf dem Handy. */
class OrderDetailScreen(
    carContext: CarContext,
    private val order: JSONObject
) : Screen(carContext) {

    private val gold = CarColor.createCustom(0xFFEAB94A.toInt(), 0xFFEAB94A.toInt())

    override fun onGetTemplate(): Template {
        val list = ItemList.Builder()

        val time = order.optString("ankunft_geplant", "").ifBlank { "--:--" }
        val info = buildString {
            append("Geplante Ankunft: $time")
            val abf = order.optString("abfahrt_geplant", "")
            if (abf.isNotBlank()) append(" · Abfahrt: $abf")
        }
        list.addItem(
            Row.Builder()
                .setTitle(order.optString("kunde", "Kunde"))
                .addText(order.optString("adresse", "").replace("\n", ", "))
                .addText(info)
                .build()
        )

        list.addItem(
            Row.Builder()
                .setTitle(goldText("➤  Navigation auf dem Handy starten"))
                .addText("Öffnet die Route in der Fehnverleih-Navi-App")
                .setOnClickListener { aufsHandy() }
                .build()
        )

        val notiz = order.optString("notiz", "")
        if (notiz.isNotBlank()) {
            list.addItem(
                Row.Builder()
                    .setTitle("Notiz")
                    .addText(notiz.take(200))
                    .build()
            )
        }

        val phone = order.optString("telefon", "")
        if (phone.isNotBlank()) {
            list.addItem(
                Row.Builder()
                    .setTitle("Anrufen")
                    .addText(phone)
                    .setOnClickListener {
                        try {
                            carContext.startCarApp(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone))))
                        } catch (_: Exception) {
                            toast("Anruf nicht möglich.")
                        }
                    }
                    .build()
            )
        }

        return ListTemplate.Builder()
            .setSingleList(list.build())
            .setTitle(order.optString("nr", "Auftrag"))
            .setHeaderAction(Action.BACK)
            .build()
    }

    /** Merkt den Auftrag vor und holt die Handy-App nach vorn; dort oeffnet sich die Route. */
    private fun aufsHandy() {
        carContext.getSharedPreferences(Server.PREFS, Context.MODE_PRIVATE).edit()
            .putString("auto_auftrag", order.optString("id")).apply()
        try {
            carContext.startActivity(
                Intent(carContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            )
        } catch (_: Exception) {
        }
        toast("Die Route öffnet sich auf dem Handy.")
    }

    private fun toast(msg: String) {
        CarToast.makeText(carContext, msg, CarToast.LENGTH_LONG).show()
    }

    private fun goldText(s: String): CharSequence {
        val sp = SpannableString(s)
        sp.setSpan(ForegroundCarColorSpan.create(gold), 0, s.length, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
        return sp
    }
}
