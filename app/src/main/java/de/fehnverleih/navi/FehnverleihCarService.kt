package de.fehnverleih.navi

import androidx.car.app.CarAppService
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator

/** Meldet die App bei Android Auto an, damit sie im Auto in der App-Liste erscheint. */
class FehnverleihCarService : CarAppService() {

    override fun createHostValidator(): HostValidator {
        // Erlaubt alle Hosts – fuer eigene (nicht im Play Store veroeffentlichte) Apps noetig.
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
    }

    override fun onCreateSession(): Session = FehnverleihSession()
}
