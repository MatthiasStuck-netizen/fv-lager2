package de.fehnverleih.lager.pc;

import java.util.Locale;

import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;

import de.fehnverleih.lager.kern.Api;

/** Programmstart des PC-Programms „FV Lager“. */
public final class Start {
    private Start() { }

    public static void main(String[] args) {
        Locale.setDefault(Locale.GERMANY);
        System.setProperty("awt.useSystemAAFontSettings", "on");
        System.setProperty("swing.aatext", "true");
        System.setProperty("sun.java2d.uiScale.enabled", "true");
        final DateiSpeicher speicher = new DateiSpeicher();
        final Api api = new Api(speicher);
        for (String a : args) if (a.startsWith("--server=")) api.serverSetzen(a.substring(9));
        api.geraet = geraetName(speicher);
        Ton.an = !"aus".equals(speicher.lesen("ton"));
        SwingUtilities.invokeLater(() -> {
            try {
                String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
                if (os.contains("win") || os.contains("mac")) UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception e) { /* Standard-Aussehen */ }
            UIManager.put("OptionPane.yesButtonText", "Ja");
            UIManager.put("OptionPane.noButtonText", "Nein");
            UIManager.put("OptionPane.cancelButtonText", "Abbrechen");
            UIManager.put("OptionPane.okButtonText", "OK");
            UIManager.put("OptionPane.messageFont", Ui.schrift(15));
            UIManager.put("OptionPane.buttonFont", Ui.schrift(14));
            UIManager.put("ComboBox.font", Ui.schrift(15));
            UIManager.put("CheckBox.font", Ui.schrift(15));
            try {
                Fenster f = new Fenster(api, speicher);
                f.setVisible(true);
                f.start();
            } catch (Throwable t) {
                JOptionPane.showMessageDialog(null, "Das Programm konnte nicht starten:\n" + t, "FV Lager", JOptionPane.ERROR_MESSAGE);
                t.printStackTrace();
            }
        });
    }

    /** Name dieses Geräts für die Geräte-Liste in der Verwaltung */
    static String geraetName(DateiSpeicher sp) {
        String eigen = sp.lesen("geraet");
        if (!eigen.isEmpty()) return eigen;
        String rechner = System.getenv("COMPUTERNAME");
        if (rechner == null || rechner.isEmpty()) rechner = System.getenv("HOSTNAME");
        if (rechner == null || rechner.isEmpty()) {
            try { rechner = java.net.InetAddress.getLocalHost().getHostName(); } catch (Exception e) { rechner = ""; }
        }
        String n = "PC-Programm (" + System.getProperty("os.name", "PC") + (rechner.isEmpty() ? "" : ", " + rechner) + ")";
        return n.length() > 80 ? n.substring(0, 80) : n;
    }
}
