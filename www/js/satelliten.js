/* Satelliten im Detail: Mit welchen Satelliten ist das Handy verbunden – Name, Höhe, Geschwindigkeit, Entfernung, Signal, Himmelskarte.
 * Das Handy meldet je Satellit: System, Nummer, genutzt ja/nein, Signal, Höhe über dem Horizont und Himmelsrichtung (Android-Teil Satelliten.java).
 * Name, Höhe und Geschwindigkeit kommen aus den öffentlichen Bahndaten (CelesTrak, Gruppe „gnss“, einmal am Tag geladen und gemerkt):
 * Die App rechnet die Bahn bis jetzt weiter (Kepler-Bahn mit Erdabplattung – für Navigationssatelliten auf wenige km genau)
 * und ordnet jeden Satelliten über seine Nummer zu, sonst über die Stelle am Himmel, an der das Handy ihn sieht. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, sym = FV.sym, Tun = FV.Tun;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }
  function h(t) { return FV.esc(t); }
  var SAT = FV.SAT = {};
  var SYSTEM = { 1: 'GPS', 2: 'SBAS', 3: 'GLONASS', 4: 'QZSS', 5: 'BeiDou', 6: 'Galileo', 7: 'NavIC' };
  var LAND = { GPS: 'USA', GLONASS: 'Russland', Galileo: 'Europa', BeiDou: 'China', QZSS: 'Japan', SBAS: 'Korrekturdienst', NavIC: 'Indien' };
  var FARBE = { GPS: '#4f8dff', GLONASS: '#ff6b5f', Galileo: '#f2c230', BeiDou: '#ff9f43', QZSS: '#c48dff', SBAS: '#3fd0c9', NavIC: '#7bd389' };
  var KUERZEL = { GPS: 'G', GLONASS: 'R', Galileo: 'E', BeiDou: 'C', QZSS: 'J', SBAS: 'S', NavIC: 'I' };
  /* Korrektursatelliten (geostationär, 35.786 km über dem Äquator) – nach PRN */
  var SBAS = { 120: ['EGNOS', 'Inmarsat 3F2 (Test)'], 121: ['EGNOS', 'Eutelsat 5WB'], 123: ['EGNOS', 'Astra 5B'], 124: ['EGNOS', 'Test'], 126: ['EGNOS', 'Inmarsat 4F2'], 136: ['EGNOS', 'SES-5'],
    131: ['WAAS (USA)', 'Eutelsat 117WB'], 133: ['WAAS (USA)', 'SES-15'], 135: ['WAAS (USA)', 'Galaxy 30'], 138: ['WAAS (USA)', 'Anik F1R'],
    127: ['GAGAN (Indien)', 'GSAT-8'], 128: ['GAGAN (Indien)', 'GSAT-10'], 132: ['GAGAN (Indien)', 'GSAT-15'], 129: ['MSAS (Japan)', 'QZS-3'], 137: ['MSAS (Japan)', 'QZS-3'],
    125: ['SDCM (Russland)', 'Luch-5A'], 140: ['SDCM (Russland)', 'Luch-5B'], 141: ['SDCM (Russland)', 'Luch-5V'], 122: ['ASECNA (Afrika)', 'Inmarsat'], 134: ['KASS (Korea)', 'MEASAT-3d'], 147: ['ASECNA (Afrika)', 'NigComSat-1R'] };
  /* Übliche Bahnen, falls keine Bahndaten da sind (Höhe km, Umlaufzeit h) */
  var UEBLICH = { GPS: [20180, 11.97], GLONASS: [19130, 11.26], Galileo: [23222, 14.08], BeiDou: [21528, 12.89], QZSS: [35786, 23.93], SBAS: [35786, 23.93], NavIC: [35786, 23.93] };

  /* ====================== Bahndaten (OMM von CelesTrak) ====================== */
  var QUELLEN = ['https://celestrak.org/NORAD/elements/gp.php?GROUP=gnss&FORMAT=json', 'https://celestrak.com/NORAD/elements/gp.php?GROUP=gnss&FORMAT=json'];
  var bahnen = null, laedt = false, bahnFehler = '';
  function systemAusName(n) {
    n = String(n || '').toUpperCase();
    if (/^(GPS|NAVSTAR)/.test(n)) return 'GPS';
    if (/^(GSAT|GALILEO)/.test(n)) return 'Galileo';
    if (/^(COSMOS|GLONASS|KOSMOS)/.test(n)) return 'GLONASS';
    if (/^(BEIDOU|COMPASS)/.test(n)) return 'BeiDou';
    if (/^(QZS|MICHIBIKI)/.test(n)) return 'QZSS';
    if (/^(IRNSS|NVS)/.test(n)) return 'NavIC';
    return '';
  }
  function prnAusName(sys, n) {
    n = String(n || '').toUpperCase(); var m;
    if (sys === 'GPS' && (m = /PRN\s*0*(\d{1,2})\b/.exec(n))) return +m[1];
    if (sys === 'Galileo' && (m = /PRN\s*E?0*(\d{1,2})\b|\bE0*(\d{1,2})\)/.exec(n))) return +(m[1] || m[2]);
    if (sys === 'BeiDou' && (m = /\bC0*(\d{1,2})\b|PRN\s*C?0*(\d{1,2})\b/.exec(n))) return +(m[1] || m[2]);
    return null;
  }
  function vorbereiten(l) {
    return (l || []).map(function (o) {
      var sys = systemAusName(o.OBJECT_NAME); if (!sys || !o.MEAN_MOTION) return null;
      var ep = Date.parse(String(o.EPOCH).replace(/(\.\d{3})\d*$/, '$1') + (/[zZ]|[+-]\d\d:?\d\d$/.test(o.EPOCH) ? '' : 'Z'));
      if (isNaN(ep)) return null;
      return { name: String(o.OBJECT_NAME).trim(), sys: sys, prn: prnAusName(sys, o.OBJECT_NAME), norad: o.NORAD_CAT_ID, ep: ep, n: +o.MEAN_MOTION, e: +o.ECCENTRICITY,
        i: +o.INCLINATION, raan: +o.RA_OF_ASC_NODE, argp: +o.ARG_OF_PERICENTER, m: +o.MEAN_ANOMALY, start: o.LAUNCH_DATE || '' };
    }).filter(Boolean);
  }
  SAT.laden = function (neu) {
    if (laedt) return;
    var merk = B.lesen('sat_bahnen', null);
    if (!bahnen && merk && merk.l) bahnen = vorbereiten(merk.l);
    if (!neu && merk && Date.now() - merk.t < 86400000) return;
    laedt = true;
    var i = 0;
    (function frag() {
      B.json({ url: QUELLEN[i], kopf: { Accept: 'application/json' }, zeit: 25000 }).then(function (l) {
        if (!Array.isArray(l) || l.length < 20) throw new Error('leer');
        var knapp = l.map(function (o) { return { OBJECT_NAME: o.OBJECT_NAME, NORAD_CAT_ID: o.NORAD_CAT_ID, EPOCH: o.EPOCH, MEAN_MOTION: o.MEAN_MOTION, ECCENTRICITY: o.ECCENTRICITY, INCLINATION: o.INCLINATION,
          RA_OF_ASC_NODE: o.RA_OF_ASC_NODE, ARG_OF_PERICENTER: o.ARG_OF_PERICENTER, MEAN_ANOMALY: o.MEAN_ANOMALY }; });
        B.schreiben('sat_bahnen', { t: Date.now(), l: knapp });
        bahnen = vorbereiten(knapp); laedt = false; bahnFehler = ''; zuordnung = {};
      }).catch(function (e) { if (++i < QUELLEN.length) return frag(); laedt = false; bahnFehler = e && e.message || 'nicht erreichbar'; });
    })();
  };

  /* ====================== Bahn rechnen ====================== */
  var MU = 398600.4418, RE = 6378.137, J2 = 1.08262668e-3, F = 1 / 298.257223563, RAD = Math.PI / 180;
  /** Position (ECEF, km) und Bahngeschwindigkeit (km/s) zur Zeit t */
  function bahnJetzt(s, t) {
    var n = s.n * 2 * Math.PI / 86400, a = Math.pow(MU / (n * n), 1 / 3), e = s.e, inc = s.i * RAD, dt = (t - s.ep) / 1000;
    var p = a * (1 - e * e), k = 1.5 * J2 * Math.pow(RE / p, 2) * n;
    var raan = s.raan * RAD - k * Math.cos(inc) * dt, argp = s.argp * RAD + k * 0.5 * (5 * Math.cos(inc) * Math.cos(inc) - 1) * dt;
    var M = (s.m * RAD + n * dt) % (2 * Math.PI), E = M;
    for (var j = 0; j < 12; j++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    var nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)), r = a * (1 - e * Math.cos(E)), u = argp + nu;
    var cO = Math.cos(raan), sO = Math.sin(raan), ci = Math.cos(inc), si = Math.sin(inc), cu = Math.cos(u), su = Math.sin(u);
    var x = r * (cO * cu - sO * su * ci), y = r * (sO * cu + cO * su * ci), z = r * (su * si);
    var jd = t / 86400000 + 2440587.5, gmst = ((280.46061837 + 360.98564736629 * (jd - 2451545)) % 360) * RAD;
    var cg = Math.cos(gmst), sg = Math.sin(gmst);
    return { x: cg * x + sg * y, y: -sg * x + cg * y, z: z, r: r, v: Math.sqrt(MU * (2 / r - 1 / a)), umlauf: 2 * Math.PI / n / 3600 };
  }
  function ortEcef(o) {
    var la = o.lat * RAD, lo = o.lon * RAD, e2 = F * (2 - F), N = RE / Math.sqrt(1 - e2 * Math.sin(la) * Math.sin(la)), hh = (o.hoehe || 0) / 1000;
    return { x: (N + hh) * Math.cos(la) * Math.cos(lo), y: (N + hh) * Math.cos(la) * Math.sin(lo), z: (N * (1 - e2) + hh) * Math.sin(la), la: la, lo: lo };
  }
  /** Höhe über dem Horizont, Richtung, Entfernung vom Standort */
  function blick(o, p) {
    var dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
    var ost = -Math.sin(o.lo) * dx + Math.cos(o.lo) * dy;
    var nord = -Math.sin(o.la) * Math.cos(o.lo) * dx - Math.sin(o.la) * Math.sin(o.lo) * dy + Math.cos(o.la) * dz;
    var hoch = Math.cos(o.la) * Math.cos(o.lo) * dx + Math.cos(o.la) * Math.sin(o.lo) * dy + Math.sin(o.la) * dz;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return { el: Math.asin(hoch / d) / RAD, az: (Math.atan2(ost, nord) / RAD + 360) % 360, d: d };
  }
  function hoeheUeberGrund(p) { var lat = Math.atan2(p.z, Math.sqrt(p.x * p.x + p.y * p.y)); return p.r - RE * (1 - F * Math.sin(lat) * Math.sin(lat)); }
  function winkel(e1, a1, e2, a2) {
    var c = Math.sin(e1 * RAD) * Math.sin(e2 * RAD) + Math.cos(e1 * RAD) * Math.cos(e2 * RAD) * Math.cos((a1 - a2) * RAD);
    return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
  }

  /* ====================== Satelliten des Handys zuordnen ====================== */
  var zuordnung = {};   // "System:Nummer" → Bahn (bleibt, solange es passt)
  SAT.liste = function () {
    var s = B.satelliten(); if (!s || !Array.isArray(s.liste)) return null;
    var o = B.ort(), t = Date.now(), oe = o ? ortEcef(o) : null;
    if (!bahnen) SAT.laden(false);
    var jetzt = {};
    if (bahnen && oe) bahnen.forEach(function (b) { var p = bahnJetzt(b, t); jetzt[b.norad] = { p: p, blick: blick(oe, p) }; });
    var vergeben = {};
    var l = s.liste.map(function (x) {
      var sys = SYSTEM[x[0]] || '?', nr = x[1];
      return { sys: sys, nr: nr, genutzt: !!x[2], snr: x[3], el: x[4], az: x[5], mhz: x[6], key: sys + ':' + nr };
    });
    l.forEach(function (x) {   // 1. über die Nummer
      if (!bahnen || x.sys === 'SBAS' || x.sys === 'GLONASS') return;
      var b = bahnen.filter(function (y) { return y.sys === x.sys && y.prn === x.nr; })[0];
      if (b) { x.bahn = b; vergeben[b.norad] = 1; }
    });
    l.forEach(function (x) {   // 2. über die Stelle am Himmel (GLONASS, QZSS, und wenn die Nummer nicht im Namen steht)
      if (x.bahn || !bahnen || !oe || x.sys === 'SBAS' || !(x.el > -1)) return;
      var alt = zuordnung[x.key];
      if (alt && jetzt[alt.norad] && winkel(x.el, x.az, jetzt[alt.norad].blick.el, jetzt[alt.norad].blick.az) < 8 && !vergeben[alt.norad]) { x.bahn = alt; vergeben[alt.norad] = 1; return; }
      var beste = null, bw = 6;
      bahnen.forEach(function (b) {
        if (b.sys !== x.sys || vergeben[b.norad] || !jetzt[b.norad]) return;
        var w = winkel(x.el, x.az, jetzt[b.norad].blick.el, jetzt[b.norad].blick.az); if (w < bw) { bw = w; beste = b; }
      });
      if (beste) { x.bahn = beste; vergeben[beste.norad] = 1; zuordnung[x.key] = beste; }
    });
    l.forEach(function (x) {
      if (x.bahn && jetzt[x.bahn.norad]) {
        var j = jetzt[x.bahn.norad];
        x.name = x.bahn.name; x.hoehe = hoeheUeberGrund(j.p); x.kmh = j.p.v * 3600; x.umlauf = j.p.umlauf; x.weit = j.blick.d; x.neig = x.bahn.i; x.norad = x.bahn.norad; x.genau = true;
      } else {
        var u = UEBLICH[x.sys] || [20000, 12];
        x.hoehe = u[0]; x.umlauf = u[1]; x.kmh = 2 * Math.PI * (RE + u[0]) / u[1]; x.genau = false;
        if (x.el > 0) { var rr = RE + u[0], el = x.el * RAD; x.weit = Math.sqrt(rr * rr - RE * RE * Math.cos(el) * Math.cos(el)) - RE * Math.sin(el); }
        if (x.sys === 'SBAS') { var sb = SBAS[x.nr]; x.name = sb ? sb[1] : 'Korrektursatellit'; x.dienst = sb ? sb[0] : 'SBAS'; x.kmh = 11068; }
        else x.name = x.sys + '-Satellit';
      }
      x.kurz = (KUERZEL[x.sys] || '') + (x.sys === 'SBAS' ? x.nr : ('0' + x.nr).slice(-2));
    });
    l.sort(function (a, b) { return (b.genutzt - a.genutzt) || (b.snr - a.snr); });
    return { s: s, l: l };
  };

  /* ====================== Anzeige ====================== */
  function zahl(x, st) { return Math.round(x).toLocaleString('de-DE') + (st || ''); }
  var RICHT = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  function richtung(a) { return RICHT[Math.round(a / 45) % 8]; }
  function band(m) { return !m ? '' : m > 1570 && m < 1580 ? 'L1/E1' : m > 1595 && m < 1610 ? 'G1' : m > 1555 && m < 1565 ? 'B1' : m > 1170 && m < 1180 ? 'L5/E5a' : m > 1200 && m < 1210 ? 'E5b/B2' : m > 1225 && m < 1230 ? 'L2' : m > 1240 && m < 1255 ? 'G2' : m > 1265 && m < 1280 ? 'E6/B3' : Math.round(m) + ' MHz'; }
  /** Himmelskarte: Mitte = senkrecht über dir, Rand = Horizont, Norden oben */
  function himmel(l) {
    var R = 120, m = 130, html = '<svg class="himmel" viewBox="0 0 260 260" role="img" aria-label="Himmelskarte der Satelliten">';
    html += '<circle cx="130" cy="130" r="120" class="hk-rand"/><circle cx="130" cy="130" r="80" class="hk-ring"/><circle cx="130" cy="130" r="40" class="hk-ring"/>' +
      '<line x1="130" y1="10" x2="130" y2="250" class="hk-ring"/><line x1="10" y1="130" x2="250" y2="130" class="hk-ring"/>' +
      '<text x="130" y="7" class="hk-n">N</text><text x="256" y="134" class="hk-r">O</text><text x="130" y="259" class="hk-r">S</text><text x="4" y="134" class="hk-r">W</text>' +
      '<text x="134" y="52" class="hk-g">60°</text><text x="134" y="92" class="hk-g">30°</text>';
    l.forEach(function (x, i) {
      if (!(x.el >= 0)) return;
      var r = R * (90 - x.el) / 90, px = m + r * Math.sin(x.az * RAD), py = m - r * Math.cos(x.az * RAD), f = FARBE[x.sys] || '#ccc';
      html += '<g data-tun="sat-info" data-i="' + i + '" class="hk-sat' + (x.genutzt ? ' an' : '') + '"><circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (x.genutzt ? 9 : 7) + '" fill="' + (x.genutzt ? f : 'none') + '" stroke="' + f + '" stroke-width="2"/>' +
        '<text x="' + px.toFixed(1) + '" y="' + (py + 3.3).toFixed(1) + '">' + h(x.kurz) + '</text></g>';
    });
    return html + '</svg>';
  }
  var letzte = null;
  SAT.html = function () {
    var d = SAT.liste(); if (!d) return '';
    letzte = d;
    var l = d.l, gen = l.filter(function (x) { return x.genutzt; });
    var html = '<h3 class="ueber">' + sym('satellit') + 'Himmel über dir</h3><div class="block himmelblock">' + himmel(l) +
      '<div class="hk-legende">' + Object.keys(FARBE).filter(function (k) { return l.some(function (x) { return x.sys === k; }); }).map(function (k) { return '<span><i style="background:' + FARBE[k] + '"></i>' + h(k) + '</span>'; }).join('') +
      '<span class="hk-hinweis">● ausgefüllt = verbunden · ○ nur in Sicht · antippen = Einzelheiten</span></div></div>';
    html += '<h3 class="ueber">' + sym('haken') + 'Verbunden (' + gen.length + ')</h3>' + (gen.length ? gen.map(zeile).join('') : '<p class="klein2">Gerade keiner – unter freiem Himmel kurz warten.</p>');
    var rest = l.filter(function (x) { return !x.genutzt; });
    if (rest.length) html += '<h3 class="ueber">' + sym('satellit') + 'Nur in Sicht (' + rest.length + ')</h3>' + rest.map(zeile).join('');
    html += '<p class="klein2">' + (bahnen ? 'Name, Höhe, Geschwindigkeit und Entfernung aus den Bahndaten von CelesTrak, für jetzt gerechnet.' : laedt ? 'Bahndaten werden geladen …' : 'Ohne Bahndaten (Internet) stehen nur die üblichen Werte des Systems da.' + (bahnFehler ? ' (' + h(bahnFehler) + ')' : '')) + '</p>';
    return html;
    function zeile(x) {
      var i = l.indexOf(x), f = FARBE[x.sys] || '#ccc';
      return '<div class="eintrag tippbar satz' + (x.genutzt ? ' an' : '') + '" data-tun="sat-info" data-i="' + i + '"><b class="satmarke" style="border-color:' + f + ';' + (x.genutzt ? 'background:' + f : 'color:' + f) + '">' + h(x.kurz) + '</b>' +
        '<div class="txt"><b>' + h(x.name) + '</b><span>' + h([x.sys + (x.dienst ? ' · ' + x.dienst : ''), (x.genau ? '' : 'ca. ') + zahl(x.hoehe, ' km hoch'), (x.genau ? '' : 'ca. ') + zahl(x.kmh, ' km/h')].join(' · ')) + '</span>' +
        '<span>' + h([x.weit ? zahl(x.weit, ' km entfernt') : '', x.el >= 0 ? Math.round(x.el) + '° ' + richtung(x.az) : '', x.snr > 0 ? Math.round(x.snr) + ' dB-Hz' : 'kein Signal'].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="ende"><i class="satsignal" style="--s:' + Math.max(0, Math.min(100, (x.snr - 10) * 3)) + '%"></i></div></div>';
    }
  };
  Tun['sat-info'] = function (el) {
    var x = letzte && letzte.l[+el.getAttribute('data-i')]; if (!x) return;
    function z(s, k, t) { return t ? '<div class="detailzeile">' + sym(s) + '<div><small>' + k + '</small>' + t + '</div></div>' : ''; }
    var u = x.umlauf ? Math.floor(x.umlauf) + ' Std. ' + Math.round((x.umlauf % 1) * 60) + ' Min.' : '';
    A().blatt('<h2>' + sym('satellit') + '<span>' + h(x.name) + '<br><small style="font-weight:400;font-size:13px">' + h(x.sys + ' (' + (LAND[x.sys] || '') + ') · ' + x.kurz) + '</small></span><button data-tun="sat-zurueck">' + sym('links') + '</button><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' + (FV.BILD ? FV.BILD.platz('Foto vom Satelliten wird gesucht …') : '') +
      '<div class="block">' + z('haken', 'Verbindung', x.genutzt ? 'verbunden – wird für deinen Standort benutzt' : 'in Sicht, wird gerade nicht benutzt') +
        z('auf', 'Höhe über der Erde', (x.genau ? '' : 'ca. ') + zahl(x.hoehe, ' km')) +
        z('tempo', 'Geschwindigkeit', (x.genau ? '' : 'ca. ') + zahl(x.kmh, ' km/h') + ' (' + (x.kmh / 3600).toFixed(2).replace('.', ',') + ' km/s)') +
        z('ort', 'Entfernung zu dir', x.weit ? (x.genau ? '' : 'ca. ') + zahl(x.weit, ' km') + ' · Funksignal braucht ' + Math.round(x.weit / 299.792) + ' ms' : '') +
        z('navi', 'Am Himmel', x.el >= 0 ? Math.round(x.el) + '° über dem Horizont, Richtung ' + richtung(x.az) + ' (' + Math.round(x.az) + '°)' : 'unter dem Horizont') +
        z('uhr', 'Einmal um die Erde', u + (x.sys === 'SBAS' ? ' – steht scheinbar still über dem Äquator' : '')) +
        z('ton', 'Signal', x.snr > 0 ? Math.round(x.snr) + ' dB-Hz · ' + (x.snr >= 35 ? 'stark' : x.snr >= 25 ? 'mittel' : 'schwach') + (x.mhz ? ' · Frequenz ' + band(x.mhz) : '') : 'kein Signal') +
        z('info', 'Kennung', h(['Nummer ' + x.nr, x.norad ? 'NORAD ' + x.norad : '', x.neig ? 'Bahnneigung ' + x.neig.toFixed(1).replace('.', ',') + '°' : ''].filter(Boolean).join(' · '))) + '</div>' +
      (x.genau ? '' : '<p class="klein2">Für diesen Satelliten fehlen Bahndaten – Höhe und Geschwindigkeit sind die üblichen Werte des Systems.</p>'));
    if (FV.BILD) FV.BILD.zeigen(FV.BILD.satellit(x.sys), x.name);
  };
  SAT._test = { bahn: bahnJetzt, blick: blick, ort: ortEcef, hoehe: hoeheUeberGrund, vorbereiten: vorbereiten };
  Tun['sat-zurueck'] = function () { if (Tun.satelliten) Tun.satelliten(); };
})();
