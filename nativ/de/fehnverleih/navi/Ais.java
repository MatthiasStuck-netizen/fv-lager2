package de.fehnverleih.navi;

import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * Schiffe live über AIS (aisstream.io, kostenloser Schlüssel). aisstream erlaubt keine Verbindung aus dem Browser,
 * deshalb hält der Android-Teil die WebSocket-Verbindung und sammelt die Schiffe im Kartenausschnitt.
 * Die Oberfläche ruft alle paar Sekunden aisStand ab; wird 90 Sekunden nicht gefragt, endet die Verbindung von selbst.
 */
public final class Ais {
    private Ais() {}

    static final class Schiff {
        long mmsi, zeit; double lat, lon, sog = -1, cog = -1; int kurs = 511, status = 15, typ = 0, laenge = 0, breite = 0;
        String name = "", rufz = "", ziel = "", imo = "", eta = ""; double tiefgang = 0; boolean klasseB;
    }

    static String HOST = "stream.aisstream.io";   // im Test ersetzbar
    static int PORT = 443;
    private static final Map<Long, Schiff> SCHIFFE = new HashMap<>();
    private static volatile String schluessel = "";
    private static volatile double[] box = null;        // s, w, n, o
    private static volatile boolean boxNeu = false;
    private static volatile long gefragt = 0;
    private static volatile Thread faden = null;
    private static volatile String zustand = "aus", fehler = "";
    private static volatile long nachrichten = 0;
    private static volatile SSLSocket sock = null;

    static synchronized void start(JSONObject a) {
        gefragt = System.currentTimeMillis();
        String k = a.optString("schluessel", "").trim();
        if (k.length() == 0) { zustand = "ohne Schlüssel"; return; }
        double[] b = { a.optDouble("s"), a.optDouble("w"), a.optDouble("n"), a.optDouble("o") };
        for (double d : b) if (Double.isNaN(d)) return;
        // etwas Rand, damit beim Verschieben nicht sofort neu abonniert werden muss
        double dl = (b[2] - b[0]) * 0.25, dw = (b[3] - b[1]) * 0.25;
        double[] nb = { Math.max(-90, b[0] - dl), Math.max(-180, b[1] - dw), Math.min(90, b[2] + dl), Math.min(180, b[3] + dw) };
        if (box == null || !innen(b, box) || (box[2] - box[0]) > 3 * (nb[2] - nb[0])) { box = nb; boxNeu = true; }
        if (!k.equals(schluessel)) { schluessel = k; schliessen(); }
        abonnieren();
        if (faden == null || !faden.isAlive()) {
            faden = new Thread(new Runnable() { @Override public void run() { schleife(); } }, "fv-ais");
            faden.setDaemon(true);
            faden.start();
        }
    }
    private static boolean innen(double[] b, double[] gross) { return b[0] >= gross[0] && b[1] >= gross[1] && b[2] <= gross[2] && b[3] <= gross[3]; }

    static synchronized void stopp() { gefragt = 0; schliessen(); }
    private static void schliessen() { ausgang = null; SSLSocket s = sock; sock = null; if (s != null) try { s.close(); } catch (Throwable ignored) {} }

    static String stand() {
        gefragt = System.currentTimeMillis();
        try {
            JSONArray l = new JSONArray();
            double[] b = box;
            long jetzt = System.currentTimeMillis();
            synchronized (SCHIFFE) {
                for (Iterator<Schiff> it = SCHIFFE.values().iterator(); it.hasNext(); ) {
                    Schiff s = it.next();
                    if (jetzt - s.zeit > 30 * 60 * 1000L) { it.remove(); continue; }
                    if (s.lat == 0 && s.lon == 0) continue;
                    if (b != null && (s.lat < b[0] || s.lat > b[2] || s.lon < b[1] || s.lon > b[3])) continue;
                    JSONArray x = new JSONArray();
                    x.put(s.mmsi).put(Math.round(s.lat * 1e5) / 1e5).put(Math.round(s.lon * 1e5) / 1e5).put(s.sog < 0 ? JSONObject.NULL : Math.round(s.sog * 10) / 10.0)
                        .put(s.cog < 0 ? JSONObject.NULL : Math.round(s.cog)).put(s.kurs == 511 ? JSONObject.NULL : s.kurs).put(s.name).put(s.rufz).put(s.typ).put(s.ziel)
                        .put(s.status).put(s.laenge).put(s.breite).put(s.imo).put(s.tiefgang).put(s.eta).put(s.zeit).put(s.klasseB ? 1 : 0);
                    l.put(x);
                    if (l.length() >= 2500) break;
                }
            }
            return new JSONObject().put("ok", true).put("zustand", zustand).put("fehler", fehler).put("nachrichten", nachrichten).put("schiffe", l).toString();
        } catch (Exception e) { return Extras.fehler(e.getMessage()); }
    }

    /* ---------- Verbindung ---------- */
    private static void schleife() {
        int warte = 2000;
        while (gefragt != 0 && System.currentTimeMillis() - gefragt < 90000) {
            try {
                zustand = "verbinde";
                verbinden();
                warte = 2000;
            } catch (Throwable t) {
                String m = t.getMessage();
                if (sock != null || !"Socket closed".equals(m)) fehler = m == null ? t.getClass().getSimpleName() : m;
                zustand = "getrennt";
            }
            schliessen();
            if (gefragt == 0) break;
            try { Thread.sleep(warte); } catch (InterruptedException e) { break; }
            warte = Math.min(60000, warte * 2);
        }
        zustand = "aus";
        faden = null;
    }

    private static void verbinden() throws Exception {
        SSLSocket s = Post.tls(HOST, PORT, 30000);
        sock = s;
        ausgang = null;
        InputStream in = new BufferedInputStream(s.getInputStream());
        OutputStream out = s.getOutputStream();
        byte[] k = new byte[16]; new SecureRandom().nextBytes(k);
        String req = "GET /v0/stream HTTP/1.1\r\nHost: stream.aisstream.io\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: "
            + Base64.encodeToString(k, Base64.NO_WRAP) + "\r\nSec-WebSocket-Version: 13\r\nUser-Agent: Fehnverleih-Navi\r\n\r\n";
        out.write(req.getBytes("US-ASCII")); out.flush();
        String erste = zeile(in);
        if (!erste.contains(" 101")) throw new Exception("aisstream antwortet: " + erste);
        while (zeile(in).length() > 0) { /* Kopfzeilen überspringen */ }
        boxNeu = true;
        abonniert = 0; ausgang = out;
        zustand = "verbunden"; fehler = "";
        ByteArrayOutputStream nachricht = new ByteArrayOutputStream();
        while (sock == s) {
            if (gefragt == 0 || System.currentTimeMillis() - gefragt > 90000) break;
            abonnieren();
            int b0;
            try { b0 = in.read(); } catch (java.net.SocketTimeoutException e) { continue; }   // nichts los im Ausschnitt
            if (b0 < 0) throw new Exception("Verbindung beendet");
            int b1 = in.read();
            boolean fin = (b0 & 0x80) != 0; int op = b0 & 0x0f;
            long len = b1 & 0x7f;
            if (len == 126) len = (in.read() << 8) | in.read();
            else if (len == 127) { len = 0; for (int i = 0; i < 8; i++) len = (len << 8) | in.read(); }
            if (len > 8_000_000) throw new Exception("Nachricht zu groß");
            boolean maske = (b1 & 0x80) != 0; byte[] mk = new byte[4];
            if (maske) for (int i = 0; i < 4; i++) mk[i] = (byte) in.read();
            byte[] d = new byte[(int) len]; int o = 0;
            while (o < len) { int r = in.read(d, o, (int) len - o); if (r < 0) throw new Exception("Verbindung beendet"); o += r; }
            if (maske) for (int i = 0; i < d.length; i++) d[i] ^= mk[i & 3];
            if (op == 8) { String grund = d.length > 2 ? new String(d, 2, d.length - 2, "UTF-8") : ""; throw new Exception(grund.length() > 0 ? grund : "aisstream hat die Verbindung beendet"); }
            if (op == 9) { senden(out, 10, d); continue; }
            if (op == 10) continue;
            if (op == 1 || op == 2 || op == 0) {
                nachricht.write(d);
                if (!fin) continue;
                String t = new String(nachricht.toByteArray(), "UTF-8");
                nachricht.reset();
                verarbeiten(t);
            }
        }
    }
    private static volatile OutputStream ausgang = null;
    private static volatile long abonniert = 0;
    /** Kartenausschnitt (neu) abonnieren – höchstens einmal je 1,5 s (aisstream trennt sonst) */
    private static void abonnieren() {
        OutputStream out = ausgang; double[] b = box;
        if (out == null || b == null || !boxNeu || System.currentTimeMillis() - abonniert < 1500) return;
        try {
            JSONObject abo = new JSONObject().put("APIKey", schluessel)
                .put("BoundingBoxes", new JSONArray().put(new JSONArray().put(new JSONArray().put(b[0]).put(b[1])).put(new JSONArray().put(b[2]).put(b[3]))))
                .put("FilterMessageTypes", new JSONArray().put("PositionReport").put("StandardClassBPositionReport").put("ExtendedClassBPositionReport").put("ShipStaticData").put("StaticDataReport"));
            boxNeu = false; abonniert = System.currentTimeMillis();
            senden(out, 1, abo.toString().getBytes("UTF-8"));
        } catch (Throwable t) { boxNeu = true; }
    }

    private static String zeile(InputStream in) throws Exception {
        StringBuilder b = new StringBuilder(); int c;
        while ((c = in.read()) != -1 && c != '\n') if (c != '\r') b.append((char) c);
        if (c == -1 && b.length() == 0) throw new Exception("keine Antwort");
        return b.toString();
    }
    private static void senden(OutputStream out, int op, byte[] d) throws Exception {
        ByteArrayOutputStream f = new ByteArrayOutputStream();
        f.write(0x80 | op);
        if (d.length < 126) f.write(0x80 | d.length);
        else if (d.length < 65536) { f.write(0x80 | 126); f.write(d.length >> 8); f.write(d.length & 0xff); }
        else { f.write(0x80 | 127); for (int i = 7; i >= 0; i--) f.write((int) ((long) d.length >> (8 * i)) & 0xff); }
        byte[] mk = new byte[4]; new SecureRandom().nextBytes(mk);
        f.write(mk);
        for (int i = 0; i < d.length; i++) f.write(d[i] ^ mk[i & 3]);
        synchronized (out) { out.write(f.toByteArray()); out.flush(); }
    }

    private static void verarbeiten(String t) {
        try {
            JSONObject j = new JSONObject(t);
            if (j.has("error")) { fehler = j.optString("error"); return; }
            nachrichten++;
            String art = j.optString("MessageType");
            JSONObject meta = j.optJSONObject("MetaData"), msg = j.optJSONObject("Message");
            if (meta == null || msg == null) return;
            long mmsi = meta.optLong("MMSI", 0);
            if (mmsi <= 0) return;
            Schiff s;
            synchronized (SCHIFFE) {
                s = SCHIFFE.get(mmsi);
                if (s == null) { if (SCHIFFE.size() > 6000) return; s = new Schiff(); s.mmsi = mmsi; SCHIFFE.put(mmsi, s); }
            }
            String mn = meta.optString("ShipName", "").trim();
            if (mn.length() > 0 && s.name.length() == 0) s.name = mn;
            JSONObject m = msg.optJSONObject(art);
            if (m == null) return;
            if (art.endsWith("PositionReport")) {
                double la = m.optDouble("Latitude", Double.NaN), lo = m.optDouble("Longitude", Double.NaN);
                if (Double.isNaN(la) || Double.isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return;
                s.lat = la; s.lon = lo; s.zeit = System.currentTimeMillis();
                double sog = m.optDouble("Sog", -1); s.sog = sog >= 102.3 ? -1 : sog;
                double cog = m.optDouble("Cog", -1); s.cog = cog >= 360 ? -1 : cog;
                s.kurs = m.optInt("TrueHeading", 511);
                if (m.has("NavigationalStatus")) s.status = m.optInt("NavigationalStatus", 15);
                s.klasseB = !art.equals("PositionReport");
                if (art.equals("ExtendedClassBPositionReport")) { String n = m.optString("Name", "").trim(); if (n.length() > 0) s.name = n; s.typ = m.optInt("Type", s.typ); }
            } else if (art.equals("ShipStaticData")) {
                String n = m.optString("Name", "").trim(); if (n.length() > 0) s.name = n;
                s.rufz = m.optString("CallSign", s.rufz).trim();
                s.ziel = m.optString("Destination", s.ziel).trim();
                s.typ = m.optInt("Type", s.typ);
                long imo = m.optLong("ImoNumber", 0); if (imo > 0) s.imo = String.valueOf(imo);
                s.tiefgang = m.optDouble("MaximumStaticDraught", s.tiefgang);
                JSONObject dim = m.optJSONObject("Dimension");
                if (dim != null) { s.laenge = dim.optInt("A") + dim.optInt("B"); s.breite = dim.optInt("C") + dim.optInt("D"); }
                JSONObject eta = m.optJSONObject("Eta");
                if (eta != null && eta.optInt("Month") > 0 && eta.optInt("Day") > 0) s.eta = String.format(java.util.Locale.ROOT, "%02d.%02d. %02d:%02d", eta.optInt("Day"), eta.optInt("Month"), eta.optInt("Hour") % 24, eta.optInt("Minute") % 60);
                if (s.zeit == 0) s.zeit = 1;   // noch ohne Position
            } else if (art.equals("StaticDataReport")) {
                JSONObject a = m.optJSONObject("ReportA"), b = m.optJSONObject("ReportB");
                if (a != null && a.optBoolean("Valid", true)) { String n = a.optString("Name", "").trim(); if (n.length() > 0) s.name = n; }
                if (b != null && b.optBoolean("Valid", true)) {
                    s.rufz = b.optString("CallSign", s.rufz).trim(); s.typ = b.optInt("ShipType", s.typ);
                    JSONObject dim = b.optJSONObject("Dimension");
                    if (dim != null) { s.laenge = dim.optInt("A") + dim.optInt("B"); s.breite = dim.optInt("C") + dim.optInt("D"); }
                }
            }
        } catch (Throwable ignored) {}
    }
}
