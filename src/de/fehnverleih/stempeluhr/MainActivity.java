/*
 * Fehnverleih Stempeluhr – Android-App
 * Copyright © fehnverleih.de – alle Rechte vorbehalten.
 *
 * Eigenes Browser-Fenster (WebView), das die Stempeluhr von www.fehnverleih.de anzeigt:
 * Ein- und Ausstempeln per Knopf für Mitarbeiter und Gäste, auf Deutsch oder Englisch.
 * Beim Öffnen zeigt die App kurz ihre Versionsnummer.
 */
package de.fehnverleih.stempeluhr;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    /** Versionsnummer dieser App – bei jeder neuen Version erhöhen (auch versionName im Manifest) */
    static final String VERSION = "1.1";
    private WebView w;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        requestWindowFeature(1);                                   // ohne Titelleiste

        // eigenes Browser-Fenster
        w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                              // merkt sich die Anmeldung
        s.setMediaPlaybackRequiresUserGesture(false);              // Kamerabild beim Ausweis-Scan
        w.setWebViewClient(new WebViewClient());                   // Links bleiben in der App
        w.setWebChromeClient(new Chrome());                        // Kamera und Rückfragen

        w.setBackgroundColor(0xff151109);                          // dunkel, bis die Seite geladen ist
        setContentView(w);

        // sofort beim Öffnen: welche Version läuft hier?
        Toast.makeText(this, "Fehnverleih Stempeluhr – Version " + VERSION, Toast.LENGTH_LONG).show();

        requestPermissions(new String[] { "android.permission.CAMERA" }, 1);   // für den Ausweis-Scan
        w.loadUrl("https://www.fehnverleih.de/stempel-app/");
    }

    @Override
    public void onBackPressed() {
        if (w.canGoBack()) w.goBack(); else super.onBackPressed();
    }
}
