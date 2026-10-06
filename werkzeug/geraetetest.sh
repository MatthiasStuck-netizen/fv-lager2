#!/bin/bash
# Laeuft im Android-Emulator auf GitHub: installiert die fertige APK, startet sie und macht Bilder der echten App.
# Jeder Schritt hat eine Zeitgrenze, damit ein haengender Emulator den Lauf nicht aufhaelt.
APK=ergebnis/Fehnverleih-Navi.apk; AUS=ergebnis/geraet; P=de.fehnverleih.navi
A() { timeout 40 adb "$@"; }
foto() { timeout 30 adb exec-out screencap -p > "$AUS/$1.png" || echo "kein Bild $1" >> "$AUS/installation.txt"; }
mkdir -p "$AUS"; rm -f "$AUS"/*
timeout 120 adb install -r "$APK" > "$AUS/installation.txt" 2>&1
for r in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS CAMERA; do A shell pm grant $P android.permission.$r >> "$AUS/installation.txt" 2>&1 || true; done
A shell dumpsys package com.google.android.webview 2>/dev/null | grep -m1 versionName >> "$AUS/installation.txt" || true
A shell settings put global hide_error_dialogs 1 || true
A emu geo fix 7.7757 53.2457 || true
A logcat -c
A shell am start -W -n $P/.MainActivity >> "$AUS/installation.txt" 2>&1
sleep 15; foto 01-anmeldung
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo" $P >> "$AUS/installation.txt" 2>&1
sleep 12; A emu geo fix 7.7757 53.2457 || true; sleep 3; foto 02-auftraege
A logcat -d -v brief | grep -E "FehnverleihNavi|AndroidRuntime|FATAL" | tail -60 > "$AUS/protokoll-1.txt" 2>&1 || true
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/navi" $P >> "$AUS/installation.txt" 2>&1
sleep 20; foto 03-navigation-frueh
A logcat -d -v brief | grep -E "FehnverleihNavi|AndroidRuntime|FATAL|chromium" | tail -80 > "$AUS/protokoll-2.txt" 2>&1 || true
sleep 25; foto 03-navigation
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/fahrt" $P >> "$AUS/installation.txt" 2>&1
sleep 45; foto 04-fahrt
sleep 30; foto 05-fahrt-spaeter
A shell dumpsys activity services $P | grep -E "ServiceRecord|isForeground|foregroundServiceType" | head -6 > "$AUS/dienst.txt" 2>&1 || true
A logcat -d -v brief | grep -E "FehnverleihNavi|AndroidRuntime|FATAL|chromium.*(ERROR|Uncaught)|TextToSpeech.*(fail|error)" | tail -150 > "$AUS/protokoll.txt" 2>&1 || true
echo "Geraetetest fertig" >> "$AUS/installation.txt"
exit 0
