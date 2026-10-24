# Fehnverleih Navi 3.9.x – 4.7.x – Oberfläche und Bauwerkzeuge

Dieser Zweig enthält die Oberfläche der installierten Navi-App ab **3.9.3** (aus der APK zurückgeholt)
und die Änderungen ab **3.9.4**. Der Android-Teil (Kotlin) von 3.9.x liegt nur kompiliert in der APK vor;
gebaut wird deshalb, indem die Oberfläche in die vorhandene APK eingesetzt und neu unterschrieben wird.

**Achtung:** Der Zweig `navi` enthält einen viel älteren Stand (3.1). Nicht von dort weiterbauen.

## Neu in 4.8.8
- Veranstaltungskalender: Google liefert Veranstaltungen nur bei **englischen** Suchen (SerpApi google_events immer hl=en/gl=us). Suchwörter jetzt englisch (Events, Theater, Musicals, Concerts, Comedy shows, Family events, Festivals and markets, Exhibitions), Ort in Deutschland mit „, Germany“; kein hl/gl mehr. Datum/Uhrzeit werden ins Deutsche übersetzt (`deutsch()`: „Sat, Oct 25, 8 PM“ → „Sa., 25. Okt., 20:00“).

## Neu in 4.8.7
- Oberfläche `www` = Stand der installierten 4.8.6 (aus der APK, mit Android Auto und Modellflugplätzen) plus diese Änderung. Gebaut mit `bauen.py Fehnverleih-Navi-4.8.6.apk www … 4.8.7 487`.
- Seite **Suche**: „Abfahrten und Ankünfte“ entfernt (gibt es unter Nahverkehr). Dafür **Veranstaltungskalender** (`suche.js`): Art (Alles, Theater, Musical, Konzerte, Comedy, Familie, Feste, Museen), Zeitraum (Alle/Heute/Wochenende/Woche/Monat), Ort oder „In der Nähe“ (Ortsname über `V.plz`). Quelle Google-Veranstaltungssuche über SerpApi (`engine=google_events`, Schlüssel wie Flugsuche aus der Verwaltung), je Seite 10, „Mehr laden“, 6 Std. gemerkt (`V.merk('events')`). Fenster mit Wann/Wo/Beschreibung, Tickets, Hinfahren (Adresse über Nominatim).
- Neue Symbole `maske`, `mikro`, `museum`.

## Neu in 4.8.1
- Offline-Karten **Großbritannien** (England, Schottland, Wales) und **Irland + Nordirland** (`grossbritannien-teil-NN`, `irland-teil-NN`, Releases `karte-grossbritannien`, `karte-irland`).

## Neu in 4.8.0
- Leiste unten: **Einstellungen** ganz rechts (nach Kosmos), `REITER` in `app.js`.

## Neu in 4.7.9
- **E-Säulen** in „Suche Nahverkehr“ (Knopf nach Dampfzüge, `nahverkehr.js` `esSuchen`/`esZeigen`/`esBlatt`): Ort eintippen → alle Ladesäulen für Autos im ganzen Gemeindegebiet (Overpass `area` aus der OSM-Grenze des Nominatim-Treffers, sonst Umkreis 3 km; leer = 5 km um den Standort). Karte oben (`K.esaeulen` in `karte.js`, GeoJSON mit Gruppen und Anzahl), Umschalter Alle/Schnelllader ab 50 kW, Liste (je 100), Fenster mit Steckern, kW, Betreiber, Kosten, Bezahlen, Hinfahren. Ohne E-Bike-Ladestellen und private Säulen.
- `G.suche` liefert zusätzlich `box`, `osmTyp`, `osmId`.

## Neu in 4.7.8 (4.7.6/4.7.7 mit weniger Ländern)
- Offline-Karten zusätzlich **Frankreich**, **Österreich**, **Schweiz**, **Italien**, **Niederlande**, **Belgien**, **Luxemburg**, **Dänemark**, **Polen**, **Tschechien** (`offline.js`, Liste `KARTEN`; Dateien `frankreich-teil-NN`, `oesterreich-teil-NN`, `schweiz-teil-NN`, `italien-teil-NN` usw. (`<land>-teil-NN`) aus den Releases `karte-<land>`, Zweig `karte-europa`).
- Einstellungen: statt aller Karten nur eine Zeile **Offline-Kartenmaterial** (`Tun.offkarten`, `offlineBlatt` in `seiten.js`); antippen öffnet ein Fenster (`#blatt`, `#offblatt`) mit allen Karten zum Laden/Löschen; `offlineNeu()` aktualisiert Zeile und Fenster.
- Oberfläche `www` ist der Stand der installierten 4.7.5 (aus der APK zurückgeholt) plus diese Änderung. Gebaut mit `bauen.py Fehnverleih-Navi-4.7.5.apk www …`.

## Neu in 4.5.0
- **Kostenlose Parkplätze** (`parken.js`, Ebene `parkenFrei`): alle Parkplätze aus OpenStreetMap mit `fee=no` – weltweit, in jeder Stadt, ab Zoom 12 im sichtbaren Ausschnitt (Kacheln 0,1°, 7 Tage gemerkt; ohne private/Kunden-/Anwohner-Parkplätze). Blaues „P“ mit grünem „0 €“, antippen → Art, Plätze, Höchstparkdauer, Parkscheibe, Zeiten, Durchfahrtshöhe, Lkw, Hinfahren/zu Fuß. Seite `parkfrei` (in der Nähe bzw. „am Ziel“ aus der Zielführung). Schalter in Ebenen, Zielführung und Einstellungen.
- **Eigene Sperrung in der Zielführung** (`sperrung.js`, `F.umfahren` in `fuehrung.js`): Knopf „Sperrung“ links auf der Karte → auf die gesperrte Straße tippen (oder „Straße vor mir“). Die Stelle wird auf die Route bzw. per Valhalla `locate` auf die Straße gesetzt, ein Sperrungs-Schild erscheint, und es wird sofort ohne diese Stelle neu berechnet (Valhalla `exclude_polygons`, gilt 12 Std. für jede Route). Schild antippen → aufheben.
- Test: `test/test_47.py`.
- Aufbauend auf 4.4.3 (E-Bike-Stationen, aus der installierten APK übernommen).

## Neu in 4.4.2
- **Fahrzeuge live von oben** (wie Flugzeug und Auto, drehen sich in Fahrtrichtung): Zug mit Lok und drei Wagen (Streifen in Linienfarbe), Bus, Straßenbahn, Schiffe als Fähre, Frachter (Container), Tanker, Segelboot, kleines Boot (`karte.js`, `zeichneFahrzeug`). Transporter als eigenes Fahrzeugsymbol (`K.istTransporter`). AIS-Füllzeichen „@“ entfernt.
- **Satelliten im Detail** (`satelliten.js`): Android meldet jeden Satelliten (System, Nummer, genutzt, Signal, Höhe/Richtung am Himmel, Frequenz). Bahndaten CelesTrak `GROUP=gnss` (einmal am Tag), Kepler-Bahn mit J2 → Name, Höhe, Geschwindigkeit, Entfernung, Umlaufzeit. Zuordnung über PRN im Namen, sonst über die Stelle am Himmel (GLONASS). EGNOS/WAAS aus Tabelle. Himmelskarte, Liste verbunden/in Sicht, Einzelblatt.
- Tests: `test/test_45.py` (Symbole, Transporter), `test/test_46.py` (Satelliten).

## Neu in 4.4.0
- **Startseite:** unter „Route starten“ / „Karte anzeigen“ kleine Knöpfe Favoriten, Telefon, Spotify, Nachrichten, Verkehrsfunk. Dünner schwarzer Rahmen um das Fehnverleih-Bild.
- **Telefon** (`extras.js`, Seite `telefon`): letzte Anrufe, Kontakte (mit Suche, Favoriten zuerst), Kunden heute, Wähltastatur. Anrufen direkt (CALL_PHONE), sonst Wähltastatur.
- **Nachrichten** (`nachrichten`): WhatsApp, Telegram, Signal, SMS über den Benachrichtigungs-Zugriff (Android-Dienst `Mitteiler`), Einblendung oben über der Karte (`#melder`), Vorlesen während der Fahrt, Schnellantworten (RemoteInput). **E-Mail** per IMAP (nur lesen, `Post.java`, Konto nur auf dem Handy, beim Abmelden gelöscht).
- **Musik:** Blatt mit Titel/Künstler (MediaSession), Zurück/Pause/Weiter, „Zu Spotify wechseln“.
- **Verkehrsfunk** (`verkehrsfunk`): Radio live (NDR 1 Niedersachsen, NDR 2, ffn, Antenne, Bremen Eins, WDR 2, NPO Radio 1 – Adressen über radio-browser.info) und Meldungen im Umkreis von 60 km (`V.umgebung`: Autobahnen aus OSM → Autobahn GmbH, mit TomTom-Schlüssel alle Straßen), vorlesbar.
- **Karte:** Knöpfe rechts: Online/Offline (`e.kartenQuelle`, `K.stilNeu` ohne Neuaufbau), Gelände (Schummerung + 3D aus Mapzen Terrain Tiles, `K.gelaende`), Musik, Nachrichten.
- **Züge live** (`live.js`): Transitous/MOTIS `map/trips`, Position nach Uhr entlang der Linie, antippen → Halte mit Verspätung. Fähren mit Fahrplan ebenso. **Schiffe live** per AIS (aisstream.io, Schlüssel in der Verwaltung oder in den Einstellungen; Verbindung im Android-Teil `Ais.java`), alle Kennungen (MMSI, IMO, Rufzeichen, Typ, Ziel, ETA, Maße).
- **Bahnstrecke schienengenau:** `FV.LIVE.gleise` holt für jeden Bahn-/Bus-Abschnitt die Linie aus Transitous `plan` (gleiche Linie, Abfahrt ±12 Min.) – `K.oev` zeichnet danach neu.
- **Routenwahl** schnellste / sparsame / kürzeste (`G.routenArten`, Valhalla `shortest` bzw. `top_speed`, Sprit geschätzt nach Tempo je Abschnitt, PKW/Transporter); die Wahl gilt auch für Neuberechnung und Umleitung.
- **Flugtafel:** Flug antippen → Abflug/Ankunft (Plan + neu), Gate, Flugzeug und – in der Luft – Höhe, Tempo, Kurs, Kennung (adsb.lol). Live-Flugzeug: Uhrzeit, Abflug, Ankunft (Server-Aufruf `flug`, AeroDataBox, 1 Std. gemerkt; sonst geschätzt).
- **Zielführung im Vollbild:** unten Uhrzeit · Abfahrt · Ankunft · Rest.
- **Entfernt:** Offline-Navi über Organic Maps / OsmAnd (Einstellungen und Knopf „Offline-Navi“).
- Android-Teil (Zweig `navi-nativ`): `Extras.java` (Brücke `FVNative.extra(befehl, json)`), `Mitteiler.java`, `Post.java`, `Ais.java`; Manifest: READ_CONTACTS, READ_CALL_LOG, CALL_PHONE, Dienst `Mitteiler`, Sichtbarkeit Spotify/WhatsApp.
- Server (`warenwirtschaft.php`): `flug`, Flugtafel mit Rufzeichen/Flugzeug/beiden Zeiten, aisstream-Schlüssel in Verwaltung → App.
- Test: `test/test_44.py` (Browser, Android-Teil nachgebildet).

## Neu in 4.3.0: Navigation für Zug, Bus, Schiff, Flug und Gesamtstrecke
- Bei jeder Verbindung „Start“ / „Navigation starten“ (Zug, Bus, Schiff, Flugzeug, Gesamtstrecke). Die Reise läuft Abschnitt für Abschnitt:
  Auto/Rad/zu Fuß mit echter Zielführung bis Bahnhof/Hafen/Flughafen, Bus/Bahn/Schiff auf der Linie (GPS, sonst Fahrplan),
  Flug nach Flugplan; „Einsteigen“ und rechtzeitig „Aussteigen“ als Ansage, danach automatisch der nächste Abschnitt.
- Reise-Leiste oben in der Zielführung (‹ › zum Springen, antippen = alle Abschnitte). Fahrtenbuch zählt nur die Auto-Abschnitte.
- `fuehrung.js`: Routen mit `oev: true` werden nicht neu berechnet, Fortschritt nach `zeitAb`/`zeitAn`, `nurZeit` für Flüge.
- Test: `test/test_reise.py`.

## Neu in 4.2.1: Satelliten-Knopf auf der Karte
- Kleiner Knopf unten links auf jeder Karte: verbundene (für den Standort genutzte) / gesehene Satelliten, Farbe nach Güte; antippen → Einzelheiten je System (GPS, Galileo, GLONASS, BeiDou …), Signalstärke, Genauigkeit.
- Dafür gibt es erstmals eine Änderung im Android-Teil: Zweig `navi-nativ` (Klasse `Satelliten.java` als `classes2.dex`, Methode `satelliten()` in `MainActivity$Bruecke`). Der Auftrag dort baut die unsignierte Grund-APK (Release `navi-nativ`) und testet sie im Emulator (Release `navi-nativ-test`).
- Bauen ab 4.2.1: `bauen.py Navi-nativ-unsigniert.apk www …` (statt der alten 3.9.3/4.1.1-APK).

## Neu in 4.2.0
- Neuer Knopf **Suche** in der Leiste unten: Ziel suchen (weltweit), **Favoriten** (Stern ☆ bei Ziel, Flughafen, Bahnhof, Haltestelle, Anleger; umbenennen, sortieren, löschen), **Letzte Ziele** (jede berechnete Route, mit Löschen).
- **Abfahrten und Ankünfte an jedem Ort**: Flughafen (eingebaute Liste aller Linienflughäfen weltweit, `www/js/flughaefen.js` aus OurAirports), Bahnhof, Bus, Schiff (Bahn-Fahrplan `SCHIFFE`, sonst Anleger aus OpenStreetMap mit Reederei-Link und Linien).
- Karte: **Bahnstrecken** und **Schiffs-/Fährstrecken** aus den Kartendaten (alle Quellen, auch offline), **Flugstrecken** (echte Flüge aus der Flugtafel, Seite „Flugstrecken“), **Flugzeuge live** (adsb.lol, sonst OpenSky; Strecke über adsb.lol routeset / adsbdb). Schalter in Ebenen, Zielführung und Einstellungen.
- **Tag-/Nachtdesign** (`www/js/design.js`): Automatisch nach Sonnenstand, Tag, Nacht – App (`html.hell` in app.css) und Karte (Farbtafeln in karte.js, Umschalten ohne Neuaufbau).
- Offline-**Weltkarte** `welt.pmtiles` / `welt-teil-NN` (Zweig `karte-welt`, Release `karte-welt`, aus dem OpenFreeMap-Planet bis Zoom 10, ca. 4 GB). Liegt unter den Länderkarten.
- Test: `test/test_42.py` (Karte mit Bahn/Fähre: `test/testkarte_strecken.py`).

## Neu in 4.1.1: mehrere Länder offline
- Einstellungen → Offline-Karten: je Land ein eigener Knopf (Deutschland, Spanien + Portugal). Es lädt immer nur eine Karte gleichzeitig.
- Spanien + Portugal: `spanien-portugal.pmtiles` oder die Teile `spanien-portugal-teil-00`, `-01`, … im selben Ordner `karten`.
  Gebaut vom Auftrag `.github/workflows/karte-spanien.yml` (Zweig `karte-spanien`), Download als Release `karte-spanien-portugal`.
- Jede weitere Karte bekommt im Kartenstil eine eigene Quelle (`openmaptiles_es`), ihre Ebenen liegen direkt hinter denen der ersten.
- Neue Länder: Eintrag in `KARTEN` in `www/js/offline.js`.

## Neu in 3.9.4: Offline-Karte vom eigenen Server
- Einstellungen → Offline-Karten → **„Offline-Karte laden“**
- Lädt `deutschland.pmtiles` oder die Teile `teil-00`, `teil-01`, … aus `https://www.fehnverleih.de/karten/`
  (zweiter Versuch: `/fehnverleih/karten/`) in den App-Speicher. Fortsetzen nach Abbruch, Anhalten, Löschen.
- Danach liest die Karte die Kacheln aus der Datei (`js/offline.js`, Protokoll `fvkarte://`), auch ohne Internet.
- Auf dem Server muss im Ordner `karten` die Datei `.htaccess` aus `server-karten/htaccess` liegen.

## Bauen
    python3 werkzeuge/bauen.py Fehnverleih-Navi-3.9.3.apk www fehnverleih-app.jks <PASSWORT> fehnverleih Fehnverleih-Navi-3.9.5.apk 3.9.5 396
    python3 werkzeuge/pruefen.py Fehnverleih-Navi-3.9.5.apk

Der Schlüssel `fehnverleih-app.jks` und sein Passwort gehören **nie** in dieses (öffentliche) Repository.

## Tests
    python3 test/pmtiles_schreiben.py a.pmtiles 7 40 && node test/leser_test.mjs www/js/offline.js a.pmtiles
    node test/download_test.mjs www/js/offline.js a.pmtiles
    # Browser-Gesamttest (Playwright): siehe Kopf von test/browsertest.py
