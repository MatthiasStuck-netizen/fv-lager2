#!/bin/bash
# Im Android-Emulator auf GitHub: Test-APK (Wegwerf-Schlüssel) installieren, Demo + Route öffnen, Bilder und Protokoll.
APK=test.apk; AUS=geraet; P=de.fehnverleih.navi
A() { timeout 40 adb "$@"; }
foto() { timeout 30 adb exec-out screencap -p > "$AUS/$1.png" || echo "kein Bild $1" >> "$AUS/installation.txt"; }
mkdir -p "$AUS"
timeout 120 adb install -r "$APK" > "$AUS/installation.txt" 2>&1
for r in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS; do A shell pm grant $P android.permission.$r >> "$AUS/installation.txt" 2>&1 || true; done
A shell settings put global hide_error_dialogs 1 || true
A emu geo fix 7.7757 53.2457 10 9 || true
A logcat -c
A shell am start -W -n $P/.MainActivity >> "$AUS/installation.txt" 2>&1
sleep 12
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo" $P >> "$AUS/installation.txt" 2>&1
sleep 8; A emu geo fix 7.7757 53.2457 10 9 || true; sleep 3; foto 01-auftraege
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/navi" $P >> "$AUS/installation.txt" 2>&1
for i in 1 2 3 4 5 6; do A emu geo fix 7.7757 53.2457 10 9 || true; sleep 4; done
foto 02-route-mit-satelliten
A emu geo fix 7.7760 53.2460 10 5 || true; sleep 4; A emu geo fix 7.7761 53.2461 10 5 || true; sleep 4
foto 03-weniger-satelliten
A logcat -d -v brief | grep -E "AndroidRuntime|FATAL|Satelliten|chromium.*(ERROR|Uncaught)" | tail -100 > "$AUS/protokoll.txt" 2>&1 || true
A shell pidof $P >> "$AUS/installation.txt" && echo "App laeuft noch" >> "$AUS/installation.txt"
echo "fertig" >> "$AUS/installation.txt"
exit 0
