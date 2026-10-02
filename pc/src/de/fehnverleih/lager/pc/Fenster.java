package de.fehnverleih.lager.pc;

import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.GridBagLayout;
import java.awt.Image;
import java.awt.KeyboardFocusManager;
import java.awt.event.KeyEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

import javax.imageio.ImageIO;
import javax.swing.BorderFactory;
import javax.swing.ImageIcon;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JLayeredPane;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.text.JTextComponent;

import de.fehnverleih.lager.kern.Antwort;
import de.fehnverleih.lager.kern.Api;
import de.fehnverleih.lager.kern.Texte;
import de.fehnverleih.lager.pc.Ui.Flaeche;
import de.fehnverleih.lager.pc.Ui.K;
import de.fehnverleih.lager.pc.Ui.Knopf;

/** Das Programmfenster: Anmeldung, Sperre, Navigation und Rahmen für die Seiten. */
public final class Fenster extends JFrame implements Api.Beobachter {

    public static final int PULS_FREI_MS = 20000, PULS_GESPERRT_MS = 8000;

    final Api api;
    final DateiSpeicher speicher;
    final ExecutorService hinter = Executors.newFixedThreadPool(3, r -> { Thread t = new Thread(r, "Server"); t.setDaemon(true); return t; });

    private final CardLayout karten = new CardLayout();
    private final JPanel wurzel = new JPanel(karten);
    private final JPanel login = new JPanel(new BorderLayout());
    private final JPanel sperre = new JPanel(new BorderLayout());
    private final JPanel app = new JPanel(new BorderLayout());
    private final JPanel nav = Ui.spalte(4);
    private final JScrollPane rollen;
    private JLabel kopfName, kopfChip;
    private javax.swing.JTextPane sperreText;
    private JLabel sperreZeit;
    private Timer puls;
    private volatile boolean pruefungLaeuft;

    boolean gesperrt = true;
    String aktuell = "";
    Map<String, Object> aktuellParam;
    int ansichtNr = 0;
    /** Bei Scan-Seiten: Feld, in das ein Hand-Scanner tippt, auch wenn gerade ein Knopf den Fokus hat */
    JTextComponent scanZiel;
    /** Zwischenspeicher für Artikel-Liste und Abgangs-Gründe (wird beim Sperren gelöscht) */
    List<Antwort> artikelCache;
    Map<String, Object> gruende;
    final List<Timer> seitenTimer = new ArrayList<Timer>();

    final Seiten seiten;
    static Image icon;

    public Fenster(Api api, DateiSpeicher speicher) {
        super("FV Lager – Fehnverleih");
        this.api = api;
        this.speicher = speicher;
        api.beobachter = this;
        try {
            icon = ImageIO.read(Fenster.class.getResource("icon-512.png"));
            List<Image> l = new ArrayList<Image>();
            for (int g : new int[]{16, 24, 32, 48, 64, 128, 256}) l.add(icon.getScaledInstance(g, g, Image.SCALE_SMOOTH));
            setIconImages(l);
        } catch (Exception e) { /* ohne Symbol */ }
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(900, 640));
        setSize(1200, 840);
        setLocationRelativeTo(null);

        seiten = new Seiten(this);
        rollen = new JScrollPane();
        rollen.setBorder(null);
        rollen.getViewport().setBackground(Ui.CREME);
        rollen.getVerticalScrollBar().setUnitIncrement(24);

        wurzel.add(ladenBildschirm(), "laden");
        wurzel.add(login, "login");
        wurzel.add(sperre, "sperre");
        wurzel.add(app, "app");
        setContentPane(wurzel);
        appRahmen();
        sperreBildschirm();

        // Hand-Scanner: Tippen ohne Textfeld-Fokus landet im Scan-Feld der Seite
        KeyboardFocusManager.getCurrentKeyboardFocusManager().addKeyEventDispatcher(e -> {
            if (e.getID() != KeyEvent.KEY_TYPED || scanZiel == null || !scanZiel.isShowing() || !isActive()) return false;
            Component f = e.getComponent();
            if (f instanceof JTextComponent) return false;
            char c = e.getKeyChar();
            if (c < 32 || c == KeyEvent.CHAR_UNDEFINED || e.isControlDown() || e.isAltDown()) return false;
            scanZiel.requestFocusInWindow();
            scanZiel.setText(scanZiel.getText() + c);
            return true;
        });
        addWindowListener(new WindowAdapter() {
            public void windowActivated(WindowEvent e) { if (api.angemeldet()) pruefen(); }
        });
    }

    /* ======================= Hintergrund-Aufrufe ======================= */
    /** Server-Aufruf im Hintergrund, Ergebnis im Oberflächen-Thread. Bei Sperre/Abmeldung wird nichts aufgerufen. */
    void hole(String aktion, Map<String, Object> daten, Consumer<Antwort> fertig) {
        hinter.execute(() -> {
            Antwort r = api.rufe(aktion, daten);
            SwingUtilities.invokeLater(() -> { if (!r.stop && fertig != null) fertig.accept(r); });
        });
    }

    /** Wie hole(), verwirft das Ergebnis aber, wenn inzwischen eine andere Seite angezeigt wird */
    void holeFuerSeite(String aktion, Map<String, Object> daten, Consumer<Antwort> fertig) {
        final int nr = ansichtNr;
        hole(aktion, daten, r -> { if (nr == ansichtNr && !gesperrt) fertig.accept(r); });
    }

    /** Beliebige Arbeit im Hintergrund */
    <T> void hintergrund(java.util.function.Supplier<T> arbeit, Consumer<T> fertig) {
        hinter.execute(() -> {
            T t = arbeit.get();
            SwingUtilities.invokeLater(() -> fertig.accept(t));
        });
    }

    /* ======================= Beobachter (vom Server) ======================= */
    public void abgemeldet(String meldung) { SwingUtilities.invokeLater(() -> abmeldenLokal(meldung)); }
    public void gesperrt(String meldung) { SwingUtilities.invokeLater(() -> sperren(meldung)); }
    public void frei(Antwort a) { SwingUtilities.invokeLater(() -> kopfAktualisieren(a)); }

    /* ======================= Start ======================= */
    void start() {
        if (!api.angemeldet()) { loginZeigen(""); return; }
        karten.show(wurzel, "laden");
        hintergrund(() -> api.rufe("status"), r -> {
            if (r.stop) return;
            if (r.ok() && r.frei()) entsperren(r);
            else sperren(r.msg().isEmpty() ? "Keine Verbindung zum Server." : r.msg());   // ohne Bestätigung vom Server bleibt alles gesperrt
        });
    }

    private JComponent ladenBildschirm() {
        JPanel p = new JPanel(new GridBagLayout());
        p.setBackground(Ui.DUNKEL);
        JPanel s = Ui.spalte(14);
        s.add(logo(96));
        JLabel t = Ui.label("Verbinde mit dem Server …", Ui.schrift(15), Ui.KOPFGRAU);
        t.setHorizontalAlignment(SwingConstants.CENTER);
        s.add(t);
        p.add(s);
        return p;
    }

    static JLabel logo(int g) {
        JLabel l = new JLabel(icon == null ? null : new ImageIcon(icon.getScaledInstance(g, g, Image.SCALE_SMOOTH)));
        l.setHorizontalAlignment(SwingConstants.CENTER);
        return l;
    }

    /* ======================= Anmeldung ======================= */
    void loginZeigen(String meldung) {
        stoppeAlles();
        login.removeAll();
        login.setBackground(Ui.CREME);
        JPanel spalte = Ui.spalte(14);
        spalte.add(logo(88));
        JLabel h = Ui.label("Fehnverleih Lager", Ui.titelSchrift(26), Ui.TEXT);
        h.setHorizontalAlignment(SwingConstants.CENTER);
        spalte.add(h);
        JLabel u = Ui.label("Lager-Programm für Mitarbeiter", Ui.schrift(13.5f), Ui.GRAU);
        u.setHorizontalAlignment(SwingConstants.CENTER);
        spalte.add(u);

        final Knopf tabMa = Ui.reiter("Mitarbeiter", true), tabAdmin = Ui.reiter("Admin", false);
        tabMa.setIcon(Ui.sym(Symbol.Art.PERSON, 16, Ui.GOLD));
        tabAdmin.setIcon(Ui.sym(Symbol.Art.SCHLUESSEL, 16, Ui.TEXT));
        JPanel tabs = new JPanel(new java.awt.FlowLayout(java.awt.FlowLayout.CENTER, 8, 0));
        tabs.setOpaque(false);
        tabs.add(tabMa); tabs.add(tabAdmin);
        spalte.add(tabs);

        final JPanel meldungBox = Ui.spalte(0);
        if (!meldung.isEmpty()) meldungBox.add(Ui.meldung(meldung, "hinweis"));
        spalte.add(meldungBox);

        // Mitarbeiter
        final Flaeche fMa = Ui.karte();
        fMa.add(Ui.klein("Einmal mit deinem Mitarbeiter-Ausweis anmelden: Ausweis mit dem Hand-Scanner scannen (oder den Code eintippen), dann das Lager-Passwort. Das Programm funktioniert nur, solange du eingestempelt bist."));
        final Ui.Feld ausweis = new Ui.Feld("Ausweis scannen …  (FVZ-…)");
        final Ui.Passwort maPw = new Ui.Passwort("Lager-Passwort");
        final JLabel erkannt = Ui.label(" ", Ui.fett(13), Ui.GRUEN);
        fMa.add(Ui.feld("Mitarbeiter-Ausweis", ausweis));
        fMa.add(erkannt);
        fMa.add(Ui.feld("Lager-Passwort", maPw));
        final Knopf maLos = Ui.knopf("Anmelden", K.DUNKEL).gross();
        fMa.add(maLos);

        // Admin
        final Flaeche fAdmin = Ui.karte();
        fAdmin.add(Ui.klein("Admin: immer nutzbar, mit Übersicht, Geräten und Stempel-Terminal."));
        final Ui.Passwort adPw = new Ui.Passwort("Admin-Passwort");
        fAdmin.add(Ui.feld("Admin-Passwort", adPw));
        final Knopf adLos = Ui.knopf("Als Admin anmelden", K.DUNKEL).gross();
        fAdmin.add(adLos);
        fAdmin.setVisible(false);

        spalte.add(fMa);
        spalte.add(fAdmin);
        JLabel server = Ui.label("Server: " + Api.schnittstelle(api.server), Ui.schrift(12), Ui.GRAU);
        server.setHorizontalAlignment(SwingConstants.CENTER);
        Knopf einst = Ui.knopf("Einstellungen", K.HELL, Symbol.Art.ZAHNRAD);
        einst.addActionListener(e -> seiten.einstellungen(() -> loginZeigen("")));
        JPanel unten = new JPanel(new java.awt.FlowLayout(java.awt.FlowLayout.CENTER, 0, 0));
        unten.setOpaque(false);
        unten.add(einst);
        spalte.add(unten);
        spalte.add(server);

        ausweis.getDocument().addDocumentListener(new javax.swing.event.DocumentListener() {
            void neu() { erkannt.setText(Api.siehtAusWieAusweis(ausweis.getText()) ? "✓ Ausweis erkannt – jetzt Lager-Passwort eingeben." : " "); }
            public void insertUpdate(javax.swing.event.DocumentEvent e) { neu(); }
            public void removeUpdate(javax.swing.event.DocumentEvent e) { neu(); }
            public void changedUpdate(javax.swing.event.DocumentEvent e) { neu(); }
        });
        ausweis.addActionListener(e -> {
            if (!Api.siehtAusWieAusweis(ausweis.getText())) { Ton.spielen("err"); toast("Das ist kein Mitarbeiter-Ausweis."); ausweis.selectAll(); return; }
            Ton.spielen("ok");
            maPw.requestFocusInWindow();
        });
        Runnable maAnmelden = () -> {
            String code = ausweis.getText().trim();
            if (code.isEmpty()) { meldungSetzen(meldungBox, "Bitte zuerst deinen Ausweis scannen.", "err"); ausweis.requestFocusInWindow(); return; }
            maLos.setEnabled(false);
            String pw = new String(maPw.getPassword());
            hintergrund(() -> api.anmeldenMitarbeiter(code, pw), r -> {
                maLos.setEnabled(true);
                if (!r.ok()) { meldungSetzen(meldungBox, r.msg().isEmpty() ? "Anmeldung fehlgeschlagen." : r.msg(), "err"); Ton.spielen("err"); return; }
                start();
            });
        };
        maLos.addActionListener(e -> maAnmelden.run());
        maPw.addActionListener(e -> maAnmelden.run());
        Runnable adAnmelden = () -> {
            adLos.setEnabled(false);
            String pw = new String(adPw.getPassword());
            hintergrund(() -> api.anmeldenAdmin(pw), r -> {
                adLos.setEnabled(true);
                if (!r.ok()) { meldungSetzen(meldungBox, r.msg().isEmpty() ? "Anmeldung fehlgeschlagen." : r.msg(), "err"); Ton.spielen("err"); return; }
                start();
            });
        };
        adLos.addActionListener(e -> adAnmelden.run());
        adPw.addActionListener(e -> adAnmelden.run());
        tabMa.addActionListener(e -> {
            tabMa.art(K.DUNKEL); tabMa.setForeground(Ui.GOLD); tabMa.setIcon(Ui.sym(Symbol.Art.PERSON, 16, Ui.GOLD));
            tabAdmin.art(K.HELL); tabAdmin.setIcon(Ui.sym(Symbol.Art.SCHLUESSEL, 16, Ui.TEXT));
            fMa.setVisible(true); fAdmin.setVisible(false); login.revalidate(); ausweis.requestFocusInWindow();
        });
        tabAdmin.addActionListener(e -> {
            tabAdmin.art(K.DUNKEL); tabAdmin.setForeground(Ui.GOLD); tabAdmin.setIcon(Ui.sym(Symbol.Art.SCHLUESSEL, 16, Ui.GOLD));
            tabMa.art(K.HELL); tabMa.setIcon(Ui.sym(Symbol.Art.PERSON, 16, Ui.TEXT));
            fMa.setVisible(false); fAdmin.setVisible(true); login.revalidate(); adPw.requestFocusInWindow();
        });

        JScrollPane sp = new JScrollPane(new Ui.Inhalt(460, spalte));
        sp.setBorder(null);
        sp.getViewport().setBackground(Ui.CREME);
        sp.getVerticalScrollBar().setUnitIncrement(24);
        JPanel mitte = new JPanel(new BorderLayout());
        mitte.setBackground(Ui.CREME);
        mitte.setBorder(BorderFactory.createEmptyBorder(30, 0, 0, 0));
        mitte.add(sp);
        login.add(mitte);
        karten.show(wurzel, "login");
        login.revalidate();
        login.repaint();
        SwingUtilities.invokeLater(ausweis::requestFocusInWindow);
    }

    static void meldungSetzen(JPanel box, String text, String art) {
        box.removeAll();
        if (text != null && !text.isEmpty()) box.add(Ui.meldung(text, art));
        box.revalidate();
        box.repaint();
    }

    /* ======================= Sperre ======================= */
    private void sperreBildschirm() {
        sperre.setBackground(Ui.DUNKEL);
        JPanel s = Ui.spalte(14);
        JLabel schloss = new JLabel(Ui.sym(Symbol.Art.SCHLOSS, 84, Ui.GOLD));
        schloss.setHorizontalAlignment(SwingConstants.CENTER);
        s.add(schloss);
        JLabel h = Ui.label("Programm gesperrt", Ui.titelSchrift(28), Ui.GOLD);
        h.setHorizontalAlignment(SwingConstants.CENTER);
        s.add(h);
        sperreText = Ui.textMittig("Du bist nicht eingestempelt.", Ui.schrift(16), new Color(0xD8CFB8));
        s.add(sperreText);
        s.add(Ui.textMittig("Bitte am Stempel-Terminal in der Lagerhalle mit deinem Ausweis einstempeln. Das Programm entsperrt sich danach automatisch.", Ui.schrift(13.5f), new Color(0xA99F86)));
        s.add(Ui.luecke(6));
        Knopf pruef = Ui.knopf("Jetzt prüfen", K.GOLD, Symbol.Art.AKTUALISIEREN).gross();
        pruef.addActionListener(e -> {
            pruef.setEnabled(false);
            hintergrund(() -> api.rufe("status"), r -> {
                pruef.setEnabled(true);
                if (r.stop) { if (gesperrt) toast("Noch nicht eingestempelt."); return; }
                if (r.ok() && r.frei()) entsperren(r);
                else if (r.netz) sperreText.setText(r.msg());
            });
        });
        s.add(pruef);
        Knopf ab = new Knopf("Abmelden / anderes Konto", K.DUNKEL, Symbol.Art.ABMELDEN);
        ab.setBorder(BorderFactory.createCompoundBorder(Ui.rundRand(), BorderFactory.createEmptyBorder(2, 6, 2, 6)));
        ab.addActionListener(e -> abmelden());
        s.add(ab);
        sperreZeit = Ui.label(" ", Ui.schrift(12.5f), new Color(0x7D735D));
        sperreZeit.setHorizontalAlignment(SwingConstants.CENTER);
        s.add(sperreZeit);
        JPanel g = new JPanel(new GridBagLayout());
        g.setOpaque(false);
        JPanel breite = new JPanel(new BorderLayout()) {
            @Override public Dimension getPreferredSize() { return new Dimension(440, s.getPreferredSize().height); }
        };
        breite.setOpaque(false);
        breite.add(s);
        g.add(breite);
        sperre.add(g);
    }

    void sperren(String text) {
        stoppeAlles();
        gesperrt = true;
        artikelCache = null;                 // alle Lagerdaten verwerfen
        rollen.setViewportView(null);
        sperreText.setText((api.name.isEmpty() ? "" : "Hallo " + Api.vorname(api.name) + " – ") + (text == null || text.isEmpty() ? "du bist nicht eingestempelt." : text));
        sperreZeit.setText("Zuletzt geprüft: " + new SimpleDateFormat("HH:mm:ss").format(new Date()));
        karten.show(wurzel, "sperre");
        pulsStarten(PULS_GESPERRT_MS);
    }

    void entsperren(Antwort r) {
        gesperrt = false;
        karten.show(wurzel, "app");
        kopfAktualisieren(r);
        if (r.hat("gruende")) gruende = r.map("gruende");
        navAufbauen();
        zeige(api.admin() ? "uebersicht" : "halle", null);
        pulsStarten(PULS_FREI_MS);
    }

    private void pulsStarten(int ms) {
        if (puls != null) puls.stop();
        puls = new Timer(ms, e -> pruefen());
        puls.start();
    }

    /** Fragt den Server, ob man noch eingestempelt ist */
    void pruefen() {
        if (!api.angemeldet() || pruefungLaeuft) return;
        pruefungLaeuft = true;
        hinter.execute(() -> {
            Antwort r = api.rufe("status");
            SwingUtilities.invokeLater(() -> {
                pruefungLaeuft = false;
                if (r.stop) return;
                if (r.ok() && r.frei()) { if (gesperrt) entsperren(r); else if (r.hat("gruende")) gruende = r.map("gruende"); }
                else if (r.netz && !gesperrt) toast(r.msg());
                else if (r.netz && gesperrt) {
                    sperreText.setText(r.msg());
                    sperreZeit.setText("Zuletzt geprüft: " + new SimpleDateFormat("HH:mm:ss").format(new Date()));
                }
            });
        });
    }

    void abmeldenLokal(String meldung) {
        stoppeAlles();
        if (puls != null) puls.stop();
        api.abmeldenLokal();
        gesperrt = true;
        artikelCache = null;
        rollen.setViewportView(null);
        loginZeigen(meldung);
    }

    void abmelden() {
        if (!fragen("Von diesem Gerät abmelden?")) return;
        hintergrund(() -> { api.abmelden(); return Boolean.TRUE; }, x -> abmeldenLokal("Abgemeldet."));
    }

    /** Stoppt Seiten-Timer und Scan-Fokus */
    void stoppeAlles() {
        for (Timer t : seitenTimer) t.stop();
        seitenTimer.clear();
        scanZiel = null;
        ansichtNr++;
        for (java.awt.Window w : getOwnedWindows()) if (w instanceof javax.swing.JDialog && w.isVisible() && Boolean.TRUE.equals(((javax.swing.JDialog) w).getRootPane().getClientProperty("blatt"))) w.dispose();
    }

    /* ======================= App-Rahmen ======================= */
    private void appRahmen() {
        JPanel seite = new JPanel(new BorderLayout());
        seite.setBackground(Ui.DUNKEL);
        seite.setPreferredSize(new Dimension(236, 100));
        seite.setBorder(BorderFactory.createMatteBorder(0, 0, 0, 3, Ui.GOLD2));

        JPanel oben = Ui.spalte(6);
        oben.setBorder(BorderFactory.createEmptyBorder(20, 18, 16, 18));
        JPanel marke = new JPanel(new BorderLayout(10, 0));
        marke.setOpaque(false);
        marke.add(logo(40), BorderLayout.WEST);
        JPanel mt = Ui.spalte(0);
        mt.add(Ui.label("FEHNVERLEIH", Ui.titelSchrift(16), Ui.GOLD));
        mt.add(Ui.label("Lager", Ui.schrift(12.5f), Ui.KOPFGRAU));
        marke.add(mt);
        oben.add(marke);
        seite.add(oben, BorderLayout.NORTH);

        nav.setBorder(BorderFactory.createEmptyBorder(6, 10, 6, 10));
        JPanel navHalter = new JPanel(new BorderLayout());
        navHalter.setOpaque(false);
        navHalter.add(nav, BorderLayout.NORTH);
        seite.add(navHalter);

        JPanel unten = Ui.spalte(8);
        unten.setBorder(BorderFactory.createEmptyBorder(12, 18, 18, 18));
        kopfName = Ui.label(" ", Ui.fett(14), Ui.CREME);
        kopfChip = new JLabel(" ") {
            @Override protected void paintComponent(Graphics g0) {
                Graphics2D g = (Graphics2D) g0.create();
                Ui.glatt(g);
                boolean ad = api.admin();
                g.setColor(ad ? Ui.GOLD2 : Ui.GRUEN);
                g.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), getHeight(), getHeight()));
                if (!ad) {
                    g.setColor(new Color(0x7CFC9A));
                    g.fill(new Ellipse2D.Double(11, getHeight() / 2.0 - 4, 8, 8));
                }
                g.dispose();
                super.paintComponent(g0);
            }
        };
        kopfChip.setFont(Ui.fett(12.5f));
        kopfChip.setBorder(BorderFactory.createEmptyBorder(5, 26, 5, 12));
        unten.add(kopfName);
        unten.add(Ui.fluss(0, kopfChip));
        seite.add(unten, BorderLayout.SOUTH);

        app.add(seite, BorderLayout.WEST);
        app.add(rollen, BorderLayout.CENTER);
    }

    void kopfAktualisieren(Antwort r) {
        if (kopfName == null) return;
        kopfName.setText(api.name + (api.admin() ? " · Verwaltung" : ""));
        if (api.admin()) { kopfChip.setText("Admin"); kopfChip.setForeground(Ui.DUNKEL); kopfChip.setBorder(BorderFactory.createEmptyBorder(5, 12, 5, 12)); }
        else {
            kopfChip.setText("eingestempelt" + (r != null && !r.str("seit").isEmpty() ? " · " + r.str("seit") : ""));
            kopfChip.setForeground(Color.WHITE);
            kopfChip.setBorder(BorderFactory.createEmptyBorder(5, 26, 5, 12));
        }
        if (r != null && r.hat("gruende")) gruende = r.map("gruende");
        kopfChip.repaint();
    }

    private final List<Knopf> navKnoepfe = new ArrayList<Knopf>();

    void navAufbauen() {
        nav.removeAll();
        navKnoepfe.clear();
        Object[][] l = api.admin()
                ? new Object[][]{{"uebersicht", Symbol.Art.DIAGRAMM, "Übersicht"}, {"halle", Symbol.Art.HAUS, "Lagerhalle"}, {"scan", Symbol.Art.SCAN, "Scannen"},
                        {"inventur", Symbol.Art.LISTE, "Inventur"}, {"mehr", Symbol.Art.MENUE, "Mehr"}}
                : new Object[][]{{"halle", Symbol.Art.HAUS, "Lagerhalle"}, {"scan", Symbol.Art.SCAN, "Scannen"}, {"inventur", Symbol.Art.LISTE, "Inventur"},
                        {"ich", Symbol.Art.PERSON, "Ich"}};
        for (Object[] z : l) {
            final String v = (String) z[0];
            final Symbol.Art s = (Symbol.Art) z[1];
            Knopf k = new Knopf((String) z[2], K.NAV, null) {
                @Override protected void paintComponent(Graphics g) { setIcon(new Symbol(s, 20, aktiv ? Ui.GOLD : Ui.KOPFGRAU)); super.paintComponent(g); }
            };
            k.setName(v);
            k.setFont(Ui.fett(15));
            k.setHorizontalAlignment(SwingConstants.LEFT);
            k.setIconTextGap(12);
            k.setBorder(BorderFactory.createEmptyBorder(11, 14, 11, 14));
            k.setIcon(new Symbol(s, 20, Ui.KOPFGRAU));
            k.addActionListener(e -> zeige(v, "scan".equals(v) ? Api.daten("modus", "info") : null));
            nav.add(k);
            navKnoepfe.add(k);
        }
        nav.add(Ui.luecke(8));
        Knopf einst = new Knopf("Einstellungen", K.NAV, Symbol.Art.ZAHNRAD);
        einst.setFont(Ui.schrift(13.5f));
        einst.setHorizontalAlignment(SwingConstants.LEFT);
        einst.setIconTextGap(12);
        einst.setBorder(BorderFactory.createEmptyBorder(8, 14, 8, 14));
        einst.setIcon(new Symbol(Symbol.Art.ZAHNRAD, 18, Ui.KOPFGRAU));
        einst.addActionListener(e -> seiten.einstellungen(null));
        nav.add(einst);
        nav.revalidate();
        nav.repaint();
    }

    /** Zeigt eine Seite */
    void zeige(String v, Map<String, Object> p) {
        if (gesperrt) return;
        stoppeAlles();
        aktuell = v;
        aktuellParam = p == null ? Api.daten() : p;
        String navV = "auftrag".equals(v) ? "halle" : "terminal".equals(v) || "geraete".equals(v) ? "mehr" : v;
        for (Knopf k : navKnoepfe) { k.aktiv = navV.equals(k.getName()); k.setForeground(k.aktiv ? Ui.GOLD : Ui.KOPFGRAU); k.repaint(); }
        JComponent inhalt = seiten.bauen(v, aktuellParam);
        ersteFuellung = true;
        rollen.setViewportView(new Ui.Inhalt("terminal".equals(v) ? 760 : 980, inhalt));
        rollen.getVerticalScrollBar().setValue(0);
        rollen.revalidate();
        rollen.repaint();
    }

    void neuLaden() { zeige(aktuell, aktuellParam); }

    private boolean ersteFuellung;

    /** Nach dem Nachladen von Inhalten: Rollbereich neu berechnen */
    void neuBerechnen() {
        if (ersteFuellung) {
            ersteFuellung = false;
            SwingUtilities.invokeLater(() -> rollen.getVerticalScrollBar().setValue(0));
        }
        Component v = rollen.getViewport().getView();
        if (v != null) { v.invalidate(); v.validate(); }
        rollen.revalidate();
        rollen.repaint();
    }

    /* ======================= Hinweise & Fragen ======================= */
    private JComponent toastFeld;
    private Timer toastTimer;

    void toast(String t) {
        JLayeredPane lp = getLayeredPane();
        if (toastFeld != null) lp.remove(toastFeld);
        Flaeche f = new Flaeche(new BorderLayout(), Ui.DUNKEL2, null, 20);
        f.setBorder(BorderFactory.createEmptyBorder(11, 20, 11, 20));
        JLabel l = Ui.label(t, Ui.schrift(14), Color.WHITE);
        f.add(l);
        Dimension d = f.getPreferredSize();
        int w = Math.min(d.width, lp.getWidth() - 40);
        f.setBounds((lp.getWidth() - w) / 2, lp.getHeight() - d.height - 34, w, d.height);
        lp.add(f, JLayeredPane.POPUP_LAYER);
        toastFeld = f;
        lp.revalidate();
        lp.repaint();
        if (toastTimer != null) toastTimer.stop();
        toastTimer = new Timer(2800, e -> { if (toastFeld != null) { lp.remove(toastFeld); toastFeld = null; lp.repaint(); } });
        toastTimer.setRepeats(false);
        toastTimer.start();
    }

    boolean fragen(String frage) {
        Object[] o = {"Ja", "Abbrechen"};
        return JOptionPane.showOptionDialog(this, frage, "FV Lager", JOptionPane.YES_NO_OPTION, JOptionPane.QUESTION_MESSAGE, null, o, o[1]) == 0;
    }

    void fehlerSeite(JPanel ziel, Antwort r) {
        ziel.removeAll();
        ziel.add(Ui.meldung(r.msg().isEmpty() ? "Fehler" : r.msg(), "err"));
        Knopf n = Ui.knopf("Nochmal versuchen", K.HELL, Symbol.Art.AKTUALISIEREN);
        n.addActionListener(e -> neuLaden());
        ziel.add(Ui.fluss(0, n));
        neuBerechnen();
    }

    String version() { return Texte.APP_NAME + " " + Texte.VERSION; }
}
