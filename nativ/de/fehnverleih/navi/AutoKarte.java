package de.fehnverleih.navi;

import android.annotation.SuppressLint;
import android.app.Presentation;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Rect;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.os.Handler;
import android.os.Looper;
import android.view.Surface;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.car.app.CarContext;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;
import androidx.webkit.WebViewAssetLoader;

/** Zeichnet die Karte auf den Bildschirm im Auto: eine eigene, unsichtbare Anzeige mit der Seite auto.html. */
final class AutoKarte implements SurfaceCallback {
    private static final String SEITE = "https://appassets.androidplatform.net/assets/www/auto.html";
    private final CarContext ctx;
    private final Handler haupt = new Handler(Looper.getMainLooper());
    private VirtualDisplay anzeige;
    private Presentation praesentation;
    private WebView web;
    private float dichte = 1f;
    private int breite, hoehe;
    private Rect sicht;
    private boolean geladen;

    /** Neuer Stand vom Handy → Karte nachführen (hält die Navi-Seite aktuell) */
    private final SharedPreferences.OnSharedPreferenceChangeListener hoerer = new SharedPreferences.OnSharedPreferenceChangeListener() {
        @Override
        public void onSharedPreferenceChanged(SharedPreferences p, String k) {
            if ("autoStand".equals(k) || "autoRoute".equals(k)) js("window.FVA&&FVA.neu()");
        }
    };

    AutoKarte(CarContext c) {
        ctx = c;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onSurfaceAvailable(SurfaceContainer c) {
        Surface flaeche = c.getSurface();
        if (flaeche == null || c.getWidth() <= 0 || c.getHeight() <= 0) return;
        ende();
        breite = c.getWidth();
        hoehe = c.getHeight();
        dichte = Math.max(0.5f, c.getDpi() / 160f);
        try {
            DisplayManager dm = (DisplayManager) ctx.getSystemService(Context.DISPLAY_SERVICE);
            anzeige = dm.createVirtualDisplay("FehnverleihAuto", breite, hoehe, c.getDpi(), flaeche, DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY);
            praesentation = new Presentation(ctx, anzeige.getDisplay());
            web = new WebView(praesentation.getContext());
            web.setBackgroundColor(Color.rgb(16, 20, 26));
            WebSettings s = web.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setAllowFileAccess(false);
            s.setMediaPlaybackRequiresUserGesture(true);
            final WebViewAssetLoader lader = new WebViewAssetLoader.Builder()
                    .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(ctx)).build();
            web.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                    return lader.shouldInterceptRequest(r.getUrl());
                }

                @Override
                public void onPageFinished(WebView v, String url) {
                    geladen = true;
                    bereichSenden();
                    js("window.FVA&&FVA.neu()");
                }
            });
            web.addJavascriptInterface(new Bruecke(ctx), "FVNative");
            praesentation.setContentView(web);
            praesentation.show();
            web.loadUrl(SEITE);
            AutoDaten.prefs(ctx).registerOnSharedPreferenceChangeListener(hoerer);
        } catch (Throwable t) {
            ende();
        }
    }

    @Override
    public void onVisibleAreaChanged(Rect r) {
        sicht = r;
        bereichSenden();
    }

    @Override
    public void onStableAreaChanged(Rect r) {
        if (sicht == null) {
            sicht = r;
            bereichSenden();
        }
    }

    @Override
    public void onSurfaceDestroyed(SurfaceContainer c) {
        ende();
    }

    /** Zoomknöpfe im Auto */
    void zoom(int d) {
        js("window.FVA&&FVA.zoom(" + d + ")");
    }

    private void bereichSenden() {
        if (!geladen || sicht == null || breite <= 0) return;
        int l = Math.round(sicht.left / dichte), t = Math.round(sicht.top / dichte);
        int r = Math.round((breite - sicht.right) / dichte), b = Math.round((hoehe - sicht.bottom) / dichte);
        js("window.FVA&&FVA.bereich(" + l + "," + t + "," + r + "," + b + ")");
    }

    private void js(final String code) {
        haupt.post(new Runnable() {
            @Override
            public void run() {
                if (web != null && geladen) {
                    try {
                        web.evaluateJavascript(code, null);
                    } catch (Throwable t) {
                        // nichts
                    }
                }
            }
        });
    }

    void ende() {
        geladen = false;
        try {
            AutoDaten.prefs(ctx).unregisterOnSharedPreferenceChangeListener(hoerer);
        } catch (Throwable t) {
            // nichts
        }
        try {
            if (praesentation != null) praesentation.dismiss();
        } catch (Throwable t) {
            // nichts
        }
        try {
            if (web != null) web.destroy();
        } catch (Throwable t) {
            // nichts
        }
        try {
            if (anzeige != null) anzeige.release();
        } catch (Throwable t) {
            // nichts
        }
        praesentation = null;
        web = null;
        anzeige = null;
    }

    /** Die Kartenseite im Auto darf nur lesen (Stand, Route, Kartenstil, Einstellungen) */
    static final class Bruecke {
        private final Context c;

        Bruecke(Context c) {
            this.c = c;
        }

        @JavascriptInterface
        public String lesen(String schluessel) {
            try {
                return AutoDaten.prefs(c).getString(schluessel, "");
            } catch (Throwable t) {
                return "";
            }
        }

        @JavascriptInterface
        public void schreiben(String schluessel, String wert) {
            // im Auto wird nichts gespeichert
        }

        @JavascriptInterface
        public String info() {
            return "{\"version\":\"auto\"}";
        }

        @JavascriptInterface
        public String anmeldung() {
            return "{}";
        }
    }
}
