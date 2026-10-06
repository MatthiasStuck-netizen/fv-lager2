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
const log = { live: LIVE, konsole: [], schritte: [], netzfehler: [] };
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.konsole.push(m.type() + ': ' + m.text().slice(0, 300)); });
page.on('pageerror', e => log.konsole.push('FEHLER: ' + String(e).slice(0, 300)));
page.on('requestfailed', r => log.netzfehler.push(r.url().slice(0, 120) + ' ' + (r.failure() || {}).errorText));
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const json = (r, j) => r.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(j) });
await page.route('https://www.fehnverleih.de/**', r => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors }); let d = {}; try { d = JSON.parse(r.request().postData() || '{}'); } catch (e) {} (log.server = log.server || []).push(d.aktion); return json(r, D.server(d)); });
if (LIVE) {
  // Die echte App holt Route, Adressen, Wetter über Android (ohne Browser-Sperren). Hier werden die Anfragen genauso durchgereicht.
  log.dienste = [];
  await page.route(/valhalla1\.openstreetmap\.de|nominatim\.openstreetmap\.org|photon\.komoot\.io|overpass|api\.brightsky\.dev|routing\.openstreetmap\.de/, async r => {
    const q = r.request(); if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    try {
      const a = await r.fetch({ headers: { ...q.headers(), 'user-agent': 'FehnverleihNavi/3.0 (Android; +https://www.fehnverleih.de)', 'accept-language': 'de' }, timeout: 40000 });
      const body = await a.body(); log.dienste.push(q.method() + ' ' + q.url().slice(0, 90) + ' -> ' + a.status() + ' (' + body.length + ' Bytes)');
      return r.fulfill({ status: a.status(), headers: { ...a.headers(), ...cors }, body });
    } catch (e) { log.dienste.push(q.method() + ' ' + q.url().slice(0, 90) + ' -> FEHLER ' + String(e).slice(0, 80)); return r.abort(); }
  });
} else {
  await page.route('**/lib/maplibre-gl.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(hier, 'kartenersatz.js')) }));
  await page.route('**/lib/maplibre-gl.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://valhalla1.openstreetmap.de/**', r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : json(r, r.request().url().includes('trace') ? D.trace : D.valhalla));
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
await versuch('anmeldung', async () => { await bild('anmeldung'); await tipp('[data-a=admin]'); await page.fill('input[name=pw]', 'test'); await tipp('#anm-los'); await page.waitForSelector('.auftrag', { timeout: 15000 }); });
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
  await page.evaluate(() => { for (let i = 0; i < 120; i++) FV.B._simOrt && 0; });
  await bild('ziel-erreicht', 700); await tipp('#blatt [data-tun=blatt-zu]');
});
await versuch('neue-route', async () => {
  await tipp('.kachel[data-tun=ziel-fest]'); await page.waitForSelector('[data-tun=route-start]:not([disabled])', { timeout: 40000 }); await tipp('[data-tun=neueroute]'); await bild('neue-route');
  await page.fill('#zsuche', 'Bäckerei Rhauderfehn'); await tipp('form[data-form=ziel-suchen] button.gold'); await page.waitForTimeout(LIVE ? 5000 : 600); await bild('neue-route-suche');
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
log.kartenfehler = await page.evaluate(() => (window.FV_TEST.kartenfehler || []).slice(0, 12));
log.jsfehler = await page.evaluate(() => (window.FV_TEST.fehler || []).slice(0, 12));
fs.writeFileSync(path.join(AUS, 'pruefung.json'), JSON.stringify(log, null, 1));
log.karte = await page.evaluate(() => { try { const m = FV.K.map; return { stil: FV.K.stilArt(), ebenen: m.getStyle().layers.length, quellen: Object.keys(m.getStyle().sources) }; } catch (e) { return String(e); } });
console.log(JSON.stringify({ karte: log.karte, dienste: log.dienste, netzfehler: log.netzfehler.slice(0, 10), kartenfehler: log.kartenfehler, wetter: log.wetter }, null, 1));
console.log(JSON.stringify({ schritte: log.schritte, konsole: log.konsole.slice(0, 15), route: log.route, zusatz: log.zusatz, stand: log.stand, ansagen: log.ansagen, jsfehler: log.jsfehler }, null, 1));
await browser.close(); srv.close();
