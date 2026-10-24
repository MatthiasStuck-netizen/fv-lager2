package de.fehnverleih.navi;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import org.json.JSONObject;

/** Austausch mit der Navi auf dem Handy über den gemeinsamen Speicher (fv_daten, Werte als JSON wie in js/bruecke.js) */
final class AutoDaten {
    static final String PREFS = "fv_daten";

    private AutoDaten() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, 0);
    }

    static JSONObject json(Context c, String schluessel) {
        try {
            String s = prefs(c).getString(schluessel, "");
            if (s == null || s.length() == 0) return null;
            return new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static long zahl(Context c, String schluessel) {
        try {
            String s = prefs(c).getString(schluessel, "");
            return s == null || s.length() == 0 ? 0 : (long) Double.parseDouble(s);
        } catch (Exception e) {
            return 0;
        }
    }

    /** true, wenn die Navi auf dem Handy in den letzten 20 Sekunden ein Lebenszeichen gegeben hat */
    static boolean handyLaeuft(Context c) {
        return System.currentTimeMillis() - zahl(c, "autoPuls") < 20000;
    }

    private static void befehl(Context c, JSONObject o) {
        try {
            o.put("id", "a" + System.nanoTime());
            o.put("t", System.currentTimeMillis());
            prefs(c).edit().putString("autoBefehl", o.toString()).apply();
        } catch (Exception e) {
            // nichts
        }
    }

    static void stoppBefehl(Context c) {
        try {
            befehl(c, new JSONObject().put("art", "stopp"));
        } catch (Exception e) {
            // nichts
        }
    }

    static void auftragBefehl(Context c, String auftragId) {
        try {
            befehl(c, new JSONObject().put("art", "auftrag").put("id2", auftragId));
        } catch (Exception e) {
            // nichts
        }
    }

    static void zielBefehl(Context c, String name, String adresse) {
        try {
            befehl(c, new JSONObject().put("art", "ziel").put("name", name).put("adresse", adresse));
        } catch (Exception e) {
            // nichts
        }
    }

    static void toast(CarContext c, String text) {
        try {
            CarToast.makeText(c, text, CarToast.LENGTH_LONG).show();
        } catch (Exception e) {
            // nichts
        }
    }
}
