"""Browsertest für Navi 4.4: Startseite (Rahmen, Favoriten/Telefon/Spotify/Nachrichten/Verkehrsfunk), Telefon, Nachrichten
(WhatsApp-Einblendung, Antworten, E-Mail), Musik, Verkehrsfunk, Karte (Online/Offline, Gelände, Züge und Schiffe live),
Routenwahl (schnellste/sparsame/kürzeste), schienengenaue Bahnstrecke, Flug aus der Tafel antippen, Vollbild mit Zeiten.
Der Android-Teil wird über FV_TEST.extra nachgebildet, Internetdienste über nachgestellte Antworten.
Aufruf: test_45.py http://localhost:8644 http://localhost:8645/karten/ bilderordner"""
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
    {'trips': [{'tripId': 'ice1', 'displayName': 'ICE 141'}], 'mode': 'HIGHSPEED_RAIL', 'distance': 30000, 'from': {'name': 'Leer', 'lat': 53.25, 'lon': 7.30}, 'to': {'name': 'Oldenburg', 'lat': 53.15, 'lon': 7.75},
     'departure': iso(-600), 'arrival': iso(900), 'scheduledDeparture': iso(-600), 'scheduledArrival': iso(900), 'realTime': True, 'polyline': enc(linie((53.25, 7.30), (53.15, 7.75), 10), 1e5)},
    {'trips': [{'tripId': 'flix1', 'displayName': 'FlixBus N802'}], 'mode': 'COACH', 'distance': 30000, 'from': {'name': 'Emden', 'lat': 53.40, 'lon': 7.10}, 'to': {'name': 'Bremen', 'lat': 53.30, 'lon': 7.60},
     'departure': iso(-900), 'arrival': iso(900), 'scheduledDeparture': iso(-2700), 'scheduledArrival': iso(-900), 'realTime': True, 'polyline': enc(linie((53.40, 7.10), (53.30, 7.60), 10), 1e5)},
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
    def antwort(r, daten):
        return r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps(daten))
    def weiter(r):
        u = r.request.url
        if u.startswith('https://valhalla1.openstreetmap.de/route'): return antwort(r, SCHNELL)
        if u.startswith('https://valhalla1.openstreetmap.de/'): return antwort(r, {'edges': []})
        if u.startswith('https://api.transitous.org/api/v6/map/trips'): return antwort(r, ZUEGE)
        if u.startswith('http://localhost') or u.startswith('blob:') or u.startswith('data:'): return r.continue_()
        return r.abort()
    ctx.route('**/*', weiter)
    p = ctx.new_page()
    p.on('pageerror', lambda e: fehler.append('Seitenfehler: ' + str(e)))
    p.add_init_script("""window.FV_TEST = { extra: function (b, d) {
        if (b === 'aisStand' || b === 'aisStart') return { ok: true, zustand: 'verbunden', fehler: '', nachrichten: 5, schiffe: [
          [211234560, 53.33, 7.15, 12.4, 305, 300, 'OSTFRIESLAND', 'DFOS', 60, 'BORKUM', 0, 78, 13, '9330733', 3.2, '', Date.now(), 0],
          [244000111, 53.36, 7.05, 0.1, null, null, 'NOORDERLICHT', '', 37, '', 5, 15, 4, '', 0, '', Date.now(), 1],
          [244000222, 53.29, 7.22, 8.0, 120, null, '@@@@@@@@', '', 70, 'EMDEN@@@', 0, 120, 18, '', 0, '', Date.now(), 0],
          [211000333, 53.31, 7.30, 0, null, 40, 'TANKER EMS', '', 80, '', 1, 90, 15, '', 0, '', Date.now(), 0],
          [211000444, 53.325, 7.33, 5, 200, null, 'WINDSBRAUT', '', 36, '', 8, 12, 4, '', 0, '', Date.now(), 1] ] };
        if (b === 'zugriff') return { mitteilungen: true }; if (b === 'nachrichten') return { ok: true, bis: 0, liste: [] };
        return { ok: true }; } };""")
    p.goto(APP + '/index.html'); p.wait_for_timeout(700)
    p.click('[data-tun=demo]'); p.wait_for_timeout(900)
    p.evaluate("FV.B._simOrt({lat: 53.135, lon: 7.62, genau: 10, tempo: 0, kurs: 0, zeit: Date.now()})")
    p.evaluate("FV.app.e.design = 'nacht'; FV.D.anwenden(); FV.app.e.aisSchluessel = 'x'")
    p.click('[data-tun=uebersicht]'); p.wait_for_timeout(1500)
    p.evaluate("FV.K.map.jumpTo({center:[7.35,53.30], zoom: 9.8})"); p.wait_for_timeout(6000)
    info = p.evaluate("FV.K.map.querySourceFeatures('live').map(f => f.properties.bild + ' | ' + f.properties.name + ' | ' + f.properties.hatKurs)")
    print('\n'.join(sorted(set(info))))
    alle = ' '.join(info)
    for w in ['fz-schiff-faehre', 'fz-schiff-fracht', 'fz-schiff-tanker', 'fz-schiff-klein', 'fz-bus', 'fz-zug']:
        if w not in alle: fehler.append(w + ' fehlt')
    if '@' in alle: fehler.append('@ im Namen')
    if not p.evaluate("FV.K.map.hasImage(FV.K.map.querySourceFeatures('live')[0].properties.bild)"): fehler.append('Bild fehlt in der Karte')
    schirm(p, '30-symbole-nacht')
    p.evaluate("(() => { var f = FV.K.map.querySourceFeatures('live').filter(x => x.properties.name.indexOf('ICE') === 0)[0]; FV.K.map.jumpTo({center: f.geometry.coordinates, zoom: 13}); })()"); p.wait_for_timeout(2500); schirm(p, '31-symbole-nah')
    p.evaluate("FV.app.e.design = 'tag'; FV.D.anwenden()"); p.wait_for_timeout(2500); schirm(p, '32-symbole-tag')
    p.evaluate("FV.app.e.design = 'nacht'; FV.D.anwenden()")
    # Transporter
    for name, soll in (('Dacia Spring', 'auto'), ('Transporter', 'transporter')):
        p.evaluate("n => { FV.app.e.fahrzeugName = n; FV.app.e.kmArt = ''; }", name)
        p.evaluate("FV.app.zeige('vorschau', { ziel: { name: 'Testziel', adresse: 'Teststr 1', lat: %f, lon: %f, art: 'frei' }, modus: 'auto' })" % ZIEL); p.wait_for_timeout(2500)
        p.click('#vfuss [data-tun=route-start]'); p.wait_for_timeout(1500)
        for i in range(4):
            p.evaluate("i => FV.B._simOrt({lat: 53.136 + i*0.0003, lon: 7.621, genau: 8, tempo: 12, kurs: 10, zeit: Date.now()})", i); p.wait_for_timeout(700)
        svg = p.evaluate("(document.querySelector('.m-auto svg') || {}).outerHTML || ''")
        ist = 'transporter' if 'viewBox="0 0 44 66"' in svg else 'auto' if 'viewBox="0 0 44 60"' in svg else '?'
        print(name, '->', ist)
        if ist != soll: fehler.append(name + ': falsches Fahrzeugsymbol ' + ist)
        p.evaluate("FV.app.zoom = 1; FV.K.map.easeTo({zoom: 17.5, duration: 0})"); p.wait_for_timeout(1500)
        schirm(p, '33-fahrzeug-' + soll)
        p.evaluate("FV.F.stopp(); FV.app.z.lauf = null; FV.app.zeige('auftraege', {}, 'reiter')"); p.wait_for_timeout(400)
    br.close()
print('\n'.join(fehler) if fehler else 'Keine Fehler.')
sys.exit(1 if fehler else 0)
