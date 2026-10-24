package de.fehnverleih.navi;

import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.DateTimeWithZone;
import androidx.car.app.model.Distance;
import androidx.car.app.model.OnClickListener;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.NavigationManagerCallback;
import androidx.car.app.navigation.model.Maneuver;
import androidx.car.app.navigation.model.MessageInfo;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.navigation.model.RoutingInfo;
import androidx.car.app.navigation.model.Step;
import androidx.car.app.navigation.model.TravelEstimate;
import java.util.TimeZone;
import org.json.JSONObject;

/** Hauptansicht im Auto: Karte, nächste Abbiegung, Restweg und Ankunft – wie die Navi auf dem Handy */
final class AutoNaviScreen extends Screen {
    private final AutoKarte karte;
    private final Handler haupt = new Handler(Looper.getMainLooper());
    private NavigationManager navi;
    private boolean naviGemeldet;
    private long zuletzt;
    private boolean geplant;

    private final SharedPreferences.OnSharedPreferenceChangeListener hoerer = new SharedPreferences.OnSharedPreferenceChangeListener() {
        @Override
        public void onSharedPreferenceChanged(SharedPreferences p, String k) {
            if ("autoStand".equals(k)) neu();
        }
    };
    private final Runnable spaeter = new Runnable() {
        @Override
        public void run() {
            geplant = false;
            neu();
        }
    };
    /** Auch ohne neue Daten alle 5 Sekunden prüfen, ob das Handy noch läuft */
    private final Runnable wache = new Runnable() {
        @Override
        public void run() {
            neu();
            haupt.postDelayed(this, 5000);
        }
    };

    AutoNaviScreen(CarContext c, AutoKarte k) {
        super(c);
        karte = k;
        try {
            navi = c.getCarService(NavigationManager.class);
            navi.setNavigationManagerCallback(new NavigationManagerCallback() {
                @Override
                public void onStopNavigation() {
                    AutoDaten.stoppBefehl(getCarContext());
                }

                @Override
                public void onAutoDriveEnabled() {
                    // nichts
                }
            });
        } catch (Throwable t) {
            navi = null;
        }
        AutoDaten.prefs(c).registerOnSharedPreferenceChangeListener(hoerer);
        haupt.postDelayed(wache, 5000);
    }

    /** Höchstens einmal pro Sekunde neu zeichnen lassen */
    private void neu() {
        long jetzt = SystemClock.elapsedRealtime();
        if (jetzt - zuletzt >= 1000) {
            zuletzt = jetzt;
            invalidate();
        } else if (!geplant) {
            geplant = true;
            haupt.postDelayed(spaeter, 1000 - (jetzt - zuletzt));
        }
    }

    private static Distance strecke(double m) {
        if (m < 0) m = 0;
        if (m < 1000) return Distance.create(m < 100 ? Math.round(m / 10.0) * 10 : Math.round(m / 50.0) * 50, Distance.UNIT_METERS);
        if (m < 10000) return Distance.create(Math.round(m / 100.0) / 10.0, Distance.UNIT_KILOMETERS_P1);
        return Distance.create(Math.round(m / 1000.0), Distance.UNIT_KILOMETERS);
    }

    private static int typ(String art, int ausfahrt) {
        if (art == null) art = "";
        switch (art) {
            case "a_links": return Maneuver.TYPE_TURN_NORMAL_LEFT;
            case "a_rechts": return Maneuver.TYPE_TURN_NORMAL_RIGHT;
            case "a_llinks": return Maneuver.TYPE_TURN_SLIGHT_LEFT;
            case "a_lrechts": return Maneuver.TYPE_TURN_SLIGHT_RIGHT;
            case "a_slinks": return Maneuver.TYPE_TURN_SHARP_LEFT;
            case "a_srechts": return Maneuver.TYPE_TURN_SHARP_RIGHT;
            case "a_wenden": return Maneuver.TYPE_U_TURN_LEFT;
            case "a_abfl": return Maneuver.TYPE_OFF_RAMP_NORMAL_LEFT;
            case "a_abfr": return Maneuver.TYPE_OFF_RAMP_NORMAL_RIGHT;
            case "a_gabl": return Maneuver.TYPE_FORK_LEFT;
            case "a_gabr": return Maneuver.TYPE_FORK_RIGHT;
            case "a_einf": return Maneuver.TYPE_MERGE_SIDE_UNSPECIFIED;
            case "a_kreisel": return ausfahrt > 0 ? Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW : Maneuver.TYPE_ROUNDABOUT_ENTER_CCW;
            case "a_ziel": return Maneuver.TYPE_DESTINATION;
            default: return Maneuver.TYPE_STRAIGHT;
        }
    }

    private Action knopf(String titel, OnClickListener l) {
        return new Action.Builder().setTitle(titel).setOnClickListener(l).build();
    }

    @Override
    public Template onGetTemplate() {
        final CarContext c = getCarContext();
        JSONObject s = AutoDaten.json(c, "autoStand");
        boolean laeuft = AutoDaten.handyLaeuft(c);
        boolean aktiv = laeuft && s != null && s.optBoolean("aktiv", false) && System.currentTimeMillis() - s.optLong("t", 0) < 30000;

        ActionStrip.Builder leiste = new ActionStrip.Builder();
        leiste.addAction(knopf("Aufträge", new OnClickListener() {
            @Override
            public void onClick() {
                getScreenManager().push(new AutoAuftraege(c));
            }
        }));
        if (aktiv) {
            leiste.addAction(knopf("Beenden", new OnClickListener() {
                @Override
                public void onClick() {
                    AutoDaten.stoppBefehl(c);
                    AutoDaten.toast(c, "Navigation wird beendet.");
                }
            }));
        }
        ActionStrip kartenLeiste = new ActionStrip.Builder()
                .addAction(new Action.Builder().setIcon(AutoSymbole.plus()).setOnClickListener(new OnClickListener() {
                    @Override
                    public void onClick() {
                        karte.zoom(1);
                    }
                }).build())
                .addAction(new Action.Builder().setIcon(AutoSymbole.minus()).setOnClickListener(new OnClickListener() {
                    @Override
                    public void onClick() {
                        karte.zoom(-1);
                    }
                }).build())
                .build();

        NavigationTemplate.Builder b = new NavigationTemplate.Builder()
                .setActionStrip(leiste.build())
                .setMapActionStrip(kartenLeiste)
                .setBackgroundColor(CarColor.createCustom(0xFF1B2430, 0xFF1B2430));

        if (aktiv) {
            String art = s.optString("art", "a_gerade");
            int ausfahrt = s.optInt("ausfahrt", 0);
            Maneuver.Builder mb = new Maneuver.Builder(typ(art, ausfahrt)).setIcon(AutoSymbole.fuer(art));
            if (typ(art, ausfahrt) == Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW) mb.setRoundaboutExitNumber(ausfahrt);
            String text = s.optString("text", "");
            if (s.optBoolean("rechnet", false)) text = "Route wird neu berechnet …";
            if (text.length() == 0) text = "Der Route folgen";
            Step schritt = new Step.Builder(text).setManeuver(mb.build()).build();
            b.setNavigationInfo(new RoutingInfo.Builder().setCurrentStep(schritt, strecke(s.optDouble("bis", 0))).build());
            long an = s.optLong("ankunft", 0), restS = s.optLong("restS", -1);
            double restM = s.optDouble("restM", -1);
            if (an > 0 && restM >= 0) {
                TravelEstimate.Builder te = new TravelEstimate.Builder(strecke(restM), DateTimeWithZone.create(an, TimeZone.getDefault()));
                if (restS >= 0) te.setRemainingTimeSeconds(restS);
                b.setDestinationTravelEstimate(te.build());
            }
            if (navi != null && !naviGemeldet) {
                try {
                    navi.navigationStarted();
                    naviGemeldet = true;
                } catch (Throwable t) {
                    // nichts
                }
            }
        } else {
            if (navi != null && naviGemeldet) {
                try {
                    navi.navigationEnded();
                } catch (Throwable t) {
                    // nichts
                }
                naviGemeldet = false;
            }
            MessageInfo info;
            if (!laeuft) info = new MessageInfo.Builder("Fehnverleih Navi").setText("Bitte die Navi auf dem Handy öffnen. Danach erscheint hier die Karte.").build();
            else info = new MessageInfo.Builder("Fehnverleih Navi").setText("Ziel unter „Aufträge“ wählen oder auf dem Handy eine Route starten.").build();
            b.setNavigationInfo(info);
        }
        return b.build();
    }
}
