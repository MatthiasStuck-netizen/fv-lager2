package de.fehnverleih.navi;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import androidx.car.app.model.CarIcon;
import androidx.core.graphics.drawable.IconCompat;

/** Einfache Symbole für den Autobildschirm: Abbiegepfeile, Ziel, Plus und Minus (weiß, selbst gezeichnet) */
final class AutoSymbole {
    private static final int G = 128;

    private AutoSymbole() {}

    private static Paint stift(float breite) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.WHITE);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(breite);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeJoin(Paint.Join.ROUND);
        return p;
    }

    private static Paint fuell() {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.WHITE);
        p.setStyle(Paint.Style.FILL);
        return p;
    }

    private static CarIcon icon(Bitmap b) {
        return new CarIcon.Builder(IconCompat.createWithBitmap(b)).build();
    }

    /** Pfeilspitze am Punkt (x, y) in Richtung winkel (Grad, 0 = nach oben, positiv = im Uhrzeigersinn) */
    private static void spitze(Canvas c, float x, float y, double winkel) {
        double w = Math.toRadians(winkel);
        float dx = (float) Math.sin(w), dy = (float) -Math.cos(w);
        float nx = -dy, ny = dx, l = 30, b = 22;
        Path p = new Path();
        p.moveTo(x + dx * 14, y + dy * 14);
        p.lineTo(x - dx * l + nx * b, y - dy * l + ny * b);
        p.lineTo(x - dx * l - nx * b, y - dy * l - ny * b);
        p.close();
        c.drawPath(p, fuell());
    }

    /** Abbiegepfeil: Stiel von unten bis zur Mitte, dann in Richtung winkel */
    private static CarIcon pfeil(double winkel) {
        Bitmap b = Bitmap.createBitmap(G, G, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint s = stift(14);
        float mx = 64, my = 64;
        double w = Math.toRadians(winkel);
        float ex = mx + (float) Math.sin(w) * 40, ey = my - (float) Math.cos(w) * 40;
        Path p = new Path();
        p.moveTo(mx, 120);
        p.lineTo(mx, my);
        p.lineTo(ex, ey);
        c.drawPath(p, s);
        spitze(c, ex, ey, winkel);
        return icon(b);
    }

    private static CarIcon wenden() {
        Bitmap b = Bitmap.createBitmap(G, G, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint s = stift(14);
        Path p = new Path();
        p.moveTo(84, 120);
        p.lineTo(84, 52);
        p.arcTo(new RectF(40, 20, 84, 64), 0, -180);
        p.lineTo(40, 84);
        c.drawPath(p, s);
        spitze(c, 40, 92, 180);
        return icon(b);
    }

    private static CarIcon kreisel() {
        Bitmap b = Bitmap.createBitmap(G, G, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint s = stift(12);
        c.drawCircle(64, 62, 26, s);
        c.drawLine(64, 120, 64, 88, s);
        c.drawLine(83, 44, 104, 22, s);
        spitze(c, 108, 18, 45);
        return icon(b);
    }

    private static CarIcon ziel() {
        Bitmap b = Bitmap.createBitmap(G, G, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Path p = new Path();
        p.moveTo(64, 120);
        p.cubicTo(30, 78, 26, 60, 26, 48);
        p.arcTo(new RectF(26, 10, 102, 86), 180, 180);
        p.cubicTo(102, 60, 98, 78, 64, 120);
        p.close();
        c.drawPath(p, fuell());
        Paint loch = new Paint(Paint.ANTI_ALIAS_FLAG);
        loch.setColor(Color.TRANSPARENT);
        loch.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.CLEAR));
        c.drawCircle(64, 48, 15, loch);
        return icon(b);
    }

    private static CarIcon einfaedeln() {
        Bitmap b = Bitmap.createBitmap(G, G, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint s = stift(14);
        c.drawLine(64, 120, 64, 30, s);
        Paint d = stift(10);
        d.setAlpha(150);
        c.drawLine(28, 118, 60, 64, d);
        spitze(c, 64, 24, 0);
        return icon(b);
    }

    static CarIcon plus() {
        Bitmap b = Bitmap.createBitmap(G, G, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint s = stift(14);
        c.drawLine(64, 30, 64, 98, s);
        c.drawLine(30, 64, 98, 64, s);
        return icon(b);
    }

    static CarIcon minus() {
        Bitmap b = Bitmap.createBitmap(G, G, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        c.drawLine(30, 64, 98, 64, stift(14));
        return icon(b);
    }

    /** Symbol zur Abbiege-Art aus der Navi (a_links, a_rechts, …) */
    static CarIcon fuer(String art) {
        if (art == null) art = "";
        switch (art) {
            case "a_links": return pfeil(-90);
            case "a_rechts": return pfeil(90);
            case "a_llinks": case "a_gabl": case "a_abfl": return pfeil(-45);
            case "a_lrechts": case "a_gabr": case "a_abfr": return pfeil(45);
            case "a_slinks": return pfeil(-135);
            case "a_srechts": return pfeil(135);
            case "a_wenden": return wenden();
            case "a_kreisel": return kreisel();
            case "a_ziel": return ziel();
            case "a_einf": return einfaedeln();
            default: return pfeil(0);
        }
    }
}
