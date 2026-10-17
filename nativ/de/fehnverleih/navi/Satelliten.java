package de.fehnverleih.navi;

import android.content.Context;
import android.location.GnssStatus;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

/** Satelliten-Anzeige fürs Navi: wie viele Satelliten sieht das Handy, wie viele nutzt es für den Standort (je System). */
public final class Satelliten {
    private static volatile String stand = "{\"sichtbar\":-1,\"genutzt\":-1,\"alter\":-1}";
    private static volatile long zeit = 0;
    private static volatile boolean laeuft = false;
    private static Object rueckruf = null;
    private static long versuch = 0;

    private Satelliten() {}

    /** JSON: { sichtbar, genutzt, alter (ms seit letzter Meldung, -1 = noch keine), systeme: { GPS: [genutzt, sichtbar], … }, snr } */
    public static String json(Context c) {
        starten(c);
        String s = stand;
        long alter = zeit == 0 ? -1 : System.currentTimeMillis() - zeit;
        return s.substring(0, s.length() - 1) + ",\"alter\":" + alter + ",\"laeuft\":" + laeuft + "}";
    }

    private static synchronized void starten(final Context c) {
        if (laeuft || Build.VERSION.SDK_INT < 24 || c == null) return;
        long jetzt = System.currentTimeMillis();
        if (jetzt - versuch < 5000) return;   // ohne Standort-Erlaubnis nicht dauernd neu probieren
        versuch = jetzt;
        final LocationManager lm = (LocationManager) c.getApplicationContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;
        GnssStatus.Callback cb = new GnssStatus.Callback() {
            @Override public void onSatelliteStatusChanged(GnssStatus g) { auswerten(g); }
            @Override public void onStopped() { zeit = 0; stand = "{\"sichtbar\":0,\"genutzt\":0,\"aus\":true}"; }
        };
        try {
            laeuft = lm.registerGnssStatusCallback(cb, new Handler(Looper.getMainLooper()));
            if (laeuft) rueckruf = cb;
        } catch (SecurityException e) {
            laeuft = false;
        } catch (RuntimeException e) {
            laeuft = false;
        }
    }

    private static final String[] NAMEN = { "?", "GPS", "SBAS", "GLONASS", "QZSS", "BeiDou", "Galileo", "NavIC" };

    private static void auswerten(GnssStatus g) {
        int n = g.getSatelliteCount(), genutzt = 0;
        StringBuilder liste = new StringBuilder();   // je Satellit: [System, Nummer, genutzt, Signal dB-Hz, Höhe über Horizont °, Richtung °, Frequenz MHz]
        int[] sicht = new int[NAMEN.length], nutz = new int[NAMEN.length];
        float snrSumme = 0; int snrZahl = 0;
        for (int i = 0; i < n; i++) {
            int t = g.getConstellationType(i);
            if (t < 0 || t >= NAMEN.length) t = 0;
            sicht[t]++;
            if (liste.length() > 0) liste.append(',');
            float fq = 0;
            if (Build.VERSION.SDK_INT >= 26 && g.hasCarrierFrequencyHz(i)) fq = g.getCarrierFrequencyHz(i) / 1e6f;
            liste.append('[').append(t).append(',').append(g.getSvid(i)).append(',').append(g.usedInFix(i) ? 1 : 0).append(',')
                 .append(Math.round(g.getCn0DbHz(i) * 10) / 10.0).append(',').append(Math.round(g.getElevationDegrees(i) * 10) / 10.0).append(',')
                 .append(Math.round(g.getAzimuthDegrees(i) * 10) / 10.0).append(',').append(Math.round(fq * 100) / 100.0).append(']');
            if (g.usedInFix(i)) {
                genutzt++; nutz[t]++;
                float s = g.getCn0DbHz(i);
                if (s > 0) { snrSumme += s; snrZahl++; }
            }
        }
        StringBuilder b = new StringBuilder();
        b.append("{\"sichtbar\":").append(n).append(",\"genutzt\":").append(genutzt)
         .append(",\"snr\":").append(snrZahl == 0 ? 0 : Math.round(snrSumme / snrZahl)).append(",\"systeme\":{");
        boolean erst = true;
        for (int t = 0; t < NAMEN.length; t++) {
            if (sicht[t] == 0) continue;
            if (!erst) b.append(',');
            erst = false;
            b.append('"').append(NAMEN[t]).append("\":[").append(nut(nutz, t)).append(',').append(sicht[t]).append(']');
        }
        b.append("},\"liste\":[").append(liste).append("]}");
        stand = b.toString();
        zeit = System.currentTimeMillis();
    }

    private static int nut(int[] a, int i) { return a[i]; }
}
