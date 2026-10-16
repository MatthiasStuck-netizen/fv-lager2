package de.fehnverleih.navi;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.CallLog;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.view.KeyEvent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Zusätze fürs Navi (Version 4.4): Telefon (Kontakte, Anrufliste, Anrufen), Nachrichten aus WhatsApp & Co.
 * (über den Benachrichtigungs-Zugriff), Musik-Steuerung (Spotify), E-Mail (IMAP) und Schiffe live (AIS).
 * Die Oberfläche ruft alles über eine einzige Brücken-Methode: FVNative.extra(befehl, datenJson) → JSON.
 */
public final class Extras {
    private Extras() {}

    public static String ruf(Context c, String befehl, String daten) {
        try {
            JSONObject a = daten == null || daten.length() == 0 || daten.charAt(0) != '{' ? new JSONObject() : new JSONObject(daten);
            String text = daten == null ? "" : daten;
            switch (befehl == null ? "" : befehl) {
                case "rechte": return rechte(c, a, true);
                case "rechteStand": return rechte(c, a, false);
                case "kontakte": return kontakte(c);
                case "anrufliste": return anrufliste(c);
                case "anrufen": return anrufen(c, a.optString("tel", text));
                case "zugriff": return new JSONObject().put("mitteilungen", Mitteiler.erlaubt(c)).put("verbunden", Mitteiler.verbunden()).toString();
                case "zugriffEinstellen": return einstellungen(c, Build.VERSION.SDK_INT >= 22 ? "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS" : Settings.ACTION_SETTINGS);
                case "appEinstellungen": return appEinstellungen(c);
                case "nachrichten": return Mitteiler.liste(a.optLong("seit", 0));
                case "nachrichtOeffnen": return ok(Mitteiler.oeffnen(c, a.optLong("id")));
                case "nachrichtAntworten": return ok(Mitteiler.antworten(c, a.optLong("id"), a.optString("text")));
                case "nachrichtenLeeren": Mitteiler.leeren(); return ok(true);
                case "medien": return medien(c);
                case "medienTaste": return ok(medienTaste(c, a.optString("taste")));
                case "appDa": return ok(appDa(c, a.optString("paket")));
                case "appOeffnen": return ok(appOeffnen(c, a.optString("paket")));
                case "mailAbruf": Post.abrufen(a); return Post.stand();
                case "mailStand": return Post.stand();
                case "aisStart": Ais.start(a); return Ais.stand();
                case "aisStand": return Ais.stand();
                case "aisStopp": Ais.stopp(); return ok(true);
                case "version": return new JSONObject().put("extras", 1).put("sdk", Build.VERSION.SDK_INT).toString();
                default: return fehler("unbekannter Befehl " + befehl);
            }
        } catch (Throwable t) {
            return fehler(t.getClass().getSimpleName() + ": " + t.getMessage());
        }
    }

    static String ok(boolean b) { return b ? "{\"ok\":true}" : "{\"ok\":false}"; }
    static String fehler(String t) {
        try { return new JSONObject().put("ok", false).put("fehler", t == null ? "Fehler" : t).toString(); } catch (Exception e) { return "{\"ok\":false}"; }
    }

    /* ---------- Berechtigungen ---------- */
    static boolean hat(Context c, String recht) {
        if (Build.VERSION.SDK_INT < 23) return true;
        return c.checkSelfPermission(recht) == PackageManager.PERMISSION_GRANTED;
    }
    private static String rechte(Context c, JSONObject a, boolean fragen) throws Exception {
        JSONArray l = a.optJSONArray("liste");
        JSONObject aus = new JSONObject();
        if (l == null) return aus.toString();
        final java.util.ArrayList<String> fehlt = new java.util.ArrayList<>();
        for (int i = 0; i < l.length(); i++) {
            String r = l.getString(i), voll = r.indexOf('.') < 0 ? "android.permission." + r : r;
            boolean da = hat(c, voll);
            aus.put(r, da);
            if (!da) fehlt.add(voll);
        }
        if (fragen && !fehlt.isEmpty() && c instanceof Activity && Build.VERSION.SDK_INT >= 23) {
            final Activity act = (Activity) c;
            act.runOnUiThread(new Runnable() { @Override public void run() {
                try { act.requestPermissions(fehlt.toArray(new String[0]), 4401); } catch (Throwable ignored) {}
            } });
        }
        return aus.toString();
    }
    private static String einstellungen(Context c, String aktion) {
        try {
            Intent i = new Intent(aktion);
            if (!(c instanceof Activity)) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            return ok(true);
        } catch (Throwable t) { return fehler(t.getMessage()); }
    }
    private static String appEinstellungen(Context c) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
            if (!(c instanceof Activity)) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            return ok(true);
        } catch (Throwable t) { return fehler(t.getMessage()); }
    }

    /* ---------- Telefon ---------- */
    private static String kontakte(Context c) throws Exception {
        JSONObject aus = new JSONObject();
        if (!hat(c, "android.permission.READ_CONTACTS")) return aus.put("ok", false).put("recht", false).toString();
        JSONArray l = new JSONArray();
        Set<String> schon = new HashSet<>();
        Cursor cu = null;
        try {
            cu = c.getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.LABEL, ContactsContract.CommonDataKinds.Phone.STARRED },
                null, null, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " COLLATE LOCALIZED ASC");
            while (cu != null && cu.moveToNext() && l.length() < 3000) {
                String name = cu.getString(0), nr = cu.getString(1);
                if (nr == null) continue;
                String sauber = nr.replaceAll("[^0-9+]", "");
                if (sauber.length() < 3 || !schon.add((name == null ? "" : name) + "|" + sauber)) continue;
                int typ = cu.isNull(2) ? 0 : cu.getInt(2);
                String art = typ == 2 ? "Mobil" : typ == 1 ? "Privat" : typ == 3 ? "Arbeit" : (cu.getString(3) != null ? cu.getString(3) : "Telefon");
                l.put(new JSONObject().put("n", name == null ? nr : name).put("t", nr).put("art", art).put("s", !cu.isNull(4) && cu.getInt(4) == 1));
            }
        } finally { if (cu != null) cu.close(); }
        return aus.put("ok", true).put("liste", l).toString();
    }
    private static String anrufliste(Context c) throws Exception {
        JSONObject aus = new JSONObject();
        if (!hat(c, "android.permission.READ_CALL_LOG")) return aus.put("ok", false).put("recht", false).toString();
        JSONArray l = new JSONArray();
        Cursor cu = null;
        try {
            cu = c.getContentResolver().query(CallLog.Calls.CONTENT_URI,
                new String[]{ CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION },
                null, null, CallLog.Calls.DATE + " DESC");
            while (cu != null && cu.moveToNext() && l.length() < 80) {
                int typ = cu.isNull(2) ? 0 : cu.getInt(2);
                String art = typ == CallLog.Calls.INCOMING_TYPE ? "ein" : typ == CallLog.Calls.OUTGOING_TYPE ? "aus" : typ == CallLog.Calls.MISSED_TYPE ? "verpasst"
                    : typ == CallLog.Calls.REJECTED_TYPE ? "abgelehnt" : typ == CallLog.Calls.BLOCKED_TYPE ? "blockiert" : "ein";
                l.put(new JSONObject().put("t", cu.getString(0) == null ? "" : cu.getString(0)).put("n", cu.getString(1) == null ? "" : cu.getString(1))
                    .put("art", art).put("zeit", cu.getLong(3)).put("dauer", cu.isNull(4) ? 0 : cu.getLong(4)));
            }
        } finally { if (cu != null) cu.close(); }
        return aus.put("ok", true).put("liste", l).toString();
    }
    private static String anrufen(Context c, String tel) throws Exception {
        if (tel == null || tel.replaceAll("[^0-9+*#]", "").length() == 0) return fehler("keine Nummer");
        boolean direkt = hat(c, "android.permission.CALL_PHONE");
        Intent i = new Intent(direkt ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(tel.trim())));
        if (!(c instanceof Activity)) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        c.startActivity(i);
        return new JSONObject().put("ok", true).put("direkt", direkt).toString();
    }

    /* ---------- Musik (Spotify oder was gerade läuft) ---------- */
    private static MediaController spieler(Context c) {
        if (Build.VERSION.SDK_INT < 21) return null;
        try {
            MediaSessionManager m = (MediaSessionManager) c.getSystemService(Context.MEDIA_SESSION_SERVICE);
            List<MediaController> l = m.getActiveSessions(new ComponentName(c, Mitteiler.class));
            MediaController spotify = null, spielt = null, erster = null;
            for (MediaController mc : l) {
                if (erster == null) erster = mc;
                if ("com.spotify.music".equals(mc.getPackageName()) && spotify == null) spotify = mc;
                PlaybackState s = mc.getPlaybackState();
                if (spielt == null && s != null && s.getState() == PlaybackState.STATE_PLAYING) spielt = mc;
            }
            return spielt != null ? spielt : spotify != null ? spotify : erster;
        } catch (SecurityException e) {
            return null;   // ohne Benachrichtigungs-Zugriff keine Titelanzeige
        } catch (Throwable t) {
            return null;
        }
    }
    private static String medien(Context c) throws Exception {
        JSONObject aus = new JSONObject();
        aus.put("spotify", appDa(c, "com.spotify.music")).put("zugriff", Mitteiler.erlaubt(c));
        MediaController mc = spieler(c);
        if (mc == null) {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            return aus.put("aktiv", false).put("spielt", am != null && am.isMusicActive()).toString();
        }
        MediaMetadata md = mc.getMetadata();
        PlaybackState s = mc.getPlaybackState();
        aus.put("aktiv", true).put("app", mc.getPackageName()).put("spielt", s != null && s.getState() == PlaybackState.STATE_PLAYING);
        if (md != null) {
            String titel = md.getString(MediaMetadata.METADATA_KEY_TITLE), wer = md.getString(MediaMetadata.METADATA_KEY_ARTIST), alb = md.getString(MediaMetadata.METADATA_KEY_ALBUM);
            aus.put("titel", titel == null ? "" : titel).put("kuenstler", wer == null ? "" : wer).put("album", alb == null ? "" : alb);
            long dauer = md.getLong(MediaMetadata.METADATA_KEY_DURATION);
            if (dauer > 0) aus.put("dauer", dauer);
        }
        if (s != null) aus.put("pos", s.getPosition());
        return aus.toString();
    }
    private static boolean medienTaste(Context c, String taste) {
        MediaController mc = spieler(c);
        if (mc != null) {
            MediaController.TransportControls t = mc.getTransportControls();
            PlaybackState s = mc.getPlaybackState();
            boolean spielt = s != null && s.getState() == PlaybackState.STATE_PLAYING;
            switch (taste) {
                case "play": t.play(); return true;
                case "pause": t.pause(); return true;
                case "umschalten": if (spielt) t.pause(); else t.play(); return true;
                case "weiter": t.skipToNext(); return true;
                case "zurueck": t.skipToPrevious(); return true;
                default: return false;
            }
        }
        int code = "play".equals(taste) ? KeyEvent.KEYCODE_MEDIA_PLAY : "pause".equals(taste) ? KeyEvent.KEYCODE_MEDIA_PAUSE
            : "weiter".equals(taste) ? KeyEvent.KEYCODE_MEDIA_NEXT : "zurueck".equals(taste) ? KeyEvent.KEYCODE_MEDIA_PREVIOUS : KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return false;
        long t0 = SystemClock.uptimeMillis();
        am.dispatchMediaKeyEvent(new KeyEvent(t0, t0, KeyEvent.ACTION_DOWN, code, 0));
        am.dispatchMediaKeyEvent(new KeyEvent(t0, t0, KeyEvent.ACTION_UP, code, 0));
        return true;
    }

    /* ---------- Andere Apps ---------- */
    static boolean appDa(Context c, String paket) {
        try { c.getPackageManager().getPackageInfo(paket, 0); return true; } catch (Throwable t) { return false; }
    }
    private static boolean appOeffnen(Context c, String paket) {
        try {
            Intent i = c.getPackageManager().getLaunchIntentForPackage(paket);
            if (i == null) return false;
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            c.startActivity(i);
            return true;
        } catch (Throwable t) { return false; }
    }
}
