package de.fehnverleih.lager.pc;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Arc2D;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Line2D;
import java.awt.geom.Path2D;
import java.awt.geom.RoundRectangle2D;

import javax.swing.Icon;

/** Selbst gezeichnete Symbole (keine Bilddateien, keine Emoji-Schrift nötig – sehen auf jedem PC gleich aus). */
public final class Symbol implements Icon {

    public enum Art { SCAN, PLUS, MINUS, LISTE, HAUS, PERSON, DIAGRAMM, MENUE, SCHLOSS, UHR, GERAETE, SCHLUESSEL,
        ZURUECK, SUCHE, ZAHNRAD, ABMELDEN, HAKEN, KREUZ, BUCH, ZAEHLEN, AKTUALISIEREN, LKW, RUECKGABE, WARNUNG, PC }

    private final Art art;
    private final int g;
    private final Color farbe;

    public Symbol(Art art, int groesse, Color farbe) { this.art = art; this.g = groesse; this.farbe = farbe; }

    public int getIconWidth() { return g; }
    public int getIconHeight() { return g; }

    public void paintIcon(Component c, Graphics gr, int x, int y) {
        Graphics2D g2 = (Graphics2D) gr.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
        g2.translate(x, y);
        g2.scale(g / 24.0, g / 24.0);           // alles auf 24×24 gezeichnet
        g2.setColor(farbe);
        g2.setStroke(new BasicStroke(2f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        zeichnen(g2);
        g2.dispose();
    }

    private static void linie(Graphics2D g, double x1, double y1, double x2, double y2) { g.draw(new Line2D.Double(x1, y1, x2, y2)); }

    private void zeichnen(Graphics2D g) {
        switch (art) {
            case SCAN: {
                // Ecken eines Suchers + QR-Muster
                Path2D p = new Path2D.Double();
                p.moveTo(3, 8); p.lineTo(3, 3); p.lineTo(8, 3);
                p.moveTo(16, 3); p.lineTo(21, 3); p.lineTo(21, 8);
                p.moveTo(21, 16); p.lineTo(21, 21); p.lineTo(16, 21);
                p.moveTo(8, 21); p.lineTo(3, 21); p.lineTo(3, 16);
                g.draw(p);
                g.fill(new RoundRectangle2D.Double(7, 7, 4, 4, 1, 1));
                g.fill(new RoundRectangle2D.Double(13, 7, 4, 4, 1, 1));
                g.fill(new RoundRectangle2D.Double(7, 13, 4, 4, 1, 1));
                g.fill(new RoundRectangle2D.Double(14, 14, 2.5, 2.5, 1, 1));
                break;
            }
            case PLUS: linie(g, 12, 5, 12, 19); linie(g, 5, 12, 19, 12); break;
            case MINUS: linie(g, 5, 12, 19, 12); break;
            case LISTE: {
                g.draw(new RoundRectangle2D.Double(5, 4, 14, 17, 3, 3));
                g.draw(new RoundRectangle2D.Double(9, 2.5, 6, 3, 1.5, 1.5));
                linie(g, 9, 10, 15, 10); linie(g, 9, 14, 15, 14); linie(g, 9, 18, 13, 18);
                break;
            }
            case HAUS: {
                Path2D p = new Path2D.Double();
                p.moveTo(3, 11); p.lineTo(12, 3.5); p.lineTo(21, 11);
                p.moveTo(5.5, 9.5); p.lineTo(5.5, 20.5); p.lineTo(18.5, 20.5); p.lineTo(18.5, 9.5);
                g.draw(p);
                g.draw(new RoundRectangle2D.Double(10, 14, 4, 6.5, 1, 1));
                break;
            }
            case PERSON: {
                g.draw(new Ellipse2D.Double(8, 3.5, 8, 8));
                g.draw(new Arc2D.Double(4, 13.5, 16, 14, 0, 180, Arc2D.OPEN));
                break;
            }
            case DIAGRAMM: {
                linie(g, 4, 20.5, 20, 20.5);
                g.fill(new RoundRectangle2D.Double(5, 12, 3.5, 7, 1, 1));
                g.fill(new RoundRectangle2D.Double(10.25, 6, 3.5, 13, 1, 1));
                g.fill(new RoundRectangle2D.Double(15.5, 9.5, 3.5, 9.5, 1, 1));
                break;
            }
            case MENUE: linie(g, 4, 7, 20, 7); linie(g, 4, 12, 20, 12); linie(g, 4, 17, 20, 17); break;
            case SCHLOSS: {
                g.draw(new RoundRectangle2D.Double(5, 10.5, 14, 10.5, 3, 3));
                g.draw(new Arc2D.Double(8, 3, 8, 10, 0, 180, Arc2D.OPEN));
                linie(g, 8, 8, 8, 10.5); linie(g, 16, 8, 16, 10.5);
                g.fill(new Ellipse2D.Double(10.5, 14, 3, 3));
                break;
            }
            case UHR: {
                g.draw(new Ellipse2D.Double(3, 3, 18, 18));
                linie(g, 12, 7, 12, 12); linie(g, 12, 12, 15.5, 14);
                break;
            }
            case GERAETE: {
                g.draw(new RoundRectangle2D.Double(7, 2.5, 10, 19, 3, 3));
                linie(g, 10.5, 18, 13.5, 18);
                break;
            }
            case PC: {
                g.draw(new RoundRectangle2D.Double(2.5, 4, 19, 12.5, 2, 2));
                linie(g, 12, 16.5, 12, 20); linie(g, 8, 20.5, 16, 20.5);
                break;
            }
            case SCHLUESSEL: {
                g.draw(new Ellipse2D.Double(3, 8, 8, 8));
                linie(g, 11, 12, 21, 12); linie(g, 17, 12, 17, 15.5); linie(g, 20, 12, 20, 14.5);
                break;
            }
            case ZURUECK: {
                Path2D p = new Path2D.Double();
                p.moveTo(14, 5); p.lineTo(7, 12); p.lineTo(14, 19);
                g.draw(p);
                break;
            }
            case SUCHE: {
                g.draw(new Ellipse2D.Double(4, 4, 12, 12));
                linie(g, 14.5, 14.5, 20, 20);
                break;
            }
            case ZAHNRAD: {
                g.draw(new Ellipse2D.Double(8.5, 8.5, 7, 7));
                for (int i = 0; i < 8; i++) {
                    double w = Math.PI / 4 * i;
                    linie(g, 12 + Math.cos(w) * 6.2, 12 + Math.sin(w) * 6.2, 12 + Math.cos(w) * 9, 12 + Math.sin(w) * 9);
                }
                g.draw(new Ellipse2D.Double(5.8, 5.8, 12.4, 12.4));
                break;
            }
            case ABMELDEN: {
                Path2D p = new Path2D.Double();
                p.moveTo(10, 4); p.lineTo(5, 4); p.lineTo(5, 20); p.lineTo(10, 20);
                p.moveTo(10, 12); p.lineTo(20, 12);
                p.moveTo(16, 8); p.lineTo(20, 12); p.lineTo(16, 16);
                g.draw(p);
                break;
            }
            case HAKEN: {
                Path2D p = new Path2D.Double();
                p.moveTo(4.5, 12.5); p.lineTo(9.5, 17.5); p.lineTo(19.5, 6.5);
                g.setStroke(new BasicStroke(2.6f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
                g.draw(p);
                break;
            }
            case KREUZ: linie(g, 6, 6, 18, 18); linie(g, 18, 6, 6, 18); break;
            case BUCH: {
                Path2D p = new Path2D.Double();
                p.moveTo(12, 6); p.curveTo(9, 4, 6, 4, 3, 5); p.lineTo(3, 19); p.curveTo(6, 18, 9, 18, 12, 20);
                p.curveTo(15, 18, 18, 18, 21, 19); p.lineTo(21, 5); p.curveTo(18, 4, 15, 4, 12, 6); p.lineTo(12, 20);
                g.draw(p);
                break;
            }
            case ZAEHLEN: {
                linie(g, 9.5, 4, 7.5, 20); linie(g, 16.5, 4, 14.5, 20);
                linie(g, 4.5, 9, 20, 9); linie(g, 4, 15, 19.5, 15);
                break;
            }
            case AKTUALISIEREN: {
                g.draw(new Arc2D.Double(4, 4, 16, 16, 60, 270, Arc2D.OPEN));
                Path2D p = new Path2D.Double();
                p.moveTo(16, 2.8); p.lineTo(16.5, 6.6); p.lineTo(12.6, 7);
                g.draw(p);
                break;
            }
            case LKW: {
                g.draw(new RoundRectangle2D.Double(2.5, 6, 11.5, 10, 1.5, 1.5));
                Path2D p = new Path2D.Double();
                p.moveTo(14, 9); p.lineTo(18, 9); p.lineTo(21.5, 12.5); p.lineTo(21.5, 16); p.lineTo(14, 16);
                g.draw(p);
                g.draw(new Ellipse2D.Double(5, 15.5, 4, 4));
                g.draw(new Ellipse2D.Double(15.5, 15.5, 4, 4));
                break;
            }
            case RUECKGABE: {
                g.draw(new Arc2D.Double(5, 5, 15, 14, 90, -200, Arc2D.OPEN));
                Path2D p = new Path2D.Double();
                p.moveTo(9, 2.5); p.lineTo(12.5, 5); p.lineTo(9, 8);
                g.draw(p);
                linie(g, 12.5, 5, 6, 5);
                break;
            }
            case WARNUNG: {
                Path2D p = new Path2D.Double();
                p.moveTo(12, 3.5); p.lineTo(21.5, 20); p.lineTo(2.5, 20); p.closePath();
                g.draw(p);
                linie(g, 12, 9.5, 12, 14);
                g.fill(new Ellipse2D.Double(10.8, 16, 2.4, 2.4));
                break;
            }
            default: break;
        }
    }
}
