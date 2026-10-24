/* Fehnverleih Stempeluhr – Copyright © fehnverleih.de */
package de.fehnverleih.stempeluhr;

import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

/** Erlaubt der Stempeluhr-Seite die Kamera (Ausweis scannen). */
public class Chrome extends WebChromeClient {
    @Override
    public void onPermissionRequest(PermissionRequest r) {
        r.grant(r.getResources());
    }
}
