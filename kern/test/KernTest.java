import de.fehnverleih.lager.kern.*;
import java.util.*;

/** Prüft den Kern gegen einen laufenden Test-Server (echte warenwirtschaft.php). Aufruf: java KernTest http://127.0.0.1:8099/ */
public class KernTest {
    static int ok = 0, fehler = 0;
    static void pruefe(boolean b, String was) { if (b) ok++; else { fehler++; System.out.println("FEHLER: " + was); } }
    static class Mem implements Api.Speicher {
        Map<String, String> m = new HashMap<>();
        public String lesen(String k) { return m.get(k); }
        public void schreiben(String k, String v) { if (v == null || v.isEmpty()) m.remove(k); else m.put(k, v); }
    }
    public static void main(String[] a) throws Exception {
        String srv = a.length > 0 ? a[0] : "http://127.0.0.1:8099/";
        pruefe(Api.schnittstelle("www.fehnverleih.de").equals("https://www.fehnverleih.de/?lagerapp"), "Adresse 1: " + Api.schnittstelle("www.fehnverleih.de"));
        pruefe(Api.schnittstelle("https://www.fehnverleih.de/lager-app/").equals("https://www.fehnverleih.de/?lagerapp"), "Adresse 2");
        pruefe(Api.schnittstelle("https://x.de/shop/index.php").equals("https://x.de/shop/?lagerapp"), "Adresse 3: " + Api.schnittstelle("https://x.de/shop/index.php"));
        pruefe(Api.schnittstelle("https://x.de/?lagerapp").equals("https://x.de/?lagerapp"), "Adresse 4");

        final List<String> ereignisse = new ArrayList<>();
        Api.Beobachter beo = new Api.Beobachter() {
            public void abgemeldet(String m) { ereignisse.add("abgemeldet"); }
            public void gesperrt(String m) { ereignisse.add("gesperrt"); }
            public void frei(Antwort r) { ereignisse.add("frei"); }
        };
        // Admin
        Api ad = new Api(new Mem()); ad.serverSetzen(srv); ad.beobachter = beo; ad.geraet = "Test-PC";
        pruefe(!ad.anmeldenAdmin("falsch").ok(), "Admin falsch abgelehnt");
        Antwort r = ad.anmeldenAdmin("Hotel-24");
        pruefe(r.ok() && ad.admin(), "Admin angemeldet: " + r.msg());
        r = ad.rufe("status");
        pruefe(r.ok() && r.frei() && r.map("gruende").size() == 7, "Status Admin");
        r = ad.rufe("halle");
        pruefe(r.liste("packen").size() == 1 && r.liste("rueckgabe").size() == 1, "Halle");
        r = ad.rufe("auftrag", Api.daten("id", "aaaa00000001", "modus", "packen"));
        pruefe(r.teil("auftrag").bool("moeglich") && r.liste("liste").size() == 3, "Auftrag");
        pruefe(r.teil("auftrag").str("zumiete").contains("Stehtisch"), "Zumiete-Text: " + r.teil("auftrag").str("zumiete"));

        // Mitarbeiter: nicht eingestempelt → gesperrt
        Api ma = new Api(new Mem()); ma.serverSetzen(srv); ma.beobachter = beo;
        pruefe(!ma.anmeldenMitarbeiter("FVZ-0a1b2c3d-aabbccddeeff", "falsch").ok(), "MA falsches PW");
        r = ma.anmeldenMitarbeiter("FVZ-0a1b2c3d-aabbccddeeff", "Silvia");
        pruefe(r.ok() && !ma.admin() && ma.name.equals("Silvia Saathoff"), "MA angemeldet");
        ereignisse.clear();
        r = ma.rufe("status");
        pruefe(r.stop && ereignisse.contains("gesperrt"), "MA gesperrt, solange nicht eingestempelt: " + r.typ());
        // Admin-Terminal stempelt ein
        r = ad.rufe("stempeln", Api.daten("code", "FVZ-0a1b2c3d-aabbccddeeff"));
        pruefe(r.ok() && "kommen".equals(r.str("art")), "eingestempelt: " + r.str("titel"));
        ereignisse.clear();
        r = ma.rufe("status");
        pruefe(r.ok() && r.frei() && !r.str("seit").isEmpty() && ereignisse.contains("frei"), "MA frei");
        // Scannen
        r = ma.rufe("scan", Api.daten("modus", "info", "code", "FV:a3", "menge", 1));
        pruefe(r.ok() && r.teil("info").zahl("imhaus") == 4, "Info-Scan");
        r = ma.rufe("scan", Api.daten("modus", "eingang", "code", "a2", "menge", 3));
        pruefe(r.ok() && r.msg().contains("15"), "Eingang: " + r.msg());
        r = ma.rufe("scan", Api.daten("modus", "abgang", "code", "a1", "menge", 1, "grund", "defekt", "grundtext", "Bein ab"));
        pruefe(r.ok() && r.liste("abgang").size() == 1, "Abgang: " + r.msg());
        r = ma.rufe("scan", Api.daten("modus", "packen", "auftrag", "aaaa00000001", "code", "FV:a1", "menge", 30));
        pruefe(r.ok() && r.liste("liste").size() == 3, "Packen: " + r.msg());
        r = ma.rufe("fertig", Api.daten("id", "aaaa00000001", "modus", "packen", "trotzdem", false));
        pruefe(!r.ok() && r.bool("fehlt"), "Ausgabe: fehlt noch");
        r = ma.rufe("fertig", Api.daten("id", "aaaa00000001", "modus", "packen", "trotzdem", true));
        pruefe(r.ok(), "Ausgabe trotzdem: " + r.msg());
        r = ma.rufe("scan", Api.daten("modus", "rueckgabe", "auftrag", "aaaa00000002", "code", "FV:a6", "menge", 8));
        r = ma.rufe("scan", Api.daten("modus", "rueckgabe", "auftrag", "aaaa00000002", "code", "FV:a3", "menge", 1, "schaden", true));
        pruefe(r.ok() && r.msg().contains("beschädigt"), "Rückgabe Schaden: " + r.msg());
        r = ma.rufe("fertig", Api.daten("id", "aaaa00000002", "modus", "rueckgabe", "trotzdem", false));
        pruefe(!r.ok() && r.bool("fehlt"), "Rückgabe fehlt: " + r.msg());
        r = ma.rufe("fertig", Api.daten("id", "aaaa00000002", "modus", "rueckgabe", "trotzdem", true));
        pruefe(r.ok(), "Rückgabe gebucht: " + r.msg());
        // Inventur
        r = ma.rufe("inventur_setzen", Api.daten("aid", "a5", "wert", "190"));
        pruefe(r.ok(), "Inventur setzen");
        r = ma.rufe("inventur");
        Integer ist = null; for (Antwort x : r.liste("liste")) if (x.str("id").equals("a5")) ist = x.zahlOderNull("ist");
        pruefe(r.bool("laeuft") && ist != null && ist == 190, "Inventur Liste");
        r = ma.rufe("inventur_abschliessen");
        pruefe(!r.ok(), "MA darf nicht abschließen");
        r = ad.rufe("inventur_abschliessen");
        pruefe(r.ok(), "Admin schließt ab: " + r.msg());
        r = ma.rufe("uebersicht");
        pruefe(!r.ok(), "Übersicht nur Admin");
        // Admin stempelt aus → MA gesperrt
        r = ad.rufe("uebersicht");
        pruefe(r.liste("anwesend").size() == 1, "anwesend");
        r = ad.rufe("ausstempeln", Api.daten("mid", "0a1b2c3d"));
        pruefe(r.ok(), "ausgestempelt: " + r.msg());
        ereignisse.clear();
        r = ma.rufe("halle");
        pruefe(r.stop && ereignisse.contains("gesperrt"), "nach Ausstempeln gesperrt");
        // Gerät abmelden → MA abgemeldet
        r = ad.rufe("geraete");
        String id = null; for (Antwort g : r.liste("geraete")) if (g.str("rolle").equals("lager")) id = g.str("id");
        r = ad.rufe("geraet_abmelden", Api.daten("id", id));
        pruefe(r.ok(), "Gerät abgemeldet");
        ereignisse.clear();
        r = ma.rufe("status");
        pruefe(r.stop && ereignisse.contains("abgemeldet") && !ma.angemeldet(), "MA abgemeldet");
        ad.abmelden();
        pruefe(!ad.angemeldet(), "Admin abgemeldet");
        // Netzfehler
        Api x = new Api(new Mem()); x.serverSetzen("http://127.0.0.1:1/");
        r = x.rufe("status");
        pruefe(r.netz && !r.ok(), "Netzfehler erkannt: " + r.msg());
        System.out.println(ok + " Prüfungen ok, " + fehler + " Fehler");
        if (fehler > 0) System.exit(1);
    }
}
