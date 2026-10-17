"""Browsertest für Navi 4.5: kostenlose Parkplätze (Ebene, Liste, Blatt) und eigene Sperrung in der Zielführung
(Knopf → auf die Straße tippen → Schild → sofortige Umleitung; „Straße vor mir“; aufheben).
Aufruf: test_47.py http://localhost:8644 bilderordner"""
import sys, json
from playwright.sync_api import sync_playwright
APP, BILDER = sys.argv[1:3]
fehler = []

def enc(punkte, f=1e6):
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
def linie(a, b, n=40, bogen=0.0):
    return [(a[0] + (b[0] - a[0]) * i / n + bogen * (i * (n - i)) / (n * n), a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)]
START = (53.135, 7.62); ZIEL = (53.17, 7.64)
def trip(punkte, sek, meter, strasse):
    s = len(punkte) - 1
    return {'trip': {'summary': {'length': meter / 1000, 'time': sek}, 'legs': [{'shape': enc(punkte), 'maneuvers': [
        {'type': 1, 'instruction': 'Losfahren', 'begin_shape_index': 0, 'end_shape_index': s // 2, 'length': meter / 2000, 'time': sek / 2, 'street_names': [strasse]},
        {'type': 10, 'instruction': 'Rechts abbiegen', 'begin_shape_index': s // 2, 'end_shape_index': s, 'length': meter / 2000, 'time': sek / 2, 'street_names': ['Zielweg']},
        {'type': 4, 'instruction': 'Ziel erreicht', 'begin_shape_index': s, 'end_shape_index': s, 'length': 0, 'time': 0}]}]}}
DIREKT = trip(linie(START, ZIEL), 400, 4200, 'Hauptstraße')
UMWEG = trip(linie(START, ZIEL, 40, 0.03), 520, 5600, 'Umgehungsstraße')

def flaeche_trifft(polys, punkte):
    for poly in polys:
        xs = [q[0] for q in poly]; ys = [q[1] for q in poly]
        for lat, lon in punkte:
            if min(xs) <= lon <= max(xs) and min(ys) <= lat <= max(ys): return True
    # auch Strecken zwischen den Punkten grob prüfen (fein unterteilen)
    for poly in polys:
        xs = [q[0] for q in poly]; ys = [q[1] for q in poly]
        for (a, b) in zip(punkte, punkte[1:]):
            for k in range(1, 20):
                lat = a[0] + (b[0] - a[0]) * k / 20; lon = a[1] + (b[1] - a[1]) * k / 20
                if min(xs) <= lon <= max(xs) and min(ys) <= lat <= max(ys): return True
    return False

PARK = {'elements': [
    {'type': 'node', 'id': 11, 'lat': 53.1365, 'lon': 7.6215, 'tags': {'amenity': 'parking', 'fee': 'no', 'name': 'Marktplatz', 'capacity': '80', 'maxstay': '2 h', 'parking_disc': 'yes'}},
    {'type': 'way', 'id': 12, 'center': {'lat': 53.1340, 'lon': 7.6240}, 'tags': {'amenity': 'parking', 'fee': 'no', 'parking': 'multi-storey', 'maxheight': '2.1'}},
    {'type': 'node', 'id': 13, 'lat': 53.1690, 'lon': 7.6395, 'tags': {'amenity': 'parking', 'fee': 'no', 'hgv': 'yes', 'capacity': '20'}},
]}
anfragen = {'route': [], 'overpass': 0, 'locate': 0}

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
    def antwort(r, daten): return r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps(daten))
    def weiter(r):
        u = r.request.url
        if u.startswith('https://valhalla1.openstreetmap.de/route'):
            b = json.loads(r.request.post_data or '{}'); polys = b.get('exclude_polygons') or []
            anfragen['route'].append(len(polys))
            return antwort(r, UMWEG if polys and flaeche_trifft(polys, linie(START, ZIEL)) else DIREKT)
        if u.startswith('https://valhalla1.openstreetmap.de/locate'):
            anfragen['locate'] += 1
            b = json.loads(r.request.post_data); l = b['locations'][0]
            return antwort(r, [{'edges': [{'correlated_lat': l['lat'] + 0.00005, 'correlated_lon': l['lon'], 'way_id': 1}]}])
        if u.startswith('https://valhalla1.openstreetmap.de/'): return antwort(r, {'edges': []})
        if 'interpreter' in u:
            q = r.request.post_data or u
            if 'parking' in q and 'fee' in q: anfragen['overpass'] += 1; return antwort(r, PARK)
            return antwort(r, {'elements': []})
        if u.startswith('http://localhost') or u.startswith('blob:') or u.startswith('data:'): return r.continue_()
        return r.abort()
    ctx.route('**/*', weiter)
    p = ctx.new_page()
    p.on('pageerror', lambda e: fehler.append('Seitenfehler: ' + str(e)))
    p.add_init_script("window.FV_TEST = { extra: function () { return { ok: true }; } };")
    p.goto(APP + '/index.html'); p.wait_for_timeout(700)
    p.click('[data-tun=demo]'); p.wait_for_timeout(900)
    p.evaluate("localStorage.removeItem('fv_sperrungen')")
    p.evaluate("FV.B._simOrt({lat: 53.135, lon: 7.62, genau: 10, tempo: 0, kurs: 0, zeit: Date.now()})")

    # ---------- 1. Kostenlose Parkplätze ----------
    p.click('[data-tun=uebersicht]'); p.wait_for_timeout(1500)
    p.evaluate("FV.K.map.jumpTo({center:[7.6225,53.1355], zoom: 15.8})"); p.wait_for_timeout(2500)
    n = p.evaluate("document.querySelectorAll('.m-parkfrei').length")
    print('Parkplätze auf der Karte:', n, '· Overpass-Anfragen:', anfragen['overpass'])
    if n < 2: fehler.append('kostenlose Parkplätze fehlen auf der Karte (%d)' % n)
    schirm = lambda name: p.screenshot(path=BILDER + '/' + name + '.png')
    schirm('47-01-parkplaetze')
    p.evaluate("FV.K.map.jumpTo({zoom: 10})"); p.wait_for_timeout(1800)
    if p.evaluate("document.querySelectorAll('.m-parkfrei').length"): fehler.append('Parkplätze bei Zoom 10 sollten weg sein')
    p.evaluate("FV.K.map.jumpTo({center:[7.6225,53.1355], zoom: 15.8})"); p.wait_for_timeout(1800)
    p.evaluate("[...document.querySelectorAll('.m-parkfrei')].find(m => m.textContent.indexOf('Marktplatz') >= 0).click()"); p.wait_for_timeout(500)
    t = p.inner_text('#blatt')
    for w in ['Marktplatz', 'kostenlos', '80', '2 Stunden', 'Parkscheibe', 'Hinfahren']:
        if w not in t: fehler.append('Parkplatz-Blatt: „%s“ fehlt' % w)
    schirm('47-02-parkplatz-blatt')
    p.evaluate("FV.app.blattZu()")
    p.evaluate("FV.app.zeige('parkfrei', {})"); p.wait_for_timeout(1500)
    t = p.inner_text('#pkliste'); print(t[:300])
    if 'Marktplatz' not in t or 'Parkhaus' not in t: fehler.append('Liste kostenlose Parkplätze unvollständig')
    schirm('47-03-parkplatz-liste')

    # ---------- 2. Sperrung in der Zielführung ----------
    p.evaluate("FV.app.zeige('vorschau', { ziel: { name: 'Testziel', adresse: 'Teststr 1', lat: %f, lon: %f, art: 'frei' }, modus: 'auto' })" % ZIEL); p.wait_for_timeout(2500)
    p.click('#vfuss [data-tun=route-start]'); p.wait_for_timeout(1500)
    for i in range(3):
        p.evaluate("i => FV.B._simOrt({lat: 53.135 + i*0.0002, lon: 7.62 + i*0.0001, genau: 8, tempo: 12, kurs: 10, zeit: Date.now()})", i); p.wait_for_timeout(600)
    if not p.query_selector('#sperrknopf'): fehler.append('Sperrung-Knopf fehlt')
    str0 = p.evaluate("FV.F.route.schritte[0].strasse"); print('Route vorher:', str0)
    schirm('47-04-fahrt-mit-sperrknopf')
    p.click('#sperrknopf'); p.wait_for_timeout(300)
    if p.is_hidden('#sperrhinweis'): fehler.append('Hinweis „Auf die gesperrte Straße tippen“ fehlt')
    schirm('47-05-sperrung-tippen')
    # Punkt auf der Route ca. 2 km voraus antippen
    p.evaluate("FV.F.uebersicht()"); p.wait_for_timeout(3000)
    xy = p.evaluate("(() => { var q = FV.G.punktBei(FV.F.route, 2000), pt = FV.K.map.project([q.lon, q.lat]), r = FV.K.map.getCanvas().getBoundingClientRect(); return [r.left + pt.x, r.top + pt.y]; })()")
    print('Ziel/Karte:', p.evaluate("(() => { var c = FV.K.map.getCanvas(), r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height, c.width, c.height, FV.K.map.getPitch(), FV.K.map.isMoving()]; })()"))
    p.evaluate("FV.K.map.on('click', e => window._ll = [e.lngLat.lat, e.lngLat.lng, e.point.x, e.point.y])")
    p.mouse.click(xy[0] + 6, xy[1] + 4); p.wait_for_timeout(2500)
    print('Tipp:', xy, p.evaluate("window._ll"), p.evaluate("(() => { var q = FV.G.punktBei(FV.F.route, 2000); return [q.lat, q.lon]; })()"))
    sp = p.evaluate("FV.SP.liste()"); print('Sperrungen:', sp)
    if len(sp) != 1: fehler.append('Sperrung nicht eingetragen')
    if not p.query_selector('.m-sperre'): fehler.append('Sperrungs-Schild fehlt auf der Karte')
    str1 = p.evaluate("FV.F.route.schritte[0].strasse"); print('Route nachher:', str1, '· Anfragen mit Sperrflächen:', anfragen['route'])
    if str1 != 'Umgehungsstraße': fehler.append('nicht umgeleitet (Route: %s)' % str1)
    if not p.evaluate("FV.F.route.umleitung && FV.F.route.umleitung.grund.eigen"): fehler.append('Umleitung nicht als eigene Sperrung markiert')
    toast = p.inner_text('#toast'); print('Hinweis:', toast)
    schirm('47-06-sperrung-umfahren')
    p.evaluate("FV.F.zentrieren()"); p.wait_for_timeout(1200); schirm('47-07-fahrt-umleitung')
    # Neuberechnung (z. B. nach Abweichen) muss die Sperrung weiter umfahren
    p.evaluate("FV.G.route({lat:53.135,lon:7.62}, {lat:%f,lon:%f}).then(r => window._r = r.schritte[0].strasse)" % ZIEL); p.wait_for_timeout(800)
    if p.evaluate("window._r") != 'Umgehungsstraße': fehler.append('neue Routen ignorieren die Sperrung')
    # Schild antippen → aufheben
    p.evaluate("document.querySelector('.m-sperre').click()"); p.wait_for_timeout(400)
    t = p.inner_text('#blatt')
    if 'aufheben' not in t: fehler.append('Blatt zum Aufheben fehlt')
    schirm('47-08-sperrung-blatt')
    p.click('[data-tun=sperrung-weg]'); p.wait_for_timeout(500)
    if p.evaluate("FV.SP.liste().length") or p.query_selector('.m-sperre'): fehler.append('Sperrung nicht aufgehoben')
    # „Straße vor mir“
    p.click('#sperrknopf'); p.wait_for_timeout(300); p.click('[data-tun=sperrung-vorne]'); p.wait_for_timeout(1500)
    if p.evaluate("FV.SP.liste().length") != 1: fehler.append('„Straße vor mir“ hat keine Sperrung gesetzt')
    # Sperrung abseits der Route: keine Umleitung
    p.evaluate("FV.SP.setzen({lat: 53.20, lon: 7.80})"); p.wait_for_timeout(1500)
    toast = p.inner_text('#toast'); print('Abseits:', toast)
    if 'nicht' not in toast: fehler.append('Sperrung abseits: Hinweis fehlt')
    # Abbrechen
    p.click('#sperrknopf'); p.wait_for_timeout(200); p.click('[data-tun=sperrung-ab]'); p.wait_for_timeout(200)
    if not p.is_hidden('#sperrhinweis'): fehler.append('Abbrechen schließt den Hinweis nicht')
    # Tag-Design
    p.evaluate("FV.app.e.design = 'tag'; FV.D.anwenden()"); p.wait_for_timeout(1200); schirm('47-09-tag')
    br.close()
print('\n'.join(fehler) if fehler else 'Keine Fehler.')
sys.exit(1 if fehler else 0)
