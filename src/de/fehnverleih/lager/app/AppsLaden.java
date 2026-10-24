package de.fehnverleih.lager.app;

import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import de.fehnverleih.lager.kern.Antwort;
import de.fehnverleih.lager.kern.Api;
import java.util.List;

/** Knopf „Apps herunterladen“ auf der Hallen-Seite: zeigt die APK-Dateien aus dem Ordner „Apps“ auf dem Server
 *  und lädt die angetippte über einen Link, den nur die Lager-App bekommt (30 Minuten gültig). */
final class AppsLaden {
    private AppsLaden() {}

    static void knopf(final Haupt h, LinearLayout ziel) {
        Button b = Ui.knopfBreit(h, "📲  Apps herunterladen", Ui.K_DUNKEL);
        b.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                liste(h);
            }
        });
        ziel.addView(b);
    }

    private static String groesse(int b) {
        if (b <= 0) return "";
        if (b < 1024 * 1024) return Math.max(1, b / 1024) + " KB";
        return String.format(java.util.Locale.GERMANY, "%.1f MB", b / 1048576.0);
    }

    static void liste(final Haupt h) {
        h.toast("Apps werden geladen …");
        h.hole("apps_liste", null, new Haupt.Fertig() {
            @Override
            public void da(Antwort a) {
                if (!a.ok()) {
                    h.toast(a.msg().length() > 0 ? a.msg() : "Die Liste konnte gerade nicht geladen werden.");
                    return;
                }
                final List<Antwort> l = a.liste("apps");
                if (l.isEmpty()) {
                    new AlertDialog.Builder(h).setTitle("Apps herunterladen")
                            .setMessage(a.bool("ordner") ? "Im Ordner „Apps“ auf dem Server liegt noch keine APK-Datei." : "Auf dem Server gibt es den Ordner „Apps“ nicht.")
                            .setPositiveButton("OK", null).show();
                    return;
                }
                String[] zeilen = new String[l.size()];
                for (int i = 0; i < l.size(); i++) {
                    Antwort x = l.get(i);
                    String mehr = groesse(x.zahl("groesse"));
                    String stand = x.str("stand");
                    if (stand.length() > 0) mehr = mehr.length() > 0 ? mehr + " · " + stand : stand;
                    zeilen[i] = x.str("datei") + (mehr.length() > 0 ? "\n" + mehr : "");
                }
                new AlertDialog.Builder(h).setTitle("Apps herunterladen")
                        .setItems(zeilen, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface d, int i) {
                                laden(h, l.get(i).str("datei"));
                            }
                        })
                        .setNegativeButton("Schließen", null).show();
            }
        });
    }

    static void laden(final Haupt h, final String datei) {
        h.hole("apps_link", Api.daten("datei", datei), new Haupt.Fertig() {
            @Override
            public void da(Antwort a) {
                String url = a.ok() ? a.str("url") : "";
                if (url.length() == 0) {
                    h.toast(a.msg().length() > 0 ? a.msg() : "Der Download konnte nicht gestartet werden.");
                    return;
                }
                try {
                    h.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    h.toast(datei + " wird heruntergeladen. Danach die Datei antippen und installieren.");
                } catch (Exception e) {
                    h.toast("Kein Browser zum Herunterladen gefunden.");
                }
            }
        });
    }
}
