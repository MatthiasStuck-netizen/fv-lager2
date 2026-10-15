import fs from 'node:fs'; import vm from 'node:vm';
const [,, js, datei] = process.argv;
const ctx0 = { window: {}, console, Map, Blob, Response, DecompressionStream, Math, JSON, String, Error, Object, Date, setTimeout, clearTimeout, Uint8Array, DataView, ArrayBuffer, Promise };
ctx0.window.FV = {}; ctx0.FV = ctx0.window.FV; vm.createContext(ctx0); vm.runInContext(fs.readFileSync(js, 'utf8'), ctx0);
const quelle = ctx0.FV.O._hintergrund.toString();
const ganz = fs.readFileSync(datei);
const schnitt = Math.floor(ganz.length * 0.6);
const teile = { 'teil-00': ganz.subarray(0, schnitt), 'teil-01': ganz.subarray(schnitt) };
const plan = { datei: 'x', basis: 'https://srv/karten/', teile: [{ name: 'teil-00', groesse: teile['teil-00'].length }, { name: 'teil-01', groesse: teile['teil-01'].length }], gesamt: ganz.length };

let speicher = Buffer.alloc(0);   // die "Datei" im App-Speicher, bleibt zwischen Läufen erhalten
function griff() {
  return { getSize: () => speicher.length, truncate: n => { speicher = Buffer.from(speicher.subarray(0, n)); },
    write: (c, o) => { const end = o.at + c.length; if (end > speicher.length) { const b = Buffer.alloc(end); speicher.copy(b); speicher = b; } Buffer.from(c).copy(speicher, o.at); return c.length; },
    flush: () => {}, close: () => {} };
}
async function lauf(opts) {
  const msgs = [];
  let abbrueche = opts.abbrueche || {};
  const ctx = { console, Promise, Error, Date, Uint8Array, Buffer, Math, JSON, String,
    setTimeout: (f) => setTimeout(f, 0),
    navigator: { storage: { getDirectory: async () => ({ getFileHandle: async () => ({ createSyncAccessHandle: async () => griff() }) }) } },
    fetch: async (url, o) => {
      const name = url.split('/').pop(); const d = teile[name];
      if (!d || opts.fehlt === name) return { status: 404, body: null };
      const rng = o && o.headers && o.headers.Range; let ab = 0, status = 200;
      if (rng && !opts.ohneRange) { ab = +/bytes=(\d+)-/.exec(rng)[1]; status = 206; }
      const daten = d.subarray(ab); let p = 0; const brocken = 7777;
      return { status, body: { getReader: () => ({
        read: async () => {
          if (abbrueche[name] && p + ab > abbrueche[name]) { delete abbrueche[name]; throw new TypeError('network error'); }
          if (opts.haltBei && ctx.self._gesamt > opts.haltBei && !ctx.self._gehalten) { ctx.self._gehalten = true; ctx.self.onmessage({ data: { cmd: 'halt' } }); }
          if (p >= daten.length) return { done: true };
          const c = daten.subarray(p, p + brocken); p += c.length; return { done: false, value: new Uint8Array(c) };
        }, cancel: async () => {} }) } };
    } };
  ctx.self = { postMessage: m => { msgs.push(m); if (m.typ === 'stand') ctx.self._gesamt = m.pos; }, _gesamt: 0 };
  vm.createContext(ctx); vm.runInContext('(' + quelle + ')()', ctx);
  ctx.self.onmessage({ data: { cmd: 'los', plan } });
  for (let i = 0; i < 4000 && !msgs.some(m => ['fertig', 'halt', 'fehler'].includes(m.typ)); i++) await new Promise(r => setTimeout(r, 2));
  return msgs.filter(m => m.typ !== 'stand');
}
const gleich = () => Buffer.compare(speicher, ganz) === 0;
let r;
r = await lauf({ abbrueche: { 'teil-00': 100000, 'teil-01': 50000 } });
console.log('1) zwei Abbrüche, automatischer Neuversuch:', JSON.stringify(r.map(m => m.typ)), gleich() ? 'DATEI RICHTIG' : 'DATEI FALSCH');
speicher = Buffer.alloc(0);
r = await lauf({ haltBei: 200000 });
console.log('2a) angehalten bei', r.at(-1).pos, 'Bytes:', r.at(-1).typ);
r = await lauf({});
console.log('2b) weiter geladen:', r.at(-1).typ, gleich() ? 'DATEI RICHTIG' : 'DATEI FALSCH');
speicher = Buffer.alloc(0);
await lauf({ haltBei: 330000 });
r = await lauf({ ohneRange: true });
console.log('3) Server ohne Teil-Downloads, Fortsetzen:', r.at(-1).typ, gleich() ? 'DATEI RICHTIG' : 'DATEI FALSCH');
speicher = Buffer.alloc(0);
r = await lauf({ fehlt: 'teil-01' });
console.log('4) Teil fehlt auf dem Server:', r.at(-1).typ, r.at(-1).text);
