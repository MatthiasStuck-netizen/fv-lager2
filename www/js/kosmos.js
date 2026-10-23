/* Seite „Kosmos“ (Knopf unten in der Leiste): alles Aktuelle aus dem Weltall auf einer Tafel – mit Ansage.
 * Sonne und Mond heute · Raketenstarts (mit Countdown und Livestream) · ISS und Tiangong (wo sie gerade sind, wann man sie sieht)
 * · Menschen im All · Finsternisse · Kometen · Asteroiden-Vorbeiflüge · Planeten am Himmel · Sternschnuppen · Polarlicht.
 * Quellen: The Space Devs (Launch Library 2), RocketLaunch.Live (Ersatz), CelesTrak, NASA/JPL, NOAA SWPC.
 * Sonne, Mond, Planeten, Kometenbahnen und Überflüge rechnet das Handy selbst (js/himmel.js). */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, sym = FV.sym, Se = FV.Seiten, Tun = FV.Tun, X = FV.SX, h = X.h, HI = FV.HIMMEL;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }
  var TAG = 86400000, MIN = 60000;
  var ZUHAUSE = { lat: 53.1317, lon: 7.6233 };   // Ostrhauderfehn, falls der Standort gerade nicht bekannt ist

  FV.SYMBOLE.rakete = '<path d="M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05c.47-.47 1.15-.68 1.81-.55zM11.17 17s3.74-1.55 5.89-3.7c5.4-5.4 4.5-9.62 4.21-10.57-.95-.3-5.17-1.19-10.57 4.21C8.55 9.09 7 12.83 7 12.83zm6.48-2.19c-2.29 2.04-5.58 3.44-5.89 3.57L13.31 22l4.05-4.05c.47-.47.68-1.15.55-1.81zM9 18c0 .83-.34 1.58-.88 2.12C6.94 21.3 2 22 2 22s.7-4.94 1.88-6.12A2.996 2.996 0 0 1 9 18m4-9c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2"/>';

  /* ====================== Feste Termine ====================== */
  /* Sonnenfinsternisse (NASA): Datum, Art, wo zu sehen, in Deutschland zu sehen?, Hinweis für Deutschland */
  var SOFI = [
    ['2027-02-06', 'ringförmig', 'Südamerika, Südatlantik, Westafrika', false, ''],
    ['2027-08-02', 'total', 'Südspanien, Nordafrika, Ägypten, Arabien', true, 'In Deutschland als teilweise (partielle) Finsternis am späten Vormittag zu sehen.'],
    ['2028-01-26', 'ringförmig', 'Ecuador, Peru, Brasilien, Atlantik', false, ''],
    ['2028-07-22', 'total', 'Australien, Neuseeland', false, ''],
    ['2029-01-14', 'partiell', 'Nordamerika', false, ''],
    ['2029-06-12', 'partiell', 'Arktis, hoher Norden', false, ''],
    ['2029-07-11', 'partiell', 'Südspitze Südamerikas', false, ''],
    ['2029-12-05', 'partiell', 'Antarktis, Südspitze Südamerikas', false, ''],
    ['2030-06-01', 'ringförmig', 'Nordafrika, Griechenland, Türkei, Russland, Japan', true, 'In Deutschland als teilweise (partielle) Finsternis am Morgen zu sehen.'],
    ['2030-11-25', 'total', 'Südliches Afrika, Australien', false, '']
  ];
  /* Mondfinsternisse: Zeitpunkt der größten Verfinsterung (deutsche Zeit), Art, in Deutschland zu sehen?, Hinweis */
  var MOFI = [
    ['2027-02-21T00:14', 'Halbschatten', true, 'Nur leichte Abdunklung – mit bloßem Auge kaum zu erkennen.'],
    ['2027-08-17T09:14', 'Halbschatten', false, 'Von Deutschland aus nicht zu sehen.'],
    ['2028-01-12T05:14', 'partiell', true, 'Nur ein kleiner Teil des Mondes wird dunkel.'],
    ['2028-07-06T20:20', 'partiell', false, 'Von Deutschland aus nicht zu sehen – der Mond geht erst danach auf.'],
    ['2028-12-31T17:53', 'total', true, 'Silvester! Die Totalität beginnt kurz nach Mondaufgang.'],
    ['2029-06-26T05:23', 'total', true, 'Nur teilweise – der Mond geht während der Totalität unter.'],
    ['2029-12-20T23:43', 'total', true, 'Beste Bedingungen: ganz zu sehen, der Mond steht hoch.'],
    ['2030-06-15T20:34', 'partiell', true, 'Etwa der halbe Mond wird dunkel – am besten gleich nach Mondaufgang.'],
    ['2030-12-09T23:28', 'Halbschatten', true, 'Nur leichte Abdunklung.']
  ];
  /* Sternschnuppen: Name, Höhepunkt (Monat, Tag), aktiv von/bis (Monat, Tag), Sternschnuppen je Stunde unter bestem Himmel */
  var STROEME = [
    ['Quadrantiden', [1, 3], [12, 28], [1, 12], 110], ['Lyriden', [4, 22], [4, 14], [4, 30], 18], ['Eta-Aquariiden', [5, 6], [4, 19], [5, 28], 50],
    ['Perseiden', [8, 12], [7, 17], [8, 24], 100], ['Draconiden', [10, 8], [10, 6], [10, 10], 10], ['Orioniden', [10, 21], [10, 2], [11, 7], 20],
    ['Tauriden', [11, 5], [9, 10], [11, 20], 5], ['Leoniden', [11, 17], [11, 6], [11, 30], 15], ['Geminiden', [12, 14], [12, 4], [12, 20], 150], ['Ursiden', [12, 22], [12, 17], [12, 26], 10]
  ];
  var PLANET_NAME = { merkur: 'Merkur', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' };

  /* ====================== Zustand, Zwischenspeicher ====================== */
  var K = { starts: null, startsZeit: 0, startsQuelle: '', astronauten: null, stationen: null, kometen: null, asteroiden: null, kp: null, fehler: {} };
  var laeuft = {}, takt = null;
  function merk(k) { var x = B.lesen('kos_' + k, null); return x && x.t ? x : null; }
  function merken(k, d) { B.schreiben('kos_' + k, { t: Date.now(), d: d }); }
  /** lädt einmal und merkt es sich dauer ms lang; danach still im Hintergrund neu */
  function holen(k, dauer, fn) {
    var m = merk(k);
    if (m && !K[k]) K[k] = m.d;
    if (m && Date.now() - m.t < dauer) return;
    if (laeuft[k]) return; laeuft[k] = true;
    fn().then(function (d) { laeuft[k] = false; if (d != null) { K[k] = d; merken(k, d); delete K.fehler[k]; } zeigen(); },
      function (e) { laeuft[k] = false; K.fehler[k] = (e && e.message) || 'nicht erreichbar'; zeigen(); });
  }
  function ort() { var o = B.ort(); return o && typeof o.lat === 'number' ? { lat: o.lat, lon: o.lon, eigen: true } : { lat: ZUHAUSE.lat, lon: ZUHAUSE.lon, eigen: false }; }

  /* ====================== Daten holen ====================== */
  var LL = 'https://ll.thespacedevs.com/2.3.0';
  var STATUS = { 'Go': 'Startbereit', 'TBD': 'Termin offen', 'TBC': 'Termin unbestätigt', 'Success': 'Erfolgreich gestartet', 'Failure': 'Fehlgeschlagen', 'Hold': 'Angehalten', 'In Flight': 'Im Flug', 'Partial Failure': 'Teilweise fehlgeschlagen' };
  function startsHolen() {
    return B.json({ url: LL + '/launches/upcoming/?limit=15&mode=detailed', kopf: { Accept: 'application/json' }, zeit: 20000 }).then(function (j) {
      if (!j || !Array.isArray(j.results)) throw new Error('leer');
      K.startsQuelle = 'The Space Devs';
      return j.results.map(function (x) {
        var r = x.rocket && x.rocket.configuration || {}, m = x.mission || {}, p = x.pad || {}, st = x.status || {};
        var vids = (x.vid_urls || (m.vid_urls) || []).map(function (v) { return { url: v.url, titel: v.title || v.publisher || 'Livestream', live: !!v.live, quelle: v.publisher || '' }; }).filter(function (v) { return /^https?:/.test(v.url || ''); });
        return { name: x.name, zeit: Date.parse(x.net), genau: x.net_precision && x.net_precision.abbrev, fensterBis: x.window_end ? Date.parse(x.window_end) : null,
          status: STATUS[st.abbrev] || st.name || '', statusK: st.abbrev || '', rakete: r.full_name || r.name || '', firma: x.launch_service_provider && x.launch_service_provider.name || '',
          mission: m.name || '', art: m.type || '', bahn: m.orbit && m.orbit.name || '', text: m.description || '', platz: p.name || '', ort: p.location && p.location.name || '', land: p.country || '',
          lat: p.latitude != null ? +p.latitude : null, lon: p.longitude != null ? +p.longitude : null, chance: x.probability, live: !!x.webcast_live, vids: vids,
          bild: x.image && typeof x.image === 'object' ? { url: x.image.image_url, credit: x.image.credit || '', lizenz: x.image.license && x.image.license.name || '' } : typeof x.image === 'string' ? { url: x.image } : null };
      });
    }).catch(function (e) {
      // Ersatz: RocketLaunch.Live (frei, die nächsten 5 Starts, ohne Livestreams)
      return B.json({ url: 'https://fdo.rocketlaunch.live/json/launches/next/5', zeit: 15000 }).then(function (j) {
        if (!j || !Array.isArray(j.result)) throw e;
        K.startsQuelle = 'RocketLaunch.Live';
        return j.result.map(function (x) {
          var p = x.pad || {}, l = p.location || {}, zeit = x.t0 ? Date.parse(x.t0) : x.win_open ? Date.parse(x.win_open) : x.sort_date ? +x.sort_date * 1000 : null;
          return { name: (x.vehicle && x.vehicle.name || '') + ' | ' + (x.name || ''), zeit: zeit, genau: x.t0 || x.win_open ? 'MIN' : 'DAY', status: x.result === 1 ? 'Erfolgreich gestartet' : x.result === 0 ? 'Fehlgeschlagen' : '',
            statusK: '', rakete: x.vehicle && x.vehicle.name || '', firma: x.provider && x.provider.name || '', mission: x.name || '', art: '', bahn: '', text: x.launch_description || '',
            platz: p.name || '', ort: l.name || '', land: l.country || '', lat: null, lon: null, chance: null, live: false, vids: [] };
        });
      });
    });
  }
  function astronautenHolen() {
    return B.json({ url: LL + '/astronauts/?in_space=true&limit=40&mode=list', zeit: 20000 }).then(function (j) {
      if (!j || !Array.isArray(j.results)) throw new Error('leer');
      return { zahl: j.count != null ? j.count : j.results.length, namen: j.results.map(function (a) { return { name: a.name, agentur: a.agency && (a.agency.abbrev || a.agency.name) || '' }; }) };
    });
  }
  function stationenHolen() {
    var urls = ['https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json', 'https://celestrak.com/NORAD/elements/gp.php?GROUP=stations&FORMAT=json'];
    function frag(i) {
      return B.json({ url: urls[i], zeit: 20000 }).then(function (l) {
        if (!Array.isArray(l)) throw new Error('leer');
        var aus = l.filter(function (o) { return o.NORAD_CAT_ID === 25544 || o.NORAD_CAT_ID === 48274; });
        if (!aus.length) throw new Error('ISS nicht dabei');
        return aus;
      }).catch(function (e) { if (i + 1 < urls.length) return frag(i + 1); throw e; });
    }
    return frag(0);
  }
  function kometenHolen() {
    var j0 = HI.jd(Date.now());
    var bed = { AND: ['q|LT|3.5', 'tp|RG|' + Math.round(j0 - 200) + '|' + Math.round(j0 + 550)] };
    return B.json({ url: 'https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,e,q,tp,i,om,w,M1,K1&sb-kind=c&sb-cdata=' + encodeURIComponent(JSON.stringify(bed)), zeit: 25000 }).then(function (j) {
      if (!j || !Array.isArray(j.data)) throw new Error('leer');
      return j.data.map(function (r) { return { name: String(r[0]).trim(), e: +r[1], q: +r[2], tp: +r[3], i: +r[4], om: +r[5], w: +r[6], M1: r[7] == null ? null : +r[7], K1: r[8] == null ? null : +r[8] }; })
        .filter(function (k) { return k.M1 != null && !isNaN(k.e) && !isNaN(k.tp); });
    });
  }
  function asteroidenHolen() {
    return B.json({ url: 'https://ssd-api.jpl.nasa.gov/cad.api?date-min=now&date-max=%2B60&dist-max=0.02&fullname=true&sort=date', zeit: 25000 }).then(function (j) {
      if (!j || !Array.isArray(j.fields)) throw new Error('leer');
      var f = j.fields, ix = function (n) { return f.indexOf(n); };
      return (j.data || []).map(function (r) {
        var t = Date.parse(String(r[ix('cd')]).replace(/^(\d{4})-(\w{3})-(\d{2}) (\d{2}:\d{2})$/, function (a, y, mo, d, hm) { return y + '-' + ('0' + (['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(mo) + 1)).slice(-2) + '-' + d + 'T' + hm + ':00Z'; }));
        return { name: String(r[ix('fullname')] || r[ix('des')]).trim(), zeit: t, ae: +r[ix('dist')], tempo: +r[ix('v_rel')], H: r[ix('h')] == null ? null : +r[ix('h')] };
      }).filter(function (a) { return !isNaN(a.zeit); });
    });
  }
  function kpHolen() {
    return B.json({ url: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json', zeit: 20000 }).then(function (j) {
      if (!Array.isArray(j) || !j.length) throw new Error('leer');
      var l = Array.isArray(j[0]) ? j.slice(1).map(function (r) { return { t: r[0], kp: +r[1], art: r[2] }; }) : j.map(function (r) { return { t: r.time_tag, kp: +r.kp, art: r.observed }; });
      return l.map(function (r) { return { t: Date.parse(String(r.t).replace(' ', 'T') + (/[zZ]$/.test(r.t) ? '' : 'Z')), kp: r.kp, vorher: /predict/i.test(r.art || '') }; }).filter(function (r) { return !isNaN(r.t) && !isNaN(r.kp); });
    });
  }
  function allesHolen(neu) {
    if (neu) { ['starts', 'astronauten', 'stationen', 'kometen', 'asteroiden', 'kp'].forEach(function (k) { B.schreiben('kos_' + k, null); }); }
    holen('starts', 20 * MIN, startsHolen);          // Launch Library erlaubt nur wenige Abrufe je Stunde
    holen('astronauten', 12 * 60 * MIN, astronautenHolen);
    holen('stationen', 12 * 60 * MIN, stationenHolen);
    holen('kometen', 24 * 60 * MIN, kometenHolen);
    holen('asteroiden', 6 * 60 * MIN, asteroidenHolen);
    holen('kp', 30 * MIN, kpHolen);
  }

  /* ====================== Rechnen ====================== */
  function uhr(t) { return t ? G.uhr(new Date(t)) : '–'; }
  function tagText(t) {
    var d = new Date(t), heute = new Date(); heute.setHours(0, 0, 0, 0);
    var tg = new Date(d); tg.setHours(0, 0, 0, 0); var diff = Math.round((tg - heute) / TAG);
    if (diff === 0) return 'heute'; if (diff === 1) return 'morgen'; if (diff === -1) return 'gestern'; if (diff === 2) return 'übermorgen';
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + (d.getFullYear() !== heute.getFullYear() ? d.getFullYear() : '');
  }
  function datumLang(t) { return new Date(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function inTagen(t) { var n = Math.ceil((t - Date.now()) / TAG); return n <= 0 ? 'heute' : n === 1 ? 'morgen' : n > 730 ? 'in ' + Math.round(n / 365.25) + ' Jahren' : 'in ' + n.toLocaleString('de-DE') + ' Tagen'; }
  /** für die Ansage: „heute“, „morgen“ oder „am Montag, 26. Oktober“ */
  function sprechTag(t) { var x = tagText(t); return /^(heute|morgen|übermorgen|gestern)$/.test(x) ? x : 'am ' + new Date(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function dauer(ms) { var m = Math.round(ms / MIN); return Math.floor(m / 60) + ' Std. ' + (m % 60) + ' Min.'; }
  function zahl(x, st) { return Number(x).toLocaleString('de-DE', { maximumFractionDigits: st || 0, minimumFractionDigits: st || 0 }); }
  function countdown(t) {
    var s = Math.round((t - Date.now()) / 1000), vor = s >= 0 ? 'T− ' : 'T+ '; s = Math.abs(s);
    var d = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
    return vor + (d ? d + ' T. ' : '') + ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2) + ':' + ('0' + ss).slice(-2);
  }
  /** Genauigkeit des Termins: 'zeit' (Uhrzeit steht fest), 'tag' (nur der Tag) oder 'grob' (Monat, Quartal, Jahr) */
  function genau(s) { var g = String(s.genau || 'MIN').toUpperCase(); return /^(SEC|MIN|HR|H|SECOND|MINUTE|HOUR)$/.test(g) ? 'zeit' : /^(DAY|D)$/.test(g) ? 'tag' : 'grob'; }
  function startZeit(s) {
    if (!s.zeit) return 'Termin offen';
    var g = genau(s);
    if (g === 'grob') return new Date(s.zeit).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) + ' (Termin grob)';
    if (g === 'tag') return tagText(s.zeit) + ' (Uhrzeit offen)';
    return tagText(s.zeit) + ' ' + uhr(s.zeit);
  }
  function stromJahr(m, j) { return new Date(j, m[0] - 1, m[1], 12).getTime(); }
  /** aktiver und nächster Sternschnuppenstrom */
  function stroeme(now) {
    var j = new Date(now).getFullYear(), aus = [];
    [j - 1, j, j + 1].forEach(function (jj) {
      STROEME.forEach(function (s) {
        var hp = stromJahr(s[1], jj), von = stromJahr(s[2], s[2][0] > s[1][0] ? jj - 1 : jj), bis = stromJahr(s[3], s[3][0] < s[1][0] ? jj + 1 : jj) + TAG / 2;
        aus.push({ name: s[0], hoch: hp, von: von, bis: bis, zhr: s[4] });
      });
    });
    return { aktiv: aus.filter(function (s) { return s.von <= now && now <= s.bis; }).sort(function (a, b) { return a.hoch - b.hoch; }),
      naechste: aus.filter(function (s) { return s.hoch > now; }).sort(function (a, b) { return a.hoch - b.hoch; }).slice(0, 3) };
  }
  /** Ab welchem Kp-Wert Polarlicht an diesem Breitengrad möglich ist (grob, für Europa) */
  function kpNoetig(lat) { return Math.max(3, Math.min(9, 5 + (54 - lat) / 2)); }
  /** Kometen: Helligkeit über die nächsten 12 Monate, hellster Tag, jetzige Helligkeit */
  function kometenAuswerten(o) {
    var now = Date.now();
    return (K.kometen || []).map(function (k) {
      var best = null, jetzt = HI.komet(k, now);
      for (var t = now; t < now + 365 * TAG; t += 2 * TAG) { var g = HI.komet(k, t); if (g.mag != null && (!best || g.mag < best.mag)) { best = g; best.t = t; } }
      if (!best) return null;
      return { k: k, name: k.name, jetzt: jetzt, best: best, peri: HI.msAusJd(k.tp) };
    }).filter(function (x) { return x && x.best.mag <= 11; }).sort(function (a, b) { return a.best.mag - b.best.mag; }).slice(0, 6);
  }
  function magText(m) { return m <= 6 ? 'mit bloßem Auge' : m <= 9 ? 'mit Fernglas' : 'nur mit Teleskop'; }
  function himmelText(sicht) {
    var t = [];
    if (sicht.abend) t.push('abends im ' + HI.richtung(sicht.abend.richtung));
    if (sicht.mitternacht && !(sicht.abend && sicht.morgen)) t.push('um Mitternacht im ' + HI.richtung(sicht.mitternacht.richtung));
    if (sicht.morgen) t.push('morgens im ' + HI.richtung(sicht.morgen.richtung));
    if (sicht.abend && sicht.morgen) return 'die ganze Nacht (abends im ' + HI.richtung(sicht.abend.richtung) + ', morgens im ' + HI.richtung(sicht.morgen.richtung) + ')';
    return t.join(', ');
  }
  function planeten(o) {
    var now = Date.now();
    return ['merkur', 'venus', 'mars', 'jupiter', 'saturn'].map(function (p) {
      var g = HI.planet(p, now), s = HI.sichtbar(function (t) { return HI.planet(p, t); }, now, o, p === 'merkur' || p === 'venus' ? 4 : 8);
      var t = g.elong < 15 ? 'steht zu nah an der Sonne – nicht zu sehen' : himmelText(s) || 'gerade nicht gut zu sehen';
      return { name: PLANET_NAME[p], text: t, sichtbar: !!(s.abend || s.morgen || s.mitternacht) && g.elong >= 15, entf: g.delta };
    });
  }
  var passCache = { schl: '', l: null };
  function ueberfluege(o) {
    var st = K.stationen; if (!st || !st.length) return null;
    var schl = st.map(function (x) { return x.EPOCH; }).join() + '|' + o.lat.toFixed(2) + o.lon.toFixed(2) + '|' + Math.floor(Date.now() / (10 * MIN));
    if (passCache.schl === schl) return passCache.l;
    var l = [];
    st.forEach(function (x) {
      var b = HI.bahn(x), name = x.NORAD_CAT_ID === 25544 ? 'ISS' : 'Tiangong';
      HI.ueberfluege(b, Date.now() - 5 * MIN, o, 4).forEach(function (p) { if (p.sichtAnf && p.ende > Date.now()) l.push(Object.assign({ station: name }, p)); });
    });
    l.sort(function (a, b) { return a.sichtAnf - b.sichtAnf; });
    passCache = { schl: schl, l: l.slice(0, 8) };
    return passCache.l;
  }
  function stationJetzt(nr, o) {
    var x = (K.stationen || []).filter(function (s) { return s.NORAD_CAT_ID === nr; })[0]; if (!x) return null;
    return HI.stationVonOrt(HI.bahn(x), Date.now(), o);
  }
  function breite(lat, lon) { return zahl(Math.abs(lat), 1) + '° ' + (lat >= 0 ? 'N' : 'S') + ', ' + zahl(Math.abs(lon), 1) + '° ' + (lon >= 0 ? 'O' : 'W'); }
  function stationZeile(s) {
    if (!s) return '';
    return 'über ' + breite(s.lat, s.lon) + ' · ' + zahl(s.hoehe) + ' km hoch · ' + zahl(Math.round(s.tempo / 100) * 100) + ' km/h · ' + (s.hoeheGrad > 0 ? '<b class="kos-gruen">jetzt über dem Horizont (' + zahl(s.hoeheGrad) + '° im ' + HI.richtung(s.richtung) + ')</b>' : zahl(s.entf) + ' km entfernt');
  }

  /* ====================== Anzeige ====================== */
  Se.kosmos = function () {
    X.seite(X.kopf('Kosmos', '<button class="rand kasten" data-tun="kos-ansage" aria-label="Ansagen">' + sym('ton') + '</button><button class="rand kasten" data-tun="kos-neu" aria-label="Neu laden">' + sym('neu') + '</button>', false) +
      '<div class="rollen" id="kosliste"></div>');
    allesHolen(false);
    zeigen();
    clearInterval(takt); takt = setInterval(laufend, 1000);
  };
  Se.kosmos_weg = function () { clearInterval(takt); takt = null; };
  Tun['kos-neu'] = function () { A().toast('Wird neu geladen …'); allesHolen(true); };

  function abschnitt(symbol, titel, inhalt) { return '<h3 class="ueber">' + sym(symbol) + h(titel) + '</h3>' + inhalt; }
  function zeile(symbol, titel, unter, ende, tun, extra) {
    return '<div class="eintrag' + (tun ? ' tippbar' : '') + (extra && extra.cls ? ' ' + extra.cls : '') + '"' + (tun ? ' data-tun="' + tun + '"' + (extra && extra.i != null ? ' data-i="' + extra.i + '"' : '') + (extra && extra.nr != null ? ' data-nr="' + extra.nr + '"' : '') : '') + '>' + sym(symbol) +
      '<div class="txt"><b style="white-space:normal">' + titel + '</b>' + (unter ? '<span style="white-space:normal">' + unter + '</span>' : '') + '</div>' + (ende ? '<div class="ende">' + ende + '</div>' : '') + '</div>';
  }
  function laden(k, text) { return K.fehler[k] && !K[k] ? '<div class="fehler">' + h(text) + ' gerade nicht erreichbar (' + h(K.fehler[k]) + ').</div>' : X.laedt(text + ' werden geladen …'); }

  function zeigen() {
    var box = $('#kosliste'); if (!box) return;
    var o = ort(), now = Date.now(), html = '';
    if (!o.eigen) html += '<p class="klein2" style="margin:2px 4px 6px">Standort noch nicht bekannt – gerechnet für Ostrhauderfehn.</p>';

    /* --- Sonne und Mond --- */
    var so = HI.sonnenTag(now, o), mo = HI.mondTag(now, o), li = HI.mondLicht(now), voll = HI.naechsteMondphase(now, true), neu = HI.naechsteMondphase(now, false);
    var sh = HI.sonnenHoehe(now, o), mh = HI.mondOrt(now, o);
    html += abschnitt('sonne', 'Sonne und Mond heute',
      '<div class="kos-kacheln">' +
      '<div class="kos-kachel">' + sym('sonne') + '<div><b>↑ ' + uhr(so.auf) + '  ↓ ' + uhr(so.unter) + '</b><span>Sonne geht auf / unter</span></div></div>' +
      '<div class="kos-kachel">' + sym('uhr') + '<div><b>' + (so.laenge ? dauer(so.laenge) : '–') + '</b><span>Tageslänge</span></div></div>' +
      '<div class="kos-kachel">' + sym('nacht') + '<div><b>' + uhr(so.buergerEnde) + ' / ' + uhr(so.astroEnde) + '</b><span>Dämmerung / ganz dunkel</span></div></div>' +
      '<div class="kos-kachel">' + sym('mond') + '<div><b>↑ ' + uhr(mo.auf) + '  ↓ ' + uhr(mo.unter) + '</b><span>Mond geht auf / unter</span></div></div>' +
      '</div>' +
      zeile('mond', mondBild(li.phase) + ' ' + h(HI.phasenName(li.phase)) + ' · ' + zahl(li.anteil * 100) + ' % beleuchtet',
        'Vollmond ' + h(tagText(voll)) + ' ' + uhr(voll) + ' · Neumond ' + h(tagText(neu)) + ' ' + uhr(neu) + ' · ' + zahl(li.dist) + ' km entfernt') +
      zeile('sonne', 'Gerade jetzt', 'Sonne ' + (sh > 0 ? zahl(sh) + '° hoch im ' + HI.richtung(HI.horizont(HI.sonne(now).ra, HI.sonne(now).dec, now, o).richtung) : 'unter dem Horizont') +
        ' · Mond ' + (mh.hoehe > 0 ? zahl(mh.hoehe) + '° hoch im ' + HI.richtung(mh.richtung) : 'unter dem Horizont'), '', null));

    /* --- Raketenstarts --- */
    var st = (K.starts || []).filter(function (s) { return !s.zeit || s.zeit > now - 6 * 3600000; }).slice(0, 10);
    html += abschnitt('rakete', 'Raketenstarts', !st.length ? laden('starts', 'Raketenstarts') : st.map(function (s, i) {
      var nah = s.zeit && s.zeit - now < 2 * TAG && s.zeit - now > -3 * 3600000 && genau(s) === 'zeit' && !/Success|Failure/.test(s.statusK);
      var live = s.live || s.vids.some(function (v) { return v.live; });
      return zeile('rakete', h(s.rakete || s.name) + (s.mission ? ' · ' + h(s.mission) : ''),
        h(startZeit(s)) + ' · ' + h([s.ort.split(',')[0], s.land].filter(Boolean).join(', ')) + (s.status ? ' · <i class="' + (/Erfolg/.test(s.status) ? 'kos-gruen' : /Fehl|Angehalten/.test(s.status) ? 'kos-rot' : '') + '">' + h(s.status) + '</i>' : ''),
        (live ? '<b class="kos-live">LIVE</b>' : '') + (nah ? '<b class="wert kos-count" data-t="' + s.zeit + '">' + countdown(s.zeit) + '</b>' : '') + sym('rechts'), 'kos-start', { i: i, cls: nah ? 'kos-bald' : '' });
    }).join('') + (st.length ? '<p class="klein2" style="margin:0 4px 6px">Antippen: Mission, Startplatz und Livestream.</p>' : ''));

    /* --- Raumstationen --- */
    var iss = stationJetzt(25544, o), tg = stationJetzt(48274, o), pl = ueberfluege(o);
    html += abschnitt('satellit', 'Raumstationen live', !K.stationen ? laden('stationen', 'Bahndaten der Raumstationen') :
      zeile('satellit', 'ISS – Internationale Raumstation', '<span id="kos-iss">' + stationZeile(iss) + '</span>', sym('rechts'), 'kos-station', { nr: 25544 }) +
      (tg ? zeile('satellit', 'Tiangong – chinesische Raumstation', '<span id="kos-tg">' + stationZeile(tg) + '</span>', sym('rechts'), 'kos-station', { nr: 48274 }) : '') +
      (pl && pl.length ? '<p class="klein2" style="margin:6px 4px">Mit bloßem Auge zu sehen (heller, ruhig ziehender Punkt):</p>' + pl.map(function (p) {
        return zeile('stern', h(p.station) + ' · ' + h(tagText(p.sichtAnf)) + ' ' + uhr(p.sichtAnf) + ' – ' + uhr(p.sichtEnde),
          'von ' + HI.richtung(p.vonRicht) + ' nach ' + HI.richtung(p.nachRicht) + ' · bis ' + zahl(p.sichtMax) + '° hoch ' + (p.sichtMax > 60 ? '(fast über Ihnen)' : 'im ' + HI.richtung(p.sichtMaxRicht)) + (p.sichtEnde < p.ende - 30000 ? ' · verschwindet dann im Erdschatten' : ''), '<b class="wert">' + zahl(p.sichtMax) + '°</b>');
      }).join('') : '<p class="klein2" style="margin:6px 4px">In den nächsten 4 Tagen kein sichtbarer Überflug der Raumstationen hier.</p>'));

    /* --- Menschen im All --- */
    var as = K.astronauten;
    html += abschnitt('person', 'Menschen im All', !as ? laden('astronauten', 'Daten') :
      zeile('leute', zahl(as.zahl) + ' Menschen sind gerade im Weltall', h(as.namen.map(function (a) { return a.name + (a.agentur ? ' (' + a.agentur + ')' : ''); }).join(', '))));

    /* --- Finsternisse --- */
    var sf = SOFI.filter(function (f) { return Date.parse(f[0] + 'T23:59:00') > now; }), mf = MOFI.filter(function (f) { return Date.parse(f[0]) + 3 * 3600000 > now; });
    var sfDe = sf.filter(function (f) { return f[3]; })[0], mfDe = mf.filter(function (f) { return f[2]; })[0];
    html += abschnitt('sonne', 'Finsternisse',
      (sf[0] ? zeile('sonne', 'Sonnenfinsternis (' + h(sf[0][1]) + ') · ' + h(datumLang(Date.parse(sf[0][0] + 'T12:00:00'))), h(sf[0][2]) + ' · ' + h(sf[0][3] ? sf[0][4] : 'In Deutschland nicht zu sehen.'), '<b class="wert">' + inTagen(Date.parse(sf[0][0] + 'T12:00:00')) + '</b>', 'kos-fin') : '') +
      (sfDe && sfDe !== sf[0] ? zeile('sonne', 'In Deutschland: ' + h(datumLang(Date.parse(sfDe[0] + 'T12:00:00'))), h(sfDe[4]), '<b class="wert">' + inTagen(Date.parse(sfDe[0] + 'T12:00:00')) + '</b>', 'kos-fin') : '') +
      (mf[0] ? zeile('mond', 'Mondfinsternis (' + h(mf[0][1]) + ') · ' + h(datumLang(Date.parse(mf[0][0]))) + ', ' + uhr(Date.parse(mf[0][0])), h(mf[0][3]), '<b class="wert">' + inTagen(Date.parse(mf[0][0])) + '</b>', 'kos-fin') : '') +
      (mfDe && mfDe !== mf[0] ? zeile('mond', 'In Deutschland: ' + h(datumLang(Date.parse(mfDe[0]))) + ', ' + uhr(Date.parse(mfDe[0])), h(mfDe[1] + ' – ' + mfDe[3]), '<b class="wert">' + inTagen(Date.parse(mfDe[0])) + '</b>', 'kos-fin') : ''));

    /* --- Kometen --- */
    var ko = K.kometen ? kometenAuswerten(o) : null;
    html += abschnitt('stern', 'Kometen', !ko ? laden('kometen', 'Kometendaten') :
      (ko.length ? ko.map(function (x) {
        var hell = x.best, jetztM = x.jetzt.mag;
        return zeile('stern', h(x.name), 'Am hellsten ' + (hell.t - now < 3 * TAG ? 'jetzt' : h(tagText(hell.t))) + ' mit etwa ' + zahl(hell.mag, 1) + ' mag – ' + magText(hell.mag) +
          ' · jetzt ' + zahl(jetztM, 1) + ' mag · Sonnennähe ' + h(tagText(x.peri)) + ' · ' + zahl(hell.delta * 149.6, 0) + ' Mio. km von der Erde' + (hell.elong < 25 ? ' · steht dann nah an der Sonne' : ''),
          '<b class="wert">' + zahl(hell.mag, 1) + '</b>');
      }).join('') : '<p class="klein2" style="margin:2px 4px 8px">Im nächsten Jahr wird voraussichtlich kein Komet heller als 11 mag (Fernglas/kleines Teleskop).</p>') +
      zeile('stern', 'Halleyscher Komet', 'Kommt wieder am 28. Juli 2061.', '<b class="wert">' + inTagen(Date.parse('2061-07-28T12:00:00')) + '</b>') +
      '<p class="klein2" style="margin:0 4px 8px">Je kleiner die Zahl (mag), desto heller. Bis 6 mag mit bloßem Auge, bis 9 mag mit Fernglas. Kometen sind schwer vorherzusagen – sie werden oft heller oder schwächer als gerechnet.</p>');

    /* --- Asteroiden --- */
    var ast = K.asteroiden;
    html += abschnitt('stern', 'Asteroiden fliegen vorbei', !ast ? laden('asteroiden', 'Asteroidendaten') :
      (ast.length ? ast.slice(0, 6).map(function (a) {
        var km = a.ae * 149597871, md = km / 384400, d = a.H != null ? Math.round(1329 / Math.sqrt(0.14) * Math.pow(10, -a.H / 5) * 1000) : null;
        return zeile('stern', h(a.name), h(tagText(a.zeit)) + ' ' + uhr(a.zeit) + ' · ' + zahl(km / 1e6, 2) + ' Mio. km (' + zahl(md, 1) + '-fache Mondentfernung)' + (d ? ' · etwa ' + (d >= 1000 ? zahl(d / 1000, 1) + ' km' : zahl(d) + ' m') + ' groß' : '') + ' · ' + zahl(a.tempo, 1) + ' km/s',
          '<b class="wert">' + zahl(md, 1) + '×</b>');
      }).join('') + '<p class="klein2" style="margin:0 4px 8px">Alle fliegen sicher an der Erde vorbei. Zahl rechts: Abstand in Mondentfernungen.</p>' : '<p class="klein2">In den nächsten 60 Tagen kommt kein Asteroid näher als 8 Mondentfernungen.</p>'));

    /* --- Planeten --- */
    html += abschnitt('stern', 'Planeten heute Nacht', planeten(o).map(function (p) {
      return zeile(p.sichtbar ? 'stern' : 'stern_leer', h(p.name), h(p.text) + ' · ' + zahl(p.entf * 149.6, 0) + ' Mio. km entfernt', '', null, { cls: p.sichtbar ? '' : 'kos-matt' });
    }).join(''));

    /* --- Sternschnuppen --- */
    var sr = stroeme(now);
    html += abschnitt('stern', 'Sternschnuppen', sr.aktiv.map(function (s) {
      var l = HI.mondLicht(s.hoch);
      return zeile('stern', h(s.name) + ' – jetzt aktiv', 'Höhepunkt ' + h(tagText(s.hoch)) + ' · bis zu ' + s.zhr + ' je Stunde unter dunklem Himmel · Mond ' + zahl(l.anteil * 100) + ' % ' + (l.anteil > 0.6 ? '(stört)' : '(stört kaum)'), '<b class="kos-gruen">aktiv</b>');
    }).join('') + sr.naechste.filter(function (s) { return sr.aktiv.indexOf(s) < 0 && !sr.aktiv.some(function (a) { return a.name === s.name; }); }).slice(0, 2).map(function (s) {
      var l = HI.mondLicht(s.hoch);
      return zeile('stern', h(s.name), 'Höhepunkt ' + h(datumLang(s.hoch)) + ' · bis zu ' + s.zhr + ' je Stunde · Mond ' + zahl(l.anteil * 100) + ' %', '<b class="wert">' + inTagen(s.hoch) + '</b>');
    }).join(''));

    /* --- Polarlicht --- */
    var kp = K.kp;
    if (!kp) html += abschnitt('nacht', 'Polarlicht und Weltraumwetter', laden('kp', 'Weltraumwetter-Daten'));
    else {
      var beob = kp.filter(function (r) { return !r.vorher && r.t <= now; }), jetzt = beob[beob.length - 1];
      var vor = kp.filter(function (r) { return r.t > now && r.t < now + 3 * TAG; }), max = vor.reduce(function (m, r) { return !m || r.kp > m.kp ? r : m; }, null);
      var noetig = kpNoetig(o.lat);
      function chance(k) { return k >= noetig + 1 ? 'gute Chance auf Polarlicht' : k >= noetig ? 'Polarlicht möglich (tief im Norden, Kamera hilft)' : k >= noetig - 1 ? 'nur mit Kamera vielleicht, tief im Norden' : 'kein Polarlicht zu erwarten'; }
      html += abschnitt('nacht', 'Polarlicht und Weltraumwetter',
        zeile('nacht', 'Kp-Wert jetzt: ' + (jetzt ? zahl(jetzt.kp, 1) : '–') + ' – ' + h(chance(jetzt ? jetzt.kp : 0)), 'Hier braucht es etwa Kp ' + zahl(noetig, 1) + ' oder mehr. Der Kp-Wert misst den Sturm im Erdmagnetfeld (0 ruhig bis 9 extrem).', '<b class="wert">' + (jetzt ? zahl(jetzt.kp, 1) : '–') + '</b>', null, { cls: jetzt && jetzt.kp >= noetig ? 'kos-bald' : '' }) +
        (max ? zeile('nacht', 'Höchster Wert der nächsten 3 Tage: Kp ' + zahl(max.kp, 1), h(tagText(max.t)) + ' ab ' + uhr(max.t) + ' · ' + h(chance(max.kp)), '<b class="wert">' + zahl(max.kp, 1) + '</b>') : ''));
    }

    html += '<p class="klein2" style="text-align:center;margin-top:10px">Quellen: The Space Devs (Launch Library 2)' + (K.startsQuelle === 'RocketLaunch.Live' ? ', RocketLaunch.Live' : '') + ', CelesTrak, NASA/JPL, NOAA SWPC. Sonne, Mond, Planeten, Kometenbahnen und Überflüge rechnet die App selbst.</p>';
    box.innerHTML = html;
  }
  function mondBild(p) { var b = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']; return b[Math.round(p * 8) % 8]; }

  /** jede Sekunde: Countdown und Ort der Raumstationen */
  function laufend() {
    if (!$('#kosliste')) { clearInterval(takt); takt = null; return; }
    [].forEach.call(document.querySelectorAll('.kos-count'), function (e) { e.textContent = countdown(+e.getAttribute('data-t')); });
    var o = ort(), a = $('#kos-iss'), b = $('#kos-tg');
    if (a) a.innerHTML = stationZeile(stationJetzt(25544, o));
    if (b) b.innerHTML = stationZeile(stationJetzt(48274, o));
  }

  /* ====================== Einzelheiten ====================== */
  Tun['kos-start'] = function (el) {
    var now = Date.now(), st = (K.starts || []).filter(function (s) { return !s.zeit || s.zeit > now - 6 * 3600000; }).slice(0, 10), s = st[+el.getAttribute('data-i')]; if (!s) return;
    var vids = s.vids.slice(0, 3);
    A().blatt('<h2>' + sym('rakete') + '<span style="white-space:normal">' + h(s.rakete || s.name) + '<br><small style="font-weight:400;font-size:13px">' + h(s.mission || s.name) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' + (FV.BILD ? FV.BILD.platz('Foto der Rakete wird gesucht …') : '') +
      '<div class="kos-daten">' +
      '<div><i>Start</i><b>' + h(s.zeit ? datumLang(s.zeit) + (genau(s) === 'zeit' ? ', ' + uhr(s.zeit) + ' Uhr' : genau(s) === 'tag' ? ' (Uhrzeit offen)' : ' (Termin grob)') : 'Termin offen') + '</b></div>' +
      (s.status ? '<div><i>Stand</i><b>' + h(s.status) + (s.chance != null && s.chance >= 0 ? ' · Wetter ' + s.chance + ' % gut' : '') + '</b></div>' : '') +
      (s.firma ? '<div><i>Betreiber</i><b>' + h(s.firma) + '</b></div>' : '') +
      '<div><i>Startplatz</i><b>' + h([s.platz, s.ort].filter(Boolean).join(' · ')) + '</b></div>' +
      (s.bahn || s.art ? '<div><i>Ziel</i><b>' + h([s.art, s.bahn].filter(Boolean).join(' · ')) + '</b></div>' : '') +
      '</div>' +
      (s.text ? '<p style="margin:8px 2px 12px;line-height:1.45">' + h(s.text) + '</p>' : '') +
      vids.map(function (v) { return '<button class="' + (v.live ? 'gold' : 'rand') + ' knopf breit" style="margin-bottom:8px" data-tun="oeffnen" data-url="' + h(v.url) + '">' + sym('abspielen') + (v.live ? 'LIVE: ' : 'Livestream: ') + h(v.quelle || v.titel) + '</button>'; }).join('') +
      (!vids.length ? '<p class="klein2">Ein Livestream ist noch nicht eingetragen – meist kommt er erst kurz vor dem Start dazu.</p>' : '') +
      '<button class="rand knopf breit" data-tun="kos-start-sag" data-i="' + el.getAttribute('data-i') + '">' + sym('ton') + 'Ansagen</button>');
    if (FV.BILD) FV.BILD.zeigen(FV.BILD.rakete(s.bild, s.rakete), s.rakete || s.name);
  };
  /* Raumstation antippen: Foto und Angaben im eigenen Fenster */
  Tun['kos-station'] = function (el) {
    var nr = +el.getAttribute('data-nr'), o = ort(), s = stationJetzt(nr, o); if (!s) return;
    var name = nr === 25544 ? 'ISS – Internationale Raumstation' : 'Tiangong – chinesische Raumstation', kurz = nr === 25544 ? 'ISS' : 'Tiangong';
    var pl = (ueberfluege(o) || []).filter(function (p) { return p.station === kurz; })[0];
    A().blatt('<h2>' + sym('satellit') + '<span style="white-space:normal">' + h(name) + '</span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' + (FV.BILD ? FV.BILD.platz('Foto der Raumstation wird gesucht …') : '') +
      '<div class="kos-daten">' +
      '<div><i>Jetzt über</i><b>' + breite(s.lat, s.lon) + '</b></div>' +
      '<div><i>Höhe</i><b>' + zahl(s.hoehe) + ' km</b></div>' +
      '<div><i>Tempo</i><b>' + zahl(Math.round(s.tempo / 100) * 100) + ' km/h – einmal um die Erde in gut 90 Minuten</b></div>' +
      '<div><i>Von dir</i><b>' + (s.hoeheGrad > 0 ? zahl(s.hoeheGrad) + '° über dem Horizont im ' + HI.richtung(s.richtung) : zahl(s.entf) + ' km entfernt') + '</b></div>' +
      '<div><i>Zu sehen</i><b>' + (pl ? h(tagText(pl.sichtAnf)) + ' ' + uhr(pl.sichtAnf) + ' Uhr, von ' + HI.richtung(pl.vonRicht) + ' nach ' + HI.richtung(pl.nachRicht) + ', bis ' + zahl(pl.sichtMax) + '° hoch' : 'in den nächsten 4 Tagen nicht') + '</b></div>' +
      '</div>');
    if (FV.BILD) FV.BILD.zeigen(FV.BILD.satellit(kurz), name);
  };
  Tun['kos-start-sag'] = function (el) {
    var now = Date.now(), st = (K.starts || []).filter(function (s) { return !s.zeit || s.zeit > now - 6 * 3600000; }).slice(0, 10), s = st[+el.getAttribute('data-i')]; if (!s) return;
    B.sprich(startSatz(s));
  };
  Tun['kos-fin'] = function () {
    var now = Date.now();
    A().blatt('<h2>' + sym('sonne') + '<span>Alle Finsternisse bis 2030</span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<h3 class="ueber" style="margin-top:4px">' + sym('sonne') + 'Sonnenfinsternisse</h3>' +
      SOFI.filter(function (f) { return Date.parse(f[0] + 'T23:59:00') > now; }).map(function (f) {
        return zeile('sonne', h(datumLang(Date.parse(f[0] + 'T12:00:00'))) + ' · ' + h(f[1]), h(f[2]) + (f[3] ? ' · <b class="kos-gruen">in Deutschland teilweise zu sehen</b>' : ''), '');
      }).join('') +
      '<h3 class="ueber">' + sym('mond') + 'Mondfinsternisse</h3>' +
      MOFI.filter(function (f) { return Date.parse(f[0]) + 3 * 3600000 > now; }).map(function (f) {
        return zeile('mond', h(datumLang(Date.parse(f[0]))) + ', ' + uhr(Date.parse(f[0])) + ' · ' + h(f[1]), (f[2] ? '<b class="kos-gruen">in Deutschland zu sehen</b> · ' : '') + h(f[3]), '');
      }).join('') + '<p class="klein2">Quelle: NASA. Uhrzeit = größte Verfinsterung, deutsche Zeit.</p>');
  };

  /* ====================== Ansage ====================== */
  function startSatz(s) {
    var g = genau(s), wann = !s.zeit ? 'mit noch offenem Termin' : g === 'grob' ? 'voraussichtlich ' + new Date(s.zeit).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : g === 'tag' ? sprechTag(s.zeit) : sprechTag(s.zeit) + ' um ' + uhr(s.zeit) + ' Uhr';
    return 'Raketenstart: ' + (s.rakete || 'eine Rakete') + (s.mission ? ' mit der Mission ' + s.mission : '') + ', ' + wann + (s.ort ? ', von ' + s.ort.split(',')[0] : '') + '.' + (s.status ? ' Stand: ' + s.status + '.' : '');
  }
  Tun['kos-ansage'] = function () {
    var o = ort(), now = Date.now(), t = [];
    var so = HI.sonnenTag(now, o), li = HI.mondLicht(now), voll = HI.naechsteMondphase(now, true);
    t.push('Kosmos aktuell. Die Sonne geht heute um ' + uhr(so.auf) + ' Uhr auf und um ' + uhr(so.unter) + ' Uhr unter.');
    t.push('Der Mond ist zu ' + Math.round(li.anteil * 100) + ' Prozent beleuchtet, ' + HI.phasenName(li.phase) + '. Nächster Vollmond ' + sprechTag(voll) + '.');
    var st = (K.starts || []).filter(function (s) { return s.zeit && s.zeit > now && !/Success|Failure/.test(s.statusK); });
    if (st[0]) t.push('Nächster ' + startSatz(st[0]));
    var pl = ueberfluege(o);
    if (pl && pl[0]) t.push('Die ' + pl[0].station + ' ist ' + sprechTag(pl[0].sichtAnf) + ' um ' + uhr(pl[0].sichtAnf) + ' Uhr zu sehen, von ' + HI.richtung(pl[0].vonRicht) + ' nach ' + HI.richtung(pl[0].nachRicht) + ', bis ' + Math.round(pl[0].sichtMax) + ' Grad hoch.');
    if (K.astronauten) t.push('Gerade sind ' + K.astronauten.zahl + ' Menschen im Weltall.');
    var vis = planeten(o).filter(function (p) { return p.sichtbar; });
    if (vis.length) t.push('Heute Nacht zu sehen: ' + vis.map(function (p) { return p.name; }).join(', ') + '.');
    var sr = stroeme(now); if (sr.aktiv[0]) t.push('Sternschnuppen: die ' + sr.aktiv[0].name + ' sind aktiv.');
    var sf = SOFI.filter(function (f) { return Date.parse(f[0] + 'T23:59:00') > now; })[0], mf = MOFI.filter(function (f) { return Date.parse(f[0]) + 3 * 3600000 > now; })[0];
    if (sf) t.push('Nächste Sonnenfinsternis: ' + datumLang(Date.parse(sf[0] + 'T12:00:00')) + ', ' + sf[1] + (sf[3] ? ', in Deutschland teilweise zu sehen.' : ', nicht in Deutschland.'));
    if (mf) t.push('Nächste Mondfinsternis: ' + datumLang(Date.parse(mf[0])) + '.');
    if (K.kp) { var b = K.kp.filter(function (r) { return !r.vorher && r.t <= now; }), j = b[b.length - 1]; if (j) t.push(j.kp >= kpNoetig(o.lat) ? 'Achtung: Polarlicht ist heute möglich!' : 'Polarlicht ist hier gerade nicht zu erwarten.'); }
    B.sprich(t.join(' '));
    A().toast('Wird angesagt …');
  };
})();
