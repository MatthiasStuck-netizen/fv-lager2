package de.fehnverleih.lager.kern;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Kleiner, eigenständiger JSON-Leser/-Schreiber (ohne Fremdbibliothek).
 * Objekte → LinkedHashMap<String,Object>, Arrays → ArrayList<Object>,
 * Zahlen → Long oder Double, sonst String / Boolean / null.
 */
public final class Json {
    private final String s;
    private int i;

    private Json(String s) { this.s = s; }

    /* ======================= Lesen ======================= */
    public static Object lesen(String text) {
        if (text == null) throw new IllegalArgumentException("Kein Text");
        // alles vor der ersten { oder [ überspringen (z. B. „<?php exit; ?>“ als Schutzzeile)
        int a = text.indexOf('{'), b = text.indexOf('[');
        int start = a < 0 ? b : (b < 0 ? a : Math.min(a, b));
        if (start < 0) throw new IllegalArgumentException("Keine JSON-Daten gefunden");
        Json j = new Json(text);
        j.i = start;
        Object o = j.wert();
        return o;
    }

    private void leer() {
        while (i < s.length()) {
            char c = s.charAt(i);
            if (c == ' ' || c == '\n' || c == '\r' || c == '\t' || c == '﻿') i++; else break;
        }
    }

    private Object wert() {
        leer();
        if (i >= s.length()) throw fehler("Unerwartetes Ende");
        char c = s.charAt(i);
        if (c == '{') return objekt();
        if (c == '[') return liste();
        if (c == '"') return text();
        if (c == 't' && s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
        if (c == 'f' && s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
        if (c == 'n' && s.startsWith("null", i)) { i += 4; return null; }
        if (c == '-' || (c >= '0' && c <= '9')) return zahl();
        throw fehler("Unerwartetes Zeichen '" + c + "'");
    }

    private Map<String, Object> objekt() {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        i++; leer();
        if (i < s.length() && s.charAt(i) == '}') { i++; return m; }
        while (true) {
            leer();
            if (i >= s.length() || s.charAt(i) != '"') throw fehler("Schlüssel erwartet");
            String k = text();
            leer();
            if (i >= s.length() || s.charAt(i) != ':') throw fehler("':' erwartet");
            i++;
            m.put(k, wert());
            leer();
            if (i >= s.length()) throw fehler("Unerwartetes Ende");
            char c = s.charAt(i++);
            if (c == ',') continue;
            if (c == '}') return m;
            throw fehler("',' oder '}' erwartet");
        }
    }

    private List<Object> liste() {
        List<Object> l = new ArrayList<Object>();
        i++; leer();
        if (i < s.length() && s.charAt(i) == ']') { i++; return l; }
        while (true) {
            l.add(wert());
            leer();
            if (i >= s.length()) throw fehler("Unerwartetes Ende");
            char c = s.charAt(i++);
            if (c == ',') continue;
            if (c == ']') return l;
            throw fehler("',' oder ']' erwartet");
        }
    }

    private String text() {
        StringBuilder b = new StringBuilder();
        i++;
        while (true) {
            if (i >= s.length()) throw fehler("Text nicht abgeschlossen");
            char c = s.charAt(i++);
            if (c == '"') return b.toString();
            if (c == '\\') {
                if (i >= s.length()) throw fehler("Text nicht abgeschlossen");
                char e = s.charAt(i++);
                switch (e) {
                    case '"': b.append('"'); break;
                    case '\\': b.append('\\'); break;
                    case '/': b.append('/'); break;
                    case 'b': b.append('\b'); break;
                    case 'f': b.append('\f'); break;
                    case 'n': b.append('\n'); break;
                    case 'r': b.append('\r'); break;
                    case 't': b.append('\t'); break;
                    case 'u':
                        if (i + 4 > s.length()) throw fehler("Ungültiges \\u");
                        b.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                        i += 4;
                        break;
                    default: b.append(e);
                }
            } else b.append(c);
        }
    }

    private Object zahl() {
        int st = i;
        if (s.charAt(i) == '-') i++;
        boolean komma = false;
        while (i < s.length()) {
            char c = s.charAt(i);
            if (c >= '0' && c <= '9') i++;
            else if (c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') { komma = true; i++; }
            else break;
        }
        String t = s.substring(st, i);
        if (!komma) {
            try { return Long.parseLong(t); } catch (NumberFormatException ex) { return Double.parseDouble(t); }
        }
        return Double.parseDouble(t);
    }

    private IllegalArgumentException fehler(String t) {
        return new IllegalArgumentException("JSON-Fehler bei Zeichen " + i + ": " + t);
    }

    /* ======================= Schreiben ======================= */
    public static String schreiben(Object o) {
        StringBuilder b = new StringBuilder();
        schreib(b, o);
        return b.toString();
    }

    @SuppressWarnings("unchecked")
    private static void schreib(StringBuilder b, Object o) {
        if (o == null) b.append("null");
        else if (o instanceof String) textSchreiben(b, (String) o);
        else if (o instanceof Boolean) b.append(((Boolean) o).booleanValue() ? "true" : "false");
        else if (o instanceof Double || o instanceof Float) {
            double d = ((Number) o).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) b.append("0");
            else if (d == Math.rint(d) && Math.abs(d) < 1e15) b.append((long) d).append(".0");
            else b.append(d);
        } else if (o instanceof Number) b.append(((Number) o).longValue());
        else if (o instanceof Map) {
            b.append('{');
            boolean erst = true;
            for (Map.Entry<String, Object> e : ((Map<String, Object>) o).entrySet()) {
                if (!erst) b.append(',');
                erst = false;
                textSchreiben(b, e.getKey());
                b.append(':');
                schreib(b, e.getValue());
            }
            b.append('}');
        } else if (o instanceof List) {
            b.append('[');
            Iterator<Object> it = ((List<Object>) o).iterator();
            boolean erst = true;
            while (it.hasNext()) {
                if (!erst) b.append(',');
                erst = false;
                schreib(b, it.next());
            }
            b.append(']');
        } else textSchreiben(b, String.valueOf(o));
    }

    private static void textSchreiben(StringBuilder b, String t) {
        b.append('"');
        for (int k = 0; k < t.length(); k++) {
            char c = t.charAt(k);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        b.append('"');
    }

    /* ======================= Hilfen zum Auslesen ======================= */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> map(Object o) {
        if (o instanceof Map) return (Map<String, Object>) o;
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        // PHP speichert leere oder durchnummerierte Arrays manchmal als Liste
        if (o instanceof List) {
            List<Object> l = (List<Object>) o;
            for (int k = 0; k < l.size(); k++) m.put(String.valueOf(k), l.get(k));
        }
        return m;
    }

    @SuppressWarnings("unchecked")
    public static List<Object> liste(Object o) {
        if (o instanceof List) return (List<Object>) o;
        List<Object> l = new ArrayList<Object>();
        if (o instanceof Map) l.addAll(((Map<String, Object>) o).values());
        return l;
    }

    public static String str(Object o) {
        if (o == null) return "";
        if (o instanceof Double) {
            double d = (Double) o;
            if (d == Math.rint(d)) return String.valueOf((long) d);
        }
        return String.valueOf(o);
    }

    public static long lng(Object o) {
        if (o == null) return 0;
        if (o instanceof Number) return ((Number) o).longValue();
        if (o instanceof Boolean) return ((Boolean) o) ? 1 : 0;
        try { return (long) Double.parseDouble(String.valueOf(o).trim().replace(',', '.')); } catch (Exception e) { return 0; }
    }

    public static int zahl(Object o) { return (int) Math.max(Integer.MIN_VALUE, Math.min(Integer.MAX_VALUE, lng(o))); }

    public static double dbl(Object o) {
        if (o == null) return 0;
        if (o instanceof Number) return ((Number) o).doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim().replace(',', '.')); } catch (Exception e) { return 0; }
    }

    public static boolean bool(Object o) {
        if (o == null) return false;
        if (o instanceof Boolean) return (Boolean) o;
        if (o instanceof Number) return ((Number) o).doubleValue() != 0;
        String t = String.valueOf(o);
        return !(t.isEmpty() || t.equals("0") || t.equalsIgnoreCase("false"));
    }

    public static Map<String, Object> neu() { return new LinkedHashMap<String, Object>(); }
}
