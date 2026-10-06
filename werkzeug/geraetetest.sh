#!/bin/bash
# Laeuft im Android-Emulator auf GitHub: installiert die fertige APK, startet sie und macht Bilder der echten App.
APK=ergebnis/Fehnverleih-Navi.apk; AUS=ergebnis/geraet; P=de.fehnverleih.navi
mkdir -p "$AUS"
adb install -r "$APK" > "$AUS/installation.txt" 2>&1
for r in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS CAMERA; do adb shell pm grant $P android.permission.$r >> "$AUS/installation.txt" 2>&1 || true; done
adb shell dumpsys package com.google.android.webview 2>/dev/null | grep -m1 versionName >> "$AUS/installation.txt" || true
adb emu geo fix 7.7757 53.2457 || true
adb logcat -c
adb shell am start -W -n $P/.MainActivity >> "$AUS/installation.txt" 2>&1
sleep 15; adb exec-out screencap -p > "$AUS/01-anmeldung.png"
adb shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo" $P >> "$AUS/installation.txt" 2>&1
sleep 12; adb emu geo fix 7.7757 53.2457 || true; sleep 3; adb exec-out screencap -p > "$AUS/02-auftraege.png"
adb shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/navi" $P >> "$AUS/installation.txt" 2>&1
sleep 40; adb exec-out screencap -p > "$AUS/03-navigation.png"
adb shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/fahrt" $P >> "$AUS/installation.txt" 2>&1
sleep 45; adb exec-out screencap -p > "$AUS/04-fahrt.png"
sleep 30; adb exec-out screencap -p > "$AUS/05-fahrt-spaeter.png"
adb shell dumpsys activity services $P | grep -E "ServiceRecord|isForeground|foregroundServiceType" | head -6 > "$AUS/dienst.txt" 2>&1 || true
adb logcat -d -v brief | grep -E "FehnverleihNavi|AndroidRuntime|FATAL|chromium.*(ERROR|Uncaught)|TextToSpeech.*(fail|error)" | tail -150 > "$AUS/protokoll.txt" 2>&1 || true
echo "Geraetetest fertig" >> "$AUS/installation.txt"
exit 0
