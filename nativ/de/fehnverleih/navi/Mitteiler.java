package de.fehnverleih.navi;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

/**
 * Liest eingehende Nachrichten von WhatsApp und anderen Messengern aus den Benachrichtigungen des Handys,
 * damit das Navi sie einblenden (und auf Wunsch vorlesen) kann. Nichts davon verlässt das Handy.
 * Der Fahrer muss dafür einmal „Benachrichtigungen lesen“ für das Navi erlauben (Android-Einstellungen).
 */
public class Mitteiler extends NotificationListenerService {
    static final Map<String, String> APPS = new HashMap<>();
    static {
        APPS.put("com.whatsapp", "WhatsApp");
        APPS.put("com.whatsapp.w4b", "WhatsApp Business");
        APPS.put("org.telegram.messenger", "Telegram");
        APPS.put("org.thoughtcrime.securesms", "Signal");
        APPS.put("com.google.android.apps.messaging", "SMS");
        APPS.put("com.samsung.android.messaging", "SMS");
        APPS.put("com.facebook.orca", "Messenger");
        APPS.put("de.fehnverleih.lager", "Fehnverleih");
        APPS.put("com.android.shell", "Test");   // nur für den Gerätetest (adb), kommt auf echten Handys nicht vor
    }

    static final class Eintrag {
        long id, zeit; String app, titel, wer, text, schluessel;
        PendingIntent oeffnen; Notification.Action antwort;
    }

    private static final ArrayDeque<Eintrag> LISTE = new ArrayDeque<>();
    private static final Set<String> GESEHEN = new HashSet<>();
    private static final ArrayDeque<String> GESEHEN_REIHE = new ArrayDeque<>();
    private static long naechste = 1;
    private static volatile boolean verbunden = false;

    @Override public void onListenerConnected() { verbunden = true; }
    @Override public void onListenerDisconnected() { verbunden = false; }

    static boolean verbunden() { return verbunden; }

    static boolean erlaubt(Context c) {
        try {
            String s = Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
            if (s == null) return false;
            String voll = new ComponentName(c, Mitteiler.class).flattenToString();
            for (String x : s.split(":")) if (voll.equals(x) || x.startsWith(c.getPackageName() + "/")) return true;
            return false;
        } catch (Throwable t) { return false; }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String paket = sbn.getPackageName();
            if (!APPS.containsKey(paket)) return;
            Notification n = sbn.getNotification();
            if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle x = n.extras;
            if (x == null) return;
            String titel = txt(x.getCharSequence(Notification.EXTRA_TITLE));
            String gespraech = txt(x.getCharSequence("android.conversationTitle"));
            Notification.Action antwort = antwortAktion(n);
            Parcelable[] msgs = x.getParcelableArray("android.messages");
            boolean neu = false;
            if (msgs != null && msgs.length > 0) {
                for (Parcelable p : msgs) {
                    if (!(p instanceof Bundle)) continue;
                    Bundle m = (Bundle) p;
                    String text = txt(m.getCharSequence("text"));
                    long zeit = m.getLong("time", sbn.getPostTime());
                    String wer = txt(m.getCharSequence("sender"));
                    if (wer.length() == 0 && Build.VERSION.SDK_INT >= 28) {
                        try { Object person = m.getParcelable("sender_person"); if (person instanceof android.app.Person) wer = txt(((android.app.Person) person).getName()); } catch (Throwable ignored) {}
                    }
                    if (wer.length() == 0) wer = titel;
                    if (text.length() == 0) continue;
                    neu |= merken(paket, gespraech.length() > 0 ? gespraech : titel, wer, text, zeit, sbn.getKey(), n.contentIntent, antwort);
                }
            } else {
                String text = txt(x.getCharSequence(Notification.EXTRA_BIG_TEXT));
                if (text.length() == 0) text = txt(x.getCharSequence(Notification.EXTRA_TEXT));
                if (text.length() == 0) return;
                neu = merken(paket, titel, titel, text, sbn.getPostTime(), sbn.getKey(), n.contentIntent, antwort);
            }
            if (neu) zuNavi();
        } catch (Throwable ignored) {}
    }

    /** Navi nach vorn holen? Nein – die Oberfläche fragt alle paar Sekunden selbst nach (liste). */
    private void zuNavi() {}

    private static String txt(CharSequence c) { return c == null ? "" : c.toString().trim(); }

    private static Notification.Action antwortAktion(Notification n) {
        if (n.actions == null) return null;
        for (Notification.Action a : n.actions) {
            RemoteInput[] r = a.getRemoteInputs();
            if (r != null && r.length > 0) return a;
        }
        return null;
    }

    private static synchronized boolean merken(String paket, String titel, String wer, String text, long zeit, String schluessel, PendingIntent oeffnen, Notification.Action antwort) {
        // Altes nicht noch einmal: WhatsApp schickt bei jeder neuen Nachricht den ganzen Verlauf mit
        if (System.currentTimeMillis() - zeit > 6 * 3600 * 1000L) return false;
        String k = paket + "|" + titel + "|" + wer + "|" + zeit + "|" + text.hashCode();
        if (!GESEHEN.add(k)) {
            // Aktionen trotzdem auffrischen (die alten werden ungültig)
            for (Eintrag e : LISTE) if (e.schluessel != null && e.schluessel.equals(schluessel)) { e.oeffnen = oeffnen; if (antwort != null) e.antwort = antwort; }
            return false;
        }
        GESEHEN_REIHE.add(k);
        while (GESEHEN_REIHE.size() > 600) GESEHEN.remove(GESEHEN_REIHE.poll());
        Eintrag e = new Eintrag();
        e.id = naechste++; e.zeit = zeit; e.app = paket; e.titel = titel; e.wer = wer; e.text = text.length() > 2000 ? text.substring(0, 2000) : text;
        e.schluessel = schluessel; e.oeffnen = oeffnen; e.antwort = antwort;
        LISTE.add(e);
        while (LISTE.size() > 80) LISTE.poll();
        for (Eintrag f : LISTE) if (f.schluessel != null && f.schluessel.equals(schluessel)) { f.oeffnen = oeffnen; if (antwort != null) f.antwort = antwort; }
        return true;
    }

    static synchronized String liste(long seit) {
        try {
            JSONArray l = new JSONArray();
            for (Eintrag e : LISTE) {
                if (e.id <= seit) continue;
                l.put(new JSONObject().put("id", e.id).put("zeit", e.zeit).put("app", e.app).put("appName", APPS.get(e.app))
                    .put("titel", e.titel).put("wer", e.wer).put("text", e.text).put("antworten", e.antwort != null).put("oeffnen", e.oeffnen != null));
            }
            return new JSONObject().put("ok", true).put("verbunden", verbunden).put("bis", naechste - 1).put("liste", l).toString();
        } catch (Exception ex) { return "{\"ok\":false}"; }
    }

    private static synchronized Eintrag finde(long id) {
        for (Eintrag e : LISTE) if (e.id == id) return e;
        return null;
    }

    static boolean oeffnen(Context c, long id) {
        Eintrag e = finde(id);
        try {
            if (e != null && e.oeffnen != null) { e.oeffnen.send(); return true; }
        } catch (Throwable ignored) {}
        if (e == null) return false;
        try {
            Intent i = c.getPackageManager().getLaunchIntentForPackage(e.app);
            if (i == null) return false;
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            return true;
        } catch (Throwable t) { return false; }
    }

    static boolean antworten(Context c, long id, String text) {
        Eintrag e = finde(id);
        if (e == null || e.antwort == null || text == null || text.trim().length() == 0) return false;
        try {
            RemoteInput[] r = e.antwort.getRemoteInputs();
            Intent i = new Intent();
            Bundle b = new Bundle();
            for (RemoteInput ri : r) b.putCharSequence(ri.getResultKey(), text.trim());
            RemoteInput.addResultsToIntent(r, i, b);
            e.antwort.actionIntent.send(c, 0, i);
            return true;
        } catch (Throwable t) { return false; }
    }

    static synchronized void leeren() {
        LISTE.clear();
    }

    /** Hilfsweise, falls jemand die Iteration braucht */
    static synchronized int anzahl() { int n = 0; for (Iterator<Eintrag> it = LISTE.iterator(); it.hasNext(); it.next()) n++; return n; }
}
