"""Browsertest für Navi 4.4: Startseite (Rahmen, Favoriten/Telefon/Spotify/Nachrichten/Verkehrsfunk), Telefon, Nachrichten
(WhatsApp-Einblendung, Antworten, E-Mail), Musik, Verkehrsfunk, Karte (Online/Offline, Gelände, Züge und Schiffe live),
Routenwahl (schnellste/sparsame/kürzeste), schienengenaue Bahnstrecke, Flug aus der Tafel antippen, Vollbild mit Zeiten.
Der Android-Teil wird über FV_TEST.extra nachgebildet, Internetdienste über nachgestellte Antworten.
Aufruf: test_44.py http://localhost:8644 http://localhost:8645/karten/ bilderordner"""
import sys, json, time, datetime
from playwright.sync_api import sync_playwright
APP, KARTEN, BILDER = sys.argv[1:4]
fehler = []

def enc(punkte, f=1e6):
    """Google-Polylinie (lat, lon)"""
    out, la0, lo0 = [], 0, 0
    for lat, lon in punkte:
        la, lo = int(round(lat * f)), int(round(lon * f))
        for d in (la - la0, lo - lo0):
            v = ~(d << 1) if d < 0 else (d << 1)
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1f)) + 63)); v >>= 5
            out.append(chr(v + 63))
        la0, lo0 = la, lo
    return ''.join(out)

def linie(a, b, n=20, bogen=0.0):
    return [(a[0] + (b[0] - a[0]) * i / n + bogen * (i * (n - i)) / (n * n), a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)]

START = (53.135, 7.62); ZIEL = (53.17, 7.64)
def trip(punkte, sek, meter):
    schritt = len(punkte) - 1
    return {'trip': {'summary': {'length': meter / 1000, 'time': sek}, 'legs': [{'shape': enc(punkte), 'maneuvers': [
        {'type': 1, 'instruction': 'Losfahren', 'begin_shape_index': 0, 'end_shape_index': schritt // 2, 'length': meter / 2000, 'time': sek / 2, 'street_names': ['Hauptstraße']},
        {'type': 10, 'instruction': 'Rechts abbiegen', 'begin_shape_index': schritt // 2, 'end_shape_index': schritt, 'length': meter / 2000, 'time': sek / 2},
        {'type': 4, 'instruction': 'Ziel erreicht', 'begin_shape_index': schritt, 'end_shape_index': schritt, 'length': 0, 'time': 0}]}]}}
SCHNELL = trip(linie(START, ZIEL, 20, 0.04), 600, 9800)      # Umweg über die Bundesstraße, schnell
SPAR = trip(linie(START, ZIEL, 20, 0.02), 660, 7600)
KURZ = trip(linie(START, ZIEL, 20, 0.0), 780, 5200)

jetzt = datetime.datetime.now(datetime.timezone.utc)
def iso(sek): return (jetzt + datetime.timedelta(seconds=sek)).strftime('%Y-%m-%dT%H:%M:%SZ')
ZUEGE = [
    {'trips': [{'tripId': 'zug1', 'displayName': 'RE 1'}], 'mode': 'REGIONAL_RAIL', 'distance': 20000, 'from': {'name': 'Leer', 'lat': 53.229, 'lon': 7.452}, 'to': {'name': 'Emden', 'lat': 53.37, 'lon': 7.207},
     'departure': iso(-300), 'arrival': iso(600), 'scheduledDeparture': iso(-420), 'scheduledArrival': iso(480), 'realTime': True, 'polyline': enc(linie((53.229, 7.452), (53.37, 7.207), 10), 1e5)},
    {'trips': [{'tripId': 'faehre1', 'displayName': 'Fähre Borkum'}], 'mode': 'FERRY', 'distance': 30000, 'from': {'name': 'Emden', 'lat': 53.34, 'lon': 7.19}, 'to': {'name': 'Borkum', 'lat': 53.56, 'lon': 6.75},
     'departure': iso(-1200), 'arrival': iso(3000), 'scheduledDeparture': iso(-1200), 'scheduledArrival': iso(3000), 'realTime': False, 'polyline': enc(linie((53.34, 7.19), (53.56, 6.75), 10), 1e5)}]
PLAN = {'itineraries': [{'legs': [{'mode': 'REGIONAL_RAIL', 'displayName': 'RE 1', 'scheduledStartTime': iso(3600), 'startTime': iso(3600),
         'legGeometry': {'points': enc([(53.229, 7.452), (53.25, 7.43), (53.28, 7.38), (53.31, 7.33), (53.34, 7.26), (53.37, 7.207)], 1e6), 'precision': 6, 'length': 6}}]}]}
ADSB = {'ac': [{'hex': '4868f8', 'flight': 'KLM50K  ', 'r': 'PH-AXR', 't': 'A21N', 'lat': 53.2, 'lon': 7.9, 'alt_baro': 34975, 'gs': 383, 'track': 232, 'squawk': '3516'}]}
AUTOBAHN = {'warning': [{'identifier': 'w1', 'title': 'A28 | Leer-Nord - Filsum', 'subtitle': 'Leer -> Oldenburg', 'description': ['Stau', 'Länge: 3 km'], 'delayTimeValue': '12',
             'coordinate': {'lat': '53.24', 'long': '7.55'}, 'isBlocked': 'false', 'future': False, 'abnormalTrafficType': 'STATIONARY_TRAFFIC'}]}
OVERPASS = {'elements': [{'type': 'way', 'id': 1, 'tags': {'ref': 'A 28', 'highway': 'motorway'}}, {'type': 'way', 'id': 2, 'tags': {'ref': 'A 31', 'highway': 'motorway'}}]}

def schirm(p, name): p.screenshot(path=BILDER + '/' + name + '.png')

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
    zaehler = {'valhalla': 0, 'trips': 0, 'plan': 0}
    def antwort(r, daten, code=200):
        return r.fulfill(status=code, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json'}, body=json.dumps(daten))
    def weiter(r):
        u = r.request.url
        if r.request.method == 'OPTIONS' and not u.startswith('http://localhost'):
            return r.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST'})
        if u.startswith('https://valhalla1.openstreetmap.de/route'):
            zaehler['valhalla'] += 1
            b = json.loads(r.request.post_data or '{}'); co = (b.get('costing_options') or {}).get('auto') or {}
            return antwort(r, KURZ if co.get('shortest') else SPAR if co.get('top_speed') else SCHNELL)
        if u.startswith('https://valhalla1.openstreetmap.de/'): return antwort(r, {'edges': []})
        if u.startswith('https://api.transitous.org/api/v6/map/trips'): zaehler['trips'] += 1; return antwort(r, ZUEGE)
        if u.startswith('https://api.transitous.org/api/v6/plan'): zaehler['plan'] += 1; return antwort(r, PLAN)
        if u.startswith('https://api.transitous.org/api/v6/trip'):
            return antwort(r, {'legs': [{'mode': 'REGIONAL_RAIL', 'headsign': 'Emden Außenhafen', 'agencyName': 'Westfalenbahn', 'from': {'name': 'Leer', 'departure': iso(-300), 'scheduledDeparture': iso(-420), 'track': '3'},
                'to': {'name': 'Emden Hbf', 'arrival': iso(600), 'scheduledArrival': iso(480)}, 'intermediateStops': [{'name': 'Neermoor', 'arrival': iso(60), 'scheduledArrival': iso(-60)}]}]})
        if u.startswith('https://api.adsb.lol/'): return antwort(r, ADSB)
        if u.startswith('https://verkehr.autobahn.de/o/autobahn/A28/services/warning'): return antwort(r, AUTOBAHN)
        if u.startswith('https://verkehr.autobahn.de/'): return antwort(r, {'warning': [], 'closure': [], 'roadworks': []})
        if 'overpass' in u or 'kumi.systems' in u or 'private.coffee' in u: return antwort(r, OVERPASS)
        if 'radio-browser.info' in u: return antwort(r, [{'name': 'NDR 1 Niedersachsen', 'url_resolved': 'https://example.invalid/ndr1.mp3'}])
        if u.startswith('http://localhost') or u.startswith('blob:') or u.startswith('data:'): return r.continue_()
        return r.abort()
    ctx.route('**/*', weiter)
    p = ctx.new_page()
    p.on('pageerror', lambda e: fehler.append('Seitenfehler: ' + str(e)))
    p.on('console', lambda m: fehler.append('Konsole: ' + m.text) if m.type == 'error' and 'net::' not in m.text and 'Failed to fetch' not in m.text and 'Failed to load resource' not in m.text and 'AJAXError' not in m.text else None)
    # Android-Teil nachbilden
    p.add_init_script("""
      window.FV_TEST = { aufrufe: [], nachr: [], mailLaeuft: 0, medienSpielt: true,
        extra: function (b, d) {
          FV_TEST.aufrufe.push(b);
          if (b === 'rechteStand' || b === 'rechte') return { READ_CONTACTS: true, READ_CALL_LOG: true, CALL_PHONE: true };
          if (b === 'kontakte') return { ok: true, liste: [ { n: 'Anna Ahrens', t: '0171 2223334', art: 'Mobil', s: true }, { n: 'Bernd Buss', t: '04952 445566', art: 'Arbeit', s: false }, { n: 'Lager Fehnverleih', t: '04952 1111', art: 'Arbeit', s: true } ] };
          if (b === 'anrufliste') return { ok: true, liste: [ { t: '04952445566', n: 'Bernd Buss', art: 'verpasst', zeit: Date.now() - 600000, dauer: 0 }, { t: '01712223334', n: 'Anna Ahrens', art: 'aus', zeit: Date.now() - 7200000, dauer: 95 } ] };
          if (b === 'anrufen') { FV_TEST.angerufen = d.tel; return { ok: true, direkt: true }; }
          if (b === 'zugriff') return { mitteilungen: true, verbunden: true };
          if (b === 'nachrichten') { var l = FV_TEST.nachr.filter(function (n) { return n.id > d.seit; }); return { ok: true, bis: FV_TEST.nachr.length, liste: l }; }
          if (b === 'nachrichtAntworten') { FV_TEST.antwort = d; return { ok: true }; }
          if (b === 'medien') return { aktiv: true, app: 'com.spotify.music', spielt: FV_TEST.medienSpielt, titel: 'Atemlos', kuenstler: 'Testband', zugriff: true, spotify: true };
          if (b === 'medienTaste') { FV_TEST.taste = d.taste; FV_TEST.medienSpielt = !FV_TEST.medienSpielt; return { ok: true }; }
          if (b === 'appDa' || b === 'appOeffnen') return { ok: true };
          if (b === 'mailAbruf') { FV_TEST.mailDaten = d; FV_TEST.mailLaeuft = 1; return { ok: true, laeuft: true, auftrag: 7 }; }
          if (b === 'mailStand') {
            if (FV_TEST.mailLaeuft) { FV_TEST.mailLaeuft = 0; return { ok: true, laeuft: true, auftrag: 7 }; }
            if (FV_TEST.mailDaten && FV_TEST.mailDaten.uid) return { ok: true, laeuft: false, auftrag: 7, mail: { uid: 12, von: '"Stadt Leer" <info@leer.de>', betreff: 'Genehmigung Zelt', datum: 'Fri, 16 Oct 2026 18:00:00 +0200', text: 'Hallo,\\nanbei die Genehmigung für das Zelt.\\nGruß', anhaenge: ['genehmigung.pdf'] } };
            return { ok: true, laeuft: false, auftrag: 7, anzahl: 2, liste: [ { uid: 12, gelesen: false, von: '"Stadt Leer" <info@leer.de>', betreff: 'Genehmigung Zelt', datum: 'Fri, 16 Oct 2026 18:00:00 +0200' }, { uid: 11, gelesen: true, von: 'kunde@example.de', betreff: 'Anfrage Hüpfburg', datum: 'Thu, 15 Oct 2026 09:12:00 +0200' } ] };
          }
          if (b === 'aisStart') return { ok: true, zustand: 'verbunden', schiffe: [] };
          if (b === 'aisStand') return { ok: true, zustand: 'verbunden', fehler: '', nachrichten: 120, schiffe: [ [211234560, 53.33, 7.15, 12.4, 305, 300, 'OSTFRIESLAND', 'DFOS', 60, 'BORKUM', 0, 78, 13, '9330733', 3.2, '16.10. 22:30', Date.now() - 30000, 0], [244000111, 53.36, 7.05, 0.1, null, null, 'NOORDERLICHT', '', 37, '', 5, 15, 4, '', 0, '', Date.now() - 120000, 1] ] };
          return { ok: true };
        } };
    """)
    p.goto(APP + '/index.html'); p.wait_for_timeout(700)
    p.evaluate("u => { FV.O.QUELLEN.length = 0; FV.O.QUELLEN.push(u); }", KARTEN)
    p.click('[data-tun=demo]'); p.wait_for_timeout(900)
    p.evaluate("FV.B._simOrt({lat: 53.135, lon: 7.62, genau: 10, tempo: 0, kurs: 0, zeit: Date.now()})")
    p.evaluate("FV.app.e.design = 'nacht'; FV.D.anwenden()"); p.wait_for_timeout(300)

    # ---------- Startseite ----------
    schirm(p, '01-start')
    t = p.inner_text('.minikacheln')
    print('Startknöpfe:', t.replace('\n', ' | '))
    for w in ['Favoriten', 'Telefon', 'Spotify', 'Nachrichten', 'Verkehrsfunk']:
        if w not in t: fehler.append('Startseite: ' + w + ' fehlt')
    rand = p.evaluate("getComputedStyle(document.querySelector('#bannerbild')).borderTopWidth + ' ' + getComputedStyle(document.querySelector('#bannerbild')).borderTopColor")
    print('Rahmen Bild:', rand)
    if not rand.startswith('2px') or 'rgb(0, 0, 0)' not in rand: fehler.append('Rahmen um das Bild fehlt')
    p.click('[data-tun=favoriten-blatt]'); p.wait_for_timeout(300); schirm(p, '02-favoriten'); p.click('#blatt [data-tun=blatt-zu]')

    # ---------- Telefon ----------
    p.click('.minikachel[data-tun=telefon]'); p.wait_for_timeout(400)
    schirm(p, '03-telefon-anrufe')
    if 'Bernd Buss' not in p.inner_text('#telliste'): fehler.append('Anrufliste fehlt')
    p.click('[data-tun=tel-tab][data-t=kontakte]'); p.wait_for_timeout(300)
    p.fill('#telsuche', 'anna'); p.wait_for_timeout(200)
    k = p.inner_text('#kliste'); print('Kontaktsuche:', k.replace('\n', ' | ')[:120])
    if 'Anna Ahrens' not in k or 'Bernd' in k: fehler.append('Kontaktsuche falsch')
    p.click('#kliste [data-tun=tel-ruf]'); p.wait_for_timeout(200); p.click('[data-tun=frage][data-a="1"]'); p.wait_for_timeout(200)
    if p.evaluate("FV_TEST.angerufen") != '0171 2223334': fehler.append('Anruf nicht ausgelöst')
    p.click('[data-tun=tel-suche-leer]'); p.wait_for_timeout(200)
    schirm(p, '04-telefon-kontakte')
    p.click('[data-tun=tel-tab][data-t=waehlen]'); p.wait_for_timeout(200)
    for z in '0495':
        p.click('[data-tun=w-taste][data-k="%s"]' % z)
    schirm(p, '05-telefon-waehlen')
    p.click('[data-tun=tel-tab][data-t=kunden]'); p.wait_for_timeout(200)
    if 'Familie Meyer' not in p.inner_text('#telliste'): fehler.append('Kunden heute fehlen')

    # ---------- Karte: Online/Offline-Knopf ohne Offline-Karte ----------
    p.evaluate("FV.app.zurueck()"); p.wait_for_timeout(300)

    # ---------- Offline-Karte laden (eigene Testkarte) ----------
    p.evaluate("FV.app.zeige('einstellungen', {}, 'reiter')"); p.wait_for_timeout(300)
    eins = p.inner_text('#seite')
    if 'Organic Maps' in eins or 'OsmAnd' in eins: fehler.append('Organic Maps / OsmAnd steht noch in den Einstellungen')
    if 'Schiffe live' not in eins or 'E-Mail-Konto' not in eins: fehler.append('Neue Einstellungen fehlen')
    p.evaluate("document.querySelector('#offblock').scrollIntoView()"); schirm(p, '06-einstellungen-offline')
    p.click('[data-tun=karte-laden][data-k=de]')
    p.wait_for_selector('text=ist geladen', timeout=60000)
    p.click('text=Jetzt neu starten'); p.wait_for_timeout(1200)
    p.click('[data-tun=demo]'); p.wait_for_timeout(700)
    p.evaluate("FV.B._simOrt({lat: 53.135, lon: 7.62, genau: 10, tempo: 0, kurs: 0, zeit: Date.now()})")
    p.evaluate("FV.app.e.design = 'nacht'; FV.D.anwenden()")

    # ---------- Karte: Züge und Schiffe live ----------
    p.evaluate("FV.app.e.aisSchluessel = 'testschluessel'")
    p.click('[data-tun=uebersicht]'); p.wait_for_timeout(1500)
    p.evaluate("FV.K.map.jumpTo({center:[7.35,53.32], zoom: 9.6})"); p.wait_for_timeout(5500)
    info = p.evaluate("""() => { var f = FV.K.map.querySourceFeatures('live'); return { quelle: FV.K.quelle(), n: f.length, typen: f.map(x => x.properties.typ + ':' + x.properties.name), trips: FV.LIVE.zustand() }; }""")
    print('Live:', json.dumps(info, ensure_ascii=False))
    if info['quelle'] != 'offline': fehler.append('Karte nicht offline nach dem Laden')
    namen = ' '.join(info['typen'])
    if 'RE 1' not in namen: fehler.append('Zug RE 1 fehlt auf der Karte')
    if 'OSTFRIESLAND' not in namen: fehler.append('Schiff OSTFRIESLAND fehlt auf der Karte')
    if 'Fähre Borkum' not in namen: fehler.append('Fähre (Fahrplan) fehlt')
    schirm(p, '07-karte-live')
    # Zug antippen
    p.evaluate("""() => { var f = FV.K.map.querySourceFeatures('live').filter(x => x.properties.name.indexOf('RE 1') === 0)[0]; var pt = FV.K.map.project(f.geometry.coordinates); FV.K.map.fire('click', { point: pt, lngLat: FV.K.map.unproject(pt), originalEvent: {} }); }""")
    p.wait_for_timeout(1200)
    zb = p.inner_text('#blatt') if p.is_visible('#blatt') else ''
    print('Zugblatt:', zb.replace('\n', ' | ')[:220])
    if 'Leer' not in zb or 'Emden' not in zb: fehler.append('Zug-Blatt fehlt')
    if 'Neermoor' not in zb: fehler.append('Halte des Zuges fehlen')
    schirm(p, '08-zug-blatt')
    p.evaluate("FV.app.blattZu()")
    p.evaluate("""() => { var f = FV.K.map.querySourceFeatures('live').filter(x => x.properties.typ === 'schiff')[0]; var pt = FV.K.map.project(f.geometry.coordinates); FV.K.map.fire('click', { point: pt, lngLat: FV.K.map.unproject(pt), originalEvent: {} }); }""")
    p.wait_for_timeout(500)
    sb = p.inner_text('#blatt') if p.is_visible('#blatt') else ''
    print('Schiffblatt:', sb.replace('\n', ' | ')[:240])
    if 'MMSI' not in sb: fehler.append('Schiff-Blatt fehlt')
    schirm(p, '09-schiff-blatt')
    p.evaluate("FV.app.blattZu()")

    # ---------- Online / Offline umschalten, Gelände ----------
    p.click('.kartenwahl [data-tun=karte-quelle]'); p.wait_for_timeout(2500)
    q1 = p.evaluate("[FV.K.quelle(), FV.K.stilArt(), !!FV.K.map.getSource('live'), FV.K.map.querySourceFeatures('live').length]")
    print('Nach Umschalten:', q1)
    if q1[0] != 'online': fehler.append('Umschalten auf online klappt nicht')
    if not q1[2]: fehler.append('Live-Ebene nach Stilwechsel weg')
    schirm(p, '10-karte-online')
    p.click('.kartenwahl [data-tun=karte-quelle]'); p.wait_for_timeout(2500)
    if p.evaluate("FV.K.quelle()") != 'offline': fehler.append('Zurück auf offline klappt nicht')
    p.click('.kartenwahl [data-tun=gelaende]'); p.wait_for_timeout(1500)
    g = p.evaluate("[!!FV.K.map.getLayer('gelaende-schatten'), !!FV.K.map.getTerrain(), Math.round(FV.K.map.getPitch())]")
    print('Gelände:', g)
    if not g[0]: fehler.append('Gelände-Ebene fehlt')
    schirm(p, '11-gelaende')
    p.click('.kartenwahl [data-tun=gelaende]'); p.wait_for_timeout(800)
    if p.evaluate("!!FV.K.map.getLayer('gelaende-schatten')"): fehler.append('Gelände lässt sich nicht ausschalten')

    # ---------- WhatsApp-Einblendung über der Karte ----------
    p.evaluate("FV_TEST.nachr.push({ id: 1, zeit: Date.now(), app: 'com.whatsapp', appName: 'WhatsApp', titel: 'Lager', wer: 'Silke', text: 'Bitte noch 20 Stühle mitnehmen!', antworten: true, oeffnen: true })")
    p.wait_for_timeout(3500)
    if not p.is_visible('#melder'): fehler.append('WhatsApp-Einblendung erscheint nicht')
    schirm(p, '12-whatsapp-einblendung')
    p.click('#melder [data-tun=melder-antworten]'); p.wait_for_timeout(300)
    schirm(p, '13-antworten')
    p.click('[data-tun=n-senden][data-s="1"]'); p.wait_for_timeout(300)
    a = p.evaluate("FV_TEST.antwort"); print('Antwort:', a)
    if not a or 'Fahre gerade' not in a['text']: fehler.append('Antwort nicht gesendet')
    p.click('.kartenwahl [data-tun=nachrichten]'); p.wait_for_timeout(400)
    schirm(p, '14-nachrichten')
    if 'Bitte noch 20 Stühle' not in p.inner_text('#nliste'): fehler.append('Nachricht nicht in der Liste')
    # E-Mail
    p.click('[data-tun=n-tab][data-t=mail]'); p.wait_for_timeout(300)
    p.fill('#madr', 'fahrer@gmx.de'); p.wait_for_timeout(100)
    if p.input_value('#mserver') != 'imap.gmx.net': fehler.append('GMX nicht erkannt')
    p.fill('#mpass', 'geheim')
    schirm(p, '15-mail-konto')
    p.click('form[data-form=mail-speichern] button.gold'); p.wait_for_timeout(2000)
    ml = p.inner_text('#nliste'); print('Mail:', ml.replace('\n', ' | ')[:200])
    if 'Genehmigung Zelt' not in ml: fehler.append('E-Mail-Liste fehlt')
    schirm(p, '16-mail-liste')
    p.click('[data-tun=mail-auf][data-u="12"]'); p.wait_for_timeout(1800)
    if 'anbei die Genehmigung' not in p.inner_text('#blatt'): fehler.append('E-Mail-Text fehlt')
    schirm(p, '17-mail-text')
    p.evaluate("FV.app.blattZu(); FV.app.zeige('auftraege', {}, 'reiter')"); p.wait_for_timeout(300)

    # ---------- Musik ----------
    p.click('.minikachel[data-tun=musik]'); p.wait_for_timeout(500)
    if 'Atemlos' not in p.inner_text('#blatt'): fehler.append('Musik-Titel fehlt')
    p.click('[data-tun=m-taste][data-k=umschalten]'); p.wait_for_timeout(800)
    if p.evaluate("FV_TEST.taste") != 'umschalten': fehler.append('Musik-Taste geht nicht')
    schirm(p, '18-musik')
    p.evaluate("FV.app.blattZu()")

    # ---------- Verkehrsfunk ----------
    p.click('.minikachel[data-tun=verkehrsfunk]'); p.wait_for_timeout(2500)
    vf = p.inner_text('#vfliste'); print('Verkehrsfunk:', vf.replace('\n', ' | ')[:160])
    if 'A 28' not in vf: fehler.append('Verkehrsmeldung A 28 fehlt')
    schirm(p, '19-verkehrsfunk')
    p.click('[data-tun=vf-vorlesen]'); p.wait_for_timeout(200)
    gs = p.evaluate("FV.B.gesprochen.slice(-1)[0] || ''"); print('Vorgelesen:', gs[:120])
    if 'Verkehrsfunk' not in gs: fehler.append('Verkehrsfunk nicht vorgelesen')
    p.evaluate("FV.app.zurueck()"); p.wait_for_timeout(300)

    # ---------- Route: schnellste / sparsame / kürzeste ----------
    p.evaluate("FV.app.zeige('vorschau', { ziel: { name: 'Testziel', adresse: 'Teststraße 1, Rhauderfehn', lat: %f, lon: %f, art: 'frei' }, modus: 'auto' })" % ZIEL)
    p.wait_for_timeout(3500)
    aw = p.inner_text('#artwahl'); print('Routenwahl:', aw.replace('\n', ' | '))
    for w in ['Schnellste', 'Sparsam', 'Kürzeste']:
        if w not in aw: fehler.append('Routenwahl: ' + w + ' fehlt')
    l1 = p.evaluate("FV.app.z.nav.route.laenge")
    schirm(p, '20-routenwahl')
    p.click('[data-tun=route-art][data-k=kurz]'); p.wait_for_timeout(800)
    l2 = p.evaluate("[FV.app.z.nav.route.laenge, FV.app.z.nav.route.art, FV.app.e.routenArt]")
    print('Länge schnell/kurz:', l1, l2)
    if not (l2[0] < l1 and l2[1] == 'kurz'): fehler.append('Kürzeste Route nicht übernommen')
    schirm(p, '21-routenwahl-kurz')
    p.click('[data-tun=route-art][data-k=schnell]'); p.wait_for_timeout(500)

    # ---------- Zielführung im Vollbild: Uhrzeit, Abfahrt, Ankunft ----------
    p.click('#vfuss [data-tun=route-start]'); p.wait_for_timeout(2500)
    p.evaluate("FV.B._simOrt({lat: 53.136, lon: 7.621, genau: 8, tempo: 10, kurs: 20, zeit: Date.now()})"); p.wait_for_timeout(1500)
    p.click('[data-tun=fahrt-voll]'); p.wait_for_timeout(1200)
    vz = p.inner_text('#vollzeiten') if p.is_visible('#vollzeiten') else ''
    print('Vollbild-Zeiten:', vz.replace('\n', ' '))
    if 'Abfahrt' not in vz or 'Ankunft' not in vz or '–' == vz.split('\n')[0]: fehler.append('Vollbild-Zeiten fehlen')
    schirm(p, '22-vollbild-zeiten')
    p.click('[data-tun=fahrt-voll]'); p.wait_for_timeout(300)
    p.evaluate("FV.F.stopp(); FV.app.z.lauf = null; FV.app.zeige('auftraege', {}, 'reiter')"); p.wait_for_timeout(400)

    # ---------- Bahnstrecke schienengenau ----------
    r = p.evaluate("""() => { var ab = new Date(Date.now() + 3600000); var f = { legs: [{ art: 'regio', linie: 'RE 1', vonOrt: { lat: 53.229, lon: 7.452 }, nachOrt: { lat: 53.37, lon: 7.207 }, ab: ab, abPlan: ab, punkte: [[7.452, 53.229], [7.207, 53.37]] }] };
        return FV.LIVE.gleise(f).then(function (neu) { return [neu, f.legs[0].punkte.length, !!f.legs[0].schienengenau]; }); }""")
    print('Gleise:', r)
    if not r[0] or r[1] < 5: fehler.append('Bahnstrecke nicht schienengenau')

    # ---------- Flugtafel: Flug antippen ----------
    p.evaluate("FV.SX.flugBlatt(FV.FL.iata('BRE'), false)"); p.wait_for_timeout(1500)
    p.click('#flugtafel [data-tun=flug-info] >> nth=1'); p.wait_for_timeout(2500)
    fd = p.inner_text('#blatt'); print('Flugdetail:', fd.replace('\n', ' | ')[:300])
    for w in ['KL 1778', 'Höhe', 'Geschwindigkeit', 'Kurs', 'Kennung', 'Abflug', 'Ankunft', 'Uhrzeit']:
        if w not in fd: fehler.append('Flugdetail: ' + w + ' fehlt')
    schirm(p, '23-flug-detail')
    p.evaluate("FV.app.blattZu()")
    # Flugzeug auf der Karte antippen: Uhrzeit, Abflug, Ankunft
    p.evaluate("FV.app.e.flugzeuge = true; FV.app.zeige('uebersicht', { tag: FV.app.heute() })"); p.wait_for_timeout(1500)
    p.evaluate("FV.K.map.jumpTo({center:[7.9,53.2], zoom: 8}); FV.FL.live()"); p.wait_for_timeout(2500)
    p.click('.m-flugzeug'); p.wait_for_timeout(2500)
    fz = p.inner_text('#blatt'); print('Flugzeug:', fz.replace('\n', ' | ')[:300])
    for w in ['Uhrzeit jetzt', 'Abflug', 'Ankunft']:
        if w not in fz: fehler.append('Flugzeug-Blatt: ' + w + ' fehlt')
    schirm(p, '24-flugzeug-zeiten')
    print('Aufrufe Android:', sorted(set(p.evaluate("FV_TEST.aufrufe"))))
    print('Zähler:', zaehler)
    br.close()

print('\n'.join(fehler) if fehler else 'Keine Fehler.')
sys.exit(1 if fehler else 0)
