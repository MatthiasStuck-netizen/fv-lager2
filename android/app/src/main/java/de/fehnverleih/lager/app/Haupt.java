package de.fehnverleih.lager.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.ResultPoint;
import com.journeyapps.barcodescanner.BarcodeCallback;
import com.journeyapps.barcodescanner.BarcodeResult;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import com.journeyapps.barcodescanner.DefaultDecoderFactory;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import de.fehnverleih.lager.kern.Antwort;
import de.fehnverleih.lager.kern.Api;

/**
 * Die Android-App „FV Lager“ – eine einzige Activity, alle Bildschirme im Code gebaut (kein HTML, kein WebView).
 * Spricht wie das PC-Programm mit der Schnittstelle der Webseite (…/?lagerapp).
 */
public class Haupt extends Activity implements Api.Beobachter {

    public static final long PULS_FREI_MS = 20000, PULS_GESPERRT_MS = 8000;

    /** Rückruf für Server-Antworten im Oberflächen-Thread */
    public interface Fertig { void da(Antwort r); }
    /** Rückruf für einen gescannten Code */
    public interface Gescannt { void code(String code); }

    final Handler ui = new Handler(Looper.getMainLooper());
    final ExecutorService hinter = Executors.newFixedThreadPool(3);
    Api api;
    SharedPreferences prefs;
    Seiten seiten;

    boolean gesperrt = true;
    boolean sichtbar;
    String aktuell = "";
    Map<String, Object> aktuellParam;
    int ansichtNr = 0;
    final List<Object[]> verlauf = new ArrayList<>();   // {seite, parameter} für die Zurück-Taste
    List<Antwort> artikelCache;
    Map<String, Object> gruende;
    AlertDialog blatt;

    // App-Bildschirm
    LinearLayout inhalt;
    ScrollView rollen;
    LinearLayout nav;
    TextView kopfName, kopfChip;
    // Sperre
    TextView sperreText, sperreZeit;

    private final Runnable puls = new Runnable() { public void run() { pruefen(); ui.postDelayed(this, gesperrt ? PULS_GESPERRT_MS : PULS_FREI_MS); } };
    private boolean pulsLaeuft;
    private volatile boolean pruefungLaeuft;
    final List<Runnable> seitenTimer = new ArrayList<>();

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Locale.setDefault(Locale.GERMANY);
        getWindow().getDecorView().setBackgroundColor(Ui.CREME);
        prefs = getSharedPreferences("fvlager", Context.MODE_PRIVATE);
        api = new Api(new Api.Speicher() {
            public String lesen(String k) { return prefs.getString(k, ""); }
            public void schreiben(String k, String v) {
                if (v == null || v.isEmpty()) prefs.edit().remove(k).apply(); else prefs.edit().putString(k, v).apply();
            }
        });
        api.beobachter = this;
        api.geraet = geraetName();
        seiten = new Seiten(this);
        start();
    }

    String geraetName() {
        String eigen = prefs.getString("geraet", "");
        if (!eigen.isEmpty()) return eigen;
        String m = Build.MODEL == null ? "" : Build.MODEL;
        String h = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        if (!h.isEmpty() && !m.toLowerCase(Locale.ROOT).startsWith(h.toLowerCase(Locale.ROOT))) m = h.substring(0, 1).toUpperCase(Locale.ROOT) + h.substring(1) + " " + m;
        String n = "Android " + Build.VERSION.RELEASE + " " + m;
        return n.length() > 80 ? n.substring(0, 80) : n;
    }

    @Override protected void onResume() { super.onResume(); sichtbar = true; if (api.angemeldet()) { pruefen(); pulsAn(); } }
    @Override protected void onPause() { super.onPause(); sichtbar = false; kameraAus(); pulsAus(); }
    @Override protected void onDestroy() { super.onDestroy(); hinter.shutdownNow(); }

    /* ======================= Hintergrund ======================= */
    void hole(final String aktion, final Map<String, Object> daten, final Fertig fertig) {
        hinter.execute(() -> {
            final Antwort r = api.rufe(aktion, daten);
            ui.post(() -> { if (!r.stop && fertig != null && !isFinishing()) fertig.da(r); });
        });
    }

    /** Wie hole(), verwirft das Ergebnis aber, wenn inzwischen eine andere Seite angezeigt wird */
    void holeFuerSeite(String aktion, Map<String, Object> daten, final Fertig fertig) {
        final int nr = ansichtNr;
        hole(aktion, daten, r -> { if (nr == ansichtNr && !gesperrt) fertig.da(r); });
    }

    interface Arbeit<T> { T tun(); }
    interface Danach<T> { void mit(T t); }
    <T> void hintergrund(final Arbeit<T> a, final Danach<T> d) {
        hinter.execute(() -> { final T t = a.tun(); ui.post(() -> { if (!isFinishing()) d.mit(t); }); });
    }

    /* ======================= Beobachter ======================= */
    public void abgemeldet(final String m) { ui.post(() -> abmeldenLokal(m)); }
    public void gesperrt(final String m) { ui.post(() -> sperren(m)); }
    public void frei(final Antwort a) { ui.post(() -> kopfAktualisieren(a)); }

    /* ======================= Start ======================= */
    void start() {
        if (!api.angemeldet()) { loginZeigen(""); return; }
        ladenZeigen();
        hintergrund(() -> api.rufe("status"), r -> {
            if (r.stop) return;
            if (r.ok() && r.frei()) entsperren(r);
            else sperren(r.msg().isEmpty() ? "Keine Verbindung zum Server." : r.msg());   // ohne Bestätigung vom Server bleibt alles gesperrt
        });
    }

    private void ladenZeigen() {
        LinearLayout l = Ui.senkrecht(this);
        l.setGravity(Gravity.CENTER);
        l.setBackgroundColor(Ui.DUNKEL);
        l.addView(logo(88));
        TextView t = Ui.text(this, "Verbinde mit dem Server …", 15, Ui.KOPFGRAU, false);
        t.setPadding(0, Ui.dp(this, 14), 0, 0);
        l.addView(t);
        setContentView(l);
        statusLeiste(Ui.DUNKEL);
    }

    ImageView logo(int dpGroesse) {
        ImageView v = new ImageView(this);
        v.setImageResource(R.mipmap.ic_launcher);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(Ui.dp(this, dpGroesse), Ui.dp(this, dpGroesse));
        p.gravity = Gravity.CENTER_HORIZONTAL;
        v.setLayoutParams(p);
        return v;
    }

    void statusLeiste(int farbe) {
        getWindow().setStatusBarColor(farbe);
        getWindow().setNavigationBarColor(farbe == Ui.CREME ? Ui.DUNKEL : farbe);
    }

    /* ======================= Anmeldung ======================= */
    private String loginCode = "";

    void loginZeigen(String meldung) {
        stoppeAlles();
        pulsAus();
        statusLeiste(Ui.DUNKEL);
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.setBackgroundColor(Ui.CREME);
        final LinearLayout s = Ui.senkrecht(this);
        int p = Ui.dp(this, 20);
        s.setPadding(p, Ui.dp(this, 36), p, Ui.dp(this, 30));
        s.setGravity(Gravity.CENTER_HORIZONTAL);
        sv.addView(s, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        s.addView(logo(84));
        TextView h = Ui.titel(this, "Fehnverleih Lager");
        h.setGravity(Gravity.CENTER);
        s.addView(h);
        TextView u = Ui.klein(this, "Lager-App für Mitarbeiter");
        u.setGravity(Gravity.CENTER);
        u.setPadding(0, 0, 0, Ui.dp(this, 14));
        s.addView(u);

        LinearLayout tabs = Ui.zeile(this);
        tabs.setGravity(Gravity.CENTER);
        final Button tMa = Ui.knopf(this, "👷 Mitarbeiter", Ui.K_DUNKEL), tAd = Ui.knopf(this, "🔑 Admin", Ui.K_HELL);
        tabs.addView(tMa, Ui.abstand(this, Ui.lp(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT), 0, 0, 8, 12));
        tabs.addView(tAd, Ui.abstand(this, Ui.lp(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT), 0, 0, 0, 12));
        s.addView(tabs);
        final LinearLayout meldungBox = Ui.senkrecht(this);
        s.addView(meldungBox, Ui.breit());
        if (!meldung.isEmpty()) meldungBox.addView(Ui.meldung(this, meldung, "hinweis"));

        // Mitarbeiter
        final LinearLayout fMa = Ui.karte(this);
        fMa.addView(Ui.klein(this, "Einmal mit deinem Mitarbeiter-Ausweis anmelden. Die App funktioniert nur, solange du eingestempelt bist."));
        fMa.addView(Ui.luecke(this, 10));
        final FrameLayout kamBox = new FrameLayout(this);
        fMa.addView(kamBox, Ui.breit());
        final Button scan = Ui.knopfGross(this, "📷 Ausweis scannen", Ui.K_GOLD);
        fMa.addView(scan);
        final TextView erkannt = Ui.meldung(this, "✓ Ausweis erkannt – jetzt Lager-Passwort eingeben.", "ok");
        erkannt.setVisibility(View.GONE);
        fMa.addView(erkannt);
        fMa.addView(Ui.feld(this, "oder Hand-Scanner / Code eintippen"));
        final EditText code = Ui.eingabe(this, "FVZ-…");
        fMa.addView(code);
        fMa.addView(Ui.feld(this, "Lager-Passwort"));
        final EditText pw = Ui.passwort(this, "Lager-Passwort");
        fMa.addView(pw);
        final Button los = Ui.knopfGross(this, "Anmelden", Ui.K_DUNKEL);
        fMa.addView(los);
        s.addView(fMa);

        // Admin
        final LinearLayout fAd = Ui.karte(this);
        fAd.addView(Ui.feld(this, "Admin-Passwort"));
        final EditText apw = Ui.passwort(this, "Admin-Passwort");
        fAd.addView(apw);
        final Button alos = Ui.knopfGross(this, "Als Admin anmelden", Ui.K_DUNKEL);
        fAd.addView(alos);
        fAd.setVisibility(View.GONE);
        s.addView(fAd);

        Button einst = Ui.knopf(this, "⚙ Einstellungen", Ui.K_HELL);
        einst.setOnClickListener(v -> seiten.einstellungen(() -> loginZeigen("")));
        s.addView(einst, Ui.abstand(this, Ui.lp(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT), 0, 4, 0, 6));
        TextView srv = Ui.klein(this, "Server: " + Api.schnittstelle(api.server));
        srv.setGravity(Gravity.CENTER);
        s.addView(srv);

        loginCode = "";
        scan.setOnClickListener(v -> kameraAn(kamBox, c -> {
            if (!Api.siehtAusWieAusweis(c)) { ton("err"); toast("Das ist kein Mitarbeiter-Ausweis."); return; }
            loginCode = c;
            ton("ok");
            kameraAus();
            erkannt.setVisibility(View.VISIBLE);
            pw.requestFocus();
            tastaturZeigen(pw);
        }));
        code.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence a, int b, int c, int d) { }
            public void onTextChanged(CharSequence a, int b, int c, int d) { }
            public void afterTextChanged(Editable e) { erkannt.setVisibility(Api.siehtAusWieAusweis(e.toString()) ? View.VISIBLE : View.GONE); }
        });
        enter(code, () -> pw.requestFocus());
        final Runnable maLos = () -> {
            final String c = loginCode.isEmpty() ? code.getText().toString().trim() : loginCode;
            if (c.isEmpty()) { meldungSetzen(meldungBox, "Bitte zuerst deinen Ausweis scannen.", "err"); return; }
            los.setEnabled(false);
            final String pwT = pw.getText().toString();
            hintergrund(() -> api.anmeldenMitarbeiter(c, pwT), r -> {
                los.setEnabled(true);
                if (!r.ok()) { meldungSetzen(meldungBox, r.msg().isEmpty() ? "Anmeldung fehlgeschlagen." : r.msg(), "err"); ton("err"); return; }
                kameraAus();
                tastaturWeg();
                start();
            });
        };
        los.setOnClickListener(v -> maLos.run());
        enter(pw, maLos);
        final Runnable adLos = () -> {
            alos.setEnabled(false);
            final String pwT = apw.getText().toString();
            hintergrund(() -> api.anmeldenAdmin(pwT), r -> {
                alos.setEnabled(true);
                if (!r.ok()) { meldungSetzen(meldungBox, r.msg().isEmpty() ? "Anmeldung fehlgeschlagen." : r.msg(), "err"); ton("err"); return; }
                tastaturWeg();
                start();
            });
        };
        alos.setOnClickListener(v -> adLos.run());
        enter(apw, adLos);
        tMa.setOnClickListener(v -> {
            Ui.knopfArt(this, tMa, Ui.K_DUNKEL); Ui.knopfArt(this, tAd, Ui.K_HELL);
            fMa.setVisibility(View.VISIBLE); fAd.setVisibility(View.GONE);
        });
        tAd.setOnClickListener(v -> {
            kameraAus();
            Ui.knopfArt(this, tAd, Ui.K_DUNKEL); Ui.knopfArt(this, tMa, Ui.K_HELL);
            fMa.setVisibility(View.GONE); fAd.setVisibility(View.VISIBLE);
        });
        setContentView(sv);
    }

    void meldungSetzen(LinearLayout box, String text, String art) {
        box.removeAllViews();
        if (text != null && !text.isEmpty()) box.addView(Ui.meldung(this, text, art));
    }

    /** Enter-Taste (Tastatur oder Hand-Scanner) in einem Eingabefeld */
    void enter(final EditText e, final Runnable r) {
        e.setImeOptions(EditorInfo.IME_ACTION_DONE);
        e.setOnEditorActionListener((v, id, ev) -> {
            boolean taste = ev != null && ev.getKeyCode() == KeyEvent.KEYCODE_ENTER;
            if (taste && ev.getAction() != KeyEvent.ACTION_DOWN) return true;
            if (taste || id == EditorInfo.IME_ACTION_DONE || id == EditorInfo.IME_ACTION_GO) { r.run(); return true; }
            return false;
        });
    }

    void tastaturZeigen(View v) {
        InputMethodManager m = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (m != null) m.showSoftInput(v, InputMethodManager.SHOW_IMPLICIT);
    }

    void tastaturWeg() {
        View v = getCurrentFocus();
        InputMethodManager m = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (m != null && v != null) m.hideSoftInputFromWindow(v.getWindowToken(), 0);
    }

    /* ======================= Sperre ======================= */
    void sperren(String text) {
        stoppeAlles();
        gesperrt = true;
        artikelCache = null;                    // alle Lagerdaten vom Gerät entfernen
        verlauf.clear();
        tastaturWeg();
        statusLeiste(Ui.DUNKEL);
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.setBackgroundColor(Ui.DUNKEL);
        LinearLayout s = Ui.senkrecht(this);
        s.setGravity(Gravity.CENTER);
        int p = Ui.dp(this, 22);
        s.setPadding(p, p, p, p);
        sv.addView(s, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        TextView schloss = Ui.text(this, "🔒", 64, Color.WHITE, false);
        schloss.setGravity(Gravity.CENTER);
        s.addView(schloss, Ui.breit());
        TextView h = Ui.text(this, "App gesperrt", 26, Ui.GOLD, true);
        h.setTypeface(android.graphics.Typeface.SERIF, android.graphics.Typeface.BOLD);
        h.setGravity(Gravity.CENTER);
        h.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 10));
        s.addView(h, Ui.breit());
        sperreText = Ui.text(this, (api.name.isEmpty() ? "" : "Hallo " + Api.vorname(api.name) + " – ") + (text == null || text.isEmpty() ? "du bist nicht eingestempelt." : text), 16, 0xFFD8CFB8, false);
        sperreText.setGravity(Gravity.CENTER);
        s.addView(sperreText, Ui.breit());
        TextView h2 = Ui.text(this, "Bitte am Stempel-Terminal in der Lagerhalle mit deinem Ausweis einstempeln. Die App entsperrt sich danach automatisch.", 13.5f, 0xFFA99F86, false);
        h2.setGravity(Gravity.CENTER);
        h2.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 22));
        s.addView(h2, Ui.breit());
        final Button pr = Ui.knopfGross(this, "↻ Jetzt prüfen", Ui.K_GOLD);
        pr.setOnClickListener(v -> {
            pr.setEnabled(false);
            hintergrund(() -> api.rufe("status"), r -> {
                pr.setEnabled(true);
                if (r.stop) { toast("Noch nicht eingestempelt."); return; }
                if (r.ok() && r.frei()) entsperren(r);
                else if (r.netz && sperreText != null) sperreText.setText(r.msg());
            });
        });
        s.addView(pr);
        Button ab = Ui.knopfBreit(this, "Abmelden / anderes Konto", Ui.K_DUNKEL);
        ab.setBackground(Ui.druck(this, Color.TRANSPARENT, 10, 0xFF5A4A26));
        ab.setOnClickListener(v -> abmelden());
        s.addView(ab);
        sperreZeit = Ui.text(this, "Zuletzt geprüft: " + new SimpleDateFormat("HH:mm:ss", Locale.GERMANY).format(new Date()), 12.5f, 0xFF7D735D, false);
        sperreZeit.setGravity(Gravity.CENTER);
        sperreZeit.setPadding(0, Ui.dp(this, 16), 0, 0);
        s.addView(sperreZeit, Ui.breit());
        setContentView(sv);
        pulsAn();
    }

    void entsperren(Antwort r) {
        gesperrt = false;
        appBildschirm();
        kopfAktualisieren(r);
        verlauf.clear();
        zeige(api.admin() ? "uebersicht" : "halle", null, false);
        pulsAn();
    }

    void pulsAn() { if (!pulsLaeuft && sichtbar) { pulsLaeuft = true; ui.postDelayed(puls, gesperrt ? PULS_GESPERRT_MS : PULS_FREI_MS); } }
    void pulsAus() { pulsLaeuft = false; ui.removeCallbacks(puls); }

    void pruefen() {
        if (!api.angemeldet() || pruefungLaeuft) return;
        pruefungLaeuft = true;
        hinter.execute(() -> {
            final Antwort r = api.rufe("status");
            ui.post(() -> {
                pruefungLaeuft = false;
                if (r.stop) return;
                if (r.ok() && r.frei()) { if (gesperrt) entsperren(r); }
                else if (r.netz && !gesperrt) toast(r.msg());
                else if (r.netz && gesperrt && sperreText != null) {
                    sperreText.setText(r.msg());
                    sperreZeit.setText("Zuletzt geprüft: " + new SimpleDateFormat("HH:mm:ss", Locale.GERMANY).format(new Date()));
                }
            });
        });
    }

    void abmeldenLokal(String meldung) {
        stoppeAlles();
        pulsAus();
        api.abmeldenLokal();
        gesperrt = true;
        artikelCache = null;
        verlauf.clear();
        loginZeigen(meldung);
    }

    void abmelden() {
        fragen("Von diesem Gerät abmelden?", () -> hintergrund(() -> { api.abmelden(); return Boolean.TRUE; }, x -> abmeldenLokal("Abgemeldet.")));
    }

    void stoppeAlles() {
        kameraAus();
        for (Runnable r : seitenTimer) ui.removeCallbacks(r);
        seitenTimer.clear();
        ansichtNr++;
        if (blatt != null) { try { blatt.dismiss(); } catch (Exception e) { /* egal */ } blatt = null; }
    }

    /* ======================= App-Rahmen ======================= */
    private void appBildschirm() {
        statusLeiste(Ui.DUNKEL);
        LinearLayout root = Ui.senkrecht(this);
        root.setBackgroundColor(Ui.CREME);

        LinearLayout kopf = Ui.zeile(this);
        kopf.setBackgroundColor(Ui.DUNKEL);
        int p = Ui.dp(this, 14);
        kopf.setPadding(p, Ui.dp(this, 10), p, Ui.dp(this, 10));
        LinearLayout t = Ui.senkrecht(this);
        TextView marke = Ui.text(this, "FEHNVERLEIH", 16, Ui.GOLD, true);
        marke.setTypeface(android.graphics.Typeface.SERIF, android.graphics.Typeface.BOLD);
        marke.setLetterSpacing(0.04f);
        t.addView(marke);
        kopfName = Ui.text(this, "", 12.5f, Ui.KOPFGRAU, false);
        kopfName.setSingleLine(true);
        t.addView(kopfName);
        kopf.addView(t, Ui.gewicht(1));
        kopfChip = Ui.marke(this, "", Ui.GRUEN, Color.WHITE);
        kopf.addView(kopfChip);
        root.addView(kopf, Ui.breit());
        View gold = new View(this);
        gold.setBackgroundColor(Ui.GOLD2);
        root.addView(gold, Ui.lp(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 3)));

        rollen = new ScrollView(this);
        rollen.setFillViewport(true);
        inhalt = Ui.senkrecht(this);
        inhalt.setPadding(p, p, p, Ui.dp(this, 24));
        rollen.addView(inhalt, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(rollen, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        nav = Ui.zeile(this);
        nav.setBackgroundColor(Ui.DUNKEL);
        nav.setPadding(Ui.dp(this, 4), Ui.dp(this, 5), Ui.dp(this, 4), Ui.dp(this, 5));
        root.addView(nav, Ui.breit());
        navAufbauen();
        setContentView(root);
    }

    void kopfAktualisieren(Antwort r) {
        if (r != null && r.hat("gruende")) gruende = r.map("gruende");
        if (kopfName == null) return;
        kopfName.setText(api.name + (api.admin() ? " · Verwaltung" : ""));
        if (api.admin()) { kopfChip.setText("🔑 Admin"); kopfChip.setBackground(Ui.rund(this, Ui.GOLD2, 99, 0)); kopfChip.setTextColor(Ui.DUNKEL); }
        else {
            kopfChip.setText("● eingestempelt" + (r != null && !r.str("seit").isEmpty() ? " seit " + r.str("seit") : ""));
            kopfChip.setBackground(Ui.rund(this, Ui.GRUEN, 99, 0));
            kopfChip.setTextColor(Color.WHITE);
        }
    }

    private final List<Button> navKnoepfe = new ArrayList<>();

    void navAufbauen() {
        nav.removeAllViews();
        navKnoepfe.clear();
        String[][] l = api.admin()
                ? new String[][]{{"uebersicht", "📊", "Übersicht"}, {"halle", "🏠", "Lager"}, {"scan", "📷", "Scannen"}, {"inventur", "📋", "Inventur"}, {"mehr", "☰", "Mehr"}}
                : new String[][]{{"halle", "🏠", "Lagerhalle"}, {"scan", "📷", "Scannen"}, {"inventur", "📋", "Inventur"}, {"ich", "👤", "Ich"}};
        for (final String[] z : l) {
            Button b = new Button(this);
            b.setText(z[1] + "\n" + z[2]);
            b.setAllCaps(false);
            b.setTextSize(11.5f);
            b.setTextColor(Ui.KOPFGRAU);
            b.setBackground(Ui.druck(this, Ui.DUNKEL, 10, 0));
            b.setStateListAnimator(null);
            b.setPadding(0, Ui.dp(this, 4), 0, Ui.dp(this, 4));
            b.setMinHeight(0);
            b.setMinimumHeight(0);
            b.setTag(z[0]);
            b.setOnClickListener(v -> zeige(z[0], "scan".equals(z[0]) ? Api.daten("modus", "info") : null, true));
            nav.addView(b, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            navKnoepfe.add(b);
        }
    }

    /** Zeigt eine Seite. merken = für die Zurück-Taste speichern */
    void zeige(String v, Map<String, Object> p, boolean merken) {
        if (gesperrt || inhalt == null) return;
        if (merken && !aktuell.isEmpty()) {
            verlauf.add(new Object[]{aktuell, aktuellParam});
            if (verlauf.size() > 30) verlauf.remove(0);
        }
        stoppeAlles();
        tastaturWeg();
        aktuell = v;
        aktuellParam = p == null ? Api.daten() : p;
        String navV = "auftrag".equals(v) ? "halle" : "terminal".equals(v) || "geraete".equals(v) ? "mehr" : v;
        for (Button b : navKnoepfe) {
            boolean akt = navV.equals(b.getTag());
            b.setTextColor(akt ? Ui.GOLD : Ui.KOPFGRAU);
            b.setBackground(Ui.druck(this, akt ? Ui.DUNKEL3 : Ui.DUNKEL, 10, 0));
        }
        inhalt.removeAllViews();
        rollen.scrollTo(0, 0);
        seiten.bauen(inhalt, v, aktuellParam);
    }

    void neuLaden() { zeige(aktuell, aktuellParam, false); }

    @Override
    public void onBackPressed() {
        if (kamera != null) { kameraAus(); return; }
        if (!gesperrt && inhalt != null && !verlauf.isEmpty()) {
            Object[] z = verlauf.remove(verlauf.size() - 1);
            @SuppressWarnings("unchecked") Map<String, Object> p = (Map<String, Object>) z[1];
            zeige((String) z[0], p, false);
            return;
        }
        super.onBackPressed();
    }

    /* ======================= Kamera-Scanner (QR) ======================= */
    DecoratedBarcodeView kamera;
    private FrameLayout kameraBox;
    private Gescannt kameraZiel;
    private Runnable kameraNachErlaubnis;
    private String letzterCode = "";
    private long letzterZeit;

    /** Startet die Kamera in der Box. Gibt den Code an „ziel“, denselben Code höchstens alle 2 Sekunden. */
    void kameraAn(final FrameLayout box, final Gescannt ziel) {
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            kameraNachErlaubnis = () -> kameraAn(box, ziel);
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 7);
            return;
        }
        kameraAus();
        kameraBox = box;
        kameraZiel = ziel;
        letzterCode = "";
        kamera = new DecoratedBarcodeView(this);
        kamera.getBarcodeView().setDecoderFactory(new DefaultDecoderFactory(Collections.singletonList(BarcodeFormat.QR_CODE)));
        kamera.setStatusText("");
        kamera.decodeContinuous(new BarcodeCallback() {
            public void barcodeResult(BarcodeResult r) {
                String c = r.getText();
                if (c == null || kameraZiel == null) return;
                long t = System.currentTimeMillis();
                boolean doppelt = c.equals(letzterCode) && t - letzterZeit < 2000;
                letzterCode = c;
                letzterZeit = t;
                if (!doppelt) kameraZiel.code(c);
            }
            public void possibleResultPoints(List<ResultPoint> l) { }
        });
        box.removeAllViews();
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 280));
        box.addView(kamera, lp);
        Button zu = Ui.knopf(this, "✕ Kamera aus", Ui.K_DUNKEL);
        zu.setTextSize(13);
        zu.setMinHeight(0); zu.setMinimumHeight(0);
        zu.setPadding(Ui.dp(this, 12), Ui.dp(this, 6), Ui.dp(this, 12), Ui.dp(this, 6));
        zu.setOnClickListener(v -> kameraAus());
        FrameLayout.LayoutParams zp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.END);
        zp.setMargins(0, Ui.dp(this, 8), Ui.dp(this, 8), 0);
        box.addView(zu, zp);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bp.setMargins(0, 0, 0, Ui.dp(this, 10));
        box.setLayoutParams(bp);
        box.setVisibility(View.VISIBLE);
        kamera.resume();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // Bildschirm an lassen
        if (kameraStatus != null) kameraStatus.mit(true);
    }

    /** Wird aufgerufen, wenn die Kamera an- oder ausgeht (zum Ein-/Ausblenden des Start-Knopfs) */
    Danach<Boolean> kameraStatus;

    void kameraAus() {
        if (kamera != null) {
            try { kamera.pause(); } catch (Exception e) { /* egal */ }
            if (kameraBox != null) { kameraBox.removeAllViews(); kameraBox.setVisibility(View.GONE); }
            kamera = null;
            if (kameraStatus != null) kameraStatus.mit(false);
        }
        kameraZiel = null;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] erg) {
        super.onRequestPermissionsResult(code, perms, erg);
        if (code != 7) return;
        if (erg.length > 0 && erg[0] == PackageManager.PERMISSION_GRANTED && kameraNachErlaubnis != null) kameraNachErlaubnis.run();
        else toast("Kamera-Zugriff wurde nicht erlaubt – in den Android-Einstellungen bei „FV Lager“ freigeben.");
        kameraNachErlaubnis = null;
    }

    /* ======================= Rückmeldung ======================= */
    void toast(String t) { Toast.makeText(this, t, Toast.LENGTH_SHORT).show(); }

    void fragen(String frage, final Runnable ja) {
        new AlertDialog.Builder(this).setMessage(frage)
                .setPositiveButton("Ja", (d, w) -> ja.run())
                .setNegativeButton("Abbrechen", null).show();
    }

    /** Ton + Vibration. art: ok | warn | err | kommen | gehen */
    void ton(final String art) {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate("err".equals(art) ? VibrationEffect.createWaveform(new long[]{0, 80, 60, 80}, -1) : VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE));
                } else v.vibrate("err".equals(art) ? 200 : 40);
            }
        } catch (Exception e) { /* ohne Vibration */ }
        if (!"aus".equals(prefs.getString("ton", ""))) hinter.execute(() -> tonSpielen(art));
    }

    private static void tonSpielen(String art) {
        int[] hz = "ok".equals(art) ? new int[]{1320} : "kommen".equals(art) ? new int[]{880, 1320} : "gehen".equals(art) ? new int[]{1320, 880}
                : "warn".equals(art) ? new int[]{660} : new int[]{220};
        int ms = "err".equals(art) ? 350 : 120;
        int rate = 44100;
        int n = rate * ms / 1000, pause = rate / 50;
        short[] puffer = new short[(n + pause) * hz.length];
        for (int i = 0; i < hz.length; i++) {
            for (int k = 0; k < n; k++) {
                double huelle = Math.min(1.0, Math.min(k, n - k) / (rate * 0.006));
                puffer[i * (n + pause) + k] = (short) (Math.sin(2 * Math.PI * hz[i] * k / rate) * 0.28 * huelle * Short.MAX_VALUE);
            }
        }
        AudioTrack t = null;
        try {
            t = new AudioTrack(AudioManager.STREAM_MUSIC, rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT, puffer.length * 2, AudioTrack.MODE_STATIC);
            t.write(puffer, 0, puffer.length);
            t.play();
            Thread.sleep((long) puffer.length * 1000 / rate + 60);
        } catch (Exception e) { /* ohne Ton */ }
        finally { if (t != null) try { t.release(); } catch (Exception e) { /* egal */ } }
    }
}
