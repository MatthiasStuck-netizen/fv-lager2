# Fehnverleih Navi

Eigenständige Navi-App für Fehnverleih (Android, mit Android Auto). Dieser Zweig `navi` enthält nur die Navi-App;
die Lager-Programme liegen unverändert im anderen Zweig.

- Aufträge aus der Warenwirtschaft, nächster Termin oben, neue Aufträge mit Extra-Wünschen anlegen
- eigene Karte (OpenStreetMap), eigene Route und Abbiege-Anzeige mit Sprachansage – ohne Google
- Tempolimit, E-Ladesäulen und Parkplätze mit WC entlang der Strecke
- Lager (wer ist eingestempelt), Wetter, Fahrzeuge mit Fahrtenbuch und Tankquittung, Einstellungen

## Stand 3.1

- Der Standort wird nur noch während einer gestarteten Fahrt an die Verwaltung gemeldet (vorher: dauerhaft ab der Anmeldung).
- Während der Zielführung steht der Bildschirm fest: Die Zurück-Taste tut nichts, beendet wird über das rote X mit Rückfrage „Ja / Nein“.
- Die Zielführung läuft weiter, wenn man auf Lager, Aufträge, Wetter usw. wechselt. Der feste Knopf „Karte“ in der Leiste führt zurück auf die Strecke (ohne laufende Fahrt: Karte mit den Aufträgen von heute).
- „Die Route wird neu berechnet“ wird je Abweichung nur einmal gesagt; ohne Netz wird still in wachsenden Abständen weiter versucht.
- Jeder Eintrag der Warteschlange (Fahrt, Tankbeleg) gehört dem Nutzer, der ihn angelegt hat, und wird nur unter seiner Anmeldung gesendet.
- Beim Abmelden werden Auftragsliste, letzte Ziele, gemerkte Adressen, Einstellungen und Kartenstil vom Handy gelöscht, eine laufende Fahrt wird vorher abgeschlossen, der Standort-Dienst endet. Es bleiben die vor Ort gespeicherten Punkte von Lagerhalle und Verwaltung.
- Der Overpass-Ausweichserver maps.mail.ru ist entfernt.
- Neu auf der Karte, einzeln schaltbar: Bäcker und Cafés, Tankstellen mit Diesel.

## Bauen

Jeder Upload in den Zweig `navi` startet auf GitHub den Lauf **Fehnverleih Navi bauen**.
Das Ergebnis liegt danach im Zweig `navi-bau`: `Fehnverleih-Navi.apk`, Bilder aller Seiten und das Prüfprotokoll.

## Aufbau

- `app/src/main/assets/www/` – Oberfläche (HTML, CSS, JavaScript)
- `app/src/main/java/` – Android-Rahmen in Kotlin (Standort, Kilometerzähler, Sprachansage, Kamera, Android Auto)
- `werkzeug/` – Prüfläufe (Bilder aller Seiten, Start im Emulator)

Die Serverdatei `warenwirtschaft.php` gehört nicht in dieses Repository, weil sie Passwörter enthält.
