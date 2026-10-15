# Fehnverleih Navi 3.9.x – Oberfläche und Bauwerkzeuge

Dieser Zweig enthält die Oberfläche der installierten Navi-App ab **3.9.3** (aus der APK zurückgeholt)
und die Änderungen ab **3.9.4**. Der Android-Teil (Kotlin) von 3.9.x liegt nur kompiliert in der APK vor;
gebaut wird deshalb, indem die Oberfläche in die vorhandene APK eingesetzt und neu unterschrieben wird.

**Achtung:** Der Zweig `navi` enthält einen viel älteren Stand (3.1). Nicht von dort weiterbauen.

## Neu in 3.9.4: Offline-Karte vom eigenen Server
- Einstellungen → Offline-Karten → **„Offline-Karte laden“**
- Lädt `deutschland.pmtiles` oder die Teile `teil-00`, `teil-01`, … aus `https://www.fehnverleih.de/karten/`
  (zweiter Versuch: `/fehnverleih/karten/`) in den App-Speicher. Fortsetzen nach Abbruch, Anhalten, Löschen.
- Danach liest die Karte die Kacheln aus der Datei (`js/offline.js`, Protokoll `fvkarte://`), auch ohne Internet.
- Auf dem Server muss im Ordner `karten` die Datei `.htaccess` aus `server-karten/htaccess` liegen.

## Bauen
    python3 werkzeuge/bauen.py Fehnverleih-Navi-3.9.3.apk www fehnverleih-app.jks <PASSWORT> fehnverleih Fehnverleih-Navi-3.9.4.apk 3.9.4 395
    python3 werkzeuge/pruefen.py Fehnverleih-Navi-3.9.4.apk

Der Schlüssel `fehnverleih-app.jks` und sein Passwort gehören **nie** in dieses (öffentliche) Repository.

## Tests
    python3 test/pmtiles_schreiben.py a.pmtiles 7 40 && node test/leser_test.mjs www/js/offline.js a.pmtiles
    node test/download_test.mjs www/js/offline.js a.pmtiles
    # Browser-Gesamttest (Playwright): siehe Kopf von test/browsertest.py
