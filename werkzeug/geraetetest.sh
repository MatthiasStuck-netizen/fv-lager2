#!/bin/bash
# Im Android-Emulator auf GitHub: Test-APK (Wegwerf-Schlüssel) installieren, Demo + Route öffnen, Bilder und Protokoll.
APK=test.apk; AUS=geraet; P=de.fehnverleih.navi
A() { timeout 40 adb "$@"; }
foto() { timeout 30 adb exec-out screencap -p > "$AUS/$1.png" || echo "kein Bild $1" >> "$AUS/installation.txt"; }
mkdir -p "$AUS"
timeout 120 adb install -r "$APK" > "$AUS/installation.txt" 2>&1
for r in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS READ_CONTACTS READ_CALL_LOG CALL_PHONE; do A shell pm grant $P android.permission.$r >> "$AUS/installation.txt" 2>&1 || true; done
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
# 4.4: Telefon, Nachrichten (Benachrichtigungs-Zugriff), Musik, Karte mit Live-Zügen
A shell cmd notification allow_listener $P/$P.Mitteiler >> "$AUS/installation.txt" 2>&1 || true
A shell content insert --uri content://com.android.contacts/raw_contacts --bind account_type:s: --bind account_name:s: >> "$AUS/installation.txt" 2>&1 || true
A shell content insert --uri content://com.android.contacts/data --bind raw_contact_id:i:1 --bind mimetype:s:vnd.android.cursor.item/name --bind data1:s:'Testkunde Meyer' >> "$AUS/installation.txt" 2>&1 || true
A shell content insert --uri content://com.android.contacts/data --bind raw_contact_id:i:1 --bind mimetype:s:vnd.android.cursor.item/phone_v2 --bind data1:s:'04952 123456' --bind data2:i:2 >> "$AUS/installation.txt" 2>&1 || true
A shell content insert --uri content://call_log/calls --bind number:s:'04952123456' --bind type:i:3 --bind date:l:1792170000000 --bind duration:i:0 >> "$AUS/installation.txt" 2>&1 || true
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/telefon" $P >> "$AUS/installation.txt" 2>&1
sleep 6; foto 04-telefon
A shell cmd notification post -S messaging --conversation "Lager" --message "Lager:Bitte noch 20 Stühle mitnehmen" -t "Lager" fvtest "Bitte noch 20 Stühle mitnehmen" >> "$AUS/installation.txt" 2>&1 || true
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/nachrichten" $P >> "$AUS/installation.txt" 2>&1
sleep 6; foto 05-nachrichten
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/musik" $P >> "$AUS/installation.txt" 2>&1
sleep 5; foto 06-musik
A shell am start -W -a android.intent.action.VIEW -d "fehnverleihnavi://demo/karte" $P >> "$AUS/installation.txt" 2>&1
sleep 14; foto 07-karte-live
A shell dumpsys package $P | grep -E "READ_CONTACTS|READ_CALL_LOG|CALL_PHONE|granted=true" | head -20 >> "$AUS/installation.txt" 2>&1 || true
A shell cmd notification list_listeners 2>/dev/null | head -5 >> "$AUS/installation.txt" || true
A logcat -d -v brief | grep -E "AndroidRuntime|FATAL|Satelliten|chromium.*(ERROR|Uncaught)" | tail -100 > "$AUS/protokoll.txt" 2>&1 || true
A shell pidof $P >> "$AUS/installation.txt" && echo "App laeuft noch" >> "$AUS/installation.txt"
echo "fertig" >> "$AUS/installation.txt"
exit 0
