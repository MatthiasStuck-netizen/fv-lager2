"""Browsertest für Navi 4.2: Suche-Reiter, Favoriten, letzte Ziele, Abfahrten an einem beliebigen Ort,
Bahn-/Schiffsstrecken auf der Offline-Karte, Flugstrecken, Flugzeuge live (nachgebildet), Tag-/Nachtdesign.
Aufruf: test_42.py http://localhost:8642 http://localhost:8643/karten/ bilderordner"""
import sys, json
from playwright.sync_api import sync_playwright
APP, KARTEN, BILDER = sys.argv[1:4]
fehler = []

ADSB = {'ac': [
    {'hex': '3c6444', 'flight': 'DLH4AB  ', 'r': 'D-AIZD', 't': 'A320', 'lat': 53.25, 'lon': 7.55, 'alt_baro': 36000, 'gs': 450, 'track': 210},
    {'hex': '4ca7b2', 'flight': 'RYR12AB ', 'r': 'EI-ABC', 't': 'B738', 'lat': 53.12, 'lon': 7.85, 'alt_baro': 24000, 'gs': 400, 'track': 95},
    {'hex': '3c0001', 'flight': '', 't': 'C172', 'lat': 53.30, 'lon': 7.70, 'alt_baro': 'ground', 'gs': 0, 'track': 0}]}
ROUTE = [{'callsign': 'DLH4AB', '_airport_codes_iata': 'HAM-PMI', '_airports': [
    {'iata': 'HAM', 'icao': 'EDDH', 'lat': 53.63, 'lon': 9.99, 'name': 'Hamburg', 'location': 'Hamburg'},
    {'iata': 'PMI', 'icao': 'LEPA', 'lat': 39.55, 'lon': 2.74, 'name': 'Palma de Mallorca', 'location': 'Palma'}]}]

def schirm(p, name): p.screenshot(path=BILDER + '/' + name + '.png')

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
    def weiter(r):
        u = r.request.url
        if u.startswith('https://api.adsb.lol/v2/'):
            return r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps(ADSB))
        if u.startswith('https://api.adsb.lol/api/0/routeset'):
            if r.request.method == 'OPTIONS':
                return r.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Accept', 'Access-Control-Allow-Methods': 'POST'})
            return r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps(ROUTE))
        if u.startswith('http://localhost') or u.startswith('blob:') or u.startswith('data:'): return r.continue_()
        return r.abort()
    ctx.route('**/*', weiter)
    p = ctx.new_page()
    p.on('pageerror', lambda e: fehler.append('Seitenfehler: ' + str(e)))
    p.on('console', lambda m: fehler.append('Konsole: ' + m.text) if m.type == 'error' and 'net::' not in m.text and 'Failed to fetch' not in m.text and 'Failed to load resource' not in m.text else None)
    p.goto(APP + '/index.html'); p.wait_for_timeout(700)
    p.evaluate("u => { FV.O.QUELLEN.length = 0; FV.O.QUELLEN.push(u); }", KARTEN)
    p.click('[data-tun=demo]'); p.wait_for_timeout(800)
    # Standort in Ostrhauderfehn
    p.evaluate("FV.B._simOrt({lat: 53.135, lon: 7.62, genau: 10, tempo: 0, kurs: 0, zeit: Date.now()})")
    n = p.evaluate("document.querySelectorAll('#leiste button').length")
    print('Knöpfe unten:', n, p.inner_text('#leiste').replace('\n', ' | '))
    if n != 7: fehler.append('Leiste hat nicht 7 Knöpfe')
    # Nachtsicht fest einstellen
    p.evaluate("FV.app.zeige('einstellungen', {}, 'reiter')"); p.wait_for_timeout(300)
    p.click('[data-tun=design][data-d=nacht]'); p.wait_for_timeout(300)
    schirm(p, '01-einstellungen-nacht')
    if p.evaluate("document.documentElement.classList.contains('hell')"): fehler.append('Nacht eingestellt, aber hell')
    p.click('[data-tun=design][data-d=tag]'); p.wait_for_timeout(300)
    if not p.evaluate("document.documentElement.classList.contains('hell')"): fehler.append('Tag eingestellt, aber dunkel')
    schirm(p, '02-einstellungen-tag')
    p.click('[data-tun=reiter][data-r=auftraege]'); p.wait_for_timeout(500)
    schirm(p, '03-auftraege-tag')
    p.click('[data-tun=design]') if False else None
    p.evaluate("FV.app.e.design = 'nacht'; FV.D.anwenden()"); p.wait_for_timeout(200)
    schirm(p, '04-auftraege-nacht')

    # ---------- Suche ----------
    p.click('[data-tun=reiter][data-r=suche]'); p.wait_for_timeout(400)
    schirm(p, '05-suche-leer')
    p.fill('#sort', 'Mallorca'); p.click('#sverkehr ~ *', timeout=1) if False else None
    p.evaluate("FV.Tun['such-verkehr']()"); p.wait_for_timeout(400)
    txt = p.inner_text('#sverkehr'); print('Flughäfen zu Mallorca:', txt[:160].replace('\n', ' | '))
    if 'PMI' not in txt: fehler.append('PMI nicht gefunden')
    schirm(p, '06-suche-mallorca')
    # Stern beim ersten Treffer → Favorit
    p.click('#sverkehr .eintrag [data-tun=fav]'); p.wait_for_timeout(300)
    favs = p.evaluate("FV.FAV.alle()"); print('Favoriten:', favs)
    if not favs or favs[0].get('iata') != 'PMI': fehler.append('Favorit PMI fehlt')
    # Flughafen öffnen → Flugtafel (Demo-Daten)
    p.click('#sverkehr .eintrag'); p.wait_for_timeout(900)
    schirm(p, '07-flugtafel-pmi')
    p.click('[data-tun=flugstrecken]'); p.wait_for_timeout(1500)
    schirm(p, '08-flugstrecken-ohne-karte')
    print('Flugkarte:', p.inner_text('#fkliste')[:200].replace('\n', ' | '))
    if 'MUC' not in p.inner_text('#fkliste'): fehler.append('Flugstrecke nach MUC fehlt')
    p.evaluate("FV.app.zurueck()"); p.wait_for_timeout(400)
    # Ort-Suche Schiff (ohne Internet: Fehlermeldung, aber kein Absturz)
    p.click('[data-tun=such-art][data-a=schiff]'); p.wait_for_timeout(2500)
    print('Schiff:', p.inner_text('#sverkehr')[:120].replace('\n', ' | '))
    schirm(p, '09-suche-schiff')

    # ---------- Offline-Karte mit Bahn- und Fährstrecke ----------
    p.evaluate("FV.app.zeige('einstellungen', {}, 'reiter')"); p.wait_for_timeout(300)
    p.click('[data-tun=karte-laden][data-k=de]')
    p.wait_for_selector('text=ist geladen', timeout=60000)
    p.click('text=Jetzt neu starten'); p.wait_for_timeout(1200)
    p.click('[data-tun=demo]'); p.wait_for_timeout(600)
    p.evaluate("FV.B._simOrt({lat: 53.135, lon: 7.62, genau: 10, tempo: 0, kurs: 0, zeit: Date.now()})")
    p.click('[data-tun=uebersicht]'); p.wait_for_timeout(1500)
    p.evaluate("FV.K.map.jumpTo({center:[7.70,53.20], zoom: 10.5})"); p.wait_for_timeout(2000)
    info = p.evaluate("""() => ({ art: FV.K.stilArt(), ebenen: FV.K.map.getStyle().layers.map(l => l.id).filter(i => /^(bahn|see|flug)/.test(i)),
        bahn: FV.K.map.queryRenderedFeatures({layers: FV.K.map.getStyle().layers.map(l => l.id).filter(i => /^bahn-/.test(i))}).length,
        see: FV.K.map.queryRenderedFeatures({layers: FV.K.map.getStyle().layers.map(l => l.id).filter(i => /^see-/.test(i))}).length })""")
    print('Karte:', json.dumps(info))
    if not info['bahn']: fehler.append('Bahnstrecke nicht zu sehen')
    if not info['see']: fehler.append('Fährlinie nicht zu sehen')
    schirm(p, '10-karte-nacht-strecken')
    p.evaluate("FV.app.e.design = 'tag'; FV.D.anwenden()"); p.wait_for_timeout(1200)
    bg = p.evaluate("FV.K.map.getPaintProperty('background', 'background-color')"); print('Hintergrund Tag:', bg)
    if bg != '#f2efe9': fehler.append('Karte nicht hell: ' + str(bg))
    schirm(p, '11-karte-tag-strecken')
    # Flugzeuge live einschalten (Ebenen-Knopf)
    p.click('[data-tun=ebenen]'); p.wait_for_timeout(300)
    schirm(p, '12-ebenen')
    p.click('[data-tun=ebene-schalter][data-k=flugzeuge]'); p.wait_for_timeout(1500)
    nfz = p.evaluate("document.querySelectorAll('.m-flugzeug').length"); print('Flugzeuge auf der Karte:', nfz)
    if nfz != 3: fehler.append('Flugzeuge fehlen: ' + str(nfz))
    p.click('[data-tun=ebenen]'); p.wait_for_timeout(200)
    p.evaluate("FV.K.map.jumpTo({center:[7.70,53.20], zoom: 8.5})"); p.wait_for_timeout(1500)
    p.click('.m-flugzeug:has-text("DLH4AB")'); p.wait_for_timeout(1500)
    print('Flugzeug:', p.inner_text('#blatt')[:200].replace('\n', ' | '))
    if 'PMI' not in p.inner_text('#blatt'): fehler.append('Strecke des Flugzeugs fehlt')
    schirm(p, '13-flugzeug-tag')
    p.evaluate("FV.app.blattZu(); FV.K.rahmen([[9.99,53.63],[2.74,39.55]])"); p.wait_for_timeout(1500)
    schirm(p, '14-flugstrecke-karte')
    # Vorschau mit Stern in der Zielkarte, letzte Ziele
    p.evaluate("FV.app.zeige('vorschau', { ziel: { name: 'Testziel', adresse: 'Am Deich 6, Ostrhauderfehn', lat: 53.14, lon: 7.64, art: 'frei' } })"); p.wait_for_timeout(1500)
    schirm(p, '15-vorschau-tag')
    p.click('.ziel [data-tun=fav]'); p.wait_for_timeout(300)
    p.click('[data-tun=reiter][data-r=suche]'); p.wait_for_timeout(500)
    t = p.inner_text('#srollen'); print('Suche-Seite:', t[t.find('Favoriten'):][:260].replace('\n', ' | '))
    if 'Testziel' not in p.inner_text('#sletzte'): fehler.append('Letztes Ziel fehlt')
    if 'Testziel' not in p.inner_text('#sfav'): fehler.append('Favorit Testziel fehlt')
    p.eval_on_selector('#sfav', 'e => e.scrollIntoView()')
    schirm(p, '16-favoriten-letzte-tag')
    p.evaluate("FV.app.e.design = 'nacht'; FV.D.anwenden()"); p.wait_for_timeout(300)
    schirm(p, '17-favoriten-letzte-nacht')
    # Automatisch: Sonnenstand
    s = p.evaluate("[FV.D.sonnenhoehe(53.2, 7.7, new Date('2026-06-21T12:00:00Z')), FV.D.sonnenhoehe(53.2, 7.7, new Date('2026-12-21T23:00:00Z'))]")
    print('Sonnenhöhe Mittag Juni / Nacht Dez:', s)
    if not (s[0] > 55 and s[1] < -30): fehler.append('Sonnenstand falsch: ' + str(s))
    br.close()
print('FEHLER:' if fehler else 'ALLES OK', *fehler, sep='\n')
