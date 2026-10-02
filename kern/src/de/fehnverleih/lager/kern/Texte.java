package de.fehnverleih.lager.kern;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Texte und kleine Hilfen, die PC-Programm und Android-App gleich benutzen. */
public final class Texte {
    private Texte() { }

    public static final String APP_NAME = "FV Lager";
    public static final String VERSION = "1.0.0";

    /** Betriebsarten beim Scannen */
    public static final String[] MODI_FREI = {"info", "eingang", "abgang", "inventur"};

    public static final Map<String, String> TITEL = new LinkedHashMap<String, String>();
    public static final Map<String, String> HILFE = new LinkedHashMap<String, String>();
    static {
        TITEL.put("info", "Artikel scannen");
        TITEL.put("eingang", "Wareneingang");
        TITEL.put("abgang", "Ausbuchen");
        TITEL.put("inventur", "Inventur zählen");
        TITEL.put("packen", "Packen");
        TITEL.put("rueckgabe", "Rückgabe");
        HILFE.put("info", "Etikett scannen – du siehst Lagerplatz, Bestand und nächste Buchungen.");
        HILFE.put("eingang", "Jeder Scan erhöht den Bestand sofort um die eingestellte Menge (Minus zum Korrigieren).");
        HILFE.put("abgang", "Grund wählen, dann Artikel scannen. Jeder Scan bucht sofort aus und steht mit Grund und deinem Namen im Lagerbuch.");
        HILFE.put("inventur", "Jeder Scan zählt die eingestellte Menge dazu.");
        HILFE.put("packen", "Jeden Artikel beim Einladen scannen. Bei Stapeln die Menge vorher einstellen.");
        HILFE.put("rueckgabe", "Jeden zurückgebrachten Artikel scannen. Beschädigte Stück mit „beschädigt“ scannen.");
    }

    public static String titel(String modus) { String t = TITEL.get(modus); return t == null ? TITEL.get("info") : t; }
    public static String hilfe(String modus) { String t = HILFE.get(modus); return t == null ? "" : t; }
    public static boolean mitAuftrag(String modus) { return "packen".equals(modus) || "rueckgabe".equals(modus); }

    /** Artikel-Suche „Wo liegt …?“: alle Wörter müssen in Name, Kategorie, Regal oder Nummer vorkommen */
    public static List<Antwort> suchen(List<Antwort> alle, String eingabe) {
        List<Antwort> aus = new ArrayList<Antwort>();
        String n = Api.norm(eingabe);
        if (n.isEmpty() || alle == null) return aus;
        String[] w = n.split(" ");
        for (Antwort a : alle) {
            String t = Api.norm(a.str("name") + " " + a.str("kat") + " " + a.str("regal") + " " + a.str("id"));
            boolean alleDa = true;
            for (String x : w) if (!t.contains(x)) { alleDa = false; break; }
            if (alleDa) aus.add(a);
        }
        return aus;
    }

    /** Unterzeile einer Artikel-Zeile in der Suche */
    public static String artikelUnter(Antwort a) {
        return a.str("kat") + " · im Haus " + a.zahl("imhaus") + (a.zahl("defekt") > 0 ? ", defekt " + a.zahl("defekt") : "");
    }

    /** Inventur-Abweichung: "–", "✓" oder "+3"/"-2" */
    public static String abweichung(Integer ist, int soll) {
        if (ist == null) return "–";
        int d = ist - soll;
        return d == 0 ? "✓" : (d > 0 ? "+" : "") + d;
    }

    /** Ein Auftrag in der Lagerhalle: Unterzeile */
    public static String auftragUnter(Antwort a) {
        return ("packen".equals(a.str("modus")) ? "Ausgabe " : "Rückgabe ") + a.str("wann")
                + (a.bool("ueberfaellig") ? " – überfällig" : "") + (a.bool("lieferung") ? " · Lieferung" : " · Abholung");
    }

    public static String infoZeile(Antwort i) {
        return "Im Haus: " + i.zahl("imhaus") + " · beim Kunden: " + i.zahl("draussen") + " · defekt: " + i.zahl("defekt") + " · Bestand: " + i.zahl("bestand");
    }

    /** Menge aus einem Eingabefeld: leer, 0 oder Unsinn → 1 */
    public static int menge(String t) {
        try { int m = Integer.parseInt(t.trim()); return m == 0 ? 1 : Math.max(-9999, Math.min(9999, m)); }
        catch (Exception e) { return 1; }
    }
}
