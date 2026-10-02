package de.fehnverleih.lager.pc;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Desktop;
import java.awt.Dimension;
import java.awt.Image;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.net.URI;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import javax.imageio.ImageIO;
import javax.swing.BorderFactory;
import javax.swing.ImageIcon;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

import de.fehnverleih.lager.kern.Antwort;
import de.fehnverleih.lager.kern.Api;
import de.fehnverleih.lager.kern.Texte;
import de.fehnverleih.lager.pc.Ui.Feld;
import de.fehnverleih.lager.pc.Ui.Flaeche;
import de.fehnverleih.lager.pc.Ui.K;
import de.fehnverleih.lager.pc.Ui.Knopf;

/** Alle Seiten des Programms. Jede Seite baut sich sofort auf und lädt ihre Daten im Hintergrund. */
final class Seiten {
    private final Fenster f;

    Seiten(Fenster f) { this.f = f; }

    JComponent bauen(String v, Map<String, Object> p) {
        switch (v) {
            case "uebersicht": return uebersicht();
            case "scan": case "auftrag": return scan(p);
            case "inventur": return inventur(p);
            case "ich": return ich();
            case "mehr": return mehr();
            case "geraete": return geraete();
            case "terminal": return terminal();
            default: return halle();
        }
    }

    private static String s(Map<String, Object> p, String k) { Object o = p.get(k); return o == null ? "" : String.valueOf(o); }

    private JPanel seite(String titel) {
        JPanel s = Ui.spalte(14);
        if (titel != null) s.add(Ui.ueberschrift(titel));
        return s;
    }

    private JComponent laedt() {
        JLabel l = Ui.label("Lädt …", Ui.schrift(14.5f), Ui.GRAU);
        l.setBorder(BorderFactory.createEmptyBorder(8, 2, 8, 2));
        return l;
    }

    private JComponent leer(String t) {
        JTextArea a = Ui.text(t, Ui.schrift(14), Ui.GRAU);
        a.setBorder(BorderFactory.createEmptyBorder(6, 2, 6, 2));
        return a;
    }

    /* ======================= Übersicht (Admin) ======================= */
    private JComponent uebersicht() {
        JPanel s = seite("Übersicht");
        JPanel inhalt = Ui.spalte(14);
        inhalt.add(laedt());
        s.add(inhalt);
        f.holeFuerSeite("uebersicht", null, r -> {
            if (!r.ok()) { f.fehlerSeite(inhalt, r); return; }
            inhalt.removeAll();
            Antwort z = r.teil("zahlen");
            inhalt.add(Ui.raster(3, 12,
                    zahl(z.zahl("anfragen"), "offene Anfragen", true), zahl(z.zahl("ausgabe_heute"), "heute auszugeben", false),
                    zahl(z.zahl("rueckgabe_heute"), "Rückgaben heute", false), zahl(z.zahl("ueberfaellig"), "Rückgaben überfällig", true),
                    zahl(z.zahl("draussen"), "Aufträge beim Kunden", false), zahl(z.zahl("defekt"), "Stück defekt", true)));
            if (z.bool("inventur")) {
                Flaeche m = Ui.meldung("Eine Inventur-Zählung läuft – hier klicken, um zur Inventur zu gehen.", "hinweis");
                Ui.klickbar(m, () -> f.zeige("inventur", null));
                inhalt.add(m);
            }
            Flaeche k = Ui.karte("Jetzt eingestempelt");
            List<Antwort> da = r.liste("anwesend");
            if (da.isEmpty()) k.add(leer("Niemand eingestempelt – alle Mitarbeiter-Programme sind gesperrt."));
            for (int i = 0; i < da.size(); i++) {
                final Antwort x = da.get(i);
                Knopf aus = Ui.knopf("Ausstempeln", K.ROT);
                aus.addActionListener(e -> {
                    if (!f.fragen(x.str("name") + " jetzt ausstempeln?\nDas Programm wird für diese Person sofort gesperrt.")) return;
                    f.hole("ausstempeln", Api.daten("mid", x.str("mid")), y -> { f.toast(y.msg()); f.neuLaden(); });
                });
                k.add(Ui.pos(null, Ui.nameUnter(x.str("name"), "seit " + x.str("seit") + " · " + x.str("dauer") + " Std. · Programm frei"), aus, i < da.size() - 1));
            }
            inhalt.add(k);
            Knopf verw = Ui.knopf("Komplette Verwaltung im Browser öffnen", K.HELL, Symbol.Art.PC);
            verw.addActionListener(e -> browser("?admin&ww=start"));
            inhalt.add(Ui.fluss(0, verw));
            f.neuBerechnen();
        });
        return s;
    }

    private JComponent zahl(int n, String t, boolean warn) {
        Flaeche k = new Flaeche(Ui.spaltenLayout(2), Ui.WEISS, Ui.LINIE, 12);
        k.setBorder(BorderFactory.createEmptyBorder(14, 16, 14, 16));
        k.add(Ui.label(String.valueOf(n), Ui.titelSchrift(30), warn && n > 0 ? Ui.ROT : Ui.TEXT));
        k.add(Ui.label(t, Ui.schrift(13), Ui.GRAU));
        return k;
    }

    void browser(String pfad) {
        try { Desktop.getDesktop().browse(new URI(f.api.basis() + pfad)); }
        catch (Exception e) { f.toast("Browser konnte nicht geöffnet werden: " + f.api.basis() + pfad); }
    }

    /* ======================= Lagerhalle ======================= */
    private JComponent halle() {
        JPanel s = seite(null);
        s.add(Ui.raster(4, 12,
                Ui.kachel(Symbol.Art.SCAN, "Scannen", "Artikel erkennen", true, () -> f.zeige("scan", Api.daten("modus", "info"))),
                Ui.kachel(Symbol.Art.PLUS, "Wareneingang", "neue Ware zählen", false, () -> f.zeige("scan", Api.daten("modus", "eingang"))),
                Ui.kachel(Symbol.Art.MINUS, "Ausbuchen", "defekt, verkauft …", false, () -> f.zeige("scan", Api.daten("modus", "abgang"))),
                Ui.kachel(Symbol.Art.LISTE, "Inventur", "Bestand zählen", false, () -> f.zeige("inventur", null))));
        Flaeche such = Ui.karte();
        such.add(suchfeld("Info", this::artikelInfo, false));
        s.add(such);
        JPanel listen = Ui.spalte(14);
        listen.add(laedt());
        s.add(listen);
        f.holeFuerSeite("halle", null, r -> {
            if (!r.ok()) { f.fehlerSeite(listen, r); return; }
            listen.removeAll();
            JPanel links = Ui.spalte(10), rechts = Ui.spalte(10);
            links.add(Ui.unterUeberschrift("Packen & ausgeben"));
            List<Antwort> p = r.liste("packen");
            if (p.isEmpty()) links.add(leer("In den nächsten 7 Tagen nichts auszugeben."));
            for (Antwort a : p) links.add(auftragEintrag(a));
            rechts.add(Ui.unterUeberschrift("Rückgabe annehmen"));
            List<Antwort> rg = r.liste("rueckgabe");
            if (rg.isEmpty()) rechts.add(leer("Nichts beim Kunden."));
            for (Antwort a : rg) rechts.add(auftragEintrag(a));
            listen.add(new Ui.ZweiSpalten(links, rechts, 0.5, 760));
            f.neuBerechnen();
        });
        return s;
    }

    private JComponent auftragEintrag(final Antwort a) {
        boolean fertig = a.zahl("fertig") >= a.zahl("gesamt");
        JLabel m = Ui.marke(a.zahl("fertig") + " / " + a.zahl("gesamt"), fertig ? Ui.GRUENHELL : Ui.ORANGEHELL, fertig ? Ui.GRUEN : Ui.ORANGE);
        JLabel sym = new JLabel(Ui.sym("packen".equals(a.str("modus")) ? Symbol.Art.LKW : Symbol.Art.RUECKGABE, 22, a.bool("ueberfaellig") ? Ui.ROT : Ui.GOLD2));
        Flaeche e = Ui.eintrag(sym, a.str("nr") + " · " + (a.str("kunde").isEmpty() ? "–" : a.str("kunde")), Texte.auftragUnter(a), m,
                () -> f.zeige("auftrag", Api.daten("modus", a.str("modus"), "auftrag", a.str("id"))));
        return e;
    }

    /* ======================= Artikel-Suche „Wo liegt …?“ ======================= */
    /** Suchfeld mit Ergebnisliste. beiWahl bekommt die Artikel-ID. */
    private JComponent suchfeld(String knopfText, Consumer<String> beiWahl, boolean klein) {
        JPanel box = Ui.spalte(8);
        final Feld feld = new Feld("Wo liegt …?  Name, Regal oder Nummer");
        JLabel lupe = new JLabel(Ui.sym(Symbol.Art.SUCHE, 20, Ui.GRAU));
        box.add(Ui.zeileWachsend(10, feld, lupe));
        final JPanel erg = Ui.spalte(8);
        box.add(erg);
        final Timer warte = new Timer(180, null);
        warte.setRepeats(false);
        warte.addActionListener(e -> {
            final String t = feld.getText();
            if (Api.norm(t).isEmpty()) { erg.removeAll(); f.neuBerechnen(); return; }
            artikelLaden(alle -> {
                if (!feld.getText().equals(t) || alle == null) return;
                erg.removeAll();
                List<Antwort> l = Texte.suchen(alle, t);
                for (int i = 0; i < Math.min(15, l.size()); i++) {
                    final Antwort a = l.get(i);
                    erg.add(Ui.eintrag(Ui.regal(a.str("regal")), a.str("name"), Texte.artikelUnter(a), Ui.marke(knopfText, Ui.BLAUHELL, Ui.BLAU),
                            () -> beiWahl.accept(a.str("id"))));
                }
                if (l.size() > 15) erg.add(Ui.klein("… " + (l.size() - 15) + " weitere – genauer suchen."));
                if (l.isEmpty()) erg.add(leer("Nichts gefunden."));
                f.neuBerechnen();
            });
        });
        f.seitenTimer.add(warte);
        feld.getDocument().addDocumentListener(new DocumentListener() {
            public void insertUpdate(DocumentEvent e) { warte.restart(); }
            public void removeUpdate(DocumentEvent e) { warte.restart(); }
            public void changedUpdate(DocumentEvent e) { warte.restart(); }
        });
        feld.addActionListener(e -> warte.restart());
        return box;
    }

    /** Artikel-Liste vom Server (zwischengespeichert, bis sich Bestände ändern) */
    void artikelLaden(Consumer<List<Antwort>> fertig) {
        if (f.artikelCache != null) { fertig.accept(f.artikelCache); return; }
        f.hole("artikel", null, r -> {
            if (!r.ok()) { f.toast(r.msg()); fertig.accept(null); return; }
            f.artikelCache = r.liste("artikel");
            fertig.accept(f.artikelCache);
        });
    }

    /* ======================= Artikel-Info (Fenster) ======================= */
    void artikelInfo(String id) {
        f.hole("artikel_info", Api.daten("code", id), r -> {
            if (!r.ok()) { f.toast(r.msg()); return; }
            final JDialog d = new JDialog(f, r.teil("info").str("name"), false);
            d.getRootPane().putClientProperty("blatt", Boolean.TRUE);
            JPanel s = Ui.spalte(14);
            s.setBorder(BorderFactory.createEmptyBorder(18, 18, 18, 18));
            s.add(infoKarte(r.teil("info")));
            Knopf ein = Ui.knopf("Wareneingang", K.DUNKEL, Symbol.Art.PLUS), ab = Ui.knopf("Ausbuchen", K.DUNKEL, Symbol.Art.MINUS),
                    inv = Ui.knopf("Inventur zählen", K.DUNKEL, Symbol.Art.ZAEHLEN), zu = Ui.knopf("Schließen", K.HELL, Symbol.Art.KREUZ);
            ein.addActionListener(e -> { d.dispose(); f.zeige("scan", Api.daten("modus", "eingang")); });
            ab.addActionListener(e -> { d.dispose(); f.zeige("scan", Api.daten("modus", "abgang")); });
            inv.addActionListener(e -> { d.dispose(); f.zeige("scan", Api.daten("modus", "inventur")); });
            zu.addActionListener(e -> d.dispose());
            s.add(Ui.raster(2, 10, ein, ab, inv, zu));
            JPanel h = new JPanel(new BorderLayout());
            h.setBackground(Ui.CREME);
            h.add(s);
            d.setContentPane(h);
            d.getRootPane().registerKeyboardAction(e -> d.dispose(), KeyStroke.getKeyStroke("ESCAPE"), JComponent.WHEN_IN_FOCUSED_WINDOW);
            d.setSize(520, 10);
            s.setSize(520, 10);
            d.pack();
            d.setSize(new Dimension(540, Math.min(640, s.getPreferredSize().height + 60)));
            d.setLocationRelativeTo(f);
            d.setVisible(true);
        });
    }

    /** Karte mit Artikel-Infos (Platz, Bestände, nächste Buchungen, ggf. Bild) */
    JComponent infoKarte(Antwort i) {
        Flaeche k = Ui.karte();
        JPanel kopf = new JPanel(new BorderLayout(14, 0));
        kopf.setOpaque(false);
        JPanel t = Ui.spalte(4);
        t.add(Ui.klein(i.str("kat") + " · " + i.str("id")));
        t.add(Ui.text(i.str("name"), Ui.titelSchrift(20), Ui.TEXT));
        JPanel platz = Ui.zeile(10, Ui.label("Platz:", Ui.schrift(17), Ui.TEXT), Ui.regal(i.str("platz")));
        t.add(platz);
        kopf.add(t);
        final JLabel bild = new JLabel();
        kopf.add(bild, BorderLayout.EAST);
        k.add(kopf);
        k.add(Ui.text(Texte.infoZeile(i), Ui.schrift(15), Ui.TEXT));
        List<String> n = i.texte("naechste");
        if (!n.isEmpty()) {
            StringBuilder b = new StringBuilder("Nächste Buchungen:");
            for (String x : n) b.append("\n").append(x);
            k.add(Ui.klein(b.toString()));
        }
        final String pfad = i.str("bild");
        if (!pfad.isEmpty()) {
            f.hintergrund(() -> {
                try {
                    Image im = ImageIO.read(new URL(f.api.basis() + pfad.replace(" ", "%20")));
                    if (im == null) return null;
                    double sk = Math.min(110.0 / im.getWidth(null), 110.0 / im.getHeight(null));
                    return new ImageIcon(im.getScaledInstance((int) (im.getWidth(null) * sk), (int) (im.getHeight(null) * sk), Image.SCALE_SMOOTH));
                } catch (Exception e) { return null; }
            }, ic -> { if (ic != null) { bild.setIcon(ic); f.neuBerechnen(); } });
        }
        return k;
    }

    /* ======================= Scannen (alle Betriebsarten) ======================= */
    private JComponent scan(Map<String, Object> p) {
        final String modus = Texte.TITEL.containsKey(s(p, "modus")) ? s(p, "modus") : "info";
        final String auftrag = s(p, "auftrag");
        final boolean mitAuftrag = Texte.mitAuftrag(modus);
        JPanel s = seite(null);
        JPanel titel = new JPanel(new BorderLayout());
        titel.setOpaque(false);
        titel.add(Ui.ueberschrift(Texte.titel(modus)));
        if (mitAuftrag) {
            Knopf zur = Ui.knopf("Lagerhalle", K.HELL, Symbol.Art.ZURUECK);
            zur.addActionListener(e -> f.zeige("halle", null));
            titel.add(zur, BorderLayout.EAST);
        }
        s.add(titel);
        JPanel rumpf = Ui.spalte(14);
        s.add(rumpf);
        if (!mitAuftrag) { scanAufbauen(rumpf, modus, "", null); return s; }
        rumpf.add(laedt());
        f.holeFuerSeite("auftrag", Api.daten("id", auftrag, "modus", modus), r -> {
            if (!r.ok()) { f.fehlerSeite(rumpf, r); return; }
            scanAufbauen(rumpf, modus, auftrag, r);
        });
        return s;
    }

    private void scanAufbauen(JPanel rumpf, final String modus, final String auftrag, Antwort ar) {
        rumpf.removeAll();
        final boolean mitAuftrag = ar != null;
        final Antwort a = mitAuftrag ? ar.teil("auftrag") : null;
        JPanel links = Ui.spalte(14), rechts = Ui.spalte(14);

        if (mitAuftrag) {
            if (!a.str("zumiete").isEmpty()) links.add(Ui.meldung("Zugemietet – nicht aus unserem Lager, nicht scannen: " + a.str("zumiete"), "hinweis"));
            Flaeche kopf = Ui.karte();
            JPanel z = new JPanel(new BorderLayout(10, 0));
            z.setOpaque(false);
            z.add(Ui.text(a.str("nr") + " · " + a.str("kunde"), Ui.fett(16), Ui.TEXT));
            z.add(Ui.mitte(Ui.marke(a.str("status_text"), Ui.BLAUHELL, Ui.BLAU)), BorderLayout.EAST);
            kopf.add(z);
            kopf.add(Ui.klein(a.str("zeitraum") + " · " + a.str("lieferung")));
            if (!a.str("notiz").isEmpty()) kopf.add(Ui.klein("Notiz: " + a.str("notiz")));
            links.add(kopf);
            if (!a.bool("moeglich")) links.add(Ui.meldung("Dieser Auftrag ist " + a.str("status_text") + " – " + Texte.titel(modus) + " ist nicht mehr möglich.", "err"));
        } else {
            JPanel reiter = Ui.fluss(8);
            for (final String m : Texte.MODI_FREI) {
                Knopf k = Ui.reiter(Texte.titel(m), m.equals(modus));
                k.addActionListener(e -> f.zeige("scan", Api.daten("modus", m)));
                reiter.add(k);
            }
            links.add(reiter);
        }
        links.add(Ui.klein(Texte.hilfe(modus)));

        // ---- Scan-Karte ----
        Flaeche karte = Ui.karte();
        JComboBox<String> grund = null;
        Feld grundText = null;
        final List<String> grundSchluessel = new ArrayList<String>();
        if ("abgang".equals(modus)) {
            grund = new JComboBox<String>();
            grund.setFont(Ui.schrift(15));
            grund.addItem("– Grund wählen –");
            grundSchluessel.add("");
            Map<String, Object> g = f.gruende == null ? new HashMap<String, Object>() : f.gruende;
            for (Map.Entry<String, Object> e : g.entrySet()) { grund.addItem(String.valueOf(e.getValue())); grundSchluessel.add(e.getKey()); }
            grund.setPreferredSize(new Dimension(200, 42));
            karte.add(Ui.feld("Grund", grund));
            grundText = new Feld("z. B. Bein gebrochen");
            final JLabel pflicht = Ui.label("Bemerkung (freiwillig)", Ui.schrift(13), Ui.GRAU);
            JPanel bem = Ui.spalte(5);
            bem.add(pflicht);
            bem.add(grundText);
            karte.add(bem);
            final JComboBox<String> gr = grund;
            grund.addActionListener(e -> pflicht.setText("sonstiges".equals(grundSchluessel.get(Math.max(0, gr.getSelectedIndex()))) ? "Bemerkung (Pflicht)" : "Bemerkung (freiwillig)"));
            if (f.gruende == null) f.hole("status", null, r -> {
                if (r.hat("gruende")) { f.gruende = r.map("gruende"); for (Map.Entry<String, Object> e : f.gruende.entrySet()) { gr.addItem(String.valueOf(e.getValue())); grundSchluessel.add(e.getKey()); } }
            });
        }
        final Feld menge = new Feld("");
        menge.setText("1");
        menge.setHorizontalAlignment(SwingConstants.CENTER);
        menge.setFont(Ui.fett(17));
        menge.setPreferredSize(new Dimension(90, 46));
        if (!"info".equals(modus)) {
            Knopf minus = Ui.knopf("", K.HELL, Symbol.Art.MINUS), plus = Ui.knopf("", K.HELL, Symbol.Art.PLUS);
            minus.setPreferredSize(new Dimension(48, 46)); plus.setPreferredSize(new Dimension(48, 46));
            minus.setBorder(BorderFactory.createEmptyBorder()); plus.setBorder(BorderFactory.createEmptyBorder());
            minus.addActionListener(e -> { int m = Texte.menge(menge.getText()) - 1; if (m == 0) m = -1; menge.setText(String.valueOf(m)); });
            plus.addActionListener(e -> { int m = Texte.menge(menge.getText()) + 1; if (m == 0) m = 1; menge.setText(String.valueOf(m)); });
            karte.add(Ui.zeile(8, minus, menge, plus, Ui.label("Menge je Scan", Ui.schrift(13), Ui.GRAU)));
        }
        final Ui.Haken schaden = new Ui.Haken("beschädigt", Ui.fett(15), Ui.ROT);
        if ("rueckgabe".equals(modus)) karte.add(schaden);
        final Feld code = new Feld("Hand-Scanner oder Artikel tippen …");
        code.setFont(Ui.schrift(16.5f));
        Knopf okK = Ui.knopf("OK", K.GOLD, Symbol.Art.SCAN);
        karte.add(Ui.zeileWachsend(8, code, okK));
        final Flaeche erg = new Flaeche(new BorderLayout(), Ui.CREME2, null, 12);
        erg.setBorder(BorderFactory.createEmptyBorder(14, 16, 14, 16));
        final JTextArea ergText = Ui.text("Bereit – Artikel scannen.", Ui.fett(15.5f), Ui.TEXT);
        erg.add(ergText);
        erg.setPreferredSize(null);
        karte.add(erg);
        final Knopf rueck = Ui.knopf("Letzten Scan rückgängig", K.HELL, Symbol.Art.RUECKGABE);
        rueck.setVisible(false);
        karte.add(Ui.fluss(0, rueck));
        links.add(karte);

        final JPanel infoBox = Ui.spalte(0);
        final JPanel listeBox = Ui.spalte(0);
        final JPanel abgangBox = Ui.spalte(0);
        links.add(infoBox);

        rechts.add(listeBox);
        if ("abgang".equals(modus)) {
            Flaeche k = Ui.karte("Heute ausgebucht");
            k.add(abgangBox);
            abgangBox.add(Ui.klein("Lädt …"));
            rechts.add(k);
        }
        if (!mitAuftrag) {
            Flaeche k = Ui.karte("Wo liegt …?");
            rechts.add(k);
            final String knopfText = "info".equals(modus) ? "Anzeigen" : "Buchen";
            // Aktion wird unten gesetzt, weil sie melde() braucht
            k.putClientProperty("knopf", knopfText);
            k.setName("suche");
        }
        final Ui.Haken trotzdem = new Ui.Haken("packen".equals(modus) ? "trotzdem ausgeben, auch wenn nicht alles gepackt ist"
                : "Rückgabe mit Fehlmengen buchen (fehlende Stück werden vom Bestand abgezogen)", Ui.schrift(13.5f), Ui.GRAU);
        Knopf fertig = null;
        if (mitAuftrag && a.bool("moeglich")) {
            Flaeche k = Ui.karte();
            fertig = Ui.knopf("packen".equals(modus) ? "Ausgabe abschließen" : "Rückgabe abschließen", K.GOLD, Symbol.Art.HAKEN).gross();
            k.add(fertig);
            k.add(trotzdem);
            rechts.add(k);
        }

        // ---- Abläufe ----
        final Consumer<List<Antwort>> liste = l -> {
            listeBox.removeAll();
            if (l == null || l.isEmpty() || !mitAuftrag) { f.neuBerechnen(); return; }
            String feld = "packen".equals(modus) ? "gepackt" : "zurueck";
            int fertigN = 0, gesamt = 0;
            JPanel zeilen = Ui.spalte(0);
            for (int i = 0; i < l.size(); i++) {
                Antwort x = l.get(i);
                int ist = x.zahl(feld), m = x.zahl("menge");
                fertigN += Math.min(ist, m); gesamt += m;
                JPanel mitte = Ui.spalte(5);
                mitte.add(Ui.text(x.str("name"), Ui.fett(15), ist >= m ? Ui.GRUEN : Ui.TEXT));
                if ("rueckgabe".equals(modus) && x.zahl("schaden") > 0) mitte.add(Ui.text(x.zahl("schaden") + " beschädigt", Ui.fett(13), Ui.ROT));
                mitte.add(Ui.balken(ist, m));
                JLabel zahl = Ui.label(ist + " / " + m, Ui.fett(15.5f), ist >= m ? Ui.GRUEN : Ui.TEXT);
                zeilen.add(Ui.pos(Ui.regal(x.str("platz")), mitte, zahl, i < l.size() - 1));
            }
            Flaeche k = Ui.karte(("packen".equals(modus) ? "Packliste" : "Rückgabe") + " – " + fertigN + " von " + gesamt + " Stück");
            k.add(zeilen);
            listeBox.add(k);
            f.neuBerechnen();
        };
        final Consumer<List<Antwort>> abgang = l -> {
            abgangBox.removeAll();
            if (l == null || l.isEmpty()) abgangBox.add(Ui.klein("Heute noch nichts ausgebucht."));
            else for (int i = 0; i < l.size(); i++) {
                Antwort z = l.get(i);
                abgangBox.add(Ui.pos(Ui.regal(z.str("regal")), Ui.nameUnter(z.str("name"), z.str("grund") + (z.str("bem").isEmpty() ? "" : " · " + z.str("bem"))),
                        Ui.label(String.valueOf(z.zahl("menge")), Ui.fett(16), Ui.TEXT), i < l.size() - 1));
            }
            f.neuBerechnen();
        };
        if (ar != null) liste.accept(ar.liste("liste"));
        if ("abgang".equals(modus)) f.holeFuerSeite("abgang_liste", null, x -> { if (x.ok()) abgang.accept(x.liste("abgang")); });

        final JComboBox<String> grundF = grund;
        final Feld grundT = grundText;
        final Object[] letzter = {null};     // {code, menge, grund, text, schaden}
        final boolean[] laeuft = {false};
        final int nr = f.ansichtNr;

        final class Melder {
            void setze(String typ, String text) {
                Color[] c = Ui.meldungsFarben("ok".equals(typ) ? "ok" : "warn".equals(typ) ? "warn" : "err".equals(typ) ? "err" : "");
                erg.farben(c[0], null);
                ergText.setForeground(c[1]);
                ergText.setText(text);
                f.neuBerechnen();
            }
            void melde(String c, int m, boolean rueckgaengig, Object[] alt) {
                String g = alt != null ? (String) alt[2] : grundF == null ? "" : grundSchluessel.get(Math.max(0, grundF.getSelectedIndex()));
                String gt = alt != null ? (String) alt[3] : grundT == null ? "" : grundT.getText().trim();
                boolean sch = alt != null ? (Boolean) alt[4] : schaden.an();
                if ("abgang".equals(modus) && !rueckgaengig) {
                    if (g.isEmpty()) { setze("err", "Bitte zuerst einen Grund wählen."); Ton.spielen("err"); grundF.requestFocusInWindow(); return; }
                    if ("sonstiges".equals(g) && gt.isEmpty()) { setze("err", "Bei „Sonstiges“ bitte den Grund eintragen."); Ton.spielen("err"); grundT.requestFocusInWindow(); return; }
                }
                if (laeuft[0]) return;
                laeuft[0] = true;
                setze("", "…");
                f.hole("scan", Api.daten("modus", modus, "auftrag", auftrag, "code", c, "menge", m, "schaden", sch, "grund", g, "grundtext", gt), x -> {
                    laeuft[0] = false;
                    if (nr != f.ansichtNr) return;
                    String typ = x.typ();
                    setze(typ, (rueckgaengig && x.ok() && !x.msg().toLowerCase().contains("rückgängig") ? "Rückgängig: " : "") + x.msg());
                    Ton.spielen(x.ok() ? "ok" : "warn".equals(typ) ? "warn" : "err");
                    if (x.hat("info")) { infoBox.removeAll(); infoBox.add(infoKarte(x.teil("info"))); }
                    if (x.hat("liste")) liste.accept(x.liste("liste"));
                    if (x.hat("abgang")) abgang.accept(x.liste("abgang"));
                    if (x.ok() && !"info".equals(modus)) {
                        f.artikelCache = null;                     // Bestände haben sich geändert
                        if (!rueckgaengig) { letzter[0] = new Object[]{c, m, g, gt, sch}; rueck.setVisible(true); }
                        else { letzter[0] = null; rueck.setVisible(false); }
                    }
                    f.neuBerechnen();
                    code.requestFocusInWindow();
                });
            }
        }
        final Melder melder = new Melder();
        Runnable abschicken = () -> {
            String c = code.getText().trim();
            if (c.isEmpty()) return;
            code.setText("");
            melder.melde(c, Texte.menge(menge.getText()), false, null);
        };
        code.addActionListener(e -> abschicken.run());
        okK.addActionListener(e -> abschicken.run());
        rueck.addActionListener(e -> {
            Object[] l = (Object[]) letzter[0];
            if (l != null) melder.melde((String) l[0], -(Integer) l[1], true, l);
        });
        // Suche rechts
        for (java.awt.Component c : rechts.getComponents()) {
            if ("suche".equals(c.getName())) {
                Flaeche k = (Flaeche) c;
                String kt = (String) k.getClientProperty("knopf");
                k.add(suchfeld(kt, id -> { if ("info".equals(modus)) artikelInfo(id); else melder.melde(id, Texte.menge(menge.getText()), false, null); }, true));
            }
        }
        if (fertig != null) {
            final Knopf fk = fertig;
            fertig.addActionListener(e -> {
                fk.setEnabled(false);
                f.hole("fertig", Api.daten("id", auftrag, "modus", modus, "trotzdem", trotzdem.an()), x -> {
                    fk.setEnabled(true);
                    if (x.ok()) { Ton.spielen("ok"); f.toast(x.msg()); f.artikelCache = null; f.zeige("halle", null); return; }
                    Ton.spielen("err");
                    melder.setze("err", x.msg());
                    if (x.bool("fehlt")) { trotzdem.farbe(Ui.ROT, Ui.fett(13.5f)); f.neuBerechnen(); }
                });
            });
        }

        rumpf.add(new Ui.ZweiSpalten(links, rechts, 0.54, 820));
        f.scanZiel = code;
        f.neuBerechnen();
        SwingUtilities.invokeLater(code::requestFocusInWindow);
    }

    /* ======================= Inventur ======================= */
    private JComponent inventur(Map<String, Object> p) {
        final boolean nur = Boolean.TRUE.equals(p.get("nur"));
        JPanel s = seite("Inventur");
        JPanel inhalt = Ui.spalte(14);
        inhalt.add(laedt());
        s.add(inhalt);
        f.holeFuerSeite("inventur", null, r -> {
            if (!r.ok()) { f.fehlerSeite(inhalt, r); return; }
            inhalt.removeAll();
            List<Antwort> l = r.liste("liste");
            int gez = 0, abw = 0;
            for (Antwort x : l) { Integer ist = x.zahlOderNull("ist"); if (ist != null) { gez++; if (ist != x.zahl("soll")) abw++; } }
            inhalt.add(Ui.klein((r.bool("laeuft") ? "Zählung läuft seit " + r.str("start") + " · " + gez + " Artikel gezählt · " + abw + " Abweichungen." : "Noch keine Zählung begonnen.")
                    + " Soll = Bestand minus Stück beim Kunden. Jede Eingabe wird sofort gespeichert (Enter oder Feld verlassen)."));
            Knopf scanK = Ui.knopf("Mit Scanner zählen", K.GOLD, Symbol.Art.SCAN);
            scanK.addActionListener(e -> f.zeige("scan", Api.daten("modus", "inventur")));
            Knopf nurK = Ui.knopf(nur ? "Alle zeigen" : "Nur ungezählte", K.HELL);
            nurK.addActionListener(e -> f.zeige("inventur", Api.daten("nur", !nur)));
            inhalt.add(Ui.fluss(10, scanK, nurK));

            Flaeche k = Ui.karte();
            String alt = null;
            boolean irgendwas = false;
            for (final Antwort x : l) {
                Integer ist = x.zahlOderNull("ist");
                if (nur && ist != null) continue;
                irgendwas = true;
                if (!x.str("regal").equals(alt)) { alt = x.str("regal"); k.add(Ui.gruppe(alt.isEmpty() ? "ohne Lagerplatz" : "Regal " + alt)); }
                final int soll = x.zahl("soll");
                final Feld feld = new Feld("–");
                feld.setHorizontalAlignment(SwingConstants.CENTER);
                feld.setText(ist == null ? "" : String.valueOf(ist));
                feld.setPreferredSize(new Dimension(92, 40));
                final JLabel d = Ui.label("", Ui.fett(15), Ui.GRAU);
                d.setPreferredSize(new Dimension(46, 24));
                d.setHorizontalAlignment(SwingConstants.RIGHT);
                diff(d, ist, soll);
                final String[] gespeichert = {feld.getText().trim()};
                Runnable speichern = () -> {
                    final String w = feld.getText().trim();
                    if (w.equals(gespeichert[0])) return;
                    if (!w.isEmpty() && !w.matches("\\d{1,5}")) { f.toast("Bitte eine Zahl eingeben."); feld.setText(gespeichert[0]); return; }
                    f.hole("inventur_setzen", Api.daten("aid", x.str("id"), "wert", w.isEmpty() ? null : w), y -> {
                        if (!y.ok()) { f.toast(y.msg()); return; }
                        gespeichert[0] = w;
                        diff(d, w.isEmpty() ? null : Integer.valueOf(w), soll);
                        f.toast("Gespeichert");
                    });
                };
                feld.addActionListener(e -> { speichern.run(); feld.transferFocus(); });
                feld.addFocusListener(new FocusAdapter() { public void focusLost(FocusEvent e) { speichern.run(); } });
                JPanel rechts = Ui.zeile(10, feld, d);
                k.add(Ui.pos(null, Ui.nameUnter(x.str("name"), "Soll " + soll), rechts, true));
            }
            if (!irgendwas) k.add(leer("Alle Artikel sind gezählt."));
            inhalt.add(k);
            JPanel kn = Ui.fluss(10);
            if (f.api.admin()) {
                Knopf ab = Ui.knopf("Abschließen & Bestand anpassen", K.DUNKEL, Symbol.Art.HAKEN);
                ab.addActionListener(e -> {
                    if (!f.fragen("Inventur abschließen?\nDie Bestände der gezählten Artikel werden an die Zählung angepasst.")) return;
                    f.hole("inventur_abschliessen", null, y -> { f.toast(y.msg()); f.artikelCache = null; f.zeige("inventur", null); });
                });
                kn.add(ab);
            }
            Knopf verw = Ui.knopf("Zählung verwerfen", K.ROT, Symbol.Art.KREUZ);
            verw.addActionListener(e -> {
                if (!f.fragen("Die ganze Zählung verwerfen?")) return;
                f.hole("inventur_verwerfen", null, y -> { f.toast(y.msg()); f.zeige("inventur", null); });
            });
            kn.add(verw);
            inhalt.add(kn);
            if (!f.api.admin()) inhalt.add(Ui.klein("Abschließen kann nur die Verwaltung."));
            List<Antwort> h = r.liste("historie");
            if (f.api.admin() && !h.isEmpty()) {
                Flaeche hk = Ui.karte("Letzte Inventuren");
                for (Antwort x : h) hk.add(Ui.klein(x.str("ende") + ": " + x.zahl("gezaehlt") + " Artikel, " + x.zahl("abw") + " Abweichungen"));
                inhalt.add(hk);
            }
            f.neuBerechnen();
        });
        return s;
    }

    private static void diff(JLabel d, Integer ist, int soll) {
        String t = Texte.abweichung(ist, soll);
        d.setText(t);
        d.setForeground(ist == null ? Ui.GRAU : ist == soll ? Ui.GRUEN : Ui.ROT);
    }

    /* ======================= Ich (Mitarbeiter) ======================= */
    private JComponent ich() {
        JPanel s = seite(null);
        JPanel inhalt = Ui.spalte(14);
        inhalt.add(laedt());
        s.add(inhalt);
        f.holeFuerSeite("status", null, r -> {
            if (!r.ok()) { f.fehlerSeite(inhalt, r); return; }
            inhalt.removeAll();
            inhalt.add(Ui.ueberschrift(r.str("name")));
            inhalt.add(Ui.meldung("Eingestempelt seit " + r.str("seit") + " Uhr – das Programm ist freigeschaltet.", "ok"));
            Flaeche k = Ui.karte();
            k.add(Ui.klein("Sobald du dich am Stempel-Terminal ausstempelst, sperrt sich das Programm automatisch. Deine Buchungen stehen mit deinem Namen im Lagerbuch."));
            inhalt.add(k);
            Knopf ab = Ui.knopf("Von diesem Gerät abmelden", K.ROT, Symbol.Art.ABMELDEN);
            ab.addActionListener(e -> f.abmelden());
            inhalt.add(Ui.fluss(0, ab));
            f.neuBerechnen();
        });
        return s;
    }

    /* ======================= Mehr (Admin) ======================= */
    private JComponent mehr() {
        JPanel s = seite("Mehr");
        s.add(Ui.raster(2, 12,
                Ui.kachel(Symbol.Art.UHR, "Stempel-Terminal", "PC als Stempeluhr", true, () -> f.zeige("terminal", null)),
                Ui.kachel(Symbol.Art.GERAETE, "Geräte", "angemeldete Handys & PCs", false, () -> f.zeige("geraete", null)),
                Ui.kachel(Symbol.Art.PC, "Verwaltung", "im Browser öffnen", false, () -> browser("?admin&ww=start")),
                Ui.kachel(Symbol.Art.BUCH, "Lagerbuch", "im Browser öffnen", false, () -> browser("?admin&ww=lagerbuch"))));
        Knopf ab = Ui.knopf("Admin abmelden", K.ROT, Symbol.Art.ABMELDEN);
        ab.addActionListener(e -> f.abmelden());
        s.add(Ui.fluss(0, ab));
        return s;
    }

    /* ======================= Geräte (Admin) ======================= */
    private JComponent geraete() {
        JPanel s = seite("Angemeldete Geräte");
        s.add(Ui.klein("Handy verloren oder Mitarbeiter ausgeschieden? Hier abmelden."));
        JPanel inhalt = Ui.spalte(14);
        inhalt.add(laedt());
        s.add(inhalt);
        f.holeFuerSeite("geraete", null, r -> {
            if (!r.ok()) { f.fehlerSeite(inhalt, r); return; }
            inhalt.removeAll();
            Flaeche k = Ui.karte();
            List<Antwort> l = r.liste("geraete");
            if (l.isEmpty()) k.add(leer("Keine."));
            for (int i = 0; i < l.size(); i++) {
                final Antwort g = l.get(i);
                JComponent rechts = null;
                if (!g.bool("ich")) {
                    Knopf weg = Ui.knopf("Abmelden", K.ROT);
                    weg.addActionListener(e -> {
                        if (!f.fragen("Dieses Gerät abmelden?")) return;
                        f.hole("geraet_abmelden", Api.daten("id", g.str("id")), y -> { f.toast(y.msg()); f.neuLaden(); });
                    });
                    rechts = weg;
                }
                k.add(Ui.pos(new JLabel(Ui.sym("admin".equals(g.str("rolle")) ? Symbol.Art.SCHLUESSEL : Symbol.Art.PERSON, 22, Ui.GOLD2)),
                        Ui.nameUnter(g.str("name") + (g.bool("ich") ? " (dieses Gerät)" : ""), g.str("geraet") + "\nzuletzt " + g.str("zuletzt")), rechts, i < l.size() - 1));
            }
            inhalt.add(k);
            f.neuBerechnen();
        });
        return s;
    }

    /* ======================= Stempel-Terminal (Admin) ======================= */
    private JComponent terminal() {
        JPanel s = seite("Stempel-Terminal");
        final Flaeche anz = new Flaeche(Ui.spaltenLayout(8), Ui.DUNKEL2, null, 16);
        anz.setBorder(BorderFactory.createEmptyBorder(30, 20, 30, 20));
        final javax.swing.JTextPane gross = Ui.textMittig("", Ui.fett(26), Ui.CREME);
        final javax.swing.JTextPane mitte = Ui.textMittig("", Ui.schrift(17), Ui.CREME);
        final javax.swing.JTextPane hinweis = Ui.textMittig("", Ui.fett(15), Ui.CREME);
        final JLabel uhr = Ui.label("", Ui.titelSchrift(64), Ui.GOLD);
        uhr.setHorizontalAlignment(SwingConstants.CENTER);
        anz.add(gross); anz.add(uhr); anz.add(mitte); anz.add(hinweis);
        s.add(anz);
        final Feld code = new Feld("Ausweis mit dem Hand-Scanner scannen …");
        code.setFont(Ui.schrift(17));
        Knopf ok = Ui.knopf("OK", K.GOLD);
        s.add(Ui.zeileWachsend(8, code, ok));
        final Flaeche daK = Ui.karte("Jetzt eingestempelt");
        final JPanel da = Ui.spalte(4);
        da.add(Ui.klein("–"));
        daK.add(da);
        s.add(daK);
        s.add(Ui.klein("1. Scan = Kommen, nächster Scan = Gehen. Wer sich ausstempelt, dessen Programm wird sofort gesperrt."));

        final Runnable bereit = () -> {
            anz.farben(Ui.DUNKEL2, null);
            gross.setText("Ausweis scannen");
            gross.setForeground(Ui.CREME);
            uhr.setText(new SimpleDateFormat("HH:mm").format(new Date()));
            uhr.setVisible(true);
            mitte.setText(""); hinweis.setText("");
            mitte.setVisible(false); hinweis.setVisible(false);
            f.neuBerechnen();
        };
        final Consumer<List<Antwort>> zeigeDa = l -> {
            da.removeAll();
            if (l.isEmpty()) da.add(Ui.klein("Niemand eingestempelt."));
            for (Antwort x : l) da.add(Ui.text(x.str("name") + "  seit " + x.str("seit"), Ui.schrift(15), Ui.TEXT));
            f.neuBerechnen();
        };
        final Timer uhrT = new Timer(5000, e -> { if (uhr.isVisible()) uhr.setText(new SimpleDateFormat("HH:mm").format(new Date())); });
        uhrT.start();
        f.seitenTimer.add(uhrT);
        final Timer ruhe = new Timer(4500, e -> bereit.run());
        ruhe.setRepeats(false);
        f.seitenTimer.add(ruhe);
        final Map<String, Long> sperre = new HashMap<String, Long>();
        Runnable stempeln = () -> {
            final String c = code.getText().trim();
            code.setText("");
            if (c.isEmpty()) return;
            long t = System.currentTimeMillis();
            Long vorher = sperre.get(c);
            if (vorher != null && t - vorher < 8000) return;
            sperre.put(c, t);
            f.hole("stempeln", Api.daten("code", c), r -> {
                String typ = r.typ(), art = r.str("art");
                Color hg = r.ok() ? ("kommen".equals(art) ? Ui.GRUEN : Ui.BLAU) : "warn".equals(typ) ? Ui.GOLD2 : Ui.ROT;
                Color vg = "warn".equals(typ) ? Ui.DUNKEL : Color.WHITE;
                anz.farben(hg, null);
                uhr.setVisible(false);
                gross.setForeground(vg); mitte.setForeground(vg); hinweis.setForeground(vg);
                gross.setText(r.str("titel").isEmpty() ? r.msg() : r.str("titel"));
                mitte.setText(r.str("titel").isEmpty() ? "" : r.msg());
                mitte.setVisible(!mitte.getText().isEmpty());
                hinweis.setText(r.str("hinweis"));
                hinweis.setVisible(!r.str("hinweis").isEmpty());
                Ton.spielen(r.ok() ? art : typ);
                if (r.hat("da")) zeigeDa.accept(r.liste("da"));
                f.neuBerechnen();
                ruhe.restart();
                code.requestFocusInWindow();
            });
        };
        code.addActionListener(e -> stempeln.run());
        ok.addActionListener(e -> stempeln.run());
        bereit.run();
        f.holeFuerSeite("uebersicht", null, r -> { if (r.ok()) zeigeDa.accept(r.liste("anwesend")); });
        f.scanZiel = code;
        SwingUtilities.invokeLater(code::requestFocusInWindow);
        return s;
    }

    /* ======================= Einstellungen ======================= */
    void einstellungen(Runnable danach) {
        final JDialog d = new JDialog(f, "Einstellungen", true);
        JPanel s = Ui.spalte(14);
        s.setBorder(BorderFactory.createEmptyBorder(20, 22, 20, 22));
        s.add(Ui.ueberschrift("Einstellungen"));
        Flaeche k = Ui.karte("Server");
        final Feld server = new Feld(Api.STANDARD_SERVER);
        server.setText(f.api.server);
        k.add(Ui.feld("Adresse der Webseite (mit der warenwirtschaft.php)", server));
        k.add(Ui.klein("Normalerweise: www.fehnverleih.de (das Programm hängt „?lagerapp“ selbst an)."));
        final JPanel test = Ui.spalte(0);
        Knopf pruef = Ui.knopf("Verbindung testen", K.HELL, Symbol.Art.AKTUALISIEREN);
        pruef.addActionListener(e -> {
            final String adr = server.getText();
            Fenster.meldungSetzen(test, "Teste …", "");
            f.hintergrund(() -> verbindungTesten(adr), t -> { Fenster.meldungSetzen(test, t[1], t[0]); d.pack(); });
        });
        k.add(Ui.fluss(0, pruef));
        k.add(test);
        s.add(k);
        Flaeche k2 = Ui.karte("Programm");
        final JCheckBox ton = new JCheckBox("Töne beim Scannen", Ton.an);
        ton.setOpaque(false);
        ton.setFont(Ui.schrift(15));
        k2.add(ton);
        final Feld geraet = new Feld("z. B. PC Lagerhalle");
        geraet.setText(f.speicher.lesen("geraet"));
        k2.add(Ui.feld("Name dieses Geräts (erscheint in der Geräte-Liste)", geraet));
        k2.add(Ui.klein(f.version() + " · Java " + System.getProperty("java.version")));
        s.add(k2);
        Knopf speichern = Ui.knopf("Speichern", K.DUNKEL, Symbol.Art.HAKEN), abbr = Ui.knopf("Abbrechen", K.HELL);
        s.add(Ui.fluss(10, speichern, abbr));
        abbr.addActionListener(e -> d.dispose());
        speichern.addActionListener(e -> {
            boolean neuerServer = !Api.schnittstelle(server.getText()).equals(Api.schnittstelle(f.api.server));
            if (neuerServer && f.api.angemeldet() && !f.fragen("Mit einer anderen Server-Adresse musst du dich neu anmelden. Weiter?")) return;
            f.api.serverSetzen(server.getText());
            Ton.an = ton.isSelected();
            f.speicher.schreiben("ton", ton.isSelected() ? "an" : "aus");
            f.speicher.schreiben("geraet", geraet.getText().trim());
            f.api.geraet = Start.geraetName(f.speicher);
            d.dispose();
            if (neuerServer && f.api.angemeldet()) f.abmeldenLokal("Server-Adresse geändert – bitte neu anmelden.");
            else if (danach != null) danach.run();
        });
        JPanel h = new JPanel(new BorderLayout());
        h.setBackground(Ui.CREME);
        h.add(s);
        d.setContentPane(h);
        d.getRootPane().registerKeyboardAction(e -> d.dispose(), KeyStroke.getKeyStroke("ESCAPE"), JComponent.WHEN_IN_FOCUSED_WINDOW);
        s.setSize(540, 10);
        d.pack();
        d.setSize(580, d.getHeight() + 40);
        d.setLocationRelativeTo(f);
        d.setVisible(true);
    }

    /** {art, text} */
    static String[] verbindungTesten(String adresse) {
        try {
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new URL(Api.schnittstelle(adresse)).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(12000);
            int code = c.getResponseCode();
            java.io.InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
            String t = is == null ? "" : new String(is.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            if (t.contains("Lager-App-Schnittstelle bereit")) return new String[]{"ok", "Verbindung klappt – der Server ist bereit."};
            return new String[]{"err", "Server erreichbar (Code " + code + "), aber die Lager-Schnittstelle antwortet nicht. Ist die neue warenwirtschaft.php hochgeladen?"};
        } catch (Exception e) {
            return new String[]{"err", "Keine Verbindung: " + e.getClass().getSimpleName() + (e.getMessage() == null ? "" : " – " + e.getMessage())};
        }
    }
}
