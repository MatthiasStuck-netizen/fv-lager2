package de.fehnverleih.navi;

import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * Kleiner IMAP-Leser (nur lesen, nichts löschen): holt die neuesten E-Mails aus dem Posteingang
 * bzw. den Text einer E-Mail. Läuft im Hintergrund; die Oberfläche fragt den Stand ab.
 * Verbindung immer verschlüsselt (IMAP über SSL/TLS, Port 993).
 */
public final class Post {
    private Post() {}

    private static volatile boolean laeuft = false;
    private static volatile String ergebnis = "{\"ok\":true}";
    private static volatile long auftrag = 0;

    static String stand() {
        String e = ergebnis;
        return e.substring(0, e.length() - 1) + ",\"laeuft\":" + laeuft + ",\"auftrag\":" + auftrag + "}";
    }

    static synchronized void abrufen(final JSONObject a) {
        if (laeuft) return;
        laeuft = true;
        final long nr = ++auftrag;
        new Thread(new Runnable() { @Override public void run() {
            String aus;
            try { aus = holen(a).put("auftrag", nr).toString(); }
            catch (Throwable t) {
                String m = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
                aus = Extras.fehler(m);
            }
            ergebnis = aus.replace(",\"laeuft\":false", "").replace(",\"laeuft\":true", "");
            laeuft = false;
        } }, "fv-post").start();
    }

    /* ---------- Verbindung ---------- */
    private static final class Imap {
        SSLSocket s; InputStream in; OutputStream out; int tag = 0;
        Imap(String host, int port) throws Exception {
            s = Post.tls(host, port, 30000);
            in = new BufferedInputStream(s.getInputStream());
            out = s.getOutputStream();
            zeile();   // Begrüßung
        }
        /** Eine Antwortzeile samt eingebetteter Literale {n} */
        List<Object> antwortTeile = new ArrayList<>();
        String zeile() throws Exception {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            int c;
            while ((c = in.read()) != -1) { if (c == '\n') break; b.write(c); }
            if (c == -1 && b.size() == 0) throw new Exception("Verbindung getrennt");
            String z = new String(b.toByteArray(), "ISO-8859-1");
            if (z.endsWith("\r")) z = z.substring(0, z.length() - 1);
            return z;
        }
        byte[] literal(int n) throws Exception {
            byte[] d = new byte[n]; int o = 0;
            while (o < n) { int r = in.read(d, o, n - o); if (r < 0) throw new Exception("Verbindung getrennt"); o += r; }
            return d;
        }
        /** Befehl senden, alle Antworten bis zum Abschluss sammeln. Untagged-Antworten mit Literalen als Liste [text, bytes, text, …] */
        List<List<Object>> befehl(String cmd) throws Exception {
            String t = "a" + (++tag);
            out.write((t + " " + cmd + "\r\n").getBytes("UTF-8"));
            out.flush();
            List<List<Object>> alle = new ArrayList<>();
            List<Object> akt = null;
            while (true) {
                String z = zeile();
                if (akt == null) {
                    if (z.startsWith(t + " ")) {
                        String rest = z.substring(t.length() + 1);
                        if (!rest.startsWith("OK")) throw new Exception(rest.replaceFirst("^(NO|BAD)\\s*", "").replaceAll("\\[[^\\]]*\\]\\s*", "").trim());
                        return alle;
                    }
                    akt = new ArrayList<>();
                }
                Matcher m = LIT.matcher(z);
                if (m.find()) {
                    akt.add(z.substring(0, m.start()));
                    akt.add(literal(Integer.parseInt(m.group(1))));
                    continue;   // dieselbe Antwort geht nach dem Literal weiter
                }
                akt.add(z);
                alle.add(akt);
                akt = null;
            }
        }
        void zu() { try { befehl("LOGOUT"); } catch (Throwable ignored) {} try { s.close(); } catch (Throwable ignored) {} }
    }
    private static final Pattern LIT = Pattern.compile("\\{(\\d+)\\}$");

    /** Verschlüsselte Verbindung mit Servername (SNI) und Prüfung, ob das Zertifikat zum Server passt */
    static SSLSocket tls(String host, int port, int zeit) throws Exception {
        java.net.Socket roh = new java.net.Socket();
        roh.connect(new InetSocketAddress(host, port), 15000);
        SSLSocket s = (SSLSocket) ((SSLSocketFactory) SSLSocketFactory.getDefault()).createSocket(roh, host, port, true);
        javax.net.ssl.SSLParameters p = s.getSSLParameters();
        p.setEndpointIdentificationAlgorithm("HTTPS");
        s.setSSLParameters(p);
        s.setSoTimeout(zeit);
        s.startHandshake();
        return s;
    }

    private static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

    private static JSONObject holen(JSONObject a) throws Exception {
        String host = a.optString("server").trim(), user = a.optString("benutzer").trim(), pass = a.optString("passwort");
        int port = a.optInt("port", 993), anzahl = Math.max(5, Math.min(50, a.optInt("anzahl", 25)));
        long uid = a.optLong("uid", 0);
        if (host.length() == 0 || user.length() == 0) throw new Exception("Server oder Benutzer fehlt");
        Imap i = new Imap(host, port);
        try {
            i.befehl("LOGIN " + q(user) + " " + q(pass));
            List<List<Object>> sel = i.befehl("EXAMINE INBOX");   // nur lesen
            int existiert = 0;
            for (List<Object> r : sel) { Matcher m = Pattern.compile("^\\* (\\d+) EXISTS").matcher(String.valueOf(r.get(0))); if (m.find()) existiert = Integer.parseInt(m.group(1)); }
            JSONObject aus = new JSONObject().put("ok", true).put("anzahl", existiert);
            if (uid > 0) {
                List<List<Object>> r = i.befehl("UID FETCH " + uid + " (UID FLAGS BODY.PEEK[]<0.400000>)");
                for (List<Object> x : r) for (Object o : x) if (o instanceof byte[]) {
                    Mime m = Mime.lesen((byte[]) o);
                    aus.put("mail", new JSONObject().put("uid", uid).put("von", m.kopf("from")).put("an", m.kopf("to")).put("betreff", m.kopf("subject"))
                        .put("datum", m.kopf("date")).put("text", m.text()).put("anhaenge", m.anhaenge));
                }
                return aus;
            }
            JSONArray l = new JSONArray();
            if (existiert > 0) {
                int von = Math.max(1, existiert - anzahl + 1);
                List<List<Object>> r = i.befehl("FETCH " + von + ":" + existiert + " (UID FLAGS RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])");
                for (List<Object> x : r) {
                    StringBuilder vorn = new StringBuilder(); byte[] kopf = null;
                    for (Object o : x) { if (o instanceof byte[]) kopf = (byte[]) o; else vorn.append(o).append(' '); }
                    String v = vorn.toString();
                    Matcher mu = Pattern.compile("UID (\\d+)").matcher(v); if (!mu.find()) continue;
                    boolean gelesen = v.contains("\\Seen");
                    Mime m = Mime.lesen(kopf == null ? new byte[0] : kopf);
                    l.put(new JSONObject().put("uid", Long.parseLong(mu.group(1))).put("gelesen", gelesen).put("von", m.kopf("from"))
                        .put("betreff", m.kopf("subject")).put("datum", m.kopf("date")));
                }
            }
            JSONArray umgekehrt = new JSONArray();
            for (int k = l.length() - 1; k >= 0; k--) umgekehrt.put(l.get(k));
            return aus.put("liste", umgekehrt);
        } finally { i.zu(); }
    }

    /* ---------- MIME: Kopfzeilen, Text-Teil, Zeichensätze ---------- */
    static final class Mime {
        final java.util.LinkedHashMap<String, String> koepfe = new java.util.LinkedHashMap<>();
        byte[] koerper = new byte[0];
        final JSONArray anhaenge = new JSONArray();
        String textPlain = null, textHtml = null;

        String kopf(String n) { String v = koepfe.get(n.toLowerCase(Locale.ROOT)); return v == null ? "" : woerter(v); }

        static Mime lesen(byte[] roh) {
            Mime m = new Mime();
            m.teil(roh, 0);
            return m;
        }
        private static int kopfEnde(byte[] b) {
            for (int i = 0; i + 1 < b.length; i++) {
                if (b[i] == '\n' && b[i + 1] == '\n') return i + 2;
                if (i + 3 < b.length && b[i] == '\r' && b[i + 1] == '\n' && b[i + 2] == '\r' && b[i + 3] == '\n') return i + 4;
            }
            return b.length;
        }
        private static java.util.LinkedHashMap<String, String> kopfLesen(String t) {
            java.util.LinkedHashMap<String, String> k = new java.util.LinkedHashMap<>();
            String name = null; StringBuilder wert = new StringBuilder();
            for (String z : t.split("\r?\n")) {
                if (z.length() > 0 && (z.charAt(0) == ' ' || z.charAt(0) == '\t')) { wert.append(' ').append(z.trim()); continue; }
                if (name != null && !k.containsKey(name)) k.put(name, wert.toString().trim());
                int p = z.indexOf(':');
                if (p <= 0) { name = null; continue; }
                name = z.substring(0, p).trim().toLowerCase(Locale.ROOT); wert = new StringBuilder(z.substring(p + 1));
            }
            if (name != null && !k.containsKey(name)) k.put(name, wert.toString().trim());
            return k;
        }
        private void teil(byte[] roh, int tiefe) {
            int e = kopfEnde(roh);
            java.util.LinkedHashMap<String, String> k = kopfLesen(new String(roh, 0, e, Charset.forName("ISO-8859-1")));
            if (tiefe == 0) koepfe.putAll(k);
            byte[] body = new byte[Math.max(0, roh.length - e)];
            System.arraycopy(roh, e, body, 0, body.length);
            String ct = k.containsKey("content-type") ? k.get("content-type") : "text/plain";
            String typ = ct.split(";")[0].trim().toLowerCase(Locale.ROOT);
            String cd = k.containsKey("content-disposition") ? k.get("content-disposition").toLowerCase(Locale.ROOT) : "";
            if (typ.startsWith("multipart/") && tiefe < 8) {
                String grenze = param(ct, "boundary");
                if (grenze == null) return;
                for (byte[] t : teilen(body, grenze)) teil(t, tiefe + 1);
                return;
            }
            String name = param(cd, "filename"); if (name == null) name = param(ct, "name");
            if (cd.startsWith("attachment") || (name != null && !typ.startsWith("text/"))) {
                try { anhaenge.put(woerter(name == null ? typ : name)); } catch (Exception ignored) {}
                return;
            }
            if (!typ.equals("text/plain") && !typ.equals("text/html")) return;
            String cte = k.containsKey("content-transfer-encoding") ? k.get("content-transfer-encoding").trim().toLowerCase(Locale.ROOT) : "";
            byte[] d = cte.equals("base64") ? b64(body) : cte.equals("quoted-printable") ? qp(body) : body;
            String cs = param(ct, "charset");
            String text = dekodieren(d, cs == null ? "UTF-8" : cs);
            if (typ.equals("text/plain") && textPlain == null) textPlain = text;
            if (typ.equals("text/html") && textHtml == null) textHtml = text;
        }
        String text() {
            String t = textPlain != null && textPlain.trim().length() > 0 ? textPlain : textHtml != null ? ohneHtml(textHtml) : "";
            t = t.replace("\r", "").replaceAll("\n{3,}", "\n\n").trim();
            return t.length() > 60000 ? t.substring(0, 60000) + " …" : t;
        }
        private static List<byte[]> teilen(byte[] b, String grenze) {
            List<byte[]> l = new ArrayList<>();
            String s = new String(b, Charset.forName("ISO-8859-1")), g = "--" + grenze;
            int p = s.indexOf(g);
            while (p >= 0) {
                int start = s.indexOf('\n', p);
                if (start < 0) break;
                if (s.startsWith(g + "--", p)) break;
                start++;
                int ende = s.indexOf("\n" + g, start);
                int stop = ende < 0 ? s.length() : ende;
                if (stop > start && s.charAt(stop - 1) == '\r') stop--;
                l.add(s.substring(start, Math.max(start, stop)).getBytes(Charset.forName("ISO-8859-1")));
                if (ende < 0) break;
                p = ende + 1;
            }
            return l;
        }
        static String param(String kopf, String name) {
            if (kopf == null) return null;
            Matcher m = Pattern.compile("(?i)(?:^|;)\\s*" + Pattern.quote(name) + "\\*?\\s*=\\s*(\"([^\"]*)\"|[^;\\s]+)").matcher(kopf);
            if (!m.find()) return null;
            String v = m.group(2) != null ? m.group(2) : m.group(1);
            if (v.matches("(?i)^[a-z0-9-]+''.*")) {   // RFC 2231: utf-8''Name%20mit%20Leerzeichen
                try { int p = v.indexOf("''"); return java.net.URLDecoder.decode(v.substring(p + 2).replace("+", "%2B"), v.substring(0, p)); } catch (Exception ignored) {}
            }
            return v;
        }
        static byte[] b64(byte[] b) {
            try { return Base64.decode(new String(b, "US-ASCII").replaceAll("[^A-Za-z0-9+/=]", ""), Base64.DEFAULT); } catch (Exception e) { return b; }
        }
        static byte[] qp(byte[] b) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            for (int i = 0; i < b.length; i++) {
                int c = b[i] & 0xff;
                if (c == '=' && i + 1 < b.length) {
                    if (b[i + 1] == '\n') { i++; continue; }
                    if (b[i + 1] == '\r' && i + 2 < b.length && b[i + 2] == '\n') { i += 2; continue; }
                    if (i + 2 < b.length) {
                        int h = Character.digit(b[i + 1], 16), l = Character.digit(b[i + 2], 16);
                        if (h >= 0 && l >= 0) { o.write(h * 16 + l); i += 2; continue; }
                    }
                }
                o.write(c);
            }
            return o.toByteArray();
        }
        static String dekodieren(byte[] d, String cs) {
            try { return new String(d, Charset.forName(cs.trim().replace("\"", ""))); } catch (Exception e) {
                try { return new String(d, "UTF-8"); } catch (Exception e2) { return new String(d); }
            }
        }
        private static final Pattern WORT = Pattern.compile("=\\?([^?]+)\\?([bBqQ])\\?([^?]*)\\?=");
        /** RFC 2047: =?UTF-8?B?…?= und =?ISO-8859-1?Q?…?= in Kopfzeilen */
        static String woerter(String s) {
            if (s == null) return "";
            s = s.replaceAll("\\?=\\s+=\\?", "?==?");
            Matcher m = WORT.matcher(s);
            StringBuffer b = new StringBuffer();
            while (m.find()) {
                String cs = m.group(1).replaceAll("\\*.*$", ""), art = m.group(2).toUpperCase(Locale.ROOT), t = m.group(3);
                byte[] d;
                try { d = art.equals("B") ? Base64.decode(t, Base64.DEFAULT) : qp(t.replace('_', ' ').getBytes("US-ASCII")); } catch (Exception e) { d = t.getBytes(); }
                m.appendReplacement(b, Matcher.quoteReplacement(dekodieren(d, cs)));
            }
            m.appendTail(b);
            return b.toString().replaceAll("\\s+", " ").trim();
        }
        static String ohneHtml(String h) {
            String t = h.replaceAll("(?is)<(script|style|head)[^>]*>.*?</\\1>", " ")
                .replaceAll("(?i)<br\\s*/?>", "\n").replaceAll("(?i)</(p|div|tr|li|h[1-6])>", "\n").replaceAll("(?s)<[^>]+>", " ");
            t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
                .replace("&auml;", "ä").replace("&ouml;", "ö").replace("&uuml;", "ü").replace("&Auml;", "Ä").replace("&Ouml;", "Ö").replace("&Uuml;", "Ü").replace("&szlig;", "ß").replace("&euro;", "€");
            Matcher m = Pattern.compile("&#(x?[0-9a-fA-F]+);").matcher(t);
            StringBuffer b = new StringBuffer();
            while (m.find()) {
                String n = m.group(1); int c;
                try { c = n.startsWith("x") || n.startsWith("X") ? Integer.parseInt(n.substring(1), 16) : Integer.parseInt(n); } catch (Exception e) { c = 32; }
                m.appendReplacement(b, Matcher.quoteReplacement(new String(Character.toChars(c))));
            }
            m.appendTail(b);
            return b.toString().replaceAll("[ \\t]+", " ").replaceAll(" *\n *", "\n");
        }
    }
}
