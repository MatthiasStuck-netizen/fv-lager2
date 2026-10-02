package de.fehnverleih.lager.kern;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Verbindung zur Lager-Schnittstelle der Webseite (warenwirtschaft.php, Adresse „…/?lagerapp“).
 * Gleicher Ablauf wie in der bisherigen Web-App: jede Aktion wird per POST als JSON geschickt,
 * der Server prüft bei JEDER Aktion Anmeldung und Stempel-Sperre.
 *
 * Wird von PC-Programm und Android-App gemeinsam benutzt. Aufrufe blockieren –
 * also nie im Oberflächen-Thread aufrufen.
 */
public final class Api {

    /** Ablage für Anmeldung und Einstellungen (PC: Datei im Benutzerordner, Android: SharedPreferences) */
    public interface Speicher {
        String lesen(String schluessel);
        void schreiben(String schluessel, String wert);   // wert leer = löschen
    }

    /** Meldet der Oberfläche, wenn der Server sperrt, abmeldet oder freigibt. Wird im Hintergrund-Thread aufgerufen. */
    public interface Beobachter {
        void abgemeldet(String meldung);
        void gesperrt(String meldung);
        void frei(Antwort a);
    }

    public static final String STANDARD_SERVER = "https://www.fehnverleih.de/";
    public static final int VERBINDUNG_MS = 10000, LESEN_MS = 20000;

    private final Speicher speicher;
    public Beobachter beobachter;
    public volatile String token, rolle, name, server, geraet = "Gerät";

    public Api(Speicher speicher) {
        this.speicher = speicher;
        token = wert("token");
        rolle = wert("rolle");
        name = wert("name");
        server = wert("server");
        if (server.isEmpty()) server = STANDARD_SERVER;
    }

    private String wert(String k) { String v = speicher.lesen(k); return v == null ? "" : v; }

    public boolean admin() { return "admin".equals(rolle); }
    public boolean angemeldet() { return !token.isEmpty(); }

    public void serverSetzen(String adresse) {
        server = adresse == null || adresse.trim().isEmpty() ? STANDARD_SERVER : adresse.trim();
        speicher.schreiben("server", server);
    }

    /**
     * Aus der eingegebenen Adresse die Schnittstelle machen:
     * „www.fehnverleih.de“ → „https://www.fehnverleih.de/?lagerapp“
     */
    public static String schnittstelle(String adresse) {
        String a = adresse == null ? "" : adresse.trim();
        if (a.isEmpty()) a = STANDARD_SERVER;
        if (!a.matches("(?i)^https?://.*")) a = "https://" + a;
        if (a.contains("lagerapp")) return a;
        int q = a.indexOf('?');
        if (q >= 0) a = a.substring(0, q);
        // eine evtl. mit eingegebene „/lager-app/“ oder „index.php“ entfernen
        a = a.replaceAll("(?i)/lager-app/?.*$", "/").replaceAll("(?i)/index\\.php$", "/");
        int pfad = a.indexOf('/', a.indexOf("//") + 2);
        if (pfad < 0) a = a + "/";
        else if (!a.endsWith("/")) a = a + "/";
        return a + "?lagerapp";
    }

    /** Basisadresse der Webseite (für Bilder und den Link zur Verwaltung) */
    public String basis() {
        String s = schnittstelle(server);
        int q = s.indexOf('?');
        return q >= 0 ? s.substring(0, q) : s;
    }

    /* ======================= Aufruf ======================= */
    public Antwort rufe(String aktion) { return rufe(aktion, null); }

    public Antwort rufe(String aktion, Map<String, Object> daten) {
        Map<String, Object> in = Json.neu();
        in.put("aktion", aktion);
        in.put("token", token);
        if (daten != null) in.putAll(daten);
        Antwort r = senden(schnittstelle(server), in);
        Beobachter b = beobachter;
        String typ = r.typ();
        if ("abgemeldet".equals(typ)) {
            abmeldenLokal();
            r.stop = true;
            if (b != null) b.abgemeldet("Deine Anmeldung ist abgelaufen oder wurde beendet. Bitte neu anmelden.");
        } else if ("gesperrt".equals(typ)) {
            if (r.hat("name")) namenMerken(r.str("name"));
            r.stop = true;
            if (b != null) b.gesperrt(r.msg());
        } else if (r.frei()) {
            if (r.hat("name") && !r.str("name").isEmpty()) namenMerken(r.str("name"));
            if (b != null) b.frei(r);
        }
        return r;
    }

    /** Kurzform für Daten: daten("id", x, "modus", y) */
    public static Map<String, Object> daten(Object... paare) {
        Map<String, Object> m = Json.neu();
        for (int i = 0; i + 1 < paare.length; i += 2) m.put(String.valueOf(paare[i]), paare[i + 1]);
        return m;
    }

    static Antwort senden(String adresse, Map<String, Object> in) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(adresse).openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(VERBINDUNG_MS);
            c.setReadTimeout(LESEN_MS);
            c.setUseCaches(false);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("User-Agent", "FV-Lager-Programm/1.0");
            byte[] b = Json.schreiben(in).getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(b.length);
            OutputStream o = c.getOutputStream();
            o.write(b);
            o.close();
            int code = c.getResponseCode();
            InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
            String txt = is == null ? "" : lesen(is);
            try {
                Object j = Json.lesen(txt);
                if (j instanceof Map) return new Antwort(Json.map(j));
            } catch (RuntimeException ignoriert) { /* unten */ }
            return Antwort.fehler(code == 404
                    ? "Server-Adresse nicht gefunden (404). Bitte in den Einstellungen prüfen."
                    : "Der Server antwortet nicht wie erwartet. Stimmt die Server-Adresse und ist die neue warenwirtschaft.php hochgeladen?", true);
        } catch (java.net.UnknownHostException e) {
            return Antwort.fehler("Keine Verbindung zum Server – Internet prüfen (Adresse „" + e.getMessage() + "“ nicht erreichbar).", true);
        } catch (java.net.SocketTimeoutException e) {
            return Antwort.fehler("Der Server antwortet nicht (Zeitüberschreitung). Bitte nochmal versuchen.", true);
        } catch (Exception e) {
            return Antwort.fehler("Keine Verbindung zum Server – WLAN oder Internet prüfen.", true);
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String lesen(InputStream is) throws java.io.IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] puf = new byte[8192];
        int n;
        while ((n = is.read(puf)) > 0) b.write(puf, 0, n);
        is.close();
        return new String(b.toByteArray(), StandardCharsets.UTF_8);
    }

    /* ======================= Anmeldung ======================= */
    /** Mitarbeiter: Ausweis-Code + Lager-Passwort. Gibt die Antwort zurück (ok = angemeldet). */
    public Antwort anmeldenMitarbeiter(String ausweis, String passwort) {
        return anmelden(daten("aktion", "login_ma", "code", ausweis, "passwort", passwort, "geraet", geraet));
    }

    public Antwort anmeldenAdmin(String passwort) {
        return anmelden(daten("aktion", "login_admin", "passwort", passwort, "geraet", geraet));
    }

    private Antwort anmelden(Map<String, Object> in) {
        Antwort r = senden(schnittstelle(server), in);
        if (r.ok() && !r.str("token").isEmpty()) {
            token = r.str("token"); rolle = r.str("rolle"); name = r.str("name");
            speicher.schreiben("token", token); speicher.schreiben("rolle", rolle); speicher.schreiben("name", name);
        } else if (r.ok()) {
            return Antwort.fehler("Anmeldung fehlgeschlagen.", false);
        }
        return r;
    }

    /** Beim Server abmelden und die Anmeldung von diesem Gerät löschen */
    public void abmelden() {
        if (angemeldet()) rufe("abmelden");
        abmeldenLokal();
    }

    public void abmeldenLokal() {
        token = ""; rolle = ""; name = "";
        speicher.schreiben("token", ""); speicher.schreiben("rolle", ""); speicher.schreiben("name", "");
    }

    private void namenMerken(String n) {
        if (n.equals(name)) return;
        name = n;
        speicher.schreiben("name", n);
    }

    public static boolean siehtAusWieAusweis(String code) {
        return code != null && code.matches("(?is).*FVZ-[a-f0-9]{8}-[a-f0-9]{12}.*");
    }

    public static String vorname(String n) {
        String t = n == null ? "" : n.trim();
        int i = t.indexOf(' ');
        return i > 0 ? t.substring(0, i) : t;
    }

    /** Für die Suche: klein, ohne Umlaute und Sonderzeichen (wie in der Web-App) */
    public static String norm(String t) {
        return (t == null ? "" : t).toLowerCase(java.util.Locale.GERMAN)
                .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
                .replaceAll("[^a-z0-9]+", " ").trim();
    }
}
