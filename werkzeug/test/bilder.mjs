/* Öffnet die App im Browser, klickt alle Seiten durch und speichert Bilder + Prüfwerte.
 * Aufruf: node bilder.mjs <www-Ordner> <Ausgabe-Ordner>   (LIVE=1: echte Karten-/Routen-/Wetterdienste) */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import * as D from './daten.mjs';
const PW = process.env.PLAYWRIGHT || 'playwright';
const { chromium } = await import(PW);
const WWW = path.resolve(process.argv[2]), AUS = path.resolve(process.argv[3]); fs.mkdirSync(AUS, { recursive: true });
const LIVE = process.env.LIVE === '1', B = Number(process.env.BREITE || 412), H = Number(process.env.HOEHE || 892);
const hier = path.dirname(new URL(import.meta.url).pathname);
const typ = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, a) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(WWW, p); if (!f.startsWith(WWW) || !fs.existsSync(f)) { a.writeHead(404); return a.end(); }
  a.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(a);
}).listen(0);
const basis = 'http://127.0.0.1:' + srv.address().port + '/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: B, height: H }, deviceScaleFactor: 2, locale: 'de-DE', timezoneId: 'Europe/Berlin', userAgent: 'Mozilla/5.0 (Linux; Android 14) FehnverleihNavi/Test' });
const page = await ctx.newPage();
const log = { live: LIVE, konsole: [], schritte: [], netzfehler: [], anfragen: [] };
let netzAus = false, routeAus = false;   // für die Prüfungen ohne Netz
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.konsole.push(m.type() + ': ' + m.text().slice(0, 300)); });
page.on('pageerror', e => log.konsole.push('FEHLER: ' + String(e).slice(0, 300)));
page.on('requestfailed', r => log.netzfehler.push(r.url().slice(0, 120) + ' ' + (r.failure() || {}).errorText));
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const json = (r, j) => r.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(j) });
await page.route('https://www.fehnverleih.de/**', r => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors }); let d = {}; try { d = JSON.parse(r.request().postData() || '{}'); } catch (e) {} (log.server = log.server || []).push(d.aktion); if (netzAus) return r.abort(); log.anfragen.push({ a: d.aktion, t: String(d.token || '').slice(0, 1), z: d.ziel || '' }); return json(r, D.server(d)); });
if (LIVE) {
  // Die echte App holt Route, Adressen, Wetter über Android (ohne Browser-Sperren). Hier werden die Anfragen genauso durchgereicht.
  log.dienste = [];
  await page.route(/valhalla1\.openstreetmap\.de|nominatim\.openstreetmap\.org|photon\.komoot\.io|overpass|api\.brightsky\.dev|routing\.openstreetmap\.de/, async r => {
    const q = r.request(); if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (routeAus && /valhalla|routing\.openstreetmap/.test(q.url())) return r.abort();
    try {
      const a = await r.fetch({ headers: { ...q.headers(), 'user-agent': 'FehnverleihNavi/3.1 (Android; +https://www.fehnverleih.de)', 'accept-language': 'de' }, timeout: 40000 });
      const body = await a.body(); log.dienste.push(q.method() + ' ' + q.url().slice(0, 90) + ' -> ' + a.status() + ' (' + body.length + ' Bytes)');
      return r.fulfill({ status: a.status(), headers: { ...a.headers(), ...cors }, body });
    } catch (e) { log.dienste.push(q.method() + ' ' + q.url().slice(0, 90) + ' -> FEHLER ' + String(e).slice(0, 80)); return r.abort(); }
  });
} else {
  await page.route('**/lib/maplibre-gl.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(hier, 'kartenersatz.js')) }));
  await page.route('**/lib/maplibre-gl.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://valhalla1.openstreetmap.de/**', r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : routeAus ? r.abort() : json(r, r.request().url().includes('trace') ? D.trace : D.valhalla));
  await page.route('https://nominatim.openstreetmap.org/**', r => json(r, D.nominatim(new URL(r.request().url()).searchParams.get('q') || '')));
  await page.route(/overpass/, r => json(r, D.overpass));
  await page.route('https://api.brightsky.dev/**', r => json(r, r.request().url().includes('current') ? D.wetterJetzt : D.wetter()));
  await page.route(/openfreemap|tile\.openstreetmap|photon|routing\.openstreetmap/, r => r.abort());
}
await page.addInitScript(() => { window.FV_TEST = { ausweis: 'FVZ-0a1b2c3d-0a1b2c3d4e5f', foto: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==' }; });
let nr = 0;
const bild = async (name, warte = 350) => { await page.waitForTimeout(warte); const f = String(++nr).padStart(2, '0') + '-' + name + '.png'; await page.screenshot({ path: path.join(AUS, f) }); log.schritte.push(f); };
const tipp = async (sel, n = 0) => { const e = page.locator(sel).nth(n); await e.waitFor({ state: 'visible', timeout: 15000 }); await e.click(); };
const versuch = async (name, f) => { try { await f(); } catch (e) { log.schritte.push('FEHLGESCHLAGEN ' + name + ': ' + String(e).split('\n')[0].slice(0, 200)); try { await page.screenshot({ path: path.join(AUS, 'fehler-' + name + '.png') }); } catch (x) {} } };
const karteWarten = LIVE ? 6000 : 500;

await page.goto(basis);
await versuch('demo', async () => {
  await bild('anmeldung'); await tipp('[data-tun=demo]'); await page.waitForSelector('.auftrag', { timeout: 15000 });
  await page.evaluate(() => { FV.B._simOrt({ lat: 53.2245, lon: 7.7560, genau: 8, tempo: 0, kurs: -1, zeit: Date.now() }); FV.app.befehl('demo/fahrt'); });
  await page.waitForSelector('#abb', { timeout: 60000 }); await page.waitForTimeout(LIVE ? 9000 : 4500);
  log.demo = await page.evaluate(() => ({ demo: FV.S.demo, restKm: FV.F.stand && Math.round(FV.F.stand.restM / 100) / 10, strecke: Math.round(FV.F.route.laenge / 100) / 10, probe: FV.B.probe }));
  await bild('demo-probefahrt');
  await page.evaluate(() => { FV.Tun.abmelden(); }); await page.waitForSelector('#anm-los', { timeout: 10000 });
  log.demoEnde = await page.evaluate(() => ({ demo: FV.S.demo, angemeldet: FV.S.angemeldet(), probe: !!FV.B.probe, aktiv: FV.F.aktiv }));
});
await versuch('anmeldung', async () => { await tipp('[data-a=admin]'); await page.fill('input[name=pw]', 'test'); await tipp('#anm-los'); await page.waitForSelector('.auftrag', { timeout: 15000 }); });
await page.evaluate(() => FV.B._simOrt({ lat: 53.2245, lon: 7.7560, genau: 8, tempo: 0, kurs: -1, zeit: Date.now() }));
await versuch('auftraege', async () => { await bild('auftraege'); });
await versuch('auftrag-einzelheiten', async () => { await tipp('.auftrag .mehr'); await bild('auftrag-einzelheiten'); await tipp('[data-tun=blatt-zu]'); });
await versuch('vorschau', async () => {
  await tipp('.auftrag .los'); await page.waitForSelector('[data-tun=route-start]:not([disabled])', { timeout: 40000 });
  await page.waitForTimeout(karteWarten); await bild('navigation-vorschau');
  log.route = await page.evaluate(() => { const r = FV.app.z.nav.route; return { quelle: r.quelle, km: Math.round(r.laenge / 100) / 10, minuten: Math.round(r.dauer / 60), ueber: r.ueber, punkte: r.punkte.length, schritte: r.schritte.map(s => s.art + ' | ' + s.text + ' | ' + Math.round(s.weg) + ' m'), karte: FV.K.stilArt() }; });
  await page.waitForTimeout(LIVE ? 9000 : 300);
  log.zusatz = await page.evaluate(() => { const r = FV.app.z.nav.route; return { limits: r.limits.length, limitsBeispiel: r.limits.slice(0, 6), pois: r.pois.length, wc: r.pois.filter(p => p.art === 'wc').length, laden: r.pois.filter(p => p.art === 'laden').length, poiBeispiel: r.pois.slice(0, 5).map(p => p.art + ' ' + p.name + ' ' + Math.round(p.weg) + ' m ' + (p.info || '')) }; });
  await bild('navigation-vorschau-mit-symbolen');
});
log.ortVorFahrt = log.anfragen.filter(x => x.a === 'navi_position').length;
await versuch('fahrt', async () => {
  await tipp('[data-tun=route-start]'); await page.waitForSelector('#abb');
  await page.evaluate(() => FV.F.simSetze(900, 48)); await page.waitForTimeout(karteWarten + 1200); await page.evaluate(() => FV.F.simSetze(1000, 48)); await bild('fahrt', 1300);
  await page.evaluate(() => { const r = FV.F.route; FV.F.simSetze(r.laenge * 0.45, 92); }); await page.waitForTimeout(1500); await page.evaluate(() => { const r = FV.F.route; FV.F.simSetze(r.laenge * 0.45 + 60, 92); }); await bild('fahrt-landstrasse', LIVE ? 4000 : 1300);
  await tipp('[data-tun=fahrt-info]'); await bild('fahrt-uhrzeit-ankunft');
  await tipp('[data-tun=fahrt-info]'); await tipp('[data-tun=fahrt-auswahl]'); await bild('fahrt-auswahl'); await tipp('[data-tun=fahrt-auswahl]');
  await tipp('[data-tun=fahrt-voll]'); await bild('fahrt-vollbild', LIVE ? 3000 : 700); await tipp('[data-tun=fahrt-voll]');
  await tipp('[data-tun=fahrt-ueber]'); await bild('fahrt-uebersicht', LIVE ? 4000 : 900);
  log.ansagen = await page.evaluate(() => FV.B.gesprochen.slice());
  log.stand = await page.evaluate(() => { const s = FV.F.stand; return s && { bis: Math.round(s.bis), text: s.schritt.text, restKm: Math.round(s.restM / 100) / 10, restMin: Math.round(s.restS / 60), kmh: s.kmh, limit: s.limit, wcIn: Math.round(s.wcIn) }; });
  await page.evaluate(() => { const r = FV.F.route; FV.B._simOrt({ lat: r.punkte[r.punkte.length - 1][1], lon: r.punkte[r.punkte.length - 1][0], genau: 6, tempo: 3, kurs: 200, zeit: Date.now() }); });
  
  await bild('ziel-erreicht', 700); await tipp('#blatt [data-tun=blatt-zu]');
});
log.ortNachFahrt = log.anfragen.filter(x => x.a === 'navi_position').length;
await versuch('neue-route', async () => {
  await page.evaluate(() => { FV.app.stapel = []; FV.app.zeige('auftraege', {}, 'reiter'); FV.app.zeige('neueroute'); }); await bild('neue-route');
  await page.fill('#zsuche', 'Bäckerei Rhauderfehn'); await tipp('form[data-form=ziel-suchen] button.gold'); await page.waitForTimeout(LIVE ? 6000 : 600); await bild('neue-route-suche');
  if (await page.locator('#ztreffer .eintrag').count()) await tipp('#ztreffer .eintrag', 0);
  await page.waitForSelector('[data-tun=route-start]:not([disabled])', { timeout: 60000 }); await page.waitForTimeout(LIVE ? 32000 : 600); await bild('neue-route-vorschau');
  log.freieRoute = await page.evaluate(() => { const r = FV.app.z.nav.route; return { km: Math.round(r.laenge / 100) / 10, pois: r.pois.length, poisDa: !!r.poisDa }; });
});
await versuch('reiter', async () => {
  await page.evaluate(() => { FV.app.stapel = []; FV.app.zeige('auftraege', {}, 'reiter'); });
  await tipp('[data-tun=uebersicht]'); await bild('alle-auftraege-karte', karteWarten + (LIVE ? 5000 : 600)); await page.evaluate(() => FV.app.zurueck());
  await tipp('[data-tun=neuauftrag]'); await page.fill('input[name=name]', 'Familie de Vries'); await page.fill('input[name=adresse]', 'Kirchstraße 4, 26842 Ostrhauderfehn'); await page.fill('textarea[name=sonder]', 'Lichterkette für das Zelt\nHeizpilz');
  await tipp('[data-tun=neu-artikel]'); await page.waitForSelector('#aliste .eintrag'); await bild('neuer-auftrag-artikel'); await tipp('#aliste .eintrag', 0); await tipp('#aliste .eintrag', 1); await tipp('[data-tun=blatt-zu]'); await bild('neuer-auftrag');
  await page.evaluate(() => document.querySelector('#nform').scrollTo(0, 9999)); await bild('neuer-auftrag-unten'); await page.evaluate(() => FV.app.zurueck());
  await tipp('#leiste [data-r=lager]'); await page.waitForSelector('#lgr .eintrag, #lgr .leer'); await bild('lager');
  await tipp('#leiste [data-r=wetter]'); await page.waitForSelector('.wetter-jetzt', { timeout: 30000 }); await bild('wetter', LIVE ? 5000 : 900);
  log.wetter = await page.evaluate(() => document.querySelector('.wetter-jetzt').innerText.replace(/\s+/g, ' '));
  await tipp('#leiste [data-r=fahrzeuge]'); await page.waitForSelector('#fbuch .eintrag, #fbuch .leer, #fbuch .fehler'); await bild('fahrzeuge');
  await tipp('[data-tun=tanken]'); await page.waitForSelector('.belegbild'); await page.fill('input[name=betrag]', '48,90'); await page.fill('input[name=liter]', '31,5'); await bild('tankquittung'); await tipp('[data-tun=blatt-zu]');
  await tipp('#leiste [data-r=einstellungen]'); await bild('einstellungen');
  await page.evaluate(() => FV.app.blase('Lager', 'Bitte auf dem Rückweg noch 10 Stehtische bei Schmidt mitnehmen.')); await bild('chat-blase', 200);
});

/* ---------- Version 3.1: Ortung nur bei laufender Fahrt, fester Bildschirm mit X, Navigation läuft beim Seitenwechsel weiter,
 *            eine einzige Ansage bei Neuberechnung, Warteschlange je Nutzer, Aufräumen beim Abmelden ---------- */
await versuch('version-3-1', async () => {
  const n = log.neu = {};
  const ortMeldungen = () => log.anfragen.filter(x => x.a === 'navi_position').length;
  const ja = async () => { await tipp('#blatt [data-tun=frage][data-a="1"]'); }, nein = async () => { await tipp('#blatt [data-tun=frage][data-a="0"]'); };
  await page.evaluate(() => { document.querySelector('#blase').hidden = true; FV.app.blattZu(); FV.app.stapel = []; FV.app.zeige('auftraege', {}, 'reiter'); FV.B._simOrt({ lat: 53.2245, lon: 7.7560, genau: 8, tempo: 0, kurs: -1, zeit: Date.now() }); });
  n.ortOhneFahrt = log.ortVorFahrt === 0;                      // vor der ersten Fahrt wurde kein Standort gesendet
  n.ortInFahrt = log.ortNachFahrt > log.ortVorFahrt;           // während der Fahrt schon
  n.keinMailRu = await page.evaluate(() => !FV.G.DIENST.overpass.some(u => /mail\.ru/.test(u)) && FV.G.DIENST.overpass.length === 2);
  n.karteKnopfImmer = await page.evaluate(() => !!document.querySelector('#leiste [data-r=karte]'));

  // Fahrt starten
  await tipp('.auftrag .los'); await page.waitForSelector('[data-tun=route-start]:not([disabled])', { timeout: 60000 }); await tipp('[data-tun=route-start]'); await page.waitForSelector('#abb');
  await page.evaluate(() => FV.F.simSetze(600, 45)); await page.waitForTimeout(karteWarten + 800);
  const laenge = await page.evaluate(() => FV.F.route.laenge);
  // 2: Zurück-Taste tut nichts
  n.zurueckTutNichts = await page.evaluate(() => { const r = FV.app.zurueck(); return r === true && FV.F.aktiv && FV.app.oben() === 'fahrt'; });
  n.keinZurueckPfeil = await page.evaluate(() => !document.querySelector('.zeile [data-tun=zurueck]') && !!document.querySelector('.zeile .xknopf'));
  await bild('fahrt-mit-x');
  // Auswahl auf der Karte: Bäcker/Café und Diesel-Tankstellen
  await page.waitForFunction(() => FV.F.route && FV.F.route.poisDa, null, { timeout: 90000 }).catch(() => {});
  n.poiArten = await page.evaluate(() => { const z = {}; FV.F.route.pois.forEach(p => { z[p.art] = (z[p.art] || 0) + 1; }); return z; });
  n.poiBeispiele = await page.evaluate(() => FV.F.route.pois.filter(p => p.art === 'essen' || p.art === 'tanken').slice(0, 6).map(p => p.art + ' | ' + p.name + ' | ' + Math.round(p.weg) + ' m | ' + p.abseits + ' m abseits | ' + (p.info || '')));
  await tipp('[data-tun=fahrt-auswahl]'); n.schalter = await page.locator('#auswfeld button').allInnerTexts(); await bild('auswahl-baecker-diesel', 300);
  const marken = () => page.locator('.m-poi.essen, .m-poi.tanken').count();
  const mitMarken = await marken(); await tipp('#auswfeld [data-k=essen]'); await tipp('#auswfeld [data-k=tanken]'); const ohneMarken = await marken();
  await tipp('#auswfeld [data-k=essen]'); await tipp('#auswfeld [data-k=tanken]'); await tipp('[data-tun=fahrt-auswahl]');
  n.baeckerUndDiesel = LIVE ? n.schalter.length === 5 && ohneMarken === 0 : n.schalter.length === 5 && n.poiArten.essen === 1 && n.poiArten.tanken === 1 && mitMarken === 2 && ohneMarken === 0;
  // 3: Seitenwechsel – die Zielführung läuft weiter
  await tipp('#leiste [data-r=lager]'); await page.waitForSelector('#lgr .eintrag, #lgr .leer');
  const restVor = await page.evaluate(() => FV.F.stand && FV.F.stand.restM);
  await page.evaluate(() => FV.F.simSetze(1600, 60)); await page.waitForTimeout(400);
  n.laeuftAufAndererSeite = await page.evaluate(v => FV.F.aktiv && !FV.F.sichtbar && document.body.classList.contains('navi') && FV.F.stand.restM < v - 500, restVor);
  await bild('lager-waehrend-der-fahrt');
  await tipp('#leiste [data-r=einstellungen]'); await tipp('#leiste [data-r=auftraege]'); await page.waitForSelector('.auftrag');
  await tipp('#leiste [data-r=karte]'); await page.waitForSelector('#abb');
  n.karteKnopfZurueck = await page.evaluate(l => FV.app.oben() === 'fahrt' && FV.F.aktiv && FV.F.sichtbar && FV.F.route.laenge === l && FV.K.hat('ziel'), laenge);
  await bild('zurueck-auf-der-strecke', karteWarten + 600);
  // 4: Abweichung ohne Netz – die Ansage kommt nur einmal
  routeAus = true;
  const vorher = await page.evaluate(() => FV.B.gesprochen.filter(t => /neu berechnet/.test(t)).length);
  for (let i = 0; i < 44; i++) { await page.evaluate(() => { const p = FV.G.punktBei(FV.F.route, 1800); FV.B._simOrt({ lat: p.lat + 0.012, lon: p.lon, genau: 8, tempo: 14, kurs: 90, zeit: Date.now() }); }); await page.waitForTimeout(500); }
  n.neuBerechnetAnsagen = await page.evaluate(v => FV.B.gesprochen.filter(t => /neu berechnet/.test(t)).length - v, vorher);
  n.ansageNurEinmal = n.neuBerechnetAnsagen === 1;
  routeAus = false;
  await page.evaluate(() => FV.F.simSetze(1900, 50)); await page.waitForTimeout(600);
  n.nachAbweichungWeiter = await page.evaluate(() => FV.F.aktiv && FV.F.stand && FV.F.stand.aufRoute);
  // 2: X mit Rückfrage Ja / Nein
  await tipp('.zeile .xknopf'); await page.waitForSelector('#blatt [data-tun=frage]');
  n.frageText = await page.evaluate(() => document.querySelector('#blatt .innen').innerText.replace(/\s+/g, ' ').trim());
  await bild('navigation-beenden-frage', 200);
  await nein(); n.neinBleibt = await page.evaluate(() => FV.F.aktiv && FV.app.oben() === 'fahrt');
  await tipp('[data-tun=fahrt-voll]'); n.xImVollbild = await page.locator('.xknopf.xvoll').isVisible(); await bild('vollbild-mit-x', 500); await tipp('[data-tun=fahrt-voll]');
  const vorEnde = ortMeldungen();
  await tipp('.zeile .xknopf'); await ja(); await page.waitForSelector('.auftrag');
  n.jaBeendet = await page.evaluate(() => !FV.F.aktiv && FV.app.oben() === 'auftraege' && !document.body.classList.contains('navi'));
  await page.waitForTimeout(31000);   // Sendepause der Standortmeldung abwarten
  await page.evaluate(() => FV.B._simOrt({ lat: 53.2245, lon: 7.7560, genau: 8, tempo: 9, kurs: 10, zeit: Date.now() })); await page.waitForTimeout(600);
  n.ortNachEndeAus = ortMeldungen() === vorEnde;
  // 3: Knopf „Karte“ ohne laufende Fahrt
  await tipp('#leiste [data-r=karte]'); await page.waitForSelector('#kfeld');
  n.karteOhneFahrt = await page.evaluate(() => FV.app.oben() === 'uebersicht' && !FV.F.aktiv);
  await bild('karte-ohne-fahrt', karteWarten + 600);

  // 5 und 6: Warteschlange je Nutzer, Aufräumen beim Abmelden
  await page.evaluate(() => { FV.app.zeige('einstellungen', {}, 'reiter'); FV.B.schreiben('festorte', { lagerhalle: { lat: 53.2245, lon: 7.756 } }); FV.app.e.zuhause = 'Testweg 1, 26842 Ostrhauderfehn'; FV.app.speichern(); FV.B.schreiben('letzte', [{ name: 'Test', adresse: 'Testweg 1', lat: 53.2, lon: 7.7 }]); });
  netzAus = true;
  await page.evaluate(() => FV.S.spaeter('fahrt_speichern', { km: 1.2, ziel: 'Fahrt vom Admin' })); await page.waitForTimeout(500);
  n.wartetOhneNetz = await page.evaluate(() => FV.S.wartend()) >= 1;
  await tipp('[data-tun=abmelden]'); await ja();
  await page.waitForFunction(() => /noch nicht gesendet/.test(document.querySelector('#blatt').innerText), null, { timeout: 30000 });
  await bild('abmelden-mit-wartendem-eintrag', 200);
  await ja(); await page.waitForSelector('#anm-los', { timeout: 30000 });
  netzAus = false;
  n.nachAbmelden = await page.evaluate(() => ({ auftraege: FV.B.lesen('auftraege', null), letzte: FV.B.lesen('letzte', null), geo: FV.B.lesen('geo', null), einstellungen: FV.B.lesen('einstellungen', null), fahrt: FV.B.lesen('fahrt', null), kartenstil: FV.B.lesen('kartenstil', null) ? 'da' : null,
    angemeldet: FV.S.angemeldet(), zuhause: FV.app.e.zuhause, imSpeicher: FV.app.z.auftraege.length, festorte: !!(FV.B.lesen('festorte', {}) || {}).lagerhalle, schlange: (FV.B.lesen('schlange', []) || []).map(x => x.wer + ' ' + x.d.ziel) }));
  const a = n.nachAbmelden;
  n.aufgeraeumt = !a.auftraege && !a.letzte && !a.geo && !a.einstellungen && !a.fahrt && !a.kartenstil && !a.angemeldet && !a.zuhause && a.imSpeicher === 0 && a.festorte && a.schlange.length >= 1 && a.schlange.every(x => x.startsWith('admin|Admin ')) && a.schlange.includes('admin|Admin Fahrt vom Admin');
  // anderer Nutzer am selben Handy
  await tipp('[data-a=ma]'); await page.fill('input[name=code]', 'FVZ-0a1b2c3d-0a1b2c3d4e5f'); await page.fill('input[name=pw]', 'lager'); await tipp('#anm-los'); await page.waitForSelector('.auftrag', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const fahrten = () => log.anfragen.filter(x => x.a === 'fahrt_speichern').map(x => x.t + ' ' + x.z);
  n.fremderEintragBleibtLiegen = await page.evaluate(() => FV.S.wartend() === 0 && (FV.B.lesen('schlange', []) || []).length >= 1) && !fahrten().some(x => /vom Admin/.test(x));
  await page.evaluate(() => FV.S.spaeter('fahrt_speichern', { km: 2, ziel: 'Fahrt von Jan' })); await page.waitForTimeout(800);
  n.eigenerEintragGeht = fahrten().includes('b Fahrt von Jan');
  await page.evaluate(() => FV.app.zeige('einstellungen', {}, 'reiter')); await tipp('[data-tun=abmelden]'); await ja(); await page.waitForSelector('#anm-los', { timeout: 30000 });
  // der erste Nutzer meldet sich wieder an: sein Eintrag geht jetzt unter seinem Namen raus
  await tipp('[data-a=admin]'); await page.fill('input[name=pw]', 'test'); await tipp('#anm-los'); await page.waitForSelector('.auftrag', { timeout: 15000 }); await page.waitForTimeout(1500);
  n.fahrtenAmServer = fahrten();
  n.eintragBeimRichtigen = fahrten().includes('a Fahrt vom Admin') && !fahrten().includes('b Fahrt vom Admin') && await page.evaluate(() => FV.S.wartend() === 0 && (FV.B.lesen('schlange', []) || []).length === 0);
  log.neuOk = ['ortOhneFahrt', 'ortInFahrt', 'keinMailRu', 'karteKnopfImmer', 'zurueckTutNichts', 'baeckerUndDiesel', 'keinZurueckPfeil', 'laeuftAufAndererSeite', 'karteKnopfZurueck', 'ansageNurEinmal', 'nachAbweichungWeiter', 'neinBleibt', 'xImVollbild', 'jaBeendet', 'ortNachEndeAus', 'karteOhneFahrt', 'wartetOhneNetz', 'aufgeraeumt', 'fremderEintragBleibtLiegen', 'eigenerEintragGeht', 'eintragBeimRichtigen'].filter(k => n[k] !== true);
});
log.adressen = await page.evaluate(async () => { const aus = {}; for (const a of ['Schulze-Flimmenstraße 20, 26689 Apen-Augustfehn', 'Am Deich 6, Ostrhauderfehn']) { try { aus[a] = await FV.G.finde(a); } catch (e) { aus[a] = String(e); } } return aus; });
log.pois = await page.evaluate(() => (FV.app.z.nav && FV.app.z.nav.route ? FV.app.z.nav.route.pois : []).slice(0, 12).map(p => p.art + ' | ' + p.name + ' | ' + Math.round(p.weg) + ' m | ' + (p.info || '')));
log.kartenfehler = await page.evaluate(() => (window.FV_TEST.kartenfehler || []).slice(0, 12));
log.jsfehler = await page.evaluate(() => (window.FV_TEST.fehler || []).slice(0, 12));
log.karte = await page.evaluate(() => { try { const m = FV.K.map; return { stil: FV.K.stilArt(), ebenen: m.getStyle().layers.length, quellen: Object.keys(m.getStyle().sources) }; } catch (e) { return String(e); } });
console.log(JSON.stringify({ demo: log.demo, demoEnde: log.demoEnde }));
console.log('VERSION 3.1: ' + (log.neuOk && !log.neuOk.length ? 'ALLE PRUEFUNGEN BESTANDEN' : 'NICHT BESTANDEN: ' + JSON.stringify(log.neuOk || 'Pruefung nicht gelaufen')));
console.log(JSON.stringify({ neu: log.neu }, null, 1));
console.log(JSON.stringify({ adressen: log.adressen, pois: log.pois }, null, 1));
console.log(JSON.stringify({ karte: log.karte, dienste: log.dienste, netzfehler: log.netzfehler.slice(0, 10), kartenfehler: log.kartenfehler, wetter: log.wetter }, null, 1));
console.log(JSON.stringify({ schritte: log.schritte, konsole: log.konsole.slice(0, 15), route: log.route, zusatz: log.zusatz, stand: log.stand, ansagen: log.ansagen, jsfehler: log.jsfehler }, null, 1));
fs.writeFileSync(path.join(AUS, 'pruefung.json'), JSON.stringify(log, null, 1));
await browser.close(); srv.close();
