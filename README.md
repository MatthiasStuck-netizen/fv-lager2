# Fehnverleih Navi

Eigenständige Navi-App für Fehnverleih (Android, mit Android Auto). Dieser Zweig `navi` enthält nur die Navi-App;
die Lager-Programme liegen unverändert im anderen Zweig.

- Aufträge aus der Warenwirtschaft, nächster Termin oben, neue Aufträge mit Extra-Wünschen anlegen
- eigene Karte (OpenStreetMap), eigene Route und Abbiege-Anzeige mit Sprachansage – ohne Google
- Tempolimit, E-Ladesäulen und Parkplätze mit WC entlang der Strecke
- Lager (wer ist eingestempelt), Wetter, Fahrzeuge mit Fahrtenbuch und Tankquittung, Einstellungen

## Bauen

Jeder Upload in den Zweig `navi` startet auf GitHub den Lauf **Fehnverleih Navi bauen**.
Das Ergebnis liegt danach im Zweig `navi-bau`: `Fehnverleih-Navi.apk`, Bilder aller Seiten und das Prüfprotokoll.

## Aufbau

- `app/src/main/assets/www/` – Oberfläche (HTML, CSS, JavaScript)
- `app/src/main/java/` – Android-Rahmen in Kotlin (Standort, Kilometerzähler, Sprachansage, Kamera, Android Auto)
- `werkzeug/` – Prüfläufe (Bilder aller Seiten, Start im Emulator)

Die Serverdatei `warenwirtschaft.php` gehört nicht in dieses Repository, weil sie Passwörter enthält.
