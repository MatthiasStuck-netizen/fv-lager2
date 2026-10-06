package de.fehnverleih.navi

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session

class FehnverleihSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen = OrdersScreen(carContext)
}
