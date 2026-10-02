package de.fehnverleih.lager.kern;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Eine Antwort des Servers (JSON-Objekt) mit bequemen Lese-Hilfen. */
public final class Antwort {
    public final Map<String, Object> m;
    /** true = Netzwerk- oder Serverfehler (keine gültige Antwort erhalten) */
    public boolean netz;
    /** true = gesperrt oder abgemeldet – die Oberfläche wurde schon umgeschaltet, nichts weiter tun */
    public boolean stop;

    public Antwort(Map<String, Object> m) { this.m = m; }

    public static Antwort fehler(String msg, boolean netz) {
        Map<String, Object> m = Json.neu();
        m.put("typ", "err");
        m.put("msg", msg);
        Antwort a = new Antwort(m);
        a.netz = netz;
        return a;
    }

    public String typ() { return str("typ"); }
    public String msg() { return str("msg"); }
    public boolean ok() { return "ok".equals(typ()); }
    public boolean frei() { return bool("frei"); }

    public boolean hat(String k) { return m.containsKey(k) && m.get(k) != null; }
    public String str(String k) { return Json.str(m.get(k)); }
    public int zahl(String k) { return Json.zahl(m.get(k)); }
    public boolean bool(String k) { return Json.bool(m.get(k)); }
    public Map<String, Object> map(String k) { return Json.map(m.get(k)); }
    public Antwort teil(String k) { return new Antwort(map(k)); }

    /** Liste von Objekten als Antwort-Objekte */
    public List<Antwort> liste(String k) {
        List<Antwort> l = new ArrayList<Antwort>();
        for (Object o : Json.liste(m.get(k))) l.add(new Antwort(Json.map(o)));
        return l;
    }

    /** Liste von Texten */
    public List<String> texte(String k) {
        List<String> l = new ArrayList<String>();
        for (Object o : Json.liste(m.get(k))) l.add(Json.str(o));
        return l;
    }

    /** null, wenn der Wert fehlt oder null ist (z. B. „ist“ in der Inventur) */
    public Integer zahlOderNull(String k) { return m.get(k) == null ? null : Json.zahl(m.get(k)); }
}
