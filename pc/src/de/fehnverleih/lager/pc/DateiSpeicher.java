package de.fehnverleih.lager.pc;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

import de.fehnverleih.lager.kern.Api;

/**
 * Speichert Anmeldung und Einstellungen in einer kleinen Datei im Benutzerordner
 * (Windows: %APPDATA%\FV-Lager\einstellungen.txt). Lagerdaten werden NICHT gespeichert –
 * die liegen nur auf dem Server.
 */
public final class DateiSpeicher implements Api.Speicher {
    private final File datei;
    private final Properties p = new Properties();

    public DateiSpeicher() {
        String basis = System.getenv("APPDATA");
        File ordner = basis != null && !basis.isEmpty() ? new File(basis, "FV-Lager") : new File(System.getProperty("user.home"), ".fv-lager");
        String test = System.getProperty("fvlager.ordner");
        if (test != null) ordner = new File(test);
        ordner.mkdirs();
        datei = new File(ordner, "einstellungen.txt");
        if (datei.isFile()) {
            try (InputStreamReader r = new InputStreamReader(new FileInputStream(datei), StandardCharsets.UTF_8)) { p.load(r); }
            catch (Exception e) { /* leer anfangen */ }
        }
    }

    public synchronized String lesen(String k) { return p.getProperty(k, ""); }

    public synchronized void schreiben(String k, String v) {
        if (v == null || v.isEmpty()) p.remove(k); else p.setProperty(k, v);
        try (OutputStreamWriter w = new OutputStreamWriter(new FileOutputStream(datei), StandardCharsets.UTF_8)) {
            p.store(w, "FV Lager – Einstellungen (nicht von Hand bearbeiten)");
        } catch (Exception e) { /* nicht schlimm */ }
        if (!System.getProperty("os.name", "").toLowerCase().contains("win")) {
            datei.setReadable(false, false); datei.setReadable(true, true);
            datei.setWritable(false, false); datei.setWritable(true, true);
        }
    }
}
