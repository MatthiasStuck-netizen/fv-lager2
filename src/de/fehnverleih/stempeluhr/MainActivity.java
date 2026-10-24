/*
 * Fehnverleih Stempeluhr – Android-App
 * Copyright © fehnverleih.de – alle Rechte vorbehalten.
 *
 * Eigenes Browser-Fenster (WebView), das die Stempeluhr von www.fehnverleih.de anzeigt:
 * Ein- und Ausstempeln per Knopf für Mitarbeiter und Gäste, auf Deutsch oder Englisch.
 * Die Versionsnummer der App steht auf der Seite unter „© fehnverleih.de“.
 */
package de.fehnverleih.stempeluhr;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    /** Versionsnummer dieser App – bei jeder neuen Version erhöhen (auch versionName im Manifest) */
    static final String VERSION = "1.1";
    private WebView w;

    /** Schreibt „Version 1.1“ in einer eigenen Zeile direkt unter „© fehnverleih.de“ (gleiche Schrift, mittig).
     *  Bleibt auch stehen, wenn die Seite ihren Inhalt neu aufbaut. */
    static final String VERSION_JS =
        "(function(){var T='Version " + VERSION + "';" +
        "function setzen(){if(document.getElementById('fv-version'))return;" +
        "var l=document.body?document.body.getElementsByTagName('*'):[],z=null;" +
        "for(var i=0;i<l.length;i++){var e=l[i];if(e.children.length===0&&/\u00a9\s*fehnverleih\.de/i.test(e.textContent||'')){z=e;}}" +
        "if(!z)return;var d=document.createElement('div');d.id='fv-version';d.textContent=T;" +
        "var c=getComputedStyle(z);d.style.cssText='text-align:center;margin-top:4px;font-size:'+c.fontSize+';color:'+c.color+';font-family:'+c.fontFamily;" +
        "z.parentNode.insertBefore(d,z.nextSibling);}" +
        "setzen();if(!window.__fvv){window.__fvv=1;new MutationObserver(setzen).observe(document.body,{childList:true,subtree:true});}})();";

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
        w.setWebViewClient(new WebViewClient() {                   // Links bleiben in der App
            @Override
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript(VERSION_JS, null);            // Versionsnummer unter „© fehnverleih.de“
            }
        });
        w.setWebChromeClient(new Chrome());                        // Kamera und Rückfragen

        w.setBackgroundColor(0xff151109);                          // dunkel, bis die Seite geladen ist
        setContentView(w);

        requestPermissions(new String[] { "android.permission.CAMERA" }, 1);   // für den Ausweis-Scan
        w.loadUrl("https://www.fehnverleih.de/stempel-app/");
    }

    @Override
    public void onBackPressed() {
        if (w.canGoBack()) w.goBack(); else super.onBackPressed();
    }
}
