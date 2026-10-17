"""Browsertest Satelliten-Einzelheiten (4.4.2): erfundene Bahnen (OMM) im Speicher, das Handy meldet passende Satelliten.
GPS/Galileo/BeiDou über die Nummer, GLONASS über die Stelle am Himmel, EGNOS aus der Liste. Aufruf: test_46.py APP bilderordner"""
import sys, json, datetime
from playwright.sync_api import sync_playwright
APP, BILDER = sys.argv[1:3]
fehler = []
ep = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000000')
OMM = []
def sat(name, nr, n, i, raan, m):
    OMM.append({'OBJECT_NAME': name, 'NORAD_CAT_ID': nr, 'EPOCH': ep, 'MEAN_MOTION': n, 'ECCENTRICITY': 0.001, 'INCLINATION': i, 'RA_OF_ASC_NODE': raan, 'ARG_OF_PERICENTER': 0, 'MEAN_ANOMALY': m})
for k in range(24): sat('GPS BIIF-%d (PRN %02d)' % (k + 1, k + 1), 40000 + k, 2.00563, 55, (k // 4) * 60, (k % 4) * 90 + k * 7)
for k in range(24): sat('GSAT%04d (PRN E%02d)' % (101 + k, k + 1), 41000 + k, 1.70475, 56, (k // 8) * 120, (k % 8) * 45 + k * 3)
for k in range(24): sat('COSMOS %d (%d)' % (2400 + k, 700 + k), 42000 + k, 2.13103, 64.8, (k // 8) * 120, (k % 8) * 45 + k * 5)
for k in range(12): sat('BEIDOU-3 M%d (C%02d)' % (k + 1, 19 + k), 43000 + k, 1.86231, 55, (k // 4) * 120, (k % 4) * 90 + k * 11)
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') or r.request.url.startswith('data:') or r.request.url.startswith('blob:') else r.abort())
    p = ctx.new_page()
    p.on('pageerror', lambda e: fehler.append('Seitenfehler: ' + str(e)))
    p.add_init_script("localStorage.setItem('fv_sat_bahnen', JSON.stringify(%s));" % json.dumps({'t': 9e15, 'l': OMM}))
    p.goto(APP + '/index.html'); p.wait_for_timeout(600)
    p.click('[data-tun=demo]'); p.wait_for_timeout(800)
    p.evaluate("FV.B._simOrt({lat: 53.135, lon: 7.62, genau: 6, tempo: 0, kurs: 0, zeit: Date.now()})")
    # Das „Handy“: alle erfundenen Satelliten über dem Horizont, die ersten 9 genutzt, dazu EGNOS 123 und 136
    p.evaluate("""() => {
      var T = FV.SAT._test, o = T.ort({lat: 53.135, lon: 7.62}), b = T.vorbereiten(JSON.parse(localStorage.getItem('fv_sat_bahnen')).l);
      var SYS = {GPS: 1, GLONASS: 3, BeiDou: 5, Galileo: 6};
      window.FV_TEST = window.FV_TEST || {};
      FV_TEST.satelliten = function () {
        var l = [], t = Date.now();
        b.forEach(function (x, i) { var bl = T.blick(o, T.bahn(x, t)); if (bl.el < 5) return;
          var nr = x.sys === 'GLONASS' ? 1 + (i % 24) : x.prn;   // GLONASS meldet den Bahnplatz, nicht die Nummer aus dem Namen
          l.push([SYS[x.sys], nr, 0, 20 + (i * 7) % 25, Math.round(bl.el * 10) / 10 + 0.4, Math.round(bl.az * 10) / 10 - 0.6, x.sys === 'GLONASS' ? 1602.56 : 1575.42]); });
        l.forEach(function (x, i) { if (i % 2 === 0) x[2] = 1; });
        l.push([2, 123, 1, 41, 28.6, 165.4, 1575.42]); l.push([2, 136, 0, 33, 26.0, 150.0, 1575.42]);
        return { sichtbar: l.length, genutzt: l.filter(x => x[2]).length, snr: 36, alter: 800, laeuft: true, systeme: {GPS: [5, 8]}, liste: l };
      };
    }""")
    p.click('[data-tun=uebersicht]'); p.wait_for_timeout(1500)
    p.click('.satknopf'); p.wait_for_timeout(800)
    t = p.inner_text('#satblatt'); print(t[:900].replace('\n', ' | '))
    for w in ['GSAT0', 'GPS BIIF', 'COSMOS', 'BEIDOU', 'Astra 5B', 'km hoch', 'km/h', 'km entfernt']:
        if w not in t: fehler.append('fehlt: ' + w)
    if 'GPS-Satellit' in t or 'Galileo-Satellit' in t or 'GLONASS-Satellit' in t: fehler.append('nicht zugeordnet: ' + t[t.find('-Satellit') - 20:t.find('-Satellit') + 10])
    if not p.query_selector('#satblatt svg.himmel .hk-sat'): fehler.append('Himmelskarte leer')
    p.screenshot(path=BILDER + '/40-satelliten.png')
    p.evaluate("document.querySelector('#blatt .innen').scrollTop = 520"); p.wait_for_timeout(300); p.screenshot(path=BILDER + '/41-satelliten-liste.png')
    p.click('#satblatt .eintrag.satz >> nth=0'); p.wait_for_timeout(500)
    d = p.inner_text('#blatt'); print('Einzeln:', d.replace('\n', ' | ')[:500])
    for w in ['Höhe über der Erde', 'Geschwindigkeit', 'Entfernung zu dir', 'Einmal um die Erde', 'NORAD']:
        if w not in d: fehler.append('Einzelheit fehlt: ' + w)
    p.screenshot(path=BILDER + '/42-satellit-einzeln.png')
    p.click('[data-tun=sat-zurueck]'); p.wait_for_timeout(400)
    if not p.query_selector('#satblatt'): fehler.append('Zurück geht nicht')
    p.evaluate("FV.app.e.design = 'tag'; FV.D.anwenden()"); p.wait_for_timeout(2300); p.screenshot(path=BILDER + '/43-satelliten-tag.png')
    br.close()
print('\n'.join(fehler) if fehler else 'Keine Fehler.')
sys.exit(1 if fehler else 0)
