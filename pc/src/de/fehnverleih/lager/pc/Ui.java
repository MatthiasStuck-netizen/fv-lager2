package de.fehnverleih.lager.pc;

import java.awt.BasicStroke;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.GridLayout;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.geom.RoundRectangle2D;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import javax.swing.BorderFactory;
import javax.swing.Icon;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.Scrollable;
import javax.swing.SwingConstants;
import javax.swing.border.AbstractBorder;
import javax.swing.border.Border;
import javax.swing.text.JTextComponent;

/** Farben, Schriften und Bausteine der Oberfläche – alles im Code gezeichnet, ohne HTML. */
public final class Ui {
    private Ui() { }

    /* ======================= Farben (wie die bisherige App) ======================= */
    public static final Color DUNKEL = new Color(0x151109), DUNKEL2 = new Color(0x1D1B16), DUNKEL3 = new Color(0x2A2418),
            GOLD = new Color(0xE6B23D), GOLD2 = new Color(0xCF931E), CREME = new Color(0xF5F1E6), CREME2 = new Color(0xF1EDE2),
            LINIE = new Color(0xE2DAC6), LINIE2 = new Color(0xEEE7D6), TEXT = new Color(0x1D1B16), GRAU = new Color(0x6B6453),
            KOPFGRAU = new Color(0xCBBF9F), GRUEN = new Color(0x1F6B35), GRUENHELL = new Color(0xEEF6EF),
            BLAU = new Color(0x1F4F99), BLAUHELL = new Color(0xE6EEFF), ROT = new Color(0xB33A2A), ROTHELL = new Color(0xF6E3DF),
            ORANGE = new Color(0x8A5A00), ORANGEHELL = new Color(0xFFF3D6), WEISS = Color.WHITE, KNOPFRAND = new Color(0xCFC6B3),
            GRUPPE = new Color(0xF3EFE4), LEERREGAL = new Color(0xDDD5C2);

    /* ======================= Schriften ======================= */
    private static String sans = "SansSerif", serif = "Serif";
    static {
        try {
            Set<String> da = new HashSet<String>(Arrays.asList(GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames()));
            for (String f : new String[]{"Segoe UI", "Noto Sans", "Cantarell", "DejaVu Sans", "Liberation Sans"}) if (da.contains(f)) { sans = f; break; }
            for (String f : new String[]{"Georgia", "Cambria", "Noto Serif", "DejaVu Serif", "Liberation Serif"}) if (da.contains(f)) { serif = f; break; }
        } catch (Throwable t) { /* Standard behalten */ }
    }
    public static Font schrift(float groesse) { return new Font(sans, Font.PLAIN, 1).deriveFont(groesse); }
    public static Font fett(float groesse) { return new Font(sans, Font.BOLD, 1).deriveFont(groesse); }
    public static Font titelSchrift(float groesse) { return new Font(serif, Font.BOLD, 1).deriveFont(groesse); }

    public static void glatt(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
    }

    /* ======================= Layouts ======================= */

    /** Senkrechter Stapel: jedes Kind bekommt die volle Breite und seine Höhe bei dieser Breite. */
    public static final class SpaltenLayout implements LayoutManager {
        final int abstand;
        public SpaltenLayout(int abstand) { this.abstand = abstand; }
        public void addLayoutComponent(String n, Component c) { }
        public void removeLayoutComponent(Component c) { }
        public Dimension minimumLayoutSize(Container p) { return preferredLayoutSize(p); }

        static int hoehe(Component c, int w) {
            if (w > 0 && c.getWidth() != w) c.setSize(w, Math.max(1, c.getHeight()));
            return c.getPreferredSize().height;
        }

        public Dimension preferredLayoutSize(Container p) {
            Insets in = p.getInsets();
            int w = p.getWidth() - in.left - in.right;
            int breite = 0;
            if (w <= 0) for (Component c : p.getComponents()) if (c.isVisible()) breite = Math.max(breite, c.getPreferredSize().width);
            int h = 0, n = 0;
            for (Component c : p.getComponents()) {
                if (!c.isVisible()) continue;
                int ch = hoehe(c, w > 0 ? w : breite);
                if (ch <= 0) continue;
                h += ch;
                n++;
            }
            if (n > 1) h += abstand * (n - 1);
            return new Dimension((w > 0 ? w : breite) + in.left + in.right, h + in.top + in.bottom);
        }

        public void layoutContainer(Container p) {
            Insets in = p.getInsets();
            int w = p.getWidth() - in.left - in.right, y = in.top;
            for (Component c : p.getComponents()) {
                if (!c.isVisible()) continue;
                int h = hoehe(c, w);
                c.setBounds(in.left, y, w, h);
                if (h > 0) y += h + abstand;
            }
        }
    }

    /** Zeile mit Abstand; mit „wachsen“ bekommt EIN Kind den Restplatz. Bricht nicht um. */
    public static final class ZeilenLayout implements LayoutManager {
        final int abstand;
        Component waechst;
        public ZeilenLayout(int abstand) { this.abstand = abstand; }
        public void addLayoutComponent(String n, Component c) { if ("wachsen".equals(n)) waechst = c; }
        public void removeLayoutComponent(Component c) { if (c == waechst) waechst = null; }
        public Dimension minimumLayoutSize(Container p) { return preferredLayoutSize(p); }
        public Dimension preferredLayoutSize(Container p) {
            Insets in = p.getInsets();
            int w = 0, h = 0, n = 0;
            for (Component c : p.getComponents()) {
                if (!c.isVisible()) continue;
                Dimension d = c.getPreferredSize();
                w += c == waechst ? Math.min(d.width, 120) : d.width;
                h = Math.max(h, d.height); n++;
            }
            if (n > 1) w += abstand * (n - 1);
            return new Dimension(w + in.left + in.right, h + in.top + in.bottom);
        }
        public void layoutContainer(Container p) {
            Insets in = p.getInsets();
            int verfuegbar = p.getWidth() - in.left - in.right, hoch = p.getHeight() - in.top - in.bottom;
            int fest = 0, n = 0;
            for (Component c : p.getComponents()) { if (!c.isVisible()) continue; n++; if (c != waechst) fest += c.getPreferredSize().width; }
            if (n > 1) fest += abstand * (n - 1);
            int x = in.left;
            for (Component c : p.getComponents()) {
                if (!c.isVisible()) continue;
                Dimension d = c.getPreferredSize();
                int w = c == waechst ? Math.max(40, verfuegbar - fest) : d.width;
                int h = Math.min(hoch, Math.max(d.height, c == waechst || c instanceof JTextField ? hoch : d.height));
                c.setBounds(x, in.top + (hoch - h) / 2, w, h);
                x += w + abstand;
            }
        }
    }

    public static SpaltenLayout spaltenLayout(int abstand) { return new SpaltenLayout(abstand); }

    /** Panel für eine Spalte */
    public static JPanel spalte(int abstand) {
        JPanel p = new JPanel(new SpaltenLayout(abstand));
        p.setOpaque(false);
        return p;
    }

    public static JPanel zeile(int abstand, Component... kinder) {
        JPanel p = new JPanel(new ZeilenLayout(abstand));
        p.setOpaque(false);
        for (Component c : kinder) p.add(c);
        return p;
    }

    /** Zeile, in der das erste Kind den Restplatz bekommt */
    public static JPanel zeileWachsend(int abstand, Component wachsend, Component... rest) {
        JPanel p = new JPanel(new ZeilenLayout(abstand));
        p.setOpaque(false);
        p.add(wachsend, "wachsen");
        for (Component c : rest) p.add(c);
        return p;
    }

    /** Raster mit gleich breiten Spalten */
    public static JPanel raster(int spalten, int abstand, Component... kinder) {
        JPanel p = new JPanel(new GridLayout(0, spalten, abstand, abstand));
        p.setOpaque(false);
        for (Component c : kinder) p.add(c);
        return p;
    }

    /** Inhalt im Rollbereich: volle Breite bis zu einer Höchstbreite, mittig */
    public static final class Inhalt extends JPanel implements Scrollable {
        final int maxBreite;
        public Inhalt(int maxBreite, JComponent kind) {
            super(null);
            this.maxBreite = maxBreite;
            setOpaque(false);
            add(kind);
        }
        int kindBreite() { return Math.max(260, Math.min(maxBreite, getWidth() - 48)); }
        @Override public void doLayout() {
            Component k = getComponent(0);
            int w = kindBreite();
            int h = SpaltenLayout.hoehe(k, w);
            k.setBounds((getWidth() - w) / 2, 20, w, h);
        }
        @Override public Dimension getPreferredSize() {
            Component k = getComponent(0);
            int w = getWidth() > 0 ? kindBreite() : Math.min(maxBreite, k.getPreferredSize().width);
            return new Dimension(w + 48, SpaltenLayout.hoehe(k, w) + 50);
        }
        public Dimension getPreferredScrollableViewportSize() { return getPreferredSize(); }
        public int getScrollableUnitIncrement(Rectangle r, int o, int d) { return 24; }
        public int getScrollableBlockIncrement(Rectangle r, int o, int d) { return Math.max(24, r.height - 60); }
        public boolean getScrollableTracksViewportWidth() { return true; }
        public boolean getScrollableTracksViewportHeight() { return false; }
    }

    /* ======================= Texte ======================= */
    /** Mehrzeiliger Text, der umbricht */
    public static JTextArea text(String t, Font f, Color farbe) {
        JTextArea a = new JTextArea(t == null ? "" : t);
        a.setFont(f);
        a.setForeground(farbe);
        a.setLineWrap(true);
        a.setWrapStyleWord(true);
        a.setEditable(false);
        a.setFocusable(false);
        a.setOpaque(false);
        a.setBorder(null);
        a.setHighlighter(null);
        a.setCursor(Cursor.getDefaultCursor());
        ((javax.swing.text.DefaultCaret) a.getCaret()).setUpdatePolicy(javax.swing.text.DefaultCaret.NEVER_UPDATE);
        return a;
    }
    /** Mehrzeiliger, mittig ausgerichteter Text */
    public static javax.swing.JTextPane textMittig(String t, Font f, Color farbe) {
        javax.swing.JTextPane p = new javax.swing.JTextPane();
        p.setEditable(false);
        p.setFocusable(false);
        p.setOpaque(false);
        p.setBorder(null);
        p.setFont(f);
        p.setForeground(farbe);
        p.putClientProperty(javax.swing.JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.TRUE);
        ((javax.swing.text.DefaultCaret) p.getCaret()).setUpdatePolicy(javax.swing.text.DefaultCaret.NEVER_UPDATE);
        javax.swing.text.SimpleAttributeSet m = new javax.swing.text.SimpleAttributeSet();
        javax.swing.text.StyleConstants.setAlignment(m, javax.swing.text.StyleConstants.ALIGN_CENTER);
        p.getStyledDocument().setParagraphAttributes(0, 0, m, false);
        p.setText(t == null ? "" : t);
        p.getStyledDocument().setParagraphAttributes(0, p.getDocument().getLength(), m, false);
        return p;
    }

    /** Zwei Spalten nebeneinander (ab einer Mindestbreite), sonst untereinander */
    public static final class ZweiSpalten extends JPanel {
        final JComponent links, rechts;
        final double anteil;
        final int abstand = 16, ab;
        public ZweiSpalten(JComponent links, JComponent rechts, double anteil, int ab) {
            super(null);
            this.links = links; this.rechts = rechts; this.anteil = anteil; this.ab = ab;
            setOpaque(false);
            add(links); add(rechts);
        }
        boolean neben(int w) { return w >= ab; }
        int[] breiten(int w) { int l = (int) ((w - abstand) * anteil); return new int[]{l, w - abstand - l}; }
        @Override public Dimension getPreferredSize() {
            int w = getWidth() > 0 ? getWidth() : 900;
            if (neben(w)) {
                int[] b = breiten(w);
                return new Dimension(w, Math.max(SpaltenLayout.hoehe(links, b[0]), SpaltenLayout.hoehe(rechts, b[1])));
            }
            int h1 = SpaltenLayout.hoehe(links, w), h2 = SpaltenLayout.hoehe(rechts, w);
            return new Dimension(w, h1 + (rechts.getComponentCount() > 0 && h2 > 0 ? abstand + h2 : 0));
        }
        @Override public void doLayout() {
            int w = getWidth();
            if (neben(w)) {
                int[] b = breiten(w);
                links.setBounds(0, 0, b[0], SpaltenLayout.hoehe(links, b[0]));
                rechts.setBounds(b[0] + abstand, 0, b[1], SpaltenLayout.hoehe(rechts, b[1]));
            } else {
                int h1 = SpaltenLayout.hoehe(links, w);
                links.setBounds(0, 0, w, h1);
                rechts.setBounds(0, h1 + abstand, w, SpaltenLayout.hoehe(rechts, w));
            }
        }
    }

    public static JTextArea text(String t) { return text(t, schrift(15), TEXT); }
    public static JTextArea klein(String t) { return text(t, schrift(13), GRAU); }

    public static JLabel label(String t, Font f, Color farbe) {
        JLabel l = new JLabel(t == null ? "" : t);
        l.setFont(f);
        l.setForeground(farbe);
        return l;
    }

    public static JLabel ueberschrift(String t) { return label(t, titelSchrift(22), TEXT); }
    public static JLabel unterUeberschrift(String t) { return label(t, titelSchrift(17), TEXT); }

    /** Name fett, darunter kleine Zeile */
    public static JPanel nameUnter(String name, String unter) {
        JPanel p = spalte(2);
        p.add(text(name, fett(15), TEXT));
        if (unter != null && !unter.isEmpty()) p.add(klein(unter));
        return p;
    }

    /* ======================= Rund gezeichnete Flächen ======================= */
    public static class Flaeche extends JPanel {
        Color hinter, rand;
        int radius;
        public Flaeche(LayoutManager l, Color hinter, Color rand, int radius) {
            super(l);
            this.hinter = hinter; this.rand = rand; this.radius = radius;
            setOpaque(false);
        }
        public void farben(Color h, Color r) { hinter = h; rand = r; repaint(); }
        @Override protected void paintComponent(Graphics g0) {
            Graphics2D g = (Graphics2D) g0.create();
            glatt(g);
            if (hinter != null) {
                g.setColor(hinter);
                g.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), radius * 2, radius * 2));
            }
            if (rand != null) {
                g.setColor(rand);
                g.setStroke(new BasicStroke(1f));
                g.draw(new RoundRectangle2D.Double(0.5, 0.5, getWidth() - 1, getHeight() - 1, radius * 2, radius * 2));
            }
            g.dispose();
            super.paintComponent(g0);
        }
    }

    /** Weiße Karte mit Rand – Inhalt wird senkrecht gestapelt */
    public static Flaeche karte() {
        Flaeche f = new Flaeche(new SpaltenLayout(10), WEISS, LINIE, 12);
        f.setBorder(BorderFactory.createEmptyBorder(16, 18, 16, 18));
        return f;
    }

    public static Flaeche karte(String titel) {
        Flaeche f = karte();
        if (titel != null) f.add(unterUeberschrift(titel));
        return f;
    }

    /** Farbige Meldung. art: ok | err | warn | hinweis */
    public static Flaeche meldung(String t, String art) {
        Color[] c = meldungsFarben(art);
        Flaeche f = new Flaeche(new SpaltenLayout(0), c[0], null, 10);
        f.setBorder(BorderFactory.createEmptyBorder(12, 16, 12, 16));
        f.add(text(t, schrift(14.5f), c[1]));
        return f;
    }

    public static Color[] meldungsFarben(String art) {
        if ("ok".equals(art)) return new Color[]{GRUENHELL, GRUEN};
        if ("err".equals(art)) return new Color[]{ROTHELL, ROT};
        if ("warn".equals(art) || "hinweis".equals(art)) return new Color[]{ORANGEHELL, ORANGE};
        return new Color[]{CREME2, TEXT};
    }

    /** Kleine farbige Marke („3 / 12“, „Bestätigt“) */
    public static JLabel marke(String t, Color hinter, Color vorder) {
        JLabel l = new JLabel(t) {
            @Override protected void paintComponent(Graphics g0) {
                Graphics2D g = (Graphics2D) g0.create();
                glatt(g);
                g.setColor(hinter);
                g.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), getHeight(), getHeight()));
                g.dispose();
                super.paintComponent(g0);
            }
        };
        l.setFont(fett(12.5f));
        l.setForeground(vorder);
        l.setHorizontalAlignment(SwingConstants.CENTER);
        l.setBorder(BorderFactory.createEmptyBorder(4, 11, 4, 11));
        return l;
    }

    /** Lagerplatz-Kästchen (dunkel mit Gold) */
    public static JLabel regal(String t) {
        final boolean leer = t == null || t.trim().isEmpty() || t.equals("–");
        JLabel l = new JLabel(leer ? "–" : t.trim()) {
            @Override protected void paintComponent(Graphics g0) {
                Graphics2D g = (Graphics2D) g0.create();
                glatt(g);
                g.setColor(leer ? LEERREGAL : DUNKEL2);
                g.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), 14, 14));
                g.dispose();
                super.paintComponent(g0);
            }
            @Override public Dimension getPreferredSize() {
                Dimension d = super.getPreferredSize();
                return new Dimension(Math.max(54, d.width), Math.max(34, d.height));
            }
        };
        l.setFont(fett(14));
        l.setForeground(leer ? GRAU : GOLD);
        l.setHorizontalAlignment(SwingConstants.CENTER);
        l.setBorder(BorderFactory.createEmptyBorder(6, 9, 6, 9));
        return l;
    }

    /** Fortschrittsbalken */
    public static JComponent balken(final int ist, final int soll) {
        JComponent b = new JComponent() {
            @Override protected void paintComponent(Graphics g0) {
                Graphics2D g = (Graphics2D) g0.create();
                glatt(g);
                g.setColor(LINIE2);
                g.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), 7, 7));
                double anteil = soll <= 0 ? 0 : Math.min(1.0, ist / (double) soll);
                g.setColor(ist >= soll && soll > 0 ? GRUEN : GOLD2);
                if (anteil > 0) g.fill(new RoundRectangle2D.Double(0, 0, Math.max(7, getWidth() * anteil), getHeight(), 7, 7));
                g.dispose();
            }
        };
        b.setPreferredSize(new Dimension(100, 7));
        return b;
    }

    public static Component luecke(int h) {
        JPanel p = new JPanel();
        p.setOpaque(false);
        p.setPreferredSize(new Dimension(1, h));
        return p;
    }

    /* ======================= Knöpfe ======================= */
    public enum K { GOLD, DUNKEL, HELL, ROT, GRUEN, NAV }

    public static class Knopf extends JButton {
        K art;
        boolean drueber, gross;
        boolean aktiv;   // für Navigation und Reiter
        public Knopf(String t, K art, Symbol.Art symbol) {
            super(t);
            this.art = art;
            setFont(fett(14.5f));
            setFocusPainted(false);
            setContentAreaFilled(false);
            setBorderPainted(false);
            setOpaque(false);
            setRolloverEnabled(true);
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            setBorder(BorderFactory.createEmptyBorder(11, 18, 11, 18));
            setIconTextGap(9);
            if (symbol != null) setIcon(new Symbol(symbol, 18, vorder()));
            addMouseListener(new MouseAdapter() {
                public void mouseEntered(MouseEvent e) { drueber = true; repaint(); }
                public void mouseExited(MouseEvent e) { drueber = false; repaint(); }
            });
            setForeground(vorder());
        }
        public Knopf gross() {
            gross = true;
            setFont(fett(16));
            setBorder(BorderFactory.createEmptyBorder(15, 20, 15, 20));
            return this;
        }
        public void art(K a) { art = a; setForeground(vorder()); repaint(); }
        Color vorder() {
            switch (art) {
                case GOLD: return DUNKEL;
                case DUNKEL: case GRUEN: return CREME;
                case ROT: return ROT;
                case NAV: return aktiv ? GOLD : KOPFGRAU;
                default: return TEXT;
            }
        }
        Color hinter() {
            switch (art) {
                case GOLD: return GOLD2;
                case DUNKEL: return DUNKEL2;
                case GRUEN: return GRUEN;
                case NAV: return aktiv ? DUNKEL3 : null;
                default: return WEISS;
            }
        }
        Color rand() { return art == K.HELL ? KNOPFRAND : art == K.ROT ? new Color(0xE0B4AB) : null; }
        @Override protected void paintComponent(Graphics g0) {
            Graphics2D g = (Graphics2D) g0.create();
            glatt(g);
            Color h = hinter();
            boolean gedrueckt = getModel().isPressed();
            if (art == K.NAV && h == null && drueber) h = new Color(0x221D14);
            if (h != null) {
                if (isEnabled() && art != K.NAV && (drueber || gedrueckt)) h = gedrueckt ? mischen(h, Color.BLACK, 0.16) : mischen(h, art == K.HELL || art == K.ROT ? CREME : Color.WHITE, art == K.HELL || art == K.ROT ? 0.6 : 0.1);
                g.setColor(h);
                g.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), 20, 20));
            }
            Color r = rand();
            if (r != null) {
                g.setColor(r);
                g.draw(new RoundRectangle2D.Double(0.5, 0.5, getWidth() - 1, getHeight() - 1, 20, 20));
            }
            if (isFocusOwner() && art != K.NAV) {
                g.setColor(new Color(GOLD2.getRed(), GOLD2.getGreen(), GOLD2.getBlue(), 160));
                g.setStroke(new BasicStroke(2f));
                g.draw(new RoundRectangle2D.Double(1.5, 1.5, getWidth() - 3, getHeight() - 3, 18, 18));
            }
            g.dispose();
            if (!isEnabled()) {
                Graphics2D g2 = (Graphics2D) g0.create();
                g2.setComposite(java.awt.AlphaComposite.getInstance(java.awt.AlphaComposite.SRC_OVER, 0.5f));
                super.paintComponent(g2);
                g2.dispose();
            } else super.paintComponent(g0);
        }
    }

    public static Color mischen(Color a, Color b, double t) {
        return new Color((int) (a.getRed() * (1 - t) + b.getRed() * t), (int) (a.getGreen() * (1 - t) + b.getGreen() * t), (int) (a.getBlue() * (1 - t) + b.getBlue() * t));
    }

    public static Knopf knopf(String t, K art) { return new Knopf(t, art, null); }
    public static Knopf knopf(String t, K art, Symbol.Art s) { return new Knopf(t, art, s); }

    /** Reiter (z. B. Betriebsart beim Scannen) */
    public static Knopf reiter(String t, boolean aktiv) {
        Knopf k = new Knopf(t, aktiv ? K.DUNKEL : K.HELL, null);
        if (aktiv) k.setForeground(GOLD);
        k.setFont(schrift(14));
        k.setBorder(BorderFactory.createEmptyBorder(8, 16, 8, 16));
        return k;
    }

    /* ======================= Klickbare Flächen ======================= */
    /** Macht eine Fläche anklickbar (Maus und Tastatur) */
    public static void klickbar(final Flaeche f, final Runnable aktion) {
        final Color h = f.hinter, r = f.rand;
        f.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        f.setFocusable(true);
        f.addMouseListener(new MouseAdapter() {
            public void mouseEntered(MouseEvent e) { f.farben(h == WEISS ? new Color(0xFFFCF4) : mischen(h, Color.WHITE, 0.08), r == null ? null : GOLD2); }
            public void mouseExited(MouseEvent e) { f.farben(h, r); }
            public void mouseReleased(MouseEvent e) {
                if (e.getButton() == MouseEvent.BUTTON1 && f.contains(e.getPoint())) aktion.run();
            }
        });
        f.addKeyListener(new KeyAdapter() {
            public void keyPressed(KeyEvent e) { if (e.getKeyCode() == KeyEvent.VK_ENTER || e.getKeyCode() == KeyEvent.VK_SPACE) aktion.run(); }
        });
        f.addFocusListener(new FocusAdapter() {
            public void focusGained(FocusEvent e) { f.farben(h, GOLD2); }
            public void focusLost(FocusEvent e) { f.farben(h, r); }
        });
        // Kinder sollen Klicks an die Fläche weitergeben
        weiterleiten(f, f);
    }

    private static void weiterleiten(Container von, final Flaeche ziel) {
        for (Component c : von.getComponents()) {
            if (c instanceof JButton || c instanceof JTextField) continue;
            c.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            c.addMouseListener(new MouseAdapter() {
                public void mouseEntered(MouseEvent e) { for (java.awt.event.MouseListener l : ziel.getMouseListeners()) l.mouseEntered(e); }
                public void mouseExited(MouseEvent e) {
                    java.awt.Point p = javax.swing.SwingUtilities.convertPoint(e.getComponent(), e.getPoint(), ziel);
                    if (!ziel.contains(p)) for (java.awt.event.MouseListener l : ziel.getMouseListeners()) l.mouseExited(e);
                }
                public void mouseReleased(MouseEvent e) {
                    MouseEvent n = javax.swing.SwingUtilities.convertMouseEvent(e.getComponent(), e, ziel);
                    for (java.awt.event.MouseListener l : ziel.getMouseListeners()) l.mouseReleased(n);
                }
            });
            if (c instanceof Container) weiterleiten((Container) c, ziel);
        }
    }

    /** Große Kachel mit Symbol, Titel und Unterzeile */
    public static Flaeche kachel(Symbol.Art s, String titel, String unter, boolean gold, Runnable aktion) {
        Flaeche k = new Flaeche(new SpaltenLayout(4), gold ? GOLD2 : DUNKEL2, null, 14);
        k.setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 16));
        JLabel sym = new JLabel(new Symbol(s, 28, gold ? DUNKEL : GOLD));
        sym.setHorizontalAlignment(SwingConstants.LEFT);
        sym.setBorder(BorderFactory.createEmptyBorder(0, 0, 6, 0));
        k.add(sym);
        k.add(label(titel, fett(16), gold ? DUNKEL : CREME));
        if (unter != null) k.add(label(unter, schrift(12.5f), gold ? new Color(0x4A3A14) : KOPFGRAU));
        klickbar(k, aktion);
        return k;
    }

    /** Listeneintrag (weiße Box): links optional Regal, Mitte Name + Unterzeile, rechts z. B. eine Marke */
    public static Flaeche eintrag(JComponent links, String name, String unter, JComponent rechts, Runnable aktion) {
        Flaeche f = new Flaeche(new BorderLayout(14, 0), WEISS, LINIE, 12);
        f.setBorder(BorderFactory.createEmptyBorder(12, 16, 12, 16));
        if (links != null) { JPanel w = mitte(links); f.add(w, BorderLayout.WEST); }
        f.add(nameUnter(name, unter), BorderLayout.CENTER);
        if (rechts != null) f.add(mitte(rechts), BorderLayout.EAST);
        if (aktion != null) klickbar(f, aktion);
        return f;
    }

    /** Senkrecht mittig ausrichten */
    public static JPanel mitte(JComponent c) {
        JPanel p = new JPanel(new java.awt.GridBagLayout());
        p.setOpaque(false);
        p.add(c);
        return p;
    }

    /** Zeile in einer Karte mit Trennlinie darunter */
    public static JPanel pos(JComponent links, JComponent mitte, JComponent rechts, boolean linie) {
        JPanel p = new JPanel(new BorderLayout(12, 0));
        p.setOpaque(false);
        p.setBorder(BorderFactory.createCompoundBorder(
                linie ? BorderFactory.createMatteBorder(0, 0, 1, 0, LINIE2) : BorderFactory.createEmptyBorder(0, 0, 1, 0),
                BorderFactory.createEmptyBorder(9, 0, 9, 0)));
        if (links != null) p.add(mitte(links), BorderLayout.WEST);
        if (mitte != null) p.add(mitte, BorderLayout.CENTER);
        if (rechts != null) p.add(mitte(rechts), BorderLayout.EAST);
        return p;
    }

    public static JPanel gruppe(String t) {
        Flaeche f = new Flaeche(new BorderLayout(), GRUPPE, null, 8);
        f.setBorder(BorderFactory.createEmptyBorder(6, 10, 6, 10));
        f.add(label(t, fett(13), TEXT));
        return f;
    }

    /* ======================= Eingabefelder ======================= */
    static final class RundRand extends AbstractBorder {
        public Insets getBorderInsets(Component c) { return new Insets(10, 12, 10, 12); }
        public Insets getBorderInsets(Component c, Insets i) { i.set(10, 12, 10, 12); return i; }
        public void paintBorder(Component c, Graphics g0, int x, int y, int w, int h) {
            Graphics2D g = (Graphics2D) g0.create();
            glatt(g);
            boolean f = c.isFocusOwner();
            g.setColor(f ? GOLD2 : LINIE);
            g.setStroke(new BasicStroke(f ? 2f : 1f));
            double d = f ? 1 : 0.5;
            g.draw(new RoundRectangle2D.Double(x + d, y + d, w - 2 * d, h - 2 * d, 18, 18));
            g.dispose();
        }
    }

    public static Border rundRand() { return new RundRand(); }

    /** Textfeld mit Platzhalter-Text */
    public static class Feld extends JTextField {
        String platzhalter;
        public Feld(String platzhalter) {
            this.platzhalter = platzhalter;
            setFont(schrift(15.5f));
            setForeground(TEXT);
            setCaretColor(TEXT);
            setBackground(WEISS);
            setBorder(rundRand());
            setSelectionColor(new Color(0xF2D9A0));
            addFocusListener(new FocusAdapter() {
                public void focusGained(FocusEvent e) { repaint(); }
                public void focusLost(FocusEvent e) { repaint(); }
            });
        }
        @Override protected void paintComponent(Graphics g0) {
            Graphics2D g = (Graphics2D) g0.create();
            glatt(g);
            g.setColor(isEnabled() ? WEISS : CREME2);
            g.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), 18, 18));
            g.dispose();
            setOpaque(false);
            super.paintComponent(g0);
            platzhalterMalen(this, g0, platzhalter);
        }
    }

    static void platzhalterMalen(JTextComponent c, Graphics g0, String platzhalter) {
        if (platzhalter == null || c.getDocument().getLength() > 0) return;
        Graphics2D g = (Graphics2D) g0.create();
        glatt(g);
        g.setColor(new Color(0x9A927F));
        g.setFont(c.getFont());
        Insets in = c.getInsets();
        FontMetrics fm = g.getFontMetrics();
        g.drawString(platzhalter, in.left + 2, (c.getHeight() - fm.getHeight()) / 2 + fm.getAscent());
        g.dispose();
    }

    public static class Passwort extends JPasswordField {
        String platzhalter;
        public Passwort(String platzhalter) {
            this.platzhalter = platzhalter;
            setFont(schrift(15.5f));
            setBorder(rundRand());
            setOpaque(false);
            addFocusListener(new FocusAdapter() {
                public void focusGained(FocusEvent e) { repaint(); }
                public void focusLost(FocusEvent e) { repaint(); }
            });
        }
        @Override protected void paintComponent(Graphics g0) {
            Graphics2D g = (Graphics2D) g0.create();
            glatt(g);
            g.setColor(WEISS);
            g.fill(new RoundRectangle2D.Double(0, 0, getWidth(), getHeight(), 18, 18));
            g.dispose();
            super.paintComponent(g0);
            platzhalterMalen(this, g0, platzhalter);
        }
    }

    /** Beschriftung über einem Feld */
    public static JPanel feld(String beschriftung, JComponent eingabe) {
        JPanel p = spalte(5);
        p.add(label(beschriftung, schrift(13), GRAU));
        p.add(eingabe);
        return p;
    }

    /** FlowLayout ohne Ränder, für kleine Gruppen */
    public static JPanel fluss(int abstand, Component... kinder) {
        JPanel p = new JPanel(new ZeilenLayout(abstand)) {
            @Override public Dimension getMaximumSize() { return getPreferredSize(); }
        };
        p.setOpaque(false);
        for (Component c : kinder) p.add(c);
        return p;
    }

    /** Häkchen mit umbrechendem Text (Klick auf den Text schaltet mit um) */
    public static final class Haken extends JPanel {
        public final javax.swing.JCheckBox box = new javax.swing.JCheckBox();
        public final JTextArea text;
        public Haken(String t, Font f, Color farbe) {
            super(new BorderLayout(8, 0));
            setOpaque(false);
            box.setOpaque(false);
            box.setFocusable(false);
            text = Ui.text(t, f, farbe);
            text.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            text.addMouseListener(new MouseAdapter() { public void mouseReleased(MouseEvent e) { box.doClick(); } });
            JPanel w = new JPanel(new BorderLayout());
            w.setOpaque(false);
            w.add(box, BorderLayout.NORTH);
            add(w, BorderLayout.WEST);
            add(text);
        }
        public boolean an() { return box.isSelected(); }
        public void farbe(Color c, Font f) { text.setForeground(c); text.setFont(f); }
    }

    public static Icon sym(Symbol.Art a, int g, Color c) { return new Symbol(a, g, c); }
}
