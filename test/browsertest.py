"""Ganzer Ablauf im echten Chromium: Einstellungen → Offline-Karte laden (mit Anhalten/Weiter), Datei prüfen,
Neustart, Karte ohne Internet aus der Datei anzeigen."""
import sys, hashlib, time, json
from playwright.sync_api import sync_playwright
APP, KARTEN, DATEI, BILDER = sys.argv[1:5]
soll = hashlib.sha256(open(DATEI, 'rb').read()).hexdigest()
fehler = []

def quelle_umstellen(p):
    p.evaluate("u => { FV.O.QUELLEN.length = 0; FV.O.QUELLEN.push(u); }", KARTEN)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
    # "Kein Internet": alles außer den beiden Test-Servern wird abgewiesen
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') or r.request.url.startswith('http://127.0.0.1') or r.request.url.startswith('blob:') or r.request.url.startswith('data:') else r.abort())
    p = ctx.new_page()
    p.on('pageerror', lambda e: fehler.append('Seitenfehler: ' + str(e)))
    p.on('console', lambda m: fehler.append('Konsole: ' + m.text) if m.type == 'error' and 'net::' not in m.text and 'Failed to fetch' not in m.text else None)
    p.goto(APP + '/index.html'); p.wait_for_timeout(800)
    quelle_umstellen(p)
    p.click('[data-tun=demo]'); p.wait_for_timeout(600)
    p.evaluate("FV.app.zeige('einstellungen')"); p.wait_for_timeout(500)
    p.eval_on_selector('#offblock', 'e => e.scrollIntoView()')
    p.screenshot(path=BILDER + '/1-einstellungen.png')
    # Laden starten und mittendrin anhalten
    p.click('[data-tun=karte-laden]'); p.wait_for_timeout(1200)
    p.screenshot(path=BILDER + '/2-laeuft.png')
    p.click('[data-tun=karte-halt]'); p.wait_for_timeout(1500)
    p.eval_on_selector('#offblock', 'e => e.scrollIntoView()')
    p.screenshot(path=BILDER + '/3-angehalten.png')
    txt = p.inner_text('#offtext'); print('Nach Anhalten:', txt)
    if 'Angehalten' not in txt: fehler.append('Anhalten hat nicht geklappt: ' + txt)
    # Weiter laden bis fertig
    p.click('[data-tun=karte-laden]')
    p.wait_for_selector('text=Die Offline-Karte ist geladen', timeout=60000)
    p.screenshot(path=BILDER + '/4-fertig.png')
    ist = p.evaluate("""async () => { const d = await navigator.storage.getDirectory(); const f = await (await d.getFileHandle('deutschland.pmtiles')).getFile();
        const h = await crypto.subtle.digest('SHA-256', await f.arrayBuffer()); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }""")
    print('Datei auf dem Handy gleich der Serverdatei:', ist == soll)
    if ist != soll: fehler.append('Datei weicht ab')
    p.click('text=Jetzt neu starten'); p.wait_for_timeout(1200)
    # Nach dem Neustart: Karte ohne Internet
    p.click('[data-tun=demo]'); p.wait_for_timeout(600)
    p.click('[data-tun=uebersicht]'); p.wait_for_timeout(1500)
    p.evaluate("FV.K.map.jumpTo({center:[7.70,53.20], zoom: 13.5})"); p.wait_for_timeout(2500)
    info = p.evaluate("() => ({ art: FV.K.stilArt(), geladen: FV.K.map.loaded(), quellen: Object.keys(FV.K.map.getStyle().sources), kacheln: FV.K.map.queryRenderedFeatures().length })")
    print('Karte:', json.dumps(info))
    if info['art'] != 'offline' or info['kacheln'] == 0: fehler.append('Karte zeigt die Offline-Datei nicht: ' + json.dumps(info))
    p.screenshot(path=BILDER + '/5-karte-offline.png')
    p.evaluate("FV.K.map.jumpTo({center:[7.70,53.20], zoom: 9})"); p.wait_for_timeout(2000)
    p.screenshot(path=BILDER + '/6-karte-weiter.png')
    # Einstellungen zeigen jetzt "Geladen"
    p.evaluate("FV.app.zeige('einstellungen')"); p.wait_for_timeout(500)
    p.eval_on_selector('#offblock', 'e => e.scrollIntoView()')
    p.screenshot(path=BILDER + '/7-einstellungen-geladen.png')
    print('Status:', p.inner_text('#offtext'))
    br.close()
print('FEHLER:' if fehler else 'ALLES OK', *fehler, sep='\n')
