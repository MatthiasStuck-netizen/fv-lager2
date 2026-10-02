package de.fehnverleih.lager.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import de.fehnverleih.lager.kern.Antwort;
import de.fehnverleih.lager.kern.Api;
import de.fehnverleih.lager.kern.Texte;

/** Alle Seiten der Android-App (Aufbau wie im PC-Programm, für das Handy angeordnet). */
final class Seiten {
    private final Haupt h;

    Seiten(Haupt h) { this.h = h; }

    private static String s(Map<String, Object> p, String k) { Object o = p.get(k); return o == null ? "" : String.valueOf(o); }

    void bauen(LinearLayout ziel, String v, Map<String, Object> p) {
        switch (v) {
            case "uebersicht": uebersicht(ziel); break;
            case "scan": case "auftrag": scan(ziel, p); break;
            case "inventur": inventur(ziel, p); break;
            case "ich": ich(ziel); break;
            case "mehr": mehr(ziel); break;
            case "geraete": geraete(ziel); break;
            case "terminal": terminal(ziel); break;
            default: halle(ziel);
        }
    }

    private TextView laedt() { TextView t = Ui.klein(h, "Lädt …"); t.setPadding(0, Ui.dp(h, 10), 0, Ui.dp(h, 10)); return t; }

    private TextView leer(String t) { TextView x = Ui.text(h, t, 14.5f, Ui.GRAU, false); x.setPadding(0, Ui.dp(h, 6), 0, Ui.dp(h, 6)); return x; }

    private void fehler(LinearLayout ziel, Antwort r) {
        ziel.removeAllViews();
        ziel.addView(Ui.meldung(h, r.msg().isEmpty() ? "Fehler" : r.msg(), "err"));
        Button b = Ui.knopfBreit(h, "↻ Nochmal versuchen", Ui.K_HELL);
        b.setOnClickListener(v -> h.neuLaden());
        ziel.addView(b);
    }

    private LinearLayout box(LinearLayout ziel) { LinearLayout l = Ui.senkrecht(h); ziel.addView(l, Ui.breit()); return l; }

    /* ======================= Übersicht (Admin) ======================= */
    private void uebersicht(LinearLayout ziel) {
        ziel.addView(Ui.titel(h, "Übersicht"));
        final LinearLayout b = box(ziel);
        b.addView(laedt());
        h.holeFuerSeite("uebersicht", null, r -> {
            if (!r.ok()) { fehler(b, r); return; }
            b.removeAllViews();
            Antwort z = r.teil("zahlen");
            b.addView(Ui.raster(h, zahl(z.zahl("anfragen"), "offene Anfragen", true), zahl(z.zahl("ausgabe_heute"), "heute auszugeben", false),
                    zahl(z.zahl("rueckgabe_heute"), "Rückgaben heute", false), zahl(z.zahl("ueberfaellig"), "Rückgaben überfällig", true),
                    zahl(z.zahl("draussen"), "Aufträge beim Kunden", false), zahl(z.zahl("defekt"), "Stück defekt", true)));
            if (z.bool("inventur")) {
                TextView m = Ui.meldung(h, "📋 Eine Inventur-Zählung läuft – antippen, um zur Inventur zu gehen.", "hinweis");
                m.setOnClickListener(v -> h.zeige("inventur", null, true));
                b.addView(m);
            }
            LinearLayout k = Ui.karte(h);
            k.addView(Ui.untertitel(h, "Jetzt eingestempelt"));
            List<Antwort> da = r.liste("anwesend");
            if (da.isEmpty()) k.addView(leer("Niemand eingestempelt – alle Mitarbeiter-Apps sind gesperrt."));
            for (int i = 0; i < da.size(); i++) {
                final Antwort x = da.get(i);
                if (i > 0) k.addView(Ui.linie(h));
                LinearLayout pz = Ui.pos(h);
                pz.addView(Ui.nameUnter(h, x.str("name"), "seit " + x.str("seit") + " · " + x.str("dauer") + " Std. · App frei"), Ui.gewicht(1));
                Button aus = Ui.knopf(h, "Ausstempeln", Ui.K_ROT);
                aus.setOnClickListener(v -> h.fragen(x.str("name") + " jetzt ausstempeln? Die App wird für diese Person sofort gesperrt.",
                        () -> h.hole("ausstempeln", Api.daten("mid", x.str("mid")), y -> { h.toast(y.msg()); h.neuLaden(); })));
                pz.addView(aus);
                k.addView(pz);
            }
            b.addView(k);
            Button verw = Ui.knopfBreit(h, "🖥 Komplette Verwaltung im Browser öffnen", Ui.K_HELL);
            verw.setOnClickListener(v -> browser("?admin&ww=start"));
            b.addView(verw);
        });
    }

    private View zahl(int n, String t, boolean warn) {
        LinearLayout k = Ui.senkrecht(h);
        k.setBackground(Ui.rund(h, Ui.WEISS, 12, Ui.LINIE));
        int p = Ui.dp(h, 12);
        k.setPadding(p, p, p, p);
        TextView z = Ui.text(h, String.valueOf(n), 28, warn && n > 0 ? Ui.ROT : Ui.TEXT, true);
        z.setTypeface(android.graphics.Typeface.SERIF, android.graphics.Typeface.BOLD);
        k.addView(z);
        k.addView(Ui.klein(h, t));
        return k;
    }

    void browser(String pfad) {
        try { h.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(h.api.basis() + pfad))); }
        catch (Exception e) { h.toast("Browser konnte nicht geöffnet werden."); }
    }

    /* ======================= Lagerhalle ======================= */
    private void halle(LinearLayout ziel) {
        ziel.addView(Ui.raster(h,
                kachel("📷", "Scannen", "Artikel erkennen", true, () -> h.zeige("scan", Api.daten("modus", "info"), true)),
                kachel("➕", "Wareneingang", "neue Ware zählen", false, () -> h.zeige("scan", Api.daten("modus", "eingang"), true)),
                kachel("➖", "Ausbuchen", "defekt, verkauft …", false, () -> h.zeige("scan", Api.daten("modus", "abgang"), true)),
                kachel("📋", "Inventur", "Bestand zählen", false, () -> h.zeige("inventur", null, true))));
        suchfeld(ziel, "Info", this::artikelInfo);
        final LinearLayout b = box(ziel);
        b.addView(laedt());
        h.holeFuerSeite("halle", null, r -> {
            if (!r.ok()) { fehler(b, r); return; }
            b.removeAllViews();
            b.addView(Ui.titel(h, "Packen & ausgeben"));
            List<Antwort> p = r.liste("packen");
            if (p.isEmpty()) b.addView(leer("In den nächsten 7 Tagen nichts auszugeben."));
            for (Antwort a : p) b.addView(auftragEintrag(a));
            b.addView(Ui.titel(h, "Rückgabe annehmen"));
            List<Antwort> rg = r.liste("rueckgabe");
            if (rg.isEmpty()) b.addView(leer("Nichts beim Kunden."));
            for (Antwort a : rg) b.addView(auftragEintrag(a));
        });
    }

    private View kachel(String sym, String titel, String unter, boolean gold, final Runnable aktion) {
        LinearLayout k = Ui.kachel(h, sym, titel, unter, gold);
        k.setOnClickListener(v -> aktion.run());
        return k;
    }

    private View auftragEintrag(final Antwort a) {
        LinearLayout e = Ui.eintrag(h);
        LinearLayout t = Ui.nameUnter(h, a.str("nr") + " · " + (a.str("kunde").isEmpty() ? "–" : a.str("kunde")), Texte.auftragUnter(a));
        if (a.bool("ueberfaellig")) ((TextView) t.getChildAt(1)).setTextColor(Ui.ROT);
        e.addView(t, Ui.gewicht(1));
        boolean fertig = a.zahl("fertig") >= a.zahl("gesamt");
        e.addView(Ui.marke(h, a.zahl("fertig") + " / " + a.zahl("gesamt"), fertig ? Ui.GRUENHELL : Ui.ORANGEHELL, fertig ? Ui.GRUEN : Ui.ORANGE));
        e.setOnClickListener(v -> h.zeige("auftrag", Api.daten("modus", a.str("modus"), "auftrag", a.str("id")), true));
        return e;
    }

    /* ======================= Suche „Wo liegt …?“ ======================= */
    interface Wahl { void id(String id); }

    private void suchfeld(LinearLayout ziel, final String knopfText, final Wahl beiWahl) {
        final EditText feld = Ui.eingabe(h, "🔍 Wo liegt …? Name, Regal oder Nummer");
        ziel.addView(feld);
        final LinearLayout erg = box(ziel);
        final Runnable[] warte = {null};
        feld.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence a, int b, int c, int d) { }
            public void onTextChanged(CharSequence a, int b, int c, int d) { }
            public void afterTextChanged(Editable e) {
                if (warte[0] != null) h.ui.removeCallbacks(warte[0]);
                warte[0] = () -> suchen(feld, erg, knopfText, beiWahl);
                h.seitenTimer.add(warte[0]);
                h.ui.postDelayed(warte[0], 200);
            }
        });
    }

    private void suchen(final EditText feld, final LinearLayout erg, final String knopfText, final Wahl beiWahl) {
        final String t = feld.getText().toString();
        if (Api.norm(t).isEmpty()) { erg.removeAllViews(); return; }
        artikelLaden(alle -> {
            if (!feld.getText().toString().equals(t) || alle == null) return;
            erg.removeAllViews();
            List<Antwort> l = Texte.suchen(alle, t);
            for (int i = 0; i < Math.min(15, l.size()); i++) {
                final Antwort a = l.get(i);
                LinearLayout e = Ui.eintrag(h);
                e.addView(Ui.regal(h, a.str("regal")));
                LinearLayout nu = Ui.nameUnter(h, a.str("name"), Texte.artikelUnter(a));
                nu.setPadding(Ui.dp(h, 10), 0, Ui.dp(h, 6), 0);
                e.addView(nu, Ui.gewicht(1));
                e.addView(Ui.marke(h, knopfText, Ui.BLAUHELL, Ui.BLAU));
                e.setOnClickListener(v -> { h.tastaturWeg(); beiWahl.id(a.str("id")); });
                erg.addView(e);
            }
            if (l.size() > 15) erg.addView(Ui.klein(h, "… " + (l.size() - 15) + " weitere – genauer suchen."));
            if (l.isEmpty()) erg.addView(leer("Nichts gefunden."));
        });
    }

    interface ArtikelDa { void da(List<Antwort> l); }

    void artikelLaden(final ArtikelDa fertig) {
        if (h.artikelCache != null) { fertig.da(h.artikelCache); return; }
        h.hole("artikel", null, r -> {
            if (!r.ok()) { h.toast(r.msg()); fertig.da(null); return; }
            h.artikelCache = r.liste("artikel");
            fertig.da(h.artikelCache);
        });
    }

    /* ======================= Artikel-Info (Blatt) ======================= */
    void artikelInfo(String id) {
        h.hole("artikel_info", Api.daten("code", id), r -> {
            if (!r.ok()) { h.toast(r.msg()); return; }
            ScrollView sv = new ScrollView(h);
            LinearLayout s = Ui.senkrecht(h);
            int p = Ui.dp(h, 16);
            s.setPadding(p, p, p, p);
            s.setBackgroundColor(Ui.CREME);
            sv.addView(s);
            s.addView(infoKarte(r.teil("info")));
            Button ein = Ui.knopf(h, "➕ Wareneingang", Ui.K_DUNKEL), ab = Ui.knopf(h, "➖ Ausbuchen", Ui.K_DUNKEL),
                    inv = Ui.knopf(h, "🔢 Inventur zählen", Ui.K_DUNKEL), zu = Ui.knopf(h, "✕ Schließen", Ui.K_HELL);
            s.addView(Ui.raster(h, ein, ab, inv, zu));
            final AlertDialog d = new AlertDialog.Builder(h).setView(sv).create();
            ein.setOnClickListener(v -> { d.dismiss(); h.zeige("scan", Api.daten("modus", "eingang"), true); });
            ab.setOnClickListener(v -> { d.dismiss(); h.zeige("scan", Api.daten("modus", "abgang"), true); });
            inv.setOnClickListener(v -> { d.dismiss(); h.zeige("scan", Api.daten("modus", "inventur"), true); });
            zu.setOnClickListener(v -> d.dismiss());
            h.blatt = d;
            d.show();
        });
    }

    View infoKarte(Antwort i) {
        LinearLayout k = Ui.karte(h);
        LinearLayout kopf = Ui.zeile(h);
        kopf.setGravity(Gravity.TOP);
        LinearLayout t = Ui.senkrecht(h);
        t.addView(Ui.klein(h, i.str("kat") + " · " + i.str("id")));
        TextView n = Ui.text(h, i.str("name"), 19, Ui.TEXT, true);
        n.setPadding(0, Ui.dp(h, 2), 0, Ui.dp(h, 6));
        t.addView(n);
        LinearLayout pl = Ui.zeile(h);
        pl.addView(Ui.text(h, "Platz: ", 17, Ui.TEXT, false));
        pl.addView(Ui.regal(h, i.str("platz")));
        t.addView(pl);
        kopf.addView(t, Ui.gewicht(1));
        final ImageView bild = new ImageView(h);
        bild.setAdjustViewBounds(true);
        bild.setMaxWidth(Ui.dp(h, 100));
        bild.setMaxHeight(Ui.dp(h, 100));
        bild.setVisibility(View.GONE);
        kopf.addView(bild);
        k.addView(kopf);
        TextView z = Ui.text(h, Texte.infoZeile(i), 15, Ui.TEXT, false);
        z.setPadding(0, Ui.dp(h, 10), 0, 0);
        k.addView(z);
        List<String> nb = i.texte("naechste");
        if (!nb.isEmpty()) {
            StringBuilder b = new StringBuilder("Nächste Buchungen:");
            for (String x : nb) b.append("\n").append(x);
            TextView nt = Ui.klein(h, b.toString());
            nt.setPadding(0, Ui.dp(h, 8), 0, 0);
            k.addView(nt);
        }
        final String pfad = i.str("bild");
        if (!pfad.isEmpty()) {
            h.hintergrund(() -> {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(h.api.basis() + pfad.replace(" ", "%20")).openConnection();
                    c.setConnectTimeout(8000); c.setReadTimeout(12000);
                    InputStream is = c.getInputStream();
                    Bitmap bm = BitmapFactory.decodeStream(is);
                    is.close();
                    return bm;
                } catch (Exception e) { return null; }
            }, bm -> { if (bm != null) { bild.setImageBitmap(bm); bild.setVisibility(View.VISIBLE); } });
        }
        return k;
    }

    /* ======================= Scannen ======================= */
    private void scan(final LinearLayout ziel, Map<String, Object> p) {
        final String modus = Texte.TITEL.containsKey(s(p, "modus")) ? s(p, "modus") : "info";
        final String auftrag = s(p, "auftrag");
        ziel.addView(Ui.titel(h, Texte.titel(modus)));
        final LinearLayout rumpf = box(ziel);
        if (!Texte.mitAuftrag(modus)) { scanAufbauen(rumpf, modus, "", null); return; }
        rumpf.addView(laedt());
        h.holeFuerSeite("auftrag", Api.daten("id", auftrag, "modus", modus), r -> {
            if (!r.ok()) { fehler(rumpf, r); return; }
            scanAufbauen(rumpf, modus, auftrag, r);
        });
    }

    private void scanAufbauen(final LinearLayout rumpf, final String modus, final String auftrag, Antwort ar) {
        rumpf.removeAllViews();
        final boolean mitAuftrag = ar != null;
        final Antwort a = mitAuftrag ? ar.teil("auftrag") : null;
        if (mitAuftrag) {
            if (!a.str("zumiete").isEmpty()) rumpf.addView(Ui.meldung(h, "🔁 Zugemietet – nicht aus unserem Lager, nicht scannen: " + a.str("zumiete"), "hinweis"));
            LinearLayout k = Ui.karte(h);
            LinearLayout z = Ui.zeile(h);
            z.addView(Ui.text(h, a.str("nr") + " · " + a.str("kunde"), 16, Ui.TEXT, true), Ui.gewicht(1));
            z.addView(Ui.marke(h, a.str("status_text"), Ui.BLAUHELL, Ui.BLAU));
            k.addView(z);
            k.addView(Ui.klein(h, a.str("zeitraum") + " · " + a.str("lieferung")));
            if (!a.str("notiz").isEmpty()) k.addView(Ui.klein(h, "Notiz: " + a.str("notiz")));
            rumpf.addView(k);
            if (!a.bool("moeglich")) rumpf.addView(Ui.meldung(h, "Dieser Auftrag ist " + a.str("status_text") + " – " + Texte.titel(modus) + " ist nicht mehr möglich.", "err"));
        } else {
            HorizontalScrollView hs = new HorizontalScrollView(h);
            hs.setHorizontalScrollBarEnabled(false);
            LinearLayout r = Ui.zeile(h);
            for (final String m : Texte.MODI_FREI) {
                Button b = Ui.knopf(h, Texte.titel(m), m.equals(modus) ? Ui.K_DUNKEL : Ui.K_HELL);
                if (m.equals(modus)) b.setTextColor(Ui.GOLD);
                b.setTextSize(14);
                b.setMinHeight(0); b.setMinimumHeight(0);
                b.setPadding(Ui.dp(h, 14), Ui.dp(h, 8), Ui.dp(h, 14), Ui.dp(h, 8));
                b.setOnClickListener(v -> h.zeige("scan", Api.daten("modus", m), false));
                r.addView(b, Ui.abstand(h, Ui.lp(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT), 0, 0, 6, 0));
            }
            hs.addView(r);
            rumpf.addView(hs, Ui.abstand(h, Ui.breit(), 0, 0, 0, 10));
        }
        TextView hilfe = Ui.klein(h, Texte.hilfe(modus));
        hilfe.setPadding(0, 0, 0, Ui.dp(h, 10));
        rumpf.addView(hilfe);

        LinearLayout karte = Ui.karte(h);
        final FrameLayout kamBox = new FrameLayout(h);
        kamBox.setVisibility(View.GONE);
        karte.addView(kamBox, Ui.breit());
        final Button kamK = Ui.knopfGross(h, "📷 Kamera starten", Ui.K_GOLD);
        karte.addView(kamK);
        h.kameraStatus = an -> kamK.setVisibility(an ? View.GONE : View.VISIBLE);

        Spinner grund = null;
        EditText grundText = null;
        final List<String> grundSchluessel = new ArrayList<>();
        if ("abgang".equals(modus)) {
            karte.addView(Ui.feld(h, "Grund"));
            grund = new Spinner(h);
            final List<String> texte = new ArrayList<>();
            texte.add("– Grund wählen –");
            grundSchluessel.add("");
            Map<String, Object> g = h.gruende == null ? new HashMap<>() : h.gruende;
            for (Map.Entry<String, Object> e : g.entrySet()) { texte.add(String.valueOf(e.getValue())); grundSchluessel.add(e.getKey()); }
            final ArrayAdapter<String> ad = new ArrayAdapter<>(h, android.R.layout.simple_spinner_item, texte);
            ad.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
            grund.setAdapter(ad);
            grund.setBackground(Ui.rund(h, Ui.WEISS, 10, Ui.LINIE));
            grund.setPadding(Ui.dp(h, 4), Ui.dp(h, 8), Ui.dp(h, 4), Ui.dp(h, 8));
            karte.addView(grund, Ui.abstand(h, Ui.breit(), 0, 0, 0, 10));
            final TextView pflicht = Ui.feld(h, "Bemerkung (freiwillig)");
            karte.addView(pflicht);
            grundText = Ui.eingabe(h, "z. B. Bein gebrochen");
            karte.addView(grundText);
            grund.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                public void onItemSelected(AdapterView<?> par, View v, int pos, long id) {
                    pflicht.setText("sonstiges".equals(grundSchluessel.get(pos)) ? "Bemerkung (Pflicht)" : "Bemerkung (freiwillig)");
                }
                public void onNothingSelected(AdapterView<?> par) { }
            });
            if (h.gruende == null) h.hole("status", null, r -> {
                if (r.hat("gruende")) {
                    h.gruende = r.map("gruende");
                    for (Map.Entry<String, Object> e : h.gruende.entrySet()) { texte.add(String.valueOf(e.getValue())); grundSchluessel.add(e.getKey()); }
                    ad.notifyDataSetChanged();
                }
            });
        }
        final EditText menge = Ui.zahlEingabe(h, "1", true);
        menge.setText("1");
        menge.setGravity(Gravity.CENTER);
        menge.setTextSize(18);
        if (!"info".equals(modus)) {
            LinearLayout mz = Ui.zeile(h);
            Button minus = Ui.knopf(h, "−", Ui.K_HELL), plus = Ui.knopf(h, "+", Ui.K_HELL);
            minus.setTextSize(22); plus.setTextSize(22);
            mz.addView(minus, new LinearLayout.LayoutParams(Ui.dp(h, 54), Ui.dp(h, 52)));
            LinearLayout.LayoutParams mp = new LinearLayout.LayoutParams(Ui.dp(h, 90), ViewGroup.LayoutParams.WRAP_CONTENT);
            mp.setMargins(Ui.dp(h, 8), 0, Ui.dp(h, 8), 0);
            menge.setLayoutParams(mp);
            mz.addView(menge);
            mz.addView(plus, new LinearLayout.LayoutParams(Ui.dp(h, 54), Ui.dp(h, 52)));
            TextView mt = Ui.klein(h, "Menge je Scan");
            mt.setPadding(Ui.dp(h, 10), 0, 0, 0);
            mz.addView(mt);
            minus.setOnClickListener(v -> { int m = Texte.menge(menge.getText().toString()) - 1; if (m == 0) m = -1; menge.setText(String.valueOf(m)); });
            plus.setOnClickListener(v -> { int m = Texte.menge(menge.getText().toString()) + 1; if (m == 0) m = 1; menge.setText(String.valueOf(m)); });
            karte.addView(mz, Ui.abstand(h, Ui.breit(), 0, 10, 0, 10));
        }
        final CheckBox schaden = new CheckBox(h);
        if ("rueckgabe".equals(modus)) {
            schaden.setText("beschädigt");
            schaden.setTextColor(Ui.ROT);
            schaden.setTextSize(16);
            schaden.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            karte.addView(schaden);
        }
        LinearLayout hand = Ui.zeile(h);
        final EditText code = Ui.eingabe(h, "Hand-Scanner oder Artikel tippen …");
        code.setLayoutParams(Ui.gewicht(1));
        hand.addView(code);
        Button ok = Ui.knopf(h, "OK", Ui.K_HELL);
        hand.addView(ok, Ui.abstand(h, Ui.lp(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT), 8, 0, 0, 10));
        karte.addView(hand, Ui.abstand(h, Ui.breit(), 0, 6, 0, 0));
        final TextView erg = Ui.meldung(h, "Bereit.", "");
        erg.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        erg.setMinHeight(Ui.dp(h, 52));
        karte.addView(erg);
        final Button rueck = Ui.knopfBreit(h, "↶ Letzten Scan rückgängig", Ui.K_HELL);
        rueck.setVisibility(View.GONE);
        karte.addView(rueck);
        rumpf.addView(karte);
        final LinearLayout infoBox = box(rumpf);
        final LinearLayout listeBox = box(rumpf);
        LinearLayout abgangBox = null;
        if ("abgang".equals(modus)) {
            LinearLayout k = Ui.karte(h);
            k.addView(Ui.untertitel(h, "Heute ausgebucht"));
            abgangBox = Ui.senkrecht(h);
            abgangBox.addView(Ui.klein(h, "Lädt …"));
            k.addView(abgangBox);
            rumpf.addView(k);
        }
        final LinearLayout abgangB = abgangBox;
        LinearLayout sucheK = null;
        if (!mitAuftrag) {
            sucheK = Ui.karte(h);
            sucheK.addView(Ui.untertitel(h, "🔍 Wo liegt …?"));
            rumpf.addView(sucheK);
        }
        final CheckBox trotzdem = new CheckBox(h);
        Button fertig = null;
        if (mitAuftrag && a.bool("moeglich")) {
            LinearLayout k = Ui.karte(h);
            fertig = Ui.knopfGross(h, "packen".equals(modus) ? "✓ Ausgabe abschließen" : "✓ Rückgabe abschließen", Ui.K_GOLD);
            k.addView(fertig);
            trotzdem.setText("packen".equals(modus) ? "trotzdem ausgeben, auch wenn nicht alles gepackt ist" : "Rückgabe mit Fehlmengen buchen (fehlende Stück werden vom Bestand abgezogen)");
            trotzdem.setTextColor(Ui.GRAU);
            trotzdem.setTextSize(13.5f);
            k.addView(trotzdem);
            rumpf.addView(k);
        }

        final Haupt.Danach<List<Antwort>> liste = l -> {
            listeBox.removeAllViews();
            if (l == null || l.isEmpty() || !mitAuftrag) return;
            String feld = "packen".equals(modus) ? "gepackt" : "zurueck";
            int fertigN = 0, gesamt = 0;
            LinearLayout k = Ui.karte(h);
            TextView kt = Ui.untertitel(h, "");
            k.addView(kt);
            for (int i = 0; i < l.size(); i++) {
                Antwort x = l.get(i);
                int ist = x.zahl(feld), m = x.zahl("menge");
                fertigN += Math.min(ist, m); gesamt += m;
                if (i > 0) k.addView(Ui.linie(h));
                LinearLayout pz = Ui.pos(h);
                pz.addView(Ui.regal(h, x.str("platz")));
                LinearLayout mitte = Ui.senkrecht(h);
                mitte.setPadding(Ui.dp(h, 10), 0, Ui.dp(h, 10), 0);
                mitte.addView(Ui.text(h, x.str("name"), 15.5f, ist >= m ? Ui.GRUEN : Ui.TEXT, true));
                if ("rueckgabe".equals(modus) && x.zahl("schaden") > 0) mitte.addView(Ui.text(h, x.zahl("schaden") + " beschädigt", 13, Ui.ROT, true));
                mitte.addView(Ui.balken(h, ist, m, ist >= m));
                pz.addView(mitte, Ui.gewicht(1));
                pz.addView(Ui.text(h, ist + " / " + m, 15.5f, ist >= m ? Ui.GRUEN : Ui.TEXT, true));
                k.addView(pz);
            }
            kt.setText(("packen".equals(modus) ? "Packliste" : "Rückgabe") + " – " + fertigN + " von " + gesamt + " Stück");
            listeBox.addView(k);
        };
        final Haupt.Danach<List<Antwort>> abgang = l -> {
            if (abgangB == null) return;
            abgangB.removeAllViews();
            if (l == null || l.isEmpty()) { abgangB.addView(Ui.klein(h, "Heute noch nichts ausgebucht.")); return; }
            for (int i = 0; i < l.size(); i++) {
                Antwort z = l.get(i);
                if (i > 0) abgangB.addView(Ui.linie(h));
                LinearLayout pz = Ui.pos(h);
                pz.addView(Ui.regal(h, z.str("regal")));
                LinearLayout nu = Ui.nameUnter(h, z.str("name"), z.str("grund") + (z.str("bem").isEmpty() ? "" : " · " + z.str("bem")));
                nu.setPadding(Ui.dp(h, 10), 0, Ui.dp(h, 10), 0);
                pz.addView(nu, Ui.gewicht(1));
                pz.addView(Ui.text(h, String.valueOf(z.zahl("menge")), 16, Ui.TEXT, true));
                abgangB.addView(pz);
            }
        };
        if (ar != null) liste.mit(ar.liste("liste"));
        if ("abgang".equals(modus)) h.holeFuerSeite("abgang_liste", null, x -> { if (x.ok()) abgang.mit(x.liste("abgang")); });

        final Spinner grundF = grund;
        final EditText grundT = grundText;
        final Object[][] letzter = {null};
        final boolean[] laeuft = {false};
        final int nr = h.ansichtNr;

        final class Melder {
            void setze(String typ, String text) {
                erg.setText(text);
                String art = "ok".equals(typ) ? "ok" : "warn".equals(typ) ? "warn" : "err".equals(typ) ? "err" : "";
                Ui.meldungFarbe(h, erg, art);
            }
            void melde(final String c, final int m, final boolean rueckgaengig, Object[] alt) {
                final String g = alt != null ? (String) alt[2] : grundF == null ? "" : grundSchluessel.get(Math.max(0, grundF.getSelectedItemPosition()));
                final String gt = alt != null ? (String) alt[3] : grundT == null ? "" : grundT.getText().toString().trim();
                final boolean sch = alt != null ? (Boolean) alt[4] : schaden.isChecked();
                if ("abgang".equals(modus) && !rueckgaengig) {
                    if (g.isEmpty()) { setze("err", "Bitte zuerst einen Grund wählen."); h.ton("err"); return; }
                    if ("sonstiges".equals(g) && gt.isEmpty()) { setze("err", "Bei „Sonstiges“ bitte den Grund eintragen."); h.ton("err"); grundT.requestFocus(); return; }
                }
                if (laeuft[0]) return;
                laeuft[0] = true;
                setze("", "…");
                h.hole("scan", Api.daten("modus", modus, "auftrag", auftrag, "code", c, "menge", m, "schaden", sch, "grund", g, "grundtext", gt), x -> {
                    laeuft[0] = false;
                    if (nr != h.ansichtNr) return;
                    String typ = x.typ();
                    setze(typ, (rueckgaengig && x.ok() && !x.msg().toLowerCase(Locale.GERMAN).contains("rückgängig") ? "Rückgängig: " : "") + x.msg());
                    h.ton(x.ok() ? "ok" : "warn".equals(typ) ? "warn" : "err");
                    if (x.hat("info")) { infoBox.removeAllViews(); infoBox.addView(infoKarte(x.teil("info"))); }
                    if (x.hat("liste")) liste.mit(x.liste("liste"));
                    if (x.hat("abgang")) abgang.mit(x.liste("abgang"));
                    if (x.ok() && !"info".equals(modus)) {
                        h.artikelCache = null;
                        if (!rueckgaengig) { letzter[0] = new Object[]{c, m, g, gt, sch}; rueck.setVisibility(View.VISIBLE); }
                        else { letzter[0] = null; rueck.setVisibility(View.GONE); }
                    }
                });
            }
        }
        final Melder melder = new Melder();
        final Runnable abschicken = () -> {
            String c = code.getText().toString().trim();
            if (c.isEmpty()) return;
            code.setText("");
            melder.melde(c, Texte.menge(menge.getText().toString()), false, null);
        };
        h.enter(code, abschicken);
        ok.setOnClickListener(v -> abschicken.run());
        rueck.setOnClickListener(v -> { Object[] l = letzter[0]; if (l != null) melder.melde((String) l[0], -(Integer) l[1], true, l); });
        kamK.setOnClickListener(v -> { h.tastaturWeg(); h.kameraAn(kamBox, c -> melder.melde(c, Texte.menge(menge.getText().toString()), false, null)); });
        if (sucheK != null) suchfeld(sucheK, "info".equals(modus) ? "Anzeigen" : "Buchen", id -> {
            if ("info".equals(modus)) artikelInfo(id); else melder.melde(id, Texte.menge(menge.getText().toString()), false, null);
        });
        if (fertig != null) {
            final Button fk = fertig;
            fertig.setOnClickListener(v -> {
                fk.setEnabled(false);
                h.hole("fertig", Api.daten("id", auftrag, "modus", modus, "trotzdem", trotzdem.isChecked()), x -> {
                    fk.setEnabled(true);
                    if (x.ok()) { h.ton("ok"); h.toast(x.msg()); h.artikelCache = null; h.verlauf.clear(); h.zeige("halle", null, false); return; }
                    h.ton("err");
                    melder.setze("err", x.msg());
                    if (x.bool("fehlt")) { trotzdem.setTextColor(Ui.ROT); trotzdem.setTypeface(android.graphics.Typeface.DEFAULT_BOLD); }
                    h.rollen.post(() -> h.rollen.smoothScrollTo(0, Math.max(0, erg.getTop())));
                });
            });
        }
    }

    /* ======================= Inventur ======================= */
    private void inventur(LinearLayout ziel, Map<String, Object> p) {
        final boolean nur = Boolean.TRUE.equals(p.get("nur"));
        ziel.addView(Ui.titel(h, "Inventur"));
        final LinearLayout b = box(ziel);
        b.addView(laedt());
        h.holeFuerSeite("inventur", null, r -> {
            if (!r.ok()) { fehler(b, r); return; }
            b.removeAllViews();
            List<Antwort> l = r.liste("liste");
            int gez = 0, abw = 0;
            for (Antwort x : l) { Integer ist = x.zahlOderNull("ist"); if (ist != null) { gez++; if (ist != x.zahl("soll")) abw++; } }
            TextView info = Ui.klein(h, (r.bool("laeuft") ? "Zählung läuft seit " + r.str("start") + " · " + gez + " Artikel gezählt · " + abw + " Abweichungen." : "Noch keine Zählung begonnen.")
                    + " Soll = Bestand minus Stück beim Kunden. Jede Eingabe wird sofort gespeichert.");
            info.setPadding(0, 0, 0, Ui.dp(h, 10));
            b.addView(info);
            LinearLayout kz = Ui.zeile(h);
            Button sc = Ui.knopf(h, "📷 Mit Scanner zählen", Ui.K_GOLD);
            sc.setOnClickListener(v -> h.zeige("scan", Api.daten("modus", "inventur"), true));
            kz.addView(sc, Ui.abstand(h, Ui.gewicht(1), 0, 0, 8, 0));
            Button nk = Ui.knopf(h, nur ? "Alle zeigen" : "Nur ungezählte", Ui.K_HELL);
            nk.setOnClickListener(v -> h.zeige("inventur", Api.daten("nur", !nur), false));
            kz.addView(nk, Ui.gewicht(1));
            b.addView(kz, Ui.abstand(h, Ui.breit(), 0, 0, 0, 12));
            LinearLayout k = Ui.karte(h);
            String alt = null;
            boolean irgendwas = false;
            for (final Antwort x : l) {
                Integer ist = x.zahlOderNull("ist");
                if (nur && ist != null) continue;
                irgendwas = true;
                if (!x.str("regal").equals(alt)) {
                    alt = x.str("regal");
                    TextView g = Ui.text(h, alt.isEmpty() ? "ohne Lagerplatz" : "Regal " + alt, 13.5f, Ui.TEXT, true);
                    g.setBackground(Ui.rund(h, 0xFFF3EFE4, 8, 0));
                    g.setPadding(Ui.dp(h, 10), Ui.dp(h, 6), Ui.dp(h, 10), Ui.dp(h, 6));
                    k.addView(g, Ui.abstand(h, Ui.breit(), 0, 10, 0, 2));
                }
                final int soll = x.zahl("soll");
                LinearLayout pz = Ui.pos(h);
                pz.addView(Ui.nameUnter(h, x.str("name"), "Soll " + soll), Ui.gewicht(1));
                final EditText feld = Ui.zahlEingabe(h, "–", false);
                feld.setGravity(Gravity.CENTER);
                feld.setText(ist == null ? "" : String.valueOf(ist));
                LinearLayout.LayoutParams fp = new LinearLayout.LayoutParams(Ui.dp(h, 84), ViewGroup.LayoutParams.WRAP_CONTENT);
                fp.setMargins(0, 0, 0, 0);
                pz.addView(feld, fp);
                final TextView d = Ui.text(h, "", 15, Ui.GRAU, true);
                d.setGravity(Gravity.END);
                pz.addView(d, new LinearLayout.LayoutParams(Ui.dp(h, 42), ViewGroup.LayoutParams.WRAP_CONTENT));
                diff(d, ist, soll);
                final String[] gespeichert = {feld.getText().toString().trim()};
                final Runnable speichern = () -> {
                    final String w = feld.getText().toString().trim();
                    if (w.equals(gespeichert[0])) return;
                    h.hole("inventur_setzen", Api.daten("aid", x.str("id"), "wert", w.isEmpty() ? null : w), y -> {
                        if (!y.ok()) { h.toast(y.msg()); return; }
                        gespeichert[0] = w;
                        Integer n = null;
                        try { n = w.isEmpty() ? null : Math.max(0, Integer.parseInt(w)); } catch (Exception e) { /* leer */ }
                        diff(d, n, soll);
                        h.toast("Gespeichert");
                    });
                };
                h.enter(feld, () -> { speichern.run(); h.tastaturWeg(); feld.clearFocus(); });
                feld.setOnFocusChangeListener((v, fokus) -> { if (!fokus) speichern.run(); });
                k.addView(pz);
                k.addView(Ui.linie(h));
            }
            if (!irgendwas) k.addView(leer("Alle Artikel sind gezählt. 👍"));
            b.addView(k);
            if (h.api.admin()) {
                Button ab = Ui.knopfBreit(h, "✓ Abschließen & Bestand anpassen", Ui.K_DUNKEL);
                ab.setOnClickListener(v -> h.fragen("Inventur abschließen? Die Bestände der gezählten Artikel werden an die Zählung angepasst.",
                        () -> h.hole("inventur_abschliessen", null, y -> { h.toast(y.msg()); h.artikelCache = null; h.zeige("inventur", null, false); })));
                b.addView(ab);
            }
            Button vw = Ui.knopfBreit(h, "Zählung verwerfen", Ui.K_ROT);
            vw.setOnClickListener(v -> h.fragen("Die ganze Zählung verwerfen?",
                    () -> h.hole("inventur_verwerfen", null, y -> { h.toast(y.msg()); h.zeige("inventur", null, false); })));
            b.addView(vw);
            if (!h.api.admin()) b.addView(Ui.klein(h, "Abschließen kann nur die Verwaltung."));
            List<Antwort> hist = r.liste("historie");
            if (h.api.admin() && !hist.isEmpty()) {
                LinearLayout hk = Ui.karte(h);
                hk.addView(Ui.untertitel(h, "Letzte Inventuren"));
                for (Antwort x : hist) hk.addView(Ui.klein(h, x.str("ende") + ": " + x.zahl("gezaehlt") + " Artikel, " + x.zahl("abw") + " Abweichungen"));
                b.addView(hk, Ui.abstand(h, Ui.breit(), 0, 10, 0, 0));
            }
        });
    }

    private static void diff(TextView d, Integer ist, int soll) {
        d.setText(Texte.abweichung(ist, soll));
        d.setTextColor(ist == null ? Ui.GRAU : ist == soll ? Ui.GRUEN : Ui.ROT);
    }

    /* ======================= Ich ======================= */
    private void ich(LinearLayout ziel) {
        final LinearLayout b = box(ziel);
        b.addView(laedt());
        h.holeFuerSeite("status", null, r -> {
            if (!r.ok()) { fehler(b, r); return; }
            b.removeAllViews();
            b.addView(Ui.titel(h, r.str("name")));
            b.addView(Ui.meldung(h, "✓ Eingestempelt seit " + r.str("seit") + " Uhr – die App ist freigeschaltet.", "ok"));
            LinearLayout k = Ui.karte(h);
            k.addView(Ui.klein(h, "Sobald du dich am Stempel-Terminal ausstempelst, sperrt sich die App automatisch. Deine Buchungen stehen mit deinem Namen im Lagerbuch."));
            b.addView(k);
            Button e = Ui.knopfBreit(h, "⚙ Einstellungen", Ui.K_HELL);
            e.setOnClickListener(v -> einstellungen(null));
            b.addView(e);
            Button ab = Ui.knopfBreit(h, "Von diesem Gerät abmelden", Ui.K_ROT);
            ab.setOnClickListener(v -> h.abmelden());
            b.addView(ab);
        });
    }

    /* ======================= Mehr (Admin) ======================= */
    private void mehr(LinearLayout ziel) {
        ziel.addView(Ui.titel(h, "Mehr"));
        ziel.addView(Ui.raster(h,
                kachel("⏱", "Stempel-Terminal", "Handy als Stempeluhr", true, () -> h.zeige("terminal", null, true)),
                kachel("📱", "Geräte", "angemeldete Handys", false, () -> h.zeige("geraete", null, true)),
                kachel("🖥", "Verwaltung", "im Browser öffnen", false, () -> browser("?admin&ww=start")),
                kachel("📒", "Lagerbuch", "im Browser öffnen", false, () -> browser("?admin&ww=lagerbuch"))));
        Button e = Ui.knopfBreit(h, "⚙ Einstellungen", Ui.K_HELL);
        e.setOnClickListener(v -> einstellungen(null));
        ziel.addView(e);
        Button ab = Ui.knopfBreit(h, "Admin abmelden", Ui.K_ROT);
        ab.setOnClickListener(v -> h.abmelden());
        ziel.addView(ab);
    }

    /* ======================= Geräte ======================= */
    private void geraete(LinearLayout ziel) {
        ziel.addView(Ui.titel(h, "Angemeldete Geräte"));
        ziel.addView(Ui.klein(h, "Handy verloren oder Mitarbeiter ausgeschieden? Hier abmelden."));
        final LinearLayout b = box(ziel);
        b.addView(laedt());
        h.holeFuerSeite("geraete", null, r -> {
            if (!r.ok()) { fehler(b, r); return; }
            b.removeAllViews();
            LinearLayout k = Ui.karte(h);
            List<Antwort> l = r.liste("geraete");
            if (l.isEmpty()) k.addView(leer("Keine."));
            for (int i = 0; i < l.size(); i++) {
                final Antwort g = l.get(i);
                if (i > 0) k.addView(Ui.linie(h));
                LinearLayout pz = Ui.pos(h);
                pz.addView(Ui.nameUnter(h, g.str("name") + (g.bool("ich") ? " (dieses Gerät)" : ""), g.str("geraet") + "\nzuletzt " + g.str("zuletzt")), Ui.gewicht(1));
                if (!g.bool("ich")) {
                    Button weg = Ui.knopf(h, "Abmelden", Ui.K_ROT);
                    weg.setOnClickListener(v -> h.fragen("Dieses Gerät abmelden?",
                            () -> h.hole("geraet_abmelden", Api.daten("id", g.str("id")), y -> { h.toast(y.msg()); h.neuLaden(); })));
                    pz.addView(weg);
                }
                k.addView(pz);
            }
            b.addView(k, Ui.abstand(h, Ui.breit(), 0, 10, 0, 0));
        });
    }

    /* ======================= Stempel-Terminal ======================= */
    private void terminal(LinearLayout ziel) {
        ziel.addView(Ui.titel(h, "Stempel-Terminal"));
        final LinearLayout anz = Ui.senkrecht(h);
        anz.setGravity(Gravity.CENTER);
        anz.setMinimumHeight(Ui.dp(h, 150));
        int p = Ui.dp(h, 18);
        anz.setPadding(p, Ui.dp(h, 24), p, Ui.dp(h, 24));
        final TextView gross = Ui.text(h, "", 22, Ui.CREME, true);
        gross.setGravity(Gravity.CENTER);
        final TextView uhr = Ui.text(h, "", 48, Ui.GOLD, true);
        uhr.setGravity(Gravity.CENTER);
        final TextView mitte = Ui.text(h, "", 16, Ui.CREME, false);
        mitte.setGravity(Gravity.CENTER);
        final TextView hinweis = Ui.text(h, "", 15, Ui.CREME, true);
        hinweis.setGravity(Gravity.CENTER);
        anz.addView(gross, Ui.breit()); anz.addView(uhr, Ui.breit()); anz.addView(mitte, Ui.breit()); anz.addView(hinweis, Ui.breit());
        ziel.addView(anz, Ui.abstand(h, Ui.breit(), 0, 0, 0, 12));
        final FrameLayout kamBox = new FrameLayout(h);
        kamBox.setVisibility(View.GONE);
        ziel.addView(kamBox, Ui.breit());
        final Button kam = Ui.knopfGross(h, "📷 Kamera starten", Ui.K_GOLD);
        ziel.addView(kam);
        h.kameraStatus = an -> kam.setVisibility(an ? View.GONE : View.VISIBLE);
        LinearLayout hand = Ui.zeile(h);
        final EditText code = Ui.eingabe(h, "oder Hand-Scanner hier …");
        code.setLayoutParams(Ui.gewicht(1));
        hand.addView(code);
        Button ok = Ui.knopf(h, "OK", Ui.K_HELL);
        hand.addView(ok, Ui.abstand(h, Ui.lp(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT), 8, 0, 0, 10));
        ziel.addView(hand, Ui.breit());
        LinearLayout daK = Ui.karte(h);
        daK.addView(Ui.untertitel(h, "Jetzt eingestempelt"));
        final TextView da = Ui.klein(h, "–");
        daK.addView(da);
        ziel.addView(daK);
        ziel.addView(Ui.klein(h, "1. Scan = Kommen, nächster Scan = Gehen. Wer sich ausstempelt, dessen App wird sofort gesperrt."));

        final Runnable bereit = () -> {
            anz.setBackground(Ui.rund(h, Ui.DUNKEL2, 16, 0));
            gross.setText("Ausweis vor die Kamera halten");
            gross.setTextColor(Ui.CREME);
            uhr.setText(new SimpleDateFormat("HH:mm", Locale.GERMANY).format(new Date()));
            uhr.setVisibility(View.VISIBLE);
            mitte.setVisibility(View.GONE); hinweis.setVisibility(View.GONE);
        };
        final Runnable uhrT = new Runnable() { public void run() {
            if (uhr.getVisibility() == View.VISIBLE) uhr.setText(new SimpleDateFormat("HH:mm", Locale.GERMANY).format(new Date()));
            h.ui.postDelayed(this, 5000);
        } };
        h.seitenTimer.add(uhrT);
        h.ui.postDelayed(uhrT, 5000);
        h.seitenTimer.add(bereit);
        final Haupt.Danach<List<Antwort>> zeigeDa = l -> {
            if (l.isEmpty()) { da.setText("Niemand eingestempelt."); return; }
            StringBuilder b = new StringBuilder();
            for (Antwort x : l) { if (b.length() > 0) b.append("\n"); b.append(x.str("name")).append("  seit ").append(x.str("seit")); }
            da.setText(b.toString());
            da.setTextColor(Ui.TEXT);
        };
        final Map<String, Long> sperre = new HashMap<>();
        final Haupt.Gescannt stempeln = c -> {
            if (c == null || c.trim().isEmpty()) return;
            long t = System.currentTimeMillis();
            Long vorher = sperre.get(c);
            if (vorher != null && t - vorher < 8000) return;
            sperre.put(c, t);
            h.hole("stempeln", Api.daten("code", c.trim()), r -> {
                String typ = r.typ(), art = r.str("art");
                int hg = r.ok() ? ("kommen".equals(art) ? Ui.GRUEN : Ui.BLAU) : "warn".equals(typ) ? Ui.GOLD2 : Ui.ROT;
                int vg = "warn".equals(typ) ? Ui.DUNKEL : Color.WHITE;
                anz.setBackground(Ui.rund(h, hg, 16, 0));
                uhr.setVisibility(View.GONE);
                gross.setTextColor(vg); mitte.setTextColor(vg); hinweis.setTextColor(vg);
                gross.setText(r.str("titel").isEmpty() ? r.msg() : r.str("titel"));
                mitte.setText(r.str("titel").isEmpty() ? "" : r.msg());
                mitte.setVisibility(mitte.getText().length() > 0 ? View.VISIBLE : View.GONE);
                hinweis.setText(r.str("hinweis"));
                hinweis.setVisibility(r.str("hinweis").isEmpty() ? View.GONE : View.VISIBLE);
                h.ton(r.ok() ? art : typ);
                if (r.hat("da")) zeigeDa.mit(r.liste("da"));
                h.ui.removeCallbacks(bereit);
                h.ui.postDelayed(bereit, 4500);
            });
        };
        kam.setOnClickListener(v -> h.kameraAn(kamBox, stempeln));
        final Runnable handLos = () -> { String c = code.getText().toString().trim(); code.setText(""); stempeln.code(c); };
        h.enter(code, handLos);
        ok.setOnClickListener(v -> handLos.run());
        bereit.run();
        h.holeFuerSeite("uebersicht", null, r -> { if (r.ok()) zeigeDa.mit(r.liste("anwesend")); });
    }

    /* ======================= Einstellungen ======================= */
    void einstellungen(final Runnable danach) {
        ScrollView sv = new ScrollView(h);
        final LinearLayout s = Ui.senkrecht(h);
        int p = Ui.dp(h, 18);
        s.setPadding(p, p, p, p);
        s.setBackgroundColor(Ui.CREME);
        sv.addView(s);
        s.addView(Ui.titel(h, "Einstellungen"));
        s.addView(Ui.feld(h, "Adresse der Webseite (mit der warenwirtschaft.php)"));
        final EditText server = Ui.eingabe(h, Api.STANDARD_SERVER);
        server.setText(h.api.server);
        server.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        s.addView(server);
        s.addView(Ui.klein(h, "Normalerweise: www.fehnverleih.de (die App hängt „?lagerapp“ selbst an)."));
        final LinearLayout test = Ui.senkrecht(h);
        Button pr = Ui.knopfBreit(h, "↻ Verbindung testen", Ui.K_HELL);
        s.addView(pr, Ui.abstand(h, Ui.breit(), 0, 10, 0, 6));
        s.addView(test, Ui.breit());
        pr.setOnClickListener(v -> {
            final String adr = server.getText().toString();
            h.meldungSetzen(test, "Teste …", "");
            h.hintergrund(() -> verbindungTesten(adr), t -> h.meldungSetzen(test, t[1], t[0]));
        });
        final CheckBox ton = new CheckBox(h);
        ton.setText("Töne beim Scannen");
        ton.setTextSize(15);
        ton.setChecked(!"aus".equals(h.prefs.getString("ton", "")));
        s.addView(ton);
        s.addView(Ui.feld(h, "Name dieses Geräts (erscheint in der Geräte-Liste)"));
        final EditText geraet = Ui.eingabe(h, h.geraetName());
        geraet.setText(h.prefs.getString("geraet", ""));
        s.addView(geraet);
        s.addView(Ui.klein(h, Texte.APP_NAME + " " + Texte.VERSION));
        final AlertDialog d = new AlertDialog.Builder(h).setView(sv)
                .setPositiveButton("Speichern", null).setNegativeButton("Abbrechen", null).create();
        d.setOnShowListener(x -> d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            final boolean neuerServer = !Api.schnittstelle(server.getText().toString()).equals(Api.schnittstelle(h.api.server));
            final Runnable speichern = () -> {
                h.api.serverSetzen(server.getText().toString());
                h.prefs.edit().putString("ton", ton.isChecked() ? "an" : "aus").putString("geraet", geraet.getText().toString().trim()).apply();
                h.api.geraet = h.geraetName();
                d.dismiss();
                if (neuerServer && h.api.angemeldet()) h.abmeldenLokal("Server-Adresse geändert – bitte neu anmelden.");
                else if (danach != null) danach.run();
            };
            if (neuerServer && h.api.angemeldet()) h.fragen("Mit einer anderen Server-Adresse musst du dich neu anmelden. Weiter?", speichern);
            else speichern.run();
        }));
        d.show();
    }

    static String[] verbindungTesten(String adresse) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(Api.schnittstelle(adresse)).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(12000);
            int code = c.getResponseCode();
            InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
            StringBuilder b = new StringBuilder();
            if (is != null) {
                byte[] puf = new byte[4096];
                int n;
                while ((n = is.read(puf)) > 0) b.append(new String(puf, 0, n, "UTF-8"));
                is.close();
            }
            if (b.toString().contains("Lager-App-Schnittstelle bereit")) return new String[]{"ok", "Verbindung klappt – der Server ist bereit."};
            return new String[]{"err", "Server erreichbar (Code " + code + "), aber die Lager-Schnittstelle antwortet nicht. Ist die neue warenwirtschaft.php hochgeladen?"};
        } catch (Exception e) {
            return new String[]{"err", "Keine Verbindung: " + e.getClass().getSimpleName() + (e.getMessage() == null ? "" : " – " + e.getMessage())};
        }
    }
}
