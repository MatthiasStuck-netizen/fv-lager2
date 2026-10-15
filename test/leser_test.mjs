import fs from 'node:fs'; import vm from 'node:vm';
const [,, js, datei] = process.argv;
const ctx = { window: {}, console, Map, Promise, Uint8Array, DataView, ArrayBuffer, Blob, Response, DecompressionStream, Math, JSON, String, Error, Object, Date, setTimeout, clearTimeout };
ctx.window.FV = {}; ctx.FV = ctx.window.FV; ctx.self = ctx.window;
vm.createContext(ctx); vm.runInContext(fs.readFileSync(js, 'utf8'), ctx);
const O = ctx.FV.O;
// Kachel-Nummern aus der Spezifikation
const soll = [[0,0,0,0],[1,0,0,1],[1,0,1,2],[1,1,1,3],[1,1,0,4],[2,0,0,5]];
for (const [z,x,y,id] of soll) if (O._zxyId(z,x,y) !== id) { console.log('FALSCH zxyId', z,x,y, O._zxyId(z,x,y)); process.exit(1); }
const buf = fs.readFileSync(datei); const blob = new Blob([buf]);
const erwart = JSON.parse(fs.readFileSync(datei + '.json', 'utf8'));
const l = new O.Leser(blob);
const k = await l.pruefen();
let ok = 0, falsch = 0;
for (const [key, w] of Object.entries(erwart)) {
  const [z,x,y] = key.split('/').map(Number);
  const d = await l.kachel(z,x,y);
  const ist = d ? new TextDecoder().decode(d) : null;
  if (ist === w) ok++; else { falsch++; if (falsch < 5) console.log('FALSCH', key, 'soll', w, 'ist', ist); }
}
console.log(datei.split('/').pop(), 'maxZ', k.maxZ, 'richtig', ok, 'falsch', falsch);
// unvollständige Datei muss erkannt werden
try { await new O.Leser(new Blob([buf.subarray(0, buf.length - 10)])).pruefen(); console.log('FEHLER: abgeschnittene Datei nicht erkannt'); process.exit(1); }
catch (e) { console.log('abgeschnitten erkannt:', e.message); }
try { await new O.Leser(new Blob([Buffer.from('kaputt'.padEnd(200,'x'))])).pruefen(); console.log('FEHLER'); process.exit(1); } catch (e) { console.log('falsche Datei erkannt:', e.message); }
process.exit(falsch ? 1 : 0);
