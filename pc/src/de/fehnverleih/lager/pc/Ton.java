package de.fehnverleih.lager.pc;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.SourceDataLine;

/** Rückmelde-Töne beim Scannen – gleiche Tonfolgen wie in der bisherigen App. */
public final class Ton {
    private Ton() { }

    public static volatile boolean an = true;
    private static final ExecutorService SPIELER = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "Ton");
        t.setDaemon(true);
        return t;
    });

    /** art: ok | warn | err | kommen | gehen */
    public static void spielen(final String art) {
        if (!an) return;
        final int[] hz;
        if ("ok".equals(art)) hz = new int[]{1320};
        else if ("kommen".equals(art)) hz = new int[]{880, 1320};
        else if ("gehen".equals(art)) hz = new int[]{1320, 880};
        else if ("warn".equals(art)) hz = new int[]{660};
        else hz = new int[]{220};
        final int ms = "err".equals(art) ? 350 : 120;
        SPIELER.execute(() -> {
            try {
                float rate = 44100f;
                AudioFormat f = new AudioFormat(rate, 16, 1, true, false);
                SourceDataLine l = AudioSystem.getSourceDataLine(f);
                l.open(f, 8820);
                l.start();
                for (int i = 0; i < hz.length; i++) {
                    int n = (int) (rate * ms / 1000);
                    int pause = (int) (rate * 0.02);
                    byte[] b = new byte[(n + pause) * 2];
                    for (int k = 0; k < n; k++) {
                        double huelle = Math.min(1.0, Math.min(k, n - k) / (rate * 0.006));   // weich ein/aus
                        short s = (short) (Math.sin(2 * Math.PI * hz[i] * k / rate) * 0.28 * huelle * Short.MAX_VALUE);
                        b[2 * k] = (byte) s;
                        b[2 * k + 1] = (byte) (s >> 8);
                    }
                    l.write(b, 0, b.length);
                }
                l.drain();
                l.close();
            } catch (Throwable t) {
                try { java.awt.Toolkit.getDefaultToolkit().beep(); } catch (Throwable ignoriert) { /* kein Ton möglich */ }
            }
        });
    }
}
