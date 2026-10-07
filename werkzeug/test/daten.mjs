/* Beispieldaten für Vorschau und Tests (keine echten Kunden). */
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const heute = iso(new Date());
const morgen = iso(new Date(Date.now() + 86400000));
function enc(pts) {
  let out = '', pl = 0, po = 0;
  const e = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>>= 5; } return s + String.fromCharCode(v + 63); };
  for (const [lon, lat] of pts) { const a = Math.round(lat * 1e6), o = Math.round(lon * 1e6); out += e(a - pl) + e(o - po); pl = a; po = o; }
  return out;
}
const eck = [[7.7560, 53.2245], [7.7520, 53.2230], [7.7440, 53.2190], [7.7300, 53.2100], [7.7150, 53.2010], [7.7000, 53.1900], [7.6850, 53.1800], [7.6700, 53.1700], [7.6600, 53.1600], [7.6500, 53.1520], [7.6400, 53.1450], [7.6300, 53.1400], [7.6238, 53.1386]];
export const strecke = [];
eck.forEach((p, i) => { if (!i) return strecke.push(p); const q = eck[i - 1]; for (let k = 1; k <= 8; k++) strecke.push([q[0] + (p[0] - q[0]) * k / 8, q[1] + (p[1] - q[1]) * k / 8]); });
const man = (type, instruction, begin, end, len, time, names, alert) => ({ type, instruction, verbal_pre_transition_instruction: instruction, verbal_transition_alert_instruction: alert || instruction, begin_shape_index: begin, end_shape_index: end, length: len, time, street_names: names });
export const valhalla = { trip: { status: 0, units: 'kilometers', language: 'de-DE', summary: { length: 13.4, time: 960 }, legs: [{ shape: enc(strecke), summary: { length: 13.4, time: 960 }, maneuvers: [
  man(1, 'Nach Südwesten auf Schulze-Flimmenstraße fahren.', 0, 8, 0.3, 40, ['Schulze-Flimmenstraße']),
  man(10, 'Rechts auf Stahlwerkstraße abbiegen.', 8, 16, 0.7, 70, ['Stahlwerkstraße']),
  man(15, 'Links auf B 72 abbiegen.', 16, 56, 6.9, 420, ['B 72'], 'Links auf B 72 abbiegen.'),
  man(26, 'Im Kreisverkehr die 2. Ausfahrt auf L 24 nehmen.', 56, 80, 4.1, 300, ['L 24', 'Rhauderfehner Straße']),
  man(10, 'Rechts auf Hauptstraße abbiegen.', 80, 96, 1.4, 130, ['Hauptstraße']),
  man(4, 'Sie haben Ihr Ziel erreicht.', 96, 96, 0, 0, [])] }] } };
export const trace = { edges: [{ speed_limit: 50, begin_shape_index: 0, end_shape_index: 16 }, { speed_limit: 100, begin_shape_index: 16, end_shape_index: 48 }, { speed_limit: 70, begin_shape_index: 48, end_shape_index: 80 }, { speed_limit: 50, begin_shape_index: 80, end_shape_index: 96 }] };
export const overpass = { elements: [
  { type: 'node', id: 1, lat: 53.2052, lon: 7.7208, tags: { amenity: 'toilets', fee: 'no', wheelchair: 'yes', name: 'Parkplatz Stickhausen' } },
  { type: 'node', id: 2, lat: 53.1568, lon: 7.6566, tags: { amenity: 'toilets', opening_hours: '24/7' } },
  { type: 'node', id: 3, lat: 53.2194, lon: 7.7448, tags: { amenity: 'charging_station', operator: 'EWE Go', capacity: '2', 'socket:type2': '2' } },
  { type: 'node', id: 4, lat: 53.1702, lon: 7.6706, tags: { amenity: 'charging_station', operator: 'EnBW', capacity: '4', 'socket:type2_combo': '4' } },
  { type: 'node', id: 5, lat: 53.1403, lon: 7.6308, tags: { amenity: 'charging_station', name: 'Rathaus Ostrhauderfehn', capacity: '2', 'socket:type2': '2' } },
  { type: 'node', id: 6, lat: 53.1904, lon: 7.7006, tags: { shop: 'bakery', name: 'Bäckerei Ripken', opening_hours: 'Mo-Sa 06:00-18:00' } },
  { type: 'node', id: 7, lat: 53.1603, lon: 7.6606, tags: { amenity: 'fuel', brand: 'Raiffeisen', 'fuel:diesel': 'yes', opening_hours: '24/7' } },
  { type: 'node', id: 8, lat: 53.2300, lon: 7.9000, tags: { amenity: 'cafe', name: 'Weit weg' } }] };
export const orte = [
  [/flimmen|apen|lagerhalle/i, 53.2245, 7.7560, 'Schulze-Flimmenstraße', '20', '26689', 'Apen'],
  [/hauptstra/i, 53.1386, 7.6238, 'Hauptstraße', '12', '26842', 'Ostrhauderfehn'],
  [/industrie/i, 53.1460, 7.6050, 'Industriestraße', '5', '26842', 'Ostrhauderfehn'],
  [/deich/i, 53.1330, 7.6400, 'Am Deich', '6', '26842', 'Ostrhauderfehn'],
  [/schulweg/i, 53.1310, 7.5700, 'Schulweg', '3', '26842', 'Rhauderfehn'],
  [/hlenstra|filsum/i, 53.2350, 7.6300, 'Mühlenstraße', '18', '26849', 'Filsum'],
  [/b.cker/i, 53.1305, 7.5650, 'Untenende', '21', '26817', 'Rhauderfehn', 'Bäckerei Musswessels']];
export function nominatim(q) {
  return orte.filter(o => o[0].test(q)).map(o => ({ lat: String(o[1]), lon: String(o[2]), name: o[7] || '', display_name: `${o[3]} ${o[4]}, ${o[5]} ${o[6]}`, address: { road: o[3], house_number: o[4], postcode: o[5], village: o[6] } }));
}
const bilder = ['partly-cloudy-day', 'cloudy', 'rain', 'cloudy', 'partly-cloudy-day', 'clear-day', 'wind'];
export function wetter() {
  const w = [], t0 = new Date(); t0.setMinutes(0, 0, 0); t0.setHours(0);
  for (let i = 0; i < 6 * 24; i++) {
    const d = new Date(t0.getTime() + i * 3600000), h = d.getHours(), tag = Math.floor(i / 24);
    w.push({ timestamp: d.toISOString(), temperature: 9 + 5 * Math.sin((h - 9) / 24 * 2 * Math.PI) + (tag % 3), precipitation: (tag === 2 && h > 9 && h < 17) ? 1.2 : (h === 15 ? 0.3 : 0), precipitation_probability: tag === 2 ? 80 : 20,
      wind_speed: 14 + tag * 3 + (h % 5), wind_gust_speed: tag === 1 ? 52 + (h % 7) : 28 + tag * 2 + (h % 6), icon: (h < 6 || h > 20) ? 'clear-night' : bilder[(tag + Math.floor(h / 6)) % bilder.length], condition: 'dry', cloud_cover: 60 });
  }
  return { weather: w };
}
export const wetterJetzt = { weather: { temperature: 12.4, wind_speed_30: 18, wind_gust_speed_30: 34, precipitation_60: 0, relative_humidity: 78, icon: 'partly-cloudy-day', condition: 'dry' } };
/* Antworten der Warenwirtschaft */
const A = (id, nr, kunde, adresse, an, ab, typ, status, tel, extra = {}) => ({ id, nr, datum: heute, bis: heute, datum_text: '', ankunft_geplant: an, abfahrt_geplant: ab, kunde, telefon: tel, adresse, typ, status, status_text: status === 'ausgegeben' ? 'Ausgegeben' : 'Bestätigt', notiz: '', ist_ankunft: '', ist_abfahrt: '', abfahrt_ziel: '', ...extra });
export const auftraege = [
  A('a1', 'A-0041', 'Familie Meyer', 'Hauptstraße 12, 26842 Ostrhauderfehn', '08:00', '10:00', 'Lieferung', 'bestaetigt', '04952 123456', { notiz: 'Zelt 6×12 m, Einfahrt hinter dem Haus.' }),
  A('a2', 'A-0042', 'Firma Schmidt', 'Industriestraße 5, 26842 Ostrhauderfehn', '12:30', '16:00', 'Lieferung', 'bestaetigt', '04952 222333'),
  A('a3', 'A-0039', 'Hochzeit Familie Janssen', 'Am Deich 6, 26842 Ostrhauderfehn', '17:00', '23:00', 'Lieferung', 'bestaetigt', '0171 5550101'),
  A('a4', 'A-0035', 'Schule Rhauderfehn', 'Schulweg 3, 26842 Rhauderfehn', '09:00', '11:00', 'Lieferung', 'ausgegeben', '04952 99887'),
  A('a5', 'A-0043', 'Herr Müller', 'Mühlenstraße 18, 26849 Filsum', '14:00', '15:30', 'Lieferung', 'bestaetigt', '0160 4443322'),
  { ...A('a6', 'A-0044', 'Verein Fehntjer Musikanten', 'Hauptstraße 80, 26842 Ostrhauderfehn', '10:00', '', 'Lieferung', 'bestaetigt', ''), datum: morgen, bis: morgen }];
export function server(d) {
  const ma = String(d.token || '').startsWith('b');   // Token des Mitarbeiters (login_ma) beginnt mit b, das des Admins mit a
  const ok = x => ({ typ: 'ok', frei: true, rolle: ma ? 'lager' : 'admin', name: ma ? 'Jan Beispiel' : 'Admin', seit: '', ...x });
  switch (d.aktion) {
    case 'login_admin': return d.passwort === 'test' ? { typ: 'ok', token: 'a'.repeat(64), rolle: 'admin', name: 'Admin' } : { typ: 'err', msg: 'Admin-Passwort falsch.' };
    case 'login_ma': return { typ: 'ok', token: 'b'.repeat(64), rolle: 'lager', name: 'Jan Beispiel' };
    case 'status': return ok({});
    case 'navi_liste': return ok({ auftraege, stand: new Date().toLocaleString('de-DE').slice(0, 17), ziele: { lagerhalle: { name: 'Lagerhalle', adresse: 'Schulze-Flimmenstraße 20, 26689 Apen-Augustfehn' }, verwaltung: { name: 'Verwaltung', adresse: 'Am Deich 6, Ostrhauderfehn' } } });
    case 'navi_zeit': return ok({ zeit: '06.10.2026 08:01', neu: true, ziel: '' });
    case 'navi_anwesend': return ok({ anwesend: [{ name: 'Jan Beispiel', seit: '07:30', dauer: '2:15', mid: 'aa', gast: false, adresse: 'Fehnweg 4, 26842 Ostrhauderfehn', tel: '0170 1112233' }, { name: 'Silke Muster', seit: '08:05', dauer: '1:40', mid: 'bb', gast: false, adresse: 'Kanalstraße 9, 26689 Apen', tel: '0151 9998877' }, { name: 'Tom Aushilfe', seit: '09:00', dauer: '0:45', mid: 'cc', gast: true, adresse: '', tel: '' }] });
    case 'artikel': return ok({ artikel: [{ id: 'z1', name: 'Zelt 6×12 m', kat: 'Zelte', regal: 'A1', bestand: 4, imhaus: 3, defekt: 0 }, { id: 'b1', name: 'Bierzeltgarnitur', kat: 'Möbel', regal: 'B2', bestand: 60, imhaus: 44, defekt: 1 }, { id: 's1', name: 'Stehtisch mit Husse', kat: 'Möbel', regal: 'B4', bestand: 30, imhaus: 22, defekt: 0 }, { id: 'l1', name: 'Lautsprecher-Set', kat: 'Technik', regal: 'T1', bestand: 3, imhaus: 2, defekt: 0 }] });
    case 'auftrag_neu_app': return ok({ nr: 'A-0045', id: 'neu', sonder: !!d.sonderwunsch });
    case 'fahrzeuge': return ok({ fahrzeuge: [{ id: 'f1', name: 'Dacia Spring', kennzeichen: 'LER-FV 24' }, { id: 'f2', name: 'Transporter', kennzeichen: 'LER-FV 7' }] });
    case 'fahrtenbuch_liste': return ok({ fahrten: [{ id: 'x1', fahrer: 'Jan Beispiel', fahrzeug: 'Dacia Spring', ziel: 'Familie Meyer, Hauptstraße 12', start: '05.10.2026 07:42', ende: '05.10.2026 08:06', km_text: '13,6 km', getankt: false }, { id: 'x2', fahrer: 'Jan Beispiel', fahrzeug: 'Dacia Spring', ziel: 'Lagerhalle', start: '05.10.2026 10:15', ende: '05.10.2026 10:41', km_text: '13,9 km', getankt: false }, { id: 'x3', fahrer: 'Silke Muster', fahrzeug: 'Transporter', ziel: 'Firma Schmidt, Industriestraße 5', start: '04.10.2026 12:02', ende: '04.10.2026 12:31', km_text: '15,2 km', getankt: true }] });
    case 'fahrt_speichern': case 'tank_beleg': case 'navi_position': return ok({ msg: 'Gespeichert.' });
    case 'abmelden': return ok({ msg: 'Abgemeldet.' });
    default: return { typ: 'err', msg: 'Unbekannte Aktion.' };
  }
}
