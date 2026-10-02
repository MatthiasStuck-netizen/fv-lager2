package de.fehnverleih.lager.app;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.ColorDrawable;
import android.content.res.ColorStateList;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Farben und Bausteine der Oberfläche (alles im Code, ohne HTML und ohne Layout-Dateien). */
public final class Ui {
    private Ui() { }

    public static final int DUNKEL = 0xFF151109, DUNKEL2 = 0xFF1D1B16, GOLD = 0xFFE6B23D, GOLD2 = 0xFFCF931E,
            CREME = 0xFFF5F1E6, LINIE = 0xFFE2DAC6, TEXT = 0xFF1D1B16, GRAU = 0xFF6B6453,
            GRUEN = 0xFF1F6B35, GRUENHELL = 0xFFEEF6EF, BLAU = 0xFF1F4F99, BLAUHELL = 0xFFE6EEFF,
            ROT = 0xFFB33A2A, ROTHELL = 0xFFF6E3DF, ORANGE = 0xFF8A5A00, ORANGEHELL = 0xFFFFF3D6,
            WEISS = 0xFFFFFFFF, HELLGRAU = 0xFFF1EDE2, KOPFGRAU = 0xFFCBBF9F, DUNKEL3 = 0xFF2A2418;

    public static final int K_GOLD = 1, K_DUNKEL = 2, K_HELL = 3, K_ROT = 4, K_GRUEN = 5;

    public static int dp(Context c, float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()));
    }

    public static GradientDrawable rund(Context c, int farbe, float radiusDp, int rand) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(farbe);
        g.setCornerRadius(dp(c, radiusDp));
        if (rand != 0) g.setStroke(dp(c, 1), rand);
        return g;
    }

    /** Hintergrund mit Druck-Effekt */
    public static android.graphics.drawable.Drawable druck(Context c, int farbe, float radiusDp, int rand) {
        return new RippleDrawable(ColorStateList.valueOf(0x33000000), rund(c, farbe, radiusDp, rand), rund(c, Color.BLACK, radiusDp, 0));
    }

    public static LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w, h); }

    public static LinearLayout.LayoutParams breit() { return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT); }

    public static LinearLayout.LayoutParams gewicht(float w) { return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, w); }

    public static LinearLayout.LayoutParams abstand(Context c, LinearLayout.LayoutParams p, int l, int o, int r, int u) {
        p.setMargins(dp(c, l), dp(c, o), dp(c, r), dp(c, u));
        return p;
    }

    public static LinearLayout senkrecht(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    public static LinearLayout zeile(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(Gravity.CENTER_VERTICAL);
        return l;
    }

    public static TextView text(Context c, String t, float sp, int farbe, boolean fett) {
        TextView v = new TextView(c);
        v.setText(t);
        v.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        v.setTextColor(farbe);
        if (fett) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }

    public static TextView text(Context c, String t) { return text(c, t, 16, TEXT, false); }

    public static TextView klein(Context c, String t) { return text(c, t, 13.5f, GRAU, false); }

    public static TextView titel(Context c, String t) {
        TextView v = text(c, t, 21, TEXT, true);
        v.setTypeface(Typeface.SERIF, Typeface.BOLD);
        v.setLayoutParams(abstand(c, breit(), 0, 14, 0, 10));
        return v;
    }

    public static TextView untertitel(Context c, String t) {
        TextView v = text(c, t, 17.5f, TEXT, true);
        v.setTypeface(Typeface.SERIF, Typeface.BOLD);
        v.setLayoutParams(abstand(c, breit(), 0, 0, 0, 8));
        return v;
    }

    public static LinearLayout karte(Context c) {
        LinearLayout l = senkrecht(c);
        l.setBackground(rund(c, WEISS, 12, LINIE));
        int p = dp(c, 14);
        l.setPadding(p, p, p, p);
        l.setLayoutParams(abstand(c, breit(), 0, 0, 0, 12));
        return l;
    }

    public static Button knopf(Context c, String t, int art) {
        Button b = new Button(c);
        b.setText(t);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setStateListAnimator(null);
        b.setElevation(0);
        int bg, fg, rand = 0;
        switch (art) {
            case K_GOLD: bg = GOLD2; fg = DUNKEL; break;
            case K_DUNKEL: bg = DUNKEL2; fg = CREME; break;
            case K_ROT: bg = WEISS; fg = ROT; rand = 0xFFE0B4AB; break;
            case K_GRUEN: bg = GRUEN; fg = WEISS; break;
            default: bg = WEISS; fg = TEXT; rand = 0xFFCFC6B3;
        }
        b.setTextColor(fg);
        b.setBackground(druck(c, bg, 10, rand));
        int ph = dp(c, 14), pv = dp(c, 12);
        b.setPadding(ph, pv, ph, pv);
        b.setMinHeight(dp(c, 48));
        b.setMinimumHeight(dp(c, 48));
        return b;
    }

    /** Art eines vorhandenen Knopfs ändern (z. B. Reiter umschalten) */
    public static void knopfArt(Context c, Button b, int art) {
        int bg, fg, rand = 0;
        switch (art) {
            case K_GOLD: bg = GOLD2; fg = DUNKEL; break;
            case K_DUNKEL: bg = DUNKEL2; fg = CREME; break;
            case K_ROT: bg = WEISS; fg = ROT; rand = 0xFFE0B4AB; break;
            case K_GRUEN: bg = GRUEN; fg = WEISS; break;
            default: bg = WEISS; fg = TEXT; rand = 0xFFCFC6B3;
        }
        b.setTextColor(fg);
        b.setBackground(druck(c, bg, 10, rand));
    }

    public static Button knopfBreit(Context c, String t, int art) {
        Button b = knopf(c, t, art);
        b.setLayoutParams(abstand(c, breit(), 0, 0, 0, 10));
        return b;
    }

    public static Button knopfGross(Context c, String t, int art) {
        Button b = knopfBreit(c, t, art);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17.5f);
        b.setMinHeight(dp(c, 58));
        b.setMinimumHeight(dp(c, 58));
        return b;
    }

    public static EditText eingabe(Context c, String hinweis) {
        EditText e = new EditText(c);
        e.setHint(hinweis);
        e.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16.5f);
        e.setTextColor(TEXT);
        e.setHintTextColor(0xFF9A927F);
        e.setBackground(rund(c, WEISS, 10, LINIE));
        int p = dp(c, 12);
        e.setPadding(p, p, p, p);
        e.setSingleLine(true);
        e.setLayoutParams(abstand(c, breit(), 0, 0, 0, 10));
        return e;
    }

    public static EditText zahlEingabe(Context c, String hinweis, boolean negativ) {
        EditText e = eingabe(c, hinweis);
        e.setInputType(InputType.TYPE_CLASS_NUMBER | (negativ ? InputType.TYPE_NUMBER_FLAG_SIGNED : 0));
        return e;
    }

    public static EditText passwort(Context c, String hinweis) {
        EditText e = eingabe(c, hinweis);
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        e.setTypeface(Typeface.DEFAULT);
        return e;
    }

    /** Beschriftung über einem Feld */
    public static TextView feld(Context c, String t) {
        TextView v = klein(c, t);
        v.setLayoutParams(abstand(c, breit(), 2, 2, 0, 4));
        return v;
    }

    public static TextView marke(Context c, String t, int bg, int fg) {
        TextView v = text(c, t, 12.5f, fg, true);
        v.setBackground(rund(c, bg, 99, 0));
        v.setPadding(dp(c, 10), dp(c, 3), dp(c, 10), dp(c, 3));
        v.setSingleLine(true);
        return v;
    }

    public static TextView regal(Context c, String t) {
        boolean leer = t == null || t.isEmpty() || t.equals("–");
        TextView v = text(c, leer ? "–" : t, 14.5f, leer ? GRAU : GOLD, true);
        v.setBackground(rund(c, leer ? 0xFFDDD5C2 : DUNKEL2, 8, 0));
        v.setGravity(Gravity.CENTER);
        v.setMinWidth(dp(c, 48));
        v.setPadding(dp(c, 8), dp(c, 6), dp(c, 8), dp(c, 6));
        v.setSingleLine(true);
        return v;
    }

    /** art: ok | err | warn | hinweis */
    public static TextView meldung(Context c, String t, String art) {
        int bg, fg;
        if ("ok".equals(art)) { bg = GRUENHELL; fg = GRUEN; }
        else if ("err".equals(art)) { bg = ROTHELL; fg = ROT; }
        else if ("warn".equals(art) || "hinweis".equals(art)) { bg = ORANGEHELL; fg = ORANGE; }
        else { bg = HELLGRAU; fg = TEXT; }
        TextView v = text(c, t, 15, fg, false);
        v.setBackground(rund(c, bg, 10, 0));
        int p = dp(c, 12);
        v.setPadding(p + 2, p, p + 2, p);
        v.setLayoutParams(abstand(c, breit(), 0, 0, 0, 12));
        return v;
    }

    /** Farbe einer vorhandenen Meldung ändern */
    public static void meldungFarbe(Context c, TextView v, String art) {
        int bg, fg;
        if ("ok".equals(art)) { bg = GRUENHELL; fg = GRUEN; }
        else if ("err".equals(art)) { bg = ROTHELL; fg = ROT; }
        else if ("warn".equals(art) || "hinweis".equals(art)) { bg = ORANGEHELL; fg = ORANGE; }
        else { bg = HELLGRAU; fg = TEXT; }
        v.setTextColor(fg);
        v.setBackground(rund(c, bg, 10, 0));
    }

    /** große Kachel (dunkel oder gold) mit Symbol, Titel und Untertitel */
    public static LinearLayout kachel(Context c, String symbol, String titel, String unter, boolean gold) {
        LinearLayout k = senkrecht(c);
        k.setBackground(druck(c, gold ? GOLD2 : DUNKEL2, 14, 0));
        int p = dp(c, 14);
        k.setPadding(p, p, p, p);
        k.setClickable(true);
        k.setFocusable(true);
        k.addView(text(c, symbol, 26, Color.WHITE, false));
        k.addView(text(c, titel, 16, gold ? DUNKEL : CREME, true));
        if (unter != null && !unter.isEmpty()) k.addView(text(c, unter, 12.5f, gold ? 0xFF4A3A14 : KOPFGRAU, false));
        return k;
    }

    /** Raster mit zwei Spalten */
    public static LinearLayout raster(Context c, View... kinder) {
        LinearLayout box = senkrecht(c);
        box.setLayoutParams(abstand(c, breit(), 0, 0, 0, 6));
        for (int i = 0; i < kinder.length; i += 2) {
            LinearLayout z = zeile(c);
            z.setBaselineAligned(false);
            z.setLayoutParams(abstand(c, breit(), 0, 0, 0, 10));
            LinearLayout.LayoutParams l1 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1);
            l1.setMargins(0, 0, dp(c, 5), 0);
            z.addView(kinder[i], l1);
            if (i + 1 < kinder.length) {
                LinearLayout.LayoutParams l2 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1);
                l2.setMargins(dp(c, 5), 0, 0, 0);
                z.addView(kinder[i + 1], l2);
            } else {
                View leer = new View(c);
                z.addView(leer, new LinearLayout.LayoutParams(0, 1, 1));
            }
            box.addView(z);
        }
        return box;
    }

    /** anklickbarer Listeneintrag (weiße Box) */
    public static LinearLayout eintrag(Context c) {
        LinearLayout l = zeile(c);
        l.setBackground(druck(c, WEISS, 12, LINIE));
        int p = dp(c, 12);
        l.setPadding(p + 2, p, p + 2, p);
        l.setLayoutParams(abstand(c, breit(), 0, 0, 0, 8));
        l.setClickable(true);
        l.setFocusable(true);
        return l;
    }

    /** Zeile mit Trennlinie (in einer Karte) */
    public static LinearLayout pos(Context c) {
        LinearLayout l = zeile(c);
        l.setPadding(0, dp(c, 9), 0, dp(c, 9));
        l.setLayoutParams(breit());
        return l;
    }

    public static View linie(Context c) {
        View v = new View(c);
        v.setBackground(new ColorDrawable(0xFFEEE7D6));
        v.setLayoutParams(lp(ViewGroup.LayoutParams.MATCH_PARENT, Math.max(1, dp(c, 1))));
        return v;
    }

    /** Text-Block: fetter Name und kleine Zeile darunter */
    public static LinearLayout nameUnter(Context c, String name, String unter) {
        LinearLayout l = senkrecht(c);
        l.addView(text(c, name, 16, TEXT, true));
        if (unter != null && !unter.isEmpty()) l.addView(klein(c, unter));
        return l;
    }

    /** Fortschrittsbalken */
    public static View balken(Context c, int ist, int soll, boolean voll) {
        LinearLayout aussen = zeile(c);
        aussen.setBackground(rund(c, 0xFFEEE7D6, 9, 0));
        View innen = new View(c);
        innen.setBackground(rund(c, voll ? GRUEN : GOLD2, 9, 0));
        float anteil = soll <= 0 ? 0 : Math.min(1f, ist / (float) soll);
        aussen.setWeightSum(1f);
        aussen.addView(innen, new LinearLayout.LayoutParams(0, dp(c, 6), anteil));
        aussen.setLayoutParams(abstand(c, lp(ViewGroup.LayoutParams.MATCH_PARENT, dp(c, 6)), 0, 5, 0, 0));
        return aussen;
    }

    public static View luecke(Context c, int dpHoehe) {
        View v = new View(c);
        v.setLayoutParams(lp(1, dp(c, dpHoehe)));
        return v;
    }
}
