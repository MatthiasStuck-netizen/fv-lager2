"""Reise-Navigation: zu Fuß → Zug → zu Fuß, Abschnitte schalten von selbst weiter (Demo, ohne Internet)."""
import sys, json
from playwright.sync_api import sync_playwright
APP, BILDER = sys.argv[1:3]
fehler = []
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    p = ctx.new_page(); p.on('pageerror', lambda e: fehler.append('Seitenfehler: ' + str(e)))
    p.goto(APP + '/index.html'); p.wait_for_timeout(600)
    p.click('[data-tun=demo]'); p.wait_for_timeout(600)
    p.evaluate("FV.B._simOrt({lat: 53.2457, lon: 7.7757, genau: 8, tempo: 0, kurs: 0, zeit: Date.now()})")
    p.evaluate("""() => { const z = FV.app.z, jetzt = Date.now(), m = n => new Date(jetzt + n * 60000);
      z.nav = { ziel: { name: 'Bremen Hbf', adresse: 'Bremen', art: 'frei' }, von: { lat: 53.2457, lon: 7.7757, name: 'Ihr Standort' }, nach: { lat: 53.0832, lon: 8.8135, name: 'Bremen Hbf' }, modus: 'zug' };
      z.zug = [{ faellt: false, legs: [
        { fuss: true, art: 'fuss', von: 'Start', nach: 'Augustfehn Bf', vonOrt: { lat: 53.2457, lon: 7.7757 }, nachOrt: { lat: 53.2440, lon: 7.7800 }, punkte: [[7.7757, 53.2457], [7.78, 53.244]], ab: m(0), an: m(4), meter: 400 },
        { fuss: false, art: 'regio', linie: 'RE 1', kurz: 'RE1', richtung: 'Hannover Hbf', von: 'Augustfehn Bf', nach: 'Bremen Hbf', gleis: '2', gleisAn: '8', vonOrt: { lat: 53.2440, lon: 7.7800 }, nachOrt: { lat: 53.0832, lon: 8.8135 },
          punkte: [[7.78, 53.244], [8.0, 53.17], [8.21, 53.14], [8.6, 53.1], [8.8135, 53.0832]], ab: m(5), an: m(55) },
        { fuss: true, art: 'fuss', von: 'Bremen Hbf', nach: 'Ziel', vonOrt: { lat: 53.0832, lon: 8.8135 }, punkte: [[8.8135, 53.0832], [8.8135, 53.0832]], ab: m(56), an: m(58), meter: 20 }] }];
      FV.Tun['zug-los']({ getAttribute: () => '0' }); }""")
    p.wait_for_timeout(3000)
    print('Seite:', p.evaluate("FV.app.oben()"), '| Leiste:', p.inner_text('#rleiste').replace('\n', ' | '))
    if p.evaluate("FV.app.oben()") != 'fahrt': fehler.append('Fahrt-Seite nicht offen')
    p.screenshot(path=BILDER + '/r1-fussweg.png')
    # Abschnitt 1 (Fußweg) laufen lassen: Router ist offline → gerade Linie; Probefahrt bis Ende
    p.evaluate("FV.F.probefahrt(200)"); p.wait_for_timeout(9000)
    i = p.evaluate("FV.app.z.lauf && FV.app.z.lauf.reise.i"); print('Abschnitt nach Fußweg:', i)
    if i != 1: fehler.append('nicht auf Abschnitt 2 gewechselt: ' + str(i))
    p.screenshot(path=BILDER + '/r2-zug.png')
    print('Leiste:', p.inner_text('#rleiste').replace('\n', ' | '), '| Abbiegen:', p.inner_text('#abb').replace('\n', ' | '))
    r = p.evaluate("({oev: FV.F.route.oev, modus: FV.F.modus(), laenge: Math.round(FV.F.route.laenge)})"); print('Route Zug:', r)
    if not r['oev']: fehler.append('Zug-Abschnitt ist keine ÖPNV-Route')
    # Mitten im Zug: GPS-Position neben dem Gleis → keine Neuberechnung, Fortschritt
    p.evaluate("FV.B._simOrt({lat: 53.15, lon: 8.15, genau: 20, tempo: 30, kurs: 100, zeit: Date.now()})"); p.wait_for_timeout(800)
    st = p.evaluate("({rest: Math.round(FV.F.stand.restM), auf: FV.F.stand.aufRoute, rechnet: FV.F.stand.rechnet})"); print('Im Zug:', st)
    if st['rechnet']: fehler.append('Zug-Abschnitt wurde neu berechnet')
    p.screenshot(path=BILDER + '/r3-im-zug.png')
    # Ankunft Bremen
    p.evaluate("FV.B._simOrt({lat: 53.0835, lon: 8.8130, genau: 15, tempo: 2, kurs: 90, zeit: Date.now()})"); p.wait_for_timeout(4000)
    print('Abschnitt nach Ankunft:', p.evaluate("FV.app.z.lauf && FV.app.z.lauf.reise.i"), '| gesagt:', p.evaluate("FV.B.gesprochen.slice(-5)"))
    p.evaluate("FV.B._simOrt({lat: 53.0832, lon: 8.8135, genau: 5, tempo: 1, kurs: 90, zeit: Date.now()})"); p.wait_for_timeout(1500)
    p.evaluate("FV.B._simOrt({lat: 53.0832, lon: 8.8135, genau: 5, tempo: 1, kurs: 90, zeit: Date.now()})"); p.wait_for_timeout(1500)
    print('Ende:', p.evaluate("FV.app.z.lauf"), p.inner_text('#blatt')[:80].replace('\n', ' | ') if p.is_visible('#blatt') else '-')
    p.screenshot(path=BILDER + '/r4-ziel.png')
    if 'Ziel erreicht' not in (p.inner_text('#blatt') if p.is_visible('#blatt') else ''): fehler.append('Ziel nicht erreicht')
    br.close()
print('FEHLER:' if fehler else 'ALLES OK', *fehler, sep='\n')
