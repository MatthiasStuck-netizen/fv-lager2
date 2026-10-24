#!/bin/bash
# Gerätetest im Emulator: installieren, Android-Auto-Dienst prüfen, App starten, Abstürze sammeln
mkdir -p geraet
echo "start $(date)" > geraet/protokoll.txt
adb wait-for-device
adb install -r test/navi.apk >> geraet/protokoll.txt 2>&1 || echo "INSTALL FEHLER" >> geraet/protokoll.txt
echo "--- Dienste CarAppService" >> geraet/protokoll.txt
adb shell cmd package query-services -a androidx.car.app.CarAppService >> geraet/protokoll.txt 2>&1 || true
echo "--- Paket" >> geraet/protokoll.txt
adb shell dumpsys package de.fehnverleih.navi 2>/dev/null | grep -iE "versionName|AutoDienst|ACCESS_SURFACE|category.NAVIGATION|action.NAVIGATE" >> geraet/protokoll.txt || true
adb logcat -c || true
adb shell am start -n de.fehnverleih.navi/.MainActivity >> geraet/protokoll.txt 2>&1 || true
sleep 30
adb exec-out screencap -p > geraet/start.png 2>/dev/null || true
echo "--- Absturz-Puffer" >> geraet/protokoll.txt
adb logcat -d -b crash >> geraet/protokoll.txt 2>&1 || true
echo "--- laeuft?" >> geraet/protokoll.txt
(adb shell pidof de.fehnverleih.navi || echo "LAEUFT NICHT") >> geraet/protokoll.txt 2>&1
adb logcat -d 2>/dev/null | grep -iE "fehnverleih|AndroidRuntime|Uncaught|dex|ClassNotFound|VerifyError" | tail -300 > geraet/logcat.txt || true
echo "ende $(date)" >> geraet/protokoll.txt
exit 0
