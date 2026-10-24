package de.fehnverleih.navi;

import android.content.Intent;
import android.net.Uri;
import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.Session;

/** Eine Verbindung zum Auto: Karte auf dem Autobildschirm und Navigations-Ansicht */
public final class AutoSitzung extends Session {
    private AutoKarte karte;
    private AutoNaviScreen navi;

    @Override
    public Screen onCreateScreen(Intent intent) {
        CarContext c = getCarContext();
        karte = new AutoKarte(c);
        c.getCarService(AppManager.class).setSurfaceCallback(karte);
        navi = new AutoNaviScreen(c, karte);
        ziel(intent);
        return navi;
    }

    @Override
    public void onNewIntent(Intent intent) {
        ziel(intent);
    }

    /** „Navigiere zu …“ aus einer anderen App oder vom Sprachassistenten: Adresse ans Handy geben */
    private void ziel(Intent intent) {
        if (intent == null || !CarContext.ACTION_NAVIGATE.equals(intent.getAction())) return;
        Uri u = intent.getData();
        if (u == null) return;
        String s = u.getSchemeSpecificPart();
        String adresse = "";
        int q = s.indexOf("q=");
        if (q >= 0) adresse = Uri.decode(s.substring(q + 2));
        else adresse = s;
        adresse = adresse.trim();
        if (adresse.length() == 0 || adresse.equals("0,0")) return;
        AutoDaten.zielBefehl(getCarContext(), adresse, adresse);
        AutoDaten.toast(getCarContext(), "Route nach " + adresse + " wird berechnet …");
    }
}
