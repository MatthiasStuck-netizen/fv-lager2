/* Himmelsrechnungen für die Seite „Kosmos“ – alles auf dem Handy gerechnet, ohne Internet:
 * Sonne und Mond (Auf-/Untergang, Dämmerung, Mondphase, Voll-/Neumond nach Meeus), Planeten (Bahnelemente JPL/Standish),
 * Kometenbahnen (aus den JPL-Bahnelementen), Raumstationen (Bahndaten von CelesTrak, Kepler-Bahn mit Erdabplattung). */
window.FV = window.FV || {};
(function () {
  'use strict';
  var H = FV.HIMMEL = {};
  var PI = Math.PI, RAD = PI / 180, TAG = 86400000, J2000 = 2451545, EPS = 23.4393 * RAD;
  function jd(ms) { return ms / TAG + 2440587.5; }
  function msAusJd(j) { return (j - 2440587.5) * TAG; }
  function tage(ms) { return jd(ms) - J2000; }
  function norm(x) { x = x % (2 * PI); return x < 0 ? x + 2 * PI : x; }
  H.jd = jd; H.msAusJd = msAusJd;

  /* ---------- Grundlagen ---------- */
  function sternzeit(ms, lon) { return norm((280.46061837 + 360.98564736629 * tage(ms)) * RAD + lon * RAD); }   // örtliche Sternzeit (rad)
  H.gmst = function (ms) { return sternzeit(ms, 0); };
  function eklAeq(l, b) {   // ekliptikal → äquatorial
    return { ra: Math.atan2(Math.sin(l) * Math.cos(EPS) - Math.tan(b) * Math.sin(EPS), Math.cos(l)), dec: Math.asin(Math.sin(b) * Math.cos(EPS) + Math.cos(b) * Math.sin(EPS) * Math.sin(l)) };
  }
  /** Höhe und Richtung (Grad, Richtung von Nord über Ost) eines Objekts mit ra/dec für einen Ort und Zeitpunkt */
  function horizont(ra, dec, ms, ort) {
    var Hw = sternzeit(ms, ort.lon) - ra, phi = ort.lat * RAD;
    var alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(Hw));
    var az = Math.atan2(Math.sin(Hw), Math.cos(Hw) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + PI;
    return { hoehe: alt / RAD, richtung: norm(az) / RAD };
  }
  H.horizont = horizont;

  /* ---------- Sonne ---------- */
  function sonne(ms) {
    var d = tage(ms), M = RAD * (357.5291 + 0.98560028 * d);
    var C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var L = M + C + RAD * 102.9372 + PI, q = eklAeq(L, 0);
    q.lon = norm(L); q.dist = 1.00014 - 0.01671 * Math.cos(M) - 0.00014 * Math.cos(2 * M);   // AE
    return q;
  }
  H.sonne = sonne;
  H.sonnenHoehe = function (ms, ort) { var s = sonne(ms); return horizont(s.ra, s.dec, ms, ort).hoehe; };

  /* ---------- Mond (genau auf etwa 0,3°) ---------- */
  function mond(ms) {
    var d = tage(ms);
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.229350 * d);
    var D = RAD * (297.850 + 12.190749 * d), Ms = RAD * (357.529 + 0.98560028 * d);
    var l = L + RAD * (6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * M) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F));
    var b = RAD * (5.128 * Math.sin(F) + 0.281 * Math.sin(M + F) + 0.278 * Math.sin(M - F) + 0.173 * Math.sin(2 * D - F));
    var dist = 385001 - 20905 * Math.cos(M) - 3699 * Math.cos(2 * D - M) - 2956 * Math.cos(2 * D);
    var q = eklAeq(l, b); q.dist = dist; q.lon = norm(l); return q;
  }
  H.mond = mond;
  function mondHoehe(ms, ort) {
    var m = mond(ms), x = horizont(m.ra, m.dec, ms, ort);
    x.hoehe -= Math.asin(6378 / m.dist) / RAD * Math.cos(x.hoehe * RAD);   // Parallaxe: von der Erdoberfläche aus steht der Mond tiefer
    return x;
  }
  H.mondOrt = mondHoehe;
  /** Beleuchtung: anteil 0…1, phase 0 = Neumond, 0,25 erstes Viertel, 0,5 Vollmond, 0,75 letztes Viertel */
  H.mondLicht = function (ms) {
    var s = sonne(ms), m = mond(ms), sd = 149598000 * s.dist;
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(sd * Math.sin(phi), m.dist - sd * Math.cos(phi));
    var ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { anteil: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / PI, dist: m.dist };
  };
  H.phasenName = function (p) {
    return p < 0.03 || p > 0.97 ? 'Neumond' : p < 0.22 ? 'zunehmende Sichel' : p < 0.28 ? 'erstes Viertel' : p < 0.47 ? 'zunehmender Mond' : p < 0.53 ? 'Vollmond' : p < 0.72 ? 'abnehmender Mond' : p < 0.78 ? 'letztes Viertel' : 'abnehmende Sichel';
  };
  /** Neu- und Vollmond nach Meeus (Kap. 49), auf wenige Minuten genau. art 0 = Neumond, 0.5 = Vollmond */
  function mondphase(k) {
    var T = k / 1236.85, voll = Math.abs(k % 1) > 0.25;
    var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T * T * T;
    var E = 1 - 0.002516 * T - 0.0000074 * T * T;
    var M = RAD * (2.5534 + 29.10535670 * k - 0.0000014 * T * T), Mm = RAD * (201.5643 + 385.81693528 * k + 0.0107582 * T * T);
    var F = RAD * (160.7108 + 390.67050284 * k - 0.0016118 * T * T), O = RAD * (124.7746 - 1.56375588 * k + 0.0020672 * T * T);
    var s = Math.sin;
    var c = (voll ? -0.40614 : -0.40720) * s(Mm) + (voll ? 0.17302 : 0.17241) * E * s(M) + (voll ? 0.01614 : 0.01608) * s(2 * Mm) + (voll ? 0.01043 : 0.01039) * s(2 * F) +
      (voll ? 0.00734 : 0.00739) * E * s(Mm - M) - (voll ? 0.00515 : 0.00514) * E * s(Mm + M) + (voll ? 0.00209 : 0.00208) * E * E * s(2 * M) - 0.00111 * s(Mm - 2 * F) -
      0.00057 * s(Mm + 2 * F) + 0.00056 * E * s(2 * Mm + M) - 0.00042 * s(3 * Mm) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mm - M) - 0.00017 * s(O);
    return msAusJd(jde + c) - 69000;   // TT → Weltzeit (ΔT ≈ 69 s)
  }
  /** nächster Vollmond (voll = true) bzw. Neumond nach ms */
  H.naechsteMondphase = function (ms, voll) {
    var j = new Date(ms), jahr = j.getUTCFullYear() + (j.getUTCMonth() + j.getUTCDate() / 31) / 12;
    var k = Math.floor((jahr - 2000) * 12.3685) - 2;
    for (var i = 0; i < 8; i++) { var t = mondphase(k + i + (voll ? 0.5 : 0)); if (t > ms) return t; }
    return null;
  };

  /* ---------- Auf- und Untergänge: Höhe abtasten und den Durchgang genau eingrenzen ---------- */
  /** fn(ms) → Höhe in Grad. Liefert [{ t, auf }] für alle Durchgänge durch ziel zwischen a und b */
  function durchgaenge(fn, a, b, ziel, schritt) {
    schritt = schritt || 10 * 60000;
    var aus = [], t0 = a, h0 = fn(a) - ziel;
    for (var t = a + schritt; t <= b + 1; t += schritt) {
      var h1 = fn(t) - ziel;
      if ((h0 < 0) !== (h1 < 0)) {
        var lo = t0, hi = t, hl = h0;
        for (var n = 0; n < 22; n++) { var m = (lo + hi) / 2, hm = fn(m) - ziel; if ((hm < 0) === (hl < 0)) { lo = m; hl = hm; } else hi = m; }
        aus.push({ t: (lo + hi) / 2, auf: h1 > 0 });
      }
      t0 = t; h0 = h1;
    }
    return aus;
  }
  H.durchgaenge = durchgaenge;
  function erster(l, auf) { for (var i = 0; i < l.length; i++) if (l[i].auf === auf) return l[i].t; return null; }
  /** Sonnenzeiten für den Kalendertag, in dem ms liegt (Ortszeit des Handys) */
  H.sonnenTag = function (ms, ort) {
    var a = new Date(ms); a.setHours(0, 0, 0, 0); var b = a.getTime() + TAG; a = a.getTime();
    var fn = function (t) { return H.sonnenHoehe(t, ort); };
    var g = durchgaenge(fn, a, b, -0.833), z = durchgaenge(fn, a, b, -6), n = durchgaenge(fn, a, b, -12), s = durchgaenge(fn, a, b, -18);
    var auf = erster(g, true), unter = erster(g, false), mittag = null, mh = -99;
    for (var t = a; t <= b; t += 5 * 60000) { var x = fn(t); if (x > mh) { mh = x; mittag = t; } }
    return { auf: auf, unter: unter, mittag: mittag, mittagHoehe: mh, laenge: auf && unter ? unter - auf : null,
      buergerAnf: erster(z, true), buergerEnde: erster(z, false), nautEnde: erster(n, false), astroEnde: erster(s, false), astroAnf: erster(s, true) };
  };
  H.mondTag = function (ms, ort) {
    var a = new Date(ms); a.setHours(0, 0, 0, 0); a = a.getTime();
    var g = durchgaenge(function (t) { return mondHoehe(t, ort).hoehe; }, a, a + TAG, 0.133);
    return { auf: erster(g, true), unter: erster(g, false) };
  };

  /* ---------- Kepler-Bahnen (Planeten, Kometen) ---------- */
  function keplerE(M, e) { var E = e < 0.8 ? M : PI; for (var i = 0; i < 30; i++) { var d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; } return E; }
  /** Ort in der Bahnebene → heliozentrisch ekliptikal (AE) */
  function drehen(r, nu, w, O, i) {
    var u = w + nu;
    return { x: r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i)), y: r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i)), z: r * Math.sin(u) * Math.sin(i) };
  }
  /* Bahnelemente J2000 und Änderung je Jahrhundert (JPL, E. M. Standish, gültig 1800–2050): a, e, I, L, ϖ, Ω */
  var PLANETEN = {
    merkur: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
    venus: [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
    erde: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
    mars: [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
    jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
    saturn: [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794]
  };
  function planetHelio(name, ms) {
    var p = PLANETEN[name], T = tage(ms) / 36525;
    var a = p[0] + p[1] * T, e = p[2] + p[3] * T, I = RAD * (p[4] + p[5] * T), L = RAD * (p[6] + p[7] * T), wq = RAD * (p[8] + p[9] * T), O = RAD * (p[10] + p[11] * T);
    var w = wq - O, M = norm(L - wq), E = keplerE(M, e);
    var nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    return drehen(a * (1 - e * Math.cos(E)), nu, w, O, I);
  }
  H.planetHelio = planetHelio;
  /** geozentrisch: ra, dec, Abstand (AE), Winkel zur Sonne (Grad) */
  function geo(p, ms) {
    var e = planetHelio('erde', ms), x = p.x - e.x, y = p.y - e.y, z = p.z - e.z;
    var d = Math.sqrt(x * x + y * y + z * z), l = Math.atan2(y, x), b = Math.asin(z / d), q = eklAeq(l, b);
    var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z), re = Math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z);
    q.delta = d; q.r = r;
    q.elong = Math.acos(Math.max(-1, Math.min(1, (re * re + d * d - r * r) / (2 * re * d)))) / RAD;
    q.l = norm(l); q.sonneL = norm(Math.atan2(-e.y, -e.x));
    return q;
  }
  H.planet = function (name, ms) { return geo(planetHelio(name, ms), ms); };
  /** Komet aus JPL-Bahnelementen { q, e, tp (JD), i, om, w (Grad) } – Ellipse, Parabel oder Hyperbel */
  function kometHelio(k, ms) {
    var t = jd(ms) - k.tp, q = k.q, e = k.e, kg = 0.01720209895, r, nu;
    if (Math.abs(e - 1) < 0.002) {   // Parabel (Barker)
      var W = 3 * kg / Math.sqrt(2 * q * q * q) * t, Y = Math.cbrt(W / 2 + Math.sqrt(W * W / 4 + 1)), s = Y - 1 / Y;
      nu = 2 * Math.atan(s); r = q * (1 + s * s);
    } else if (e < 1) {
      var a = q / (1 - e), M = kg / Math.pow(a, 1.5) * t, E = keplerE(norm(M + PI) - PI, e);
      nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)); r = a * (1 - e * Math.cos(E));
    } else {
      var ah = q / (e - 1), Mh = kg / Math.pow(ah, 1.5) * t, Hh = Math.asinh(Mh / e);
      for (var i = 0; i < 50; i++) { var dd = (e * Math.sinh(Hh) - Hh - Mh) / (e * Math.cosh(Hh) - 1); Hh -= dd; if (Math.abs(dd) < 1e-12) break; }
      nu = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(Hh / 2)); r = ah * (e * Math.cosh(Hh) - 1);
    }
    return drehen(r, nu, k.w * RAD, k.om * RAD, k.i * RAD);
  }
  H.komet = function (k, ms) { var g = geo(kometHelio(k, ms), ms); g.mag = k.M1 != null ? k.M1 + 5 * Math.log10(g.delta) + (k.K1 != null ? k.K1 : 10) * Math.log10(g.r) : null; return g; };

  /** Sichtbarkeit am Abend (Sonne 8° unter dem Horizont) und am Morgen: { abend: {hoehe, richtung} | null, morgen: … } */
  H.sichtbar = function (fnRaDec, ms, ort, minHoehe) {
    minHoehe = minHoehe == null ? 8 : minHoehe;
    var a = new Date(ms); a.setHours(12, 0, 0, 0); a = a.getTime();
    var sf = function (t) { return H.sonnenHoehe(t, ort); };
    var abend = erster(durchgaenge(sf, a, a + TAG / 2, -8), false), morgen = erster(durchgaenge(sf, a + TAG / 2, a + TAG, -8), true);
    function bei(t) { if (!t) return null; var q = fnRaDec(t), x = horizont(q.ra, q.dec, t, ort); return x.hoehe >= minHoehe ? { hoehe: x.hoehe, richtung: x.richtung, t: t } : null; }
    var mitte = abend && morgen ? (abend + morgen) / 2 : null;
    return { abend: bei(abend), morgen: bei(morgen), mitternacht: bei(mitte) };
  };

  /* ---------- Raumstationen ---------- */
  var MU = 398600.4418, RE = 6378.137, J2 = 0.00108263;
  /** OMM-Datensatz von CelesTrak vorbereiten */
  H.bahn = function (o) {
    var ep = Date.parse(String(o.EPOCH).replace(/(\.\d{3})\d*$/, '$1') + (/[zZ]$/.test(o.EPOCH) ? '' : 'Z'));
    var n = +o.MEAN_MOTION * 2 * PI / 86400, a = Math.pow(MU / (n * n), 1 / 3);
    return { name: o.OBJECT_NAME, nr: o.NORAD_CAT_ID, ep: ep, n: n, nRev: +o.MEAN_MOTION, ndot: +o.MEAN_MOTION_DOT || 0, a: a, e: +o.ECCENTRICITY, i: +o.INCLINATION * RAD, O: +o.RA_OF_ASC_NODE * RAD, w: +o.ARG_OF_PERICENTER * RAD, M: +o.MEAN_ANOMALY * RAD };
  };
  /** Ort im Raum (km, erdfest) und über der Erde zum Zeitpunkt ms */
  H.station = function (b, ms) {
    var dt = (ms - b.ep) / 1000, dtT = dt / 86400, e = b.e, p = b.a * (1 - e * e), f = 1.5 * J2 * Math.pow(RE / p, 2) * b.n, ci = Math.cos(b.i), si = Math.sin(b.i);
    var O = b.O - f * ci * dt, w = b.w + f * (2 - 2.5 * si * si) * dt;
    var M = b.M + b.n * (1 + 1.5 * J2 * Math.pow(RE / p, 2) * Math.sqrt(1 - e * e) * (1 - 1.5 * si * si)) * dt + 2 * PI * b.ndot * dtT * dtT;
    var nRev = b.nRev + 2 * b.ndot * dtT, a = Math.pow(MU / Math.pow(nRev * 2 * PI / 86400, 2), 1 / 3);   // Bahn sinkt langsam durch die Luftreibung
    var E = keplerE(norm(M), e), nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)), r = a * (1 - e * Math.cos(E));
    var x = drehen(r, nu, w, O, b.i), th = H.gmst(ms);
    var xe = x.x * Math.cos(th) + x.y * Math.sin(th), ye = -x.x * Math.sin(th) + x.y * Math.cos(th);
    return { eci: x, ecef: { x: xe, y: ye, z: x.z }, r: r, lat: Math.atan2(x.z, Math.sqrt(xe * xe + ye * ye)) / RAD, lon: Math.atan2(ye, xe) / RAD, hoehe: r - 6371, tempo: Math.sqrt(MU * (2 / r - 1 / a)) * 3600 };
  };
  /** Höhe/Richtung/Entfernung von einem Ort aus; sonnig = von der Sonne beschienen (nicht im Erdschatten) */
  H.stationVonOrt = function (b, ms, ort) {
    var s = H.station(b, ms), la = ort.lat * RAD, lo = ort.lon * RAD, R = 6371;
    var ox = R * Math.cos(la) * Math.cos(lo), oy = R * Math.cos(la) * Math.sin(lo), oz = R * Math.sin(la);
    var rx = s.ecef.x - ox, ry = s.ecef.y - oy, rz = s.ecef.z - oz, d = Math.sqrt(rx * rx + ry * ry + rz * rz);
    var S = Math.sin(la) * Math.cos(lo) * rx + Math.sin(la) * Math.sin(lo) * ry - Math.cos(la) * rz, E = -Math.sin(lo) * rx + Math.cos(lo) * ry, Z = Math.cos(la) * Math.cos(lo) * rx + Math.cos(la) * Math.sin(lo) * ry + Math.sin(la) * rz;
    var so = sonne(ms), sx = Math.cos(so.dec) * Math.cos(so.ra), sy = Math.cos(so.dec) * Math.sin(so.ra), sz = Math.sin(so.dec);
    var p = s.eci.x * sx + s.eci.y * sy + s.eci.z * sz, qx = s.eci.x - p * sx, qy = s.eci.y - p * sy, qz = s.eci.z - p * sz;
    var sonnig = p > 0 || Math.sqrt(qx * qx + qy * qy + qz * qz) > RE;
    s.hoeheGrad = Math.asin(Z / d) / RAD; s.richtung = norm(Math.atan2(E, -S)) / RAD; s.entf = d; s.sonnig = sonnig;
    return s;
  };
  /** Überflüge der nächsten tageN Tage. Sichtbar = Station über 10°, beschienen, und bei uns ist es dunkel (Sonne unter −6°). */
  H.ueberfluege = function (b, ab, ort, tageN) {
    var aus = [], ende = ab + (tageN || 4) * TAG, schritt = 20000, lauf = null;
    for (var t = ab; t < ende; t += schritt) {
      var s = H.stationVonOrt(b, t, ort);
      if (s.hoeheGrad >= 10) {
        if (!lauf) lauf = { start: t, max: -1, sichtAnf: null, sichtEnde: null };
        if (s.hoeheGrad > lauf.max) { lauf.max = s.hoeheGrad; lauf.maxT = t; lauf.maxRicht = s.richtung; }
        var hell = s.sonnig && H.sonnenHoehe(t, ort) < -6;
        if (hell) { if (!lauf.sichtAnf) { lauf.sichtAnf = t; lauf.vonRicht = s.richtung; } lauf.sichtEnde = t; lauf.nachRicht = s.richtung; if (!(s.hoeheGrad <= lauf.sichtMax)) { lauf.sichtMax = s.hoeheGrad; lauf.sichtMaxRicht = s.richtung; } }
        lauf.ende = t; if (!lauf.vonAlle) lauf.vonAlle = s.richtung; lauf.nachAlle = s.richtung;
      } else if (lauf) { aus.push(lauf); lauf = null; }
    }
    if (lauf) aus.push(lauf);
    return aus;
  };

  /* ---------- Hilfen für Texte ---------- */
  var RICHT = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];
  var RICHT_K = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  H.richtung = function (az, kurz) { var i = Math.round(norm(az * RAD) / RAD / 45) % 8; return (kurz ? RICHT_K : RICHT)[i]; };
})();
