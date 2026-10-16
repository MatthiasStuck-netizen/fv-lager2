/* Verkehr: aktuelle Meldungen (Stau, Unfall, Sperrung, Baustelle) entlang der Route, Umleitung, Zugverbindungen.
 * Quellen: Autobahn GmbH des Bundes (alle Autobahnen, frei) · TomTom Traffic (alle Straßen, Schlüssel aus der Verwaltung)
 * · Deutsche Bahn: DB Navigator / bahn.de (Zugverbindungen, Bahnhöfe, Abfahrtstafeln), Ersatz v6.db.transport.rest. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, V = FV.V = { meldungen: [], stand: 0, fehler: '' };
  var RAD = Math.PI / 180;
  V.DIENST = {
    autobahn: 'https://verkehr.autobahn.de/o/autobahn',
    tomtom: 'https://api.tomtom.com/traffic/services/5/incidentDetails',
    bahn: ['https://v6.db.transport.rest', 'https://v6.bvg.transport.rest']
  };
  V.ART = {
    sperrung: ['Sperrung', 'sperrung'], unfall: ['Unfall', 'unfall'], stau: ['Stau', 'stau'], stockend: ['Stockender Verkehr', 'stau'],
    baustelle: ['Baustelle', 'baustelle'], panne: ['Liegengebliebenes Fahrzeug', 'gefahr'], gefahr: ['Gefahr', 'gefahr'], wetter: ['Wetter', 'gefahr'], spur: ['Fahrstreifen gesperrt', 'baustelle']
  };
  /** TomTom-Schlüssel kommt mit der Auftragsliste aus der Verwaltung (Einstellungen → App) */
  V.schluessel = function () { var v = FV.app && FV.app.z && FV.app.z.verkehr; return v && v.tomtom ? String(v.tomtom) : ''; };
  V.quellen = function () { return V.schluessel() ? 'Autobahn GmbH · TomTom' : 'Autobahn GmbH'; };

  /* ---------- Zwischenspeicher auf dem Handy ----------
   * Gefundene Apotheken, Ärzte, Bahnhöfe, Flughäfen usw. bleiben auch nach dem Schließen der App gespeichert.
   * Beim nächsten Mal erscheinen sie sofort; ist der Eintrag älter als „frisch“, wird still im Hintergrund erneuert. */
  var ZW_TAG = 86400000, zwDa = {}, zwLaeuft = {};
  function zwLesen(kat) {
    if (!zwDa[kat]) { var d = B.lesen('zw_' + kat, null); zwDa[kat] = d && typeof d === 'object' && !Array.isArray(d) ? d : {}; }
    return zwDa[kat];
  }
  function zwMerken(kat, key, l, max) {
    var d = zwLesen(kat); d[key] = { t: Date.now(), l: l };
    Object.keys(d).sort(function (a, b) { return d[b].t - d[a].t; }).slice(max || 20).forEach(function (k) { delete d[k]; });
    B.schreiben('zw_' + kat, d);
  }
  /** o.frisch: so lange gilt ein Eintrag als aktuell · o.alt: so alt darf er sofort gezeigt werden (dann neu im Hintergrund)
   *  · o.notfall: so alt darf er sein, wenn das Neuladen scheitert · o.max: Anzahl gespeicherter Orte */
  V.merk = function (kat, key, o, holen) {
    var d = zwLesen(kat)[key], alter = d ? Date.now() - d.t : Infinity, lk = kat + '|' + key;
    if (d && alter < o.frisch) return Promise.resolve(d.l);
    var neu = zwLaeuft[lk] || (zwLaeuft[lk] = holen().then(function (l) { delete zwLaeuft[lk]; zwMerken(kat, key, l, o.max); return l; },
      function (e) { delete zwLaeuft[lk]; throw e; }));
    if (d && alter < (o.alt != null ? o.alt : 30 * ZW_TAG)) { neu.catch(function () {}); return Promise.resolve(d.l); }
    return neu.catch(function (e) { if (d && alter < (o.notfall != null ? o.notfall : 30 * ZW_TAG)) return d.l; throw e; });
  };
  /** Alles Gespeicherte löschen (Einstellungen) */
  V.merkLeeren = function () { ['apo', 'arzt', 'arztnot', 'bahnhof', 'flug', 'plz', 'notdienst', 'halt_bus', 'halt_stadt'].forEach(function (k) { zwDa[k] = {}; B.schreiben('zw_' + k, null); }); };

  /* ---------- OpenStreetMap (Overpass): zuerst über die Verwaltung (Zwischenspeicher auf dem Server), sonst direkt ---------- */
  function wirt(u) { return String(u).replace(/^https?:\/\//, '').split('/')[0]; }
  /** Fehlergrund kurz und verständlich, z. B. „overpass-api.de: gesperrt (406)“ */
  function grundText(e) {
    var m = String(e && e.message || e || 'Fehler'), st = e && e.status || (m.match(/\((\d{3})\)/) || [])[1];
    st = +st || 0;
    if (st === 429) return 'zu viele Anfragen (429)';
    if (st === 406 || st === 403) return 'Anfrage abgelehnt (' + st + ')';
    if (st === 504 || st === 503 || st === 502) return 'überlastet (' + st + ')';
    if (st) return 'Fehler ' + st;
    return m;
  }
  function osmDirekt(q, gruende, zeit) {
    gruende = gruende || [];
    function frag(i) {
      var url = G.DIENST.overpass[i];
      return B.json({ methode: 'POST', url: url, kopf: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'Referer': 'https://fehnverleih.de/' }, daten: 'data=' + encodeURIComponent(q), zeit: zeit || 20000 })
        .then(function (j) {
          if (!j || !Array.isArray(j.elements)) throw new Error('leere Antwort');
          if (/error|timed out|out of memory/i.test(j.remark || '') && !j.elements.length) throw new Error('Abfrage abgebrochen');
          return j;
        })
        .catch(function (e) {
          gruende.push('Handy → ' + wirt(url) + ': ' + grundText(e));
          if (i + 1 < G.DIENST.overpass.length) return frag(i + 1);
          var f = new Error('OpenStreetMap ist gerade nicht erreichbar.'); f.gruende = gruende; throw f;
        });
    }
    return frag(0);
  }
  var osmOhneServer = false;
  /** dauer: so viele Sekunden darf der Server die Antwort aus seinem Speicher geben */
  V.osm = function (q, dauer) {
    var S = FV.S;
    if (osmOhneServer || !S || S.demo || !S.angemeldet()) return osmDirekt(q);
    return S.ruf('osm', { q: q, dauer: dauer || 86400 }, 55000).then(function (r) {
      if (!Array.isArray(r.elements)) throw new Error('leer');
      return r;
    }).catch(function (e) {
      if (e.unbekannt) osmOhneServer = true;   // alte warenwirtschaft.php ohne Zwischenspeicher
      var g = [];
      var sg = e && e.antwort && e.antwort.gruende;
      if (Array.isArray(sg) && sg.length) sg.forEach(function (x) { g.push('Server → ' + x); });
      else g.push('Server: ' + grundText(e));
      return osmDirekt(q, g);
    });
  };
  /** Gründe eines Kartenfehlers für die Anzeige (klein, unter der Fehlermeldung) */
  V.grundHtml = function (e) {
    var g = e && e.gruende;
    if (!Array.isArray(g) || !g.length) return '';
    return '<p class="klein2" style="margin:8px 0 0;font-size:12px;line-height:1.4">Grund: ' + g.map(function (x) { return String(x).replace(/[<>&]/g, ''); }).join('<br>') + '</p>';
  };
  /** Mittelpunkt einer Suche, auf rund 1 km gerundet: so passen gespeicherte Antworten auch für Nachbarorte */
  function raster(p) { return { lat: +p.lat.toFixed(2), lon: +p.lon.toFixed(2) }; }

  /* ---------- kleine Helfer ---------- */
  function txt(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }
  /** „14.10.26 um 19:00“ → Zeitstempel */
  function datum(t) {
    var m = String(t).match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:[^\d]{1,8}(\d{1,2}):(\d{2}))?/);
    if (!m) return 0;
    var j = +m[3]; if (j < 100) j += 2000;
    return new Date(j, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  }
  /** Gilt eine Autobahn-Meldung gerade? Viele Baustellen-Sperrungen gelten nur nachts („Beginn … Ende …“). */
  function giltJetzt(beschr, zukunft) {
    if (zukunft === true) return false;
    var zeilen = (beschr || []).join(' | '), a = 0, e = 0;
    var mb = zeilen.match(/Beginn[^|]*?(\d{1,2}\.\d{1,2}\.\d{2,4}[^|]{0,12})/i), me = zeilen.match(/Ende[^|]*?(\d{1,2}\.\d{1,2}\.\d{2,4}[^|]{0,12})/i);
    if (mb) a = datum(mb[1]); if (me) e = datum(me[1]);
    var jetzt = Date.now();
    if (a && jetzt < a - 10 * 60000) return false;
    if (e && jetzt > e + 10 * 60000) return false;
    return true;
  }
  /** Straßen der Route, z. B. ['A28', 'A31', 'B72'] */
  function strassen(r) {
    var s = {};
    (r.schritte || []).forEach(function (x) { (x.namen || []).forEach(function (n) { var m = String(n).match(/^([AB])\s?(\d{1,3})\b/); if (m) s[m[1] + m[2]] = 1; }); });
    return Object.keys(s);
  }
  function winkel(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

  /** Legt eine Meldung auf die Route: von wo bis wo (Meter ab Start) liegt sie auf unserer Strecke – und in unserer Fahrtrichtung?
   *  Gibt null zurück, wenn sie nicht auf der Strecke liegt (oder nur auf der Gegenfahrbahn). */
  V.aufRoute = function (r, m) {
    var pts = m.punkte && m.punkte.length ? m.punkte : [[m.lon, m.lat]];
    var schritt = Math.max(1, Math.floor(pts.length / 40)), treffer = [], probe = 0;
    for (var i = 0; i < pts.length; i += schritt) {
      probe++;
      var s = G.einrasten(r, { lon: pts[i][0], lat: pts[i][1] });
      if (s && s.entf <= (m.quelle === 'tomtom' ? 30 : 45)) treffer.push({ i: i, weg: s.weg, kurs: s.kurs, idx: s.idx });
    }
    if (!treffer.length) return null;
    if (pts.length > 1) {
      if (treffer.length < Math.max(1, Math.ceil(probe * 0.5))) return null;   // nur gestreift (Kreuzung, Brücke): nicht unsere Strecke
      // Richtung: Die Meldung ist in Fahrtrichtung gezeichnet. Läuft sie gegen unsere Route, betrifft sie die Gegenfahrbahn.
      var gleich = 0, gegen = 0;
      for (var k = 0; k < treffer.length; k++) {
        var j = treffer[k].i, j2 = Math.min(pts.length - 1, j + schritt); if (j2 === j) j2 = Math.max(0, j - schritt);
        if (j2 === j) continue;
        var kg = j2 > j ? G.kurs({ lon: pts[j][0], lat: pts[j][1] }, { lon: pts[j2][0], lat: pts[j2][1] }) : G.kurs({ lon: pts[j2][0], lat: pts[j2][1] }, { lon: pts[j][0], lat: pts[j][1] });
        if (winkel(kg, treffer[k].kurs) < 70) gleich++; else if (winkel(kg, treffer[k].kurs) > 110) gegen++;
      }
      if (gegen > gleich) return null;
    }
    var ab = Infinity, bis = -Infinity;
    treffer.forEach(function (t) { if (t.weg < ab) ab = t.weg; if (t.weg > bis) bis = t.weg; });
    return { ab: ab, bis: Math.max(ab, bis) };
  };

  /* ---------- Autobahn GmbH ---------- */
  var abMerker = {};   // je Autobahn 2 Minuten merken
  V.leeren = function () { abMerker = {}; };
  function autobahn(nr) {
    var m = abMerker[nr];
    if (m && Date.now() - m.t < 110000) return Promise.resolve(m.l);
    var name = nr.replace(/^A/, 'A');
    function hol(art) { return B.json({ url: V.DIENST.autobahn + '/' + name + '/services/' + art, zeit: 15000 }).then(function (j) { return j[art] || []; }).catch(function () { return null; }); }
    return Promise.all([hol('warning'), hol('closure'), hol('roadworks')]).then(function (x) {
      if (x[0] === null && x[1] === null && x[2] === null) throw new Error('Autobahn-Daten nicht erreichbar');
      var l = [];
      (x[0] || []).forEach(function (e) { var w = abMeldung(e, 'warning', nr); if (w) l.push(w); });
      (x[1] || []).forEach(function (e) { var w = abMeldung(e, 'closure', nr); if (w) l.push(w); });
      (x[2] || []).forEach(function (e) { var w = abMeldung(e, 'roadworks', nr); if (w) l.push(w); });
      abMerker[nr] = { t: Date.now(), l: l };
      return l;
    });
  }
  function abMeldung(e, dienst, nr) {
    if (!e) return null;
    var beschr = Array.isArray(e.description) ? e.description : [String(e.description || '')];
    if (!giltJetzt(beschr, e.future)) return null;
    var alles = (e.title + ' ' + beschr.join(' ')).toLowerCase();
    var gesperrt = String(e.isBlocked) === 'true' || (dienst === 'closure' && e.display_type === 'CLOSURE');
    var art;
    if (dienst === 'closure') art = e.display_type === 'CLOSURE_ENTRY_EXIT' ? 'sperrung' : 'sperrung';
    else if (dienst === 'roadworks') art = gesperrt ? 'sperrung' : 'baustelle';
    else if (/unfall/.test(alles)) art = 'unfall';
    else if (/vollsperrung|gesperrt/.test(alles)) { art = 'sperrung'; gesperrt = true; }
    else if (/stau|stillstand|stehender verkehr/.test(alles) || e.abnormalTrafficType === 'STATIONARY_TRAFFIC') art = 'stau';
    else if (/stockend|zähfließend|dicht/.test(alles) || e.abnormalTrafficType === 'QUEUING_TRAFFIC' || e.abnormalTrafficType === 'SLOW_TRAFFIC') art = 'stockend';
    else if (/panne|liegengeblieben/.test(alles)) art = 'panne';
    else art = 'gefahr';
    if (/vollsperrung/.test(alles)) gesperrt = true;
    var punkte = e.geometry && Array.isArray(e.geometry.coordinates) && e.geometry.coordinates.length ? e.geometry.coordinates.map(function (c) { return [+c[0], +c[1]]; }) : null;
    var lat = e.coordinate ? +e.coordinate.lat : NaN, lon = e.coordinate ? +(e.coordinate.long != null ? e.coordinate.long : e.coordinate.lon) : NaN;
    if ((isNaN(lat) || isNaN(lon)) && punkte) { lon = punkte[0][0]; lat = punkte[0][1]; }
    if (isNaN(lat) || isNaN(lon)) return null;
    var verz = parseFloat(e.delayTimeValue); verz = isNaN(verz) ? 0 : verz * 60;
    var abschnitt = txt(String(e.title || '').replace(/^[AB]\s?\d+\s*\|\s*/, ''));
    var richtung = txt(String(e.subtitle || '').replace(/^.*->\s*/, ''));
    var t = beschr.map(txt).filter(function (z) { return z && !/^(beginn|ende|länge|dauer)\b/i.test(z) && z.indexOf(abschnitt) < 0; }).slice(0, 3).join(' ');
    return { id: 'ab:' + (e.identifier || nr + lat + lon), quelle: 'autobahn', art: art, gesperrt: gesperrt, strasse: nr.replace(/^([AB])/, '$1 '), abschnitt: abschnitt,
      richtung: richtung ? 'Richtung ' + richtung : '', text: t, verzoegerung: verz, punkte: punkte, lat: lat, lon: lon, nurRampe: e.display_type === 'CLOSURE_ENTRY_EXIT' };
  }

  /* ---------- TomTom (alle Straßen, auch Landstraßen und Orte) ---------- */
  var TT_ART = { 1: 'unfall', 2: 'wetter', 3: 'gefahr', 4: 'wetter', 5: 'wetter', 6: 'stau', 7: 'spur', 8: 'sperrung', 9: 'baustelle', 10: 'wetter', 11: 'gefahr', 14: 'panne' };
  /** Rechtecke um die (restliche) Route: höchstens 10.000 km² je Abfrage – meist reicht eins */
  function rechtecke(r, ab) {
    var aus = [], start = Math.max(0, ab || 0), ende = Math.min(r.laenge, start + 160000);
    function kasten(a, e) {
      var s = 90, w = 180, n = -90, o = -180;
      for (var x = a; ; x = Math.min(e, x + 300)) { var p = G.punktBei(r, x); if (p.lat < s) s = p.lat; if (p.lat > n) n = p.lat; if (p.lon < w) w = p.lon; if (p.lon > o) o = p.lon; if (x >= e) break; }
      var d = 0.01; return [w - d, s - d, o + d, n + d];
    }
    function flaeche(k) { return (k[2] - k[0]) * 111 * Math.cos((k[1] + k[3]) / 2 * RAD) * (k[3] - k[1]) * 111; }
    var ganz = kasten(start, ende);
    if (flaeche(ganz) < 9500) return [ganz];
    for (var a = start; a < ende && aus.length < 8; a += 25000) aus.push(kasten(a, Math.min(ende, a + 25000)));
    return aus;
  }
  function tomtom(r, ab) {
    var key = V.schluessel(); if (!key) return Promise.resolve([]);
    var felder = '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,probabilityOfOccurrence}}}';
    return Promise.all(rechtecke(r, ab).map(function (k) {
      var u = V.DIENST.tomtom + '?key=' + encodeURIComponent(key) + '&bbox=' + k.map(function (z) { return z.toFixed(4); }).join(',') + '&fields=' + encodeURIComponent(felder) + '&language=de-DE&timeValidityFilter=present';
      return B.json({ url: u, zeit: 15000 }).then(function (j) { return j.incidents || []; });
    })).then(function (teile) {
      var l = [], gesehen = {};
      teile.forEach(function (t) { t.forEach(function (f) {
        var p = f.properties || {}, g = f.geometry || {};
        if (!p.id || gesehen[p.id]) return; gesehen[p.id] = 1;
        if (p.probabilityOfOccurrence && p.probabilityOfOccurrence !== 'certain' && p.probabilityOfOccurrence !== 'probable') return;
        var art = TT_ART[p.iconCategory] || 'gefahr';
        if (art === 'stau' && (p.magnitudeOfDelay || 0) <= 1) art = 'stockend';
        var punkte = g.type === 'LineString' ? g.coordinates : g.type === 'Point' ? [g.coordinates] : null;
        if (!punkte || !punkte.length) return;
        var ev = (p.events || []).map(function (e) { return txt(e.description); }).filter(Boolean);
        var str = (p.roadNumbers || []).join(', ');
        l.push({ id: 'tt:' + p.id, quelle: 'tomtom', art: art, gesperrt: p.iconCategory === 8 || (p.magnitudeOfDelay === 4 && art !== 'baustelle'), strasse: str, abschnitt: [p.from, p.to].filter(Boolean).join(' – '),
          richtung: p.to ? 'Richtung ' + p.to : '', text: ev.join(', '), verzoegerung: +p.delay || 0, punkte: punkte, lon: punkte[0][0], lat: punkte[0][1], laenge: p.length || 0 });
      }); });
      return l;
    });
  }

  /* ---------- Meldungen für eine Route holen ---------- */
  /** Alle Meldungen, die auf der Route liegen (ab = gefahrene Meter, davor liegende werden weggelassen). */
  V.laden = function (r, ab) {
    if (!r || (r.modus && r.modus !== 'auto')) return Promise.resolve([]);
    if (FV.app && FV.app.e && FV.app.e.verkehr === false) return Promise.resolve([]);
    ab = ab || 0;
    var bahnen = strassen(r).filter(function (s) { return s.charAt(0) === 'A'; }).slice(0, 6), fehler = 0, quellen = 0;
    var jobs = bahnen.map(function (nr) { quellen++; return autobahn(nr).catch(function () { fehler++; return []; }); });
    if (V.schluessel()) { quellen++; jobs.push(tomtom(r, ab).catch(function () { fehler++; return []; })); }
    return Promise.all(jobs).then(function (teile) {
      var alle = [].concat.apply([], teile), aus = [], gesehen = {};
      alle.forEach(function (m) {
        var lage = V.aufRoute(r, m); if (!lage) return;
        if (lage.bis < ab - 30) return;   // schon vorbei
        if (m.nurRampe) { if (!rampeGenutzt(r, lage)) return; m = Object.assign({}, m, { gesperrt: true, nurRampe: false }); }   // gesperrte Auf-/Abfahrt, die wir nehmen wollten
        // gleiche Stelle aus zwei Quellen nur einmal zeigen (TomTom hat meist die genaueren Angaben)
        var k = m.art + Math.round(lage.ab / 400); if (gesehen[k]) return; gesehen[k] = 1;
        aus.push(Object.assign({}, m, { ab: lage.ab, bis: lage.bis }));
      });
      aus.sort(function (a, b) { return a.ab - b.ab; });
      V.meldungen = aus; V.stand = Date.now(); V.fehler = quellen && fehler === quellen ? 'Verkehrsdaten gerade nicht erreichbar' : '';
      r.verkehr = aus; r.verkehrStand = V.stand;
      return aus;
    });
  };
  function rampeGenutzt(r, lage) {   // gesperrte Auf-/Abfahrt betrifft uns nur, wenn wir dort ab- oder auffahren
    return (r.schritte || []).some(function (s) { return /a_abf|a_einf/.test(s.art) && Math.abs(s.weg - lage.ab) < 600; });
  }
  /** Behindert uns die Meldung so, dass wir drumherum sollten? */
  V.hindernis = function (m) { return m.gesperrt || ((m.art === 'unfall' || m.art === 'stau' || m.art === 'stockend') && m.verzoegerung >= 180) || (m.art === 'unfall' && !m.verzoegerung); };

  /** Vielecke um die betroffenen Stücke unserer Route – da darf die Umleitung nicht durch */
  function meideFlaechen(r, liste) {
    var aus = [];
    liste.forEach(function (m) {
      var a = Math.max(0, m.ab), e = Math.min(r.laenge, Math.max(m.bis, m.ab + 20)), n = Math.min(10, Math.max(1, Math.ceil((e - a) / 150)));
      for (var i = 0; i < n; i++) {
        var p = G.punktBei(r, a + (e - a) * (n === 1 ? 0.5 : i / (n - 1))), dLat = 18 / 110540, dLon = 18 / (111320 * Math.cos(p.lat * RAD));
        aus.push([[p.lon - dLon, p.lat - dLat], [p.lon + dLon, p.lat - dLat], [p.lon + dLon, p.lat + dLat], [p.lon - dLon, p.lat + dLat], [p.lon - dLon, p.lat - dLat]]);
      }
    });
    return aus.slice(0, 40);
  }
  /** Zeit, die eine Route mit den Meldungen darauf braucht (gesperrt = unendlich) */
  function kosten(r, liste, ab) {
    var t = r.dauer * Math.max(0, (r.laenge - (ab || 0)) / Math.max(1, r.laenge)), zu = false;
    liste.forEach(function (m) { if (m.bis < (ab || 0) - 30) return; if (m.gesperrt && !m.nurRampe) zu = true; t += m.verzoegerung || (m.art === 'unfall' ? 300 : 0); });
    return zu ? Infinity : t;
  }
  /**
   * Prüft die Route auf Hindernisse und sucht die beste Umleitung: so schnell wie möglich, bei fast gleicher Zeit die kürzere.
   * von = aktuelle Position, ab = gefahrene Meter auf r. Liefert { meldungen, neu (Route oder null), grund, mehr (Sekunden), spart }.
   */
  V.pruefen = function (r, von, nach, ab) {
    return V.laden(r, ab).then(function (liste) {
      var hin = liste.filter(V.hindernis);
      var erg = { meldungen: liste, neu: null, grund: null, mehr: 0, spart: 0 };
      if (!hin.length || !von || !nach) return erg;
      var alteMeiden = r.meiden || [], meiden = alteMeiden.concat(meideFlaechen(r, hin)).slice(-60);
      var jetzt = kosten(r, liste, ab);
      return G.routen(von, nach, { modus: 'auto', meiden: meiden, alternativen: 2 }).then(function (alts) {
        // Auch auf den Ausweichrouten können Meldungen liegen – die schon geladenen dagegen prüfen
        var alle = V.meldungen.slice(), beste = null, besteK = Infinity;
        alts.forEach(function (a) {
          if (a.meidetNicht) return;
          var drauf = alle.filter(function (m) { return V.aufRoute(a, m); }).map(function (m) { var l = V.aufRoute(a, m); return Object.assign({}, m, l); });
          var k = kosten(a, drauf, 0);
          // schneller gewinnt; liegen zwei Routen fast gleich (unter einer Minute oder 3 %), gewinnt die kürzere
          if (!beste || k < besteK - Math.max(60, besteK * 0.03) || (Math.abs(k - besteK) <= Math.max(60, besteK * 0.03) && a.laenge < beste.laenge)) { beste = a; besteK = k; }
        });
        if (!beste || besteK === Infinity) return erg;
        var spart = jetzt === Infinity ? Infinity : jetzt - besteK;
        if (jetzt !== Infinity && spart < 120) return erg;   // lohnt sich nicht: auf der Route bleiben
        beste.meiden = meiden;
        erg.neu = beste; erg.grund = hin[0]; erg.spart = spart;
        erg.mehr = Math.round(besteK - r.dauer * Math.max(0, (r.laenge - (ab || 0)) / Math.max(1, r.laenge)));
        return V.laden(beste, 0).then(function (l2) { erg.meldungen = l2; return erg; }, function () { return erg; });
      }).catch(function () { return erg; });
    });
  };

  /* ---------- Texte ---------- */
  V.titel = function (m) { return (V.ART[m.art] || V.ART.gefahr)[0] + (m.gesperrt && m.art !== 'sperrung' ? ' · gesperrt' : ''); };
  V.ort = function (m) { return [m.strasse, m.abschnitt].filter(Boolean).join(' · '); };
  V.klasse = function (m) { return m.gesperrt ? 'sperrung' : (V.ART[m.art] || V.ART.gefahr)[1]; };
  /** Sprechtext, z. B. „Unfall auf der A 28 zwischen Leer und Filsum“ */
  V.sprache = function (m) {
    var was = { sperrung: 'Sperrung', unfall: 'Unfall', stau: 'Stau', stockend: 'Stockender Verkehr', baustelle: 'Baustelle', panne: 'Liegengebliebenes Fahrzeug', gefahr: 'Gefahrenstelle', wetter: 'Wettergefahr', spur: 'Fahrstreifen gesperrt' }[m.art] || 'Verkehrsmeldung';
    var wo = m.strasse ? ' auf der ' + m.strasse.split(',')[0] : '';
    var ab = m.abschnitt && m.abschnitt.indexOf(' - ') > 0 ? ' zwischen ' + m.abschnitt.replace(' - ', ' und ') : (m.abschnitt && m.abschnitt.indexOf(' – ') > 0 ? ' zwischen ' + m.abschnitt.replace(' – ', ' und ') : '');
    return (was + wo + ab).replace(/\s*\/\s*/g, ' ');
  };
  V.verzText = function (s) { var m = Math.round((s || 0) / 60); return m >= 1 ? '+' + G.minuten(s).replace(' Min.', ' Min.') : ''; };
  V.minSprache = function (s) { var m = Math.max(1, Math.round(s / 60)); return m === 1 ? 'eine Minute' : m < 60 ? m + ' Minuten' : Math.floor(m / 60) + ' Stunden ' + (m % 60 ? (m % 60) + ' Minuten' : ''); };

  /* ---------- Zug: Verbindungen der Deutschen Bahn ---------- */
  /** Bahn-Abfrage über den eigenen Server (Ersatzweg, wenn das Handy die Bahn nicht direkt erreicht) */
  function bahnUeberServer(url, gruende, extra) {
    var S = FV.S;
    if (!S || S.demo || !S.angemeldet()) return Promise.reject(new Error('nicht angemeldet'));
    return S.ruf('bahn', Object.assign({ url: url }, extra || {}), 25000).then(function (r) { return r.daten; }, function (e) {
      var g = e && e.antwort && e.antwort.gruende;
      if (Array.isArray(g) && g.length) g.forEach(function (x) { gruende.push('Server → ' + x); }); else gruende.push('Server: ' + grundText(e));
      throw e;
    });
  }
  /** Fragt nacheinander die Adressen ab (erst direkt vom Handy, dann über den Server). Bei Misserfolg: Fehler mit allen Gründen. */
  function bahnReihe(urls, kopf, zeit, gruende) {
    gruende = gruende || [];
    var i = 0;
    function direkt() {
      var u = urls[i];
      return B.json({ url: u, kopf: kopf, zeit: zeit }).catch(function (e) {
        gruende.push('Handy → ' + wirt(u) + ': ' + grundText(e));
        if (++i < urls.length) return direkt();
        i = 0; return server();
      });
    }
    function server() {
      return bahnUeberServer(urls[i], gruende).catch(function () {
        if (++i < urls.length) return server();
        var f = new Error('Bahn nicht erreichbar'); f.gruende = gruende; throw f;
      });
    }
    return direkt();
  }
  function bahnFrage(pfad, gruende) {
    return bahnReihe(V.DIENST.bahn.map(function (b) { return b + pfad; }), {}, 20000, gruende);
  }
  function punktParam(name, p, text) { return name + '.latitude=' + p.lat.toFixed(6) + '&' + name + '.longitude=' + p.lon.toFixed(6) + '&' + name + '.address=' + encodeURIComponent(text || (name === 'from' ? 'Standort' : 'Ziel')); }
  /** Verbindungen von Ort zu Ort (mit Fußwegen zum und vom Bahnhof). wann = Date oder leer (jetzt). */
  /** opt: Date (Abfahrt ab) oder { wann: Date, ankunft: true/false, spaeter: laterRef, nurBus: true (nur Busse/Rufbusse) } */
  /* Reihenfolge: DB Navigator (dieselbe Auskunft wie die DB-App) → bahn.de → transport.rest.
   * Die erste Quelle, die Verbindungen liefert, gewinnt. „Später“ merkt sich die Quelle („nav:…“, „web:…“, „rest:…“),
   * damit beim Nachladen dieselbe Auskunft gefragt wird. */
  V.zug = function (von, nach, nachText, opt) {
    if (opt instanceof Date) opt = { wann: opt };
    opt = opt || {};
    var gruende = [], sp = String(opt.spaeter || ''), quelle = (sp.match(/^(nav|web|rest):/) || [])[1] || '';
    var ref = quelle ? sp.slice(quelle.length + 1) : sp;
    if (sp && !quelle) quelle = 'rest';
    var wege = { nav: zugNavi, web: zugWeb, rest: zugRest };
    var reihe = quelle ? [quelle] : ['nav', 'web', 'rest'];
    function versuch(i) {
      var q = reihe[i];
      return wege[q](von, nach, nachText, opt, ref, gruende).then(function (erg) {
        if (!erg.liste.length) throw new Error('Keine Zugverbindung gefunden.');
        return { liste: erg.liste, spaeter: erg.spaeter ? q + ':' + erg.spaeter : '', quelle: q };
      }).catch(function (e) {
        if (e && /Keine Zug/.test(e.message || '')) gruende.push(q + ': keine Verbindung'); else gruende.push(q + ': ' + grundText(e));
        if (i + 1 < reihe.length) return versuch(i + 1);
        var f = new Error(gruende.every(function (g) { return /keine Verbindung/.test(g); }) ? 'Keine Zugverbindung gefunden.' : 'Bahn nicht erreichbar');
        f.gruende = gruende; throw f;
      });
    }
    return versuch(0);
  };
  function zugRest(von, nach, nachText, opt, ref, gruende) {
    var q = '/journeys?' + punktParam('from', von, von.name) + '&' + punktParam('to', nach, nachText) + '&results=6&stopovers=false&remarks=true&polylines=true&language=de' +
      (opt.nurBus ? '&nationalExpress=false&national=false&regionalExpress=false&regional=false&suburban=false&subway=false&tram=false&ferry=false&bus=true&taxi=true' : '') +
      (ref ? '&laterThan=' + encodeURIComponent(ref) : opt.wann ? (opt.ankunft ? '&arrival=' : '&departure=') + encodeURIComponent(opt.wann.toISOString()) : '');
    return bahnFrage(q, gruende).then(function (j) {
      return { liste: (j.journeys || []).map(function (x) { var f = fahrt(x); if (f && x.price && x.price.amount) f.preis = { betrag: +x.price.amount, teil: !!x.price.partialFare }; return f; }).filter(Boolean), spaeter: j.laterRef || '' };
    });
  }
  /** Ort für die Bahn-Auskunft: Adresse mit Koordinaten („A=2@O=…@X=…@Y=…@“) */
  function vendoOrt(p, text) {
    return 'A=2@O=' + String(text || 'Standort').replace(/@/g, ' ') + '@X=' + Math.round(p.lon * 1e6) + '@Y=' + Math.round(p.lat * 1e6) + '@';
  }
  /** Zeit mit Zeitzone, z. B. „2026-10-16T04:10:00+02:00“ (DB Navigator) bzw. ohne (bahn.de) */
  function isoOrt(d, mitZone) {
    function z(n) { return ('0' + n).slice(-2); }
    var s = d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':00';
    if (!mitZone) return s;
    var o = -d.getTimezoneOffset();
    return s + (o >= 0 ? '+' : '-') + z(Math.floor(Math.abs(o) / 60)) + ':' + z(Math.abs(o) % 60);
  }
  function zugNavi(von, nach, nachText, opt, ref, gruende) {
    var wunsch = {
      abgangsLocationId: vendoOrt(von, von.name || 'Standort'),
      zielLocationId: vendoOrt(nach, nachText || 'Ziel'),
      verkehrsmittel: opt.nurBus ? ['BUSSE', 'ANRUFPFLICHTIGEVERKEHRE'] : ['ALL'],
      alternativeHalteBerechnung: true,
      zeitWunsch: { reiseDatum: isoOrt(opt.wann || new Date(), true), zeitPunktArt: opt.ankunft ? 'ANKUNFT' : 'ABFAHRT' }
    };
    if (ref) wunsch.context = ref;
    var body = {
      autonomeReservierung: false, einstiegsTypList: ['STANDARD'],
      fahrverguenstigungen: { deutschlandTicketVorhanden: false, nurDeutschlandTicketVerbindungen: false },
      klasse: 'KLASSE_2',
      reisendenProfil: { reisende: [{ ermaessigungen: ['KEINE_ERMAESSIGUNG KLASSENLOS'], reisendenTyp: 'ERWACHSENER' }] },
      reservierungsKontingenteVorhanden: false,
      reiseHin: { wunsch: wunsch }
    };
    return naviFrage('angebote/fahrplan', 'verbindungssuche.v9', body, gruende, 25000).then(function (j) {
      if (!j || typeof j !== 'object' || !Array.isArray(j.verbindungen)) throw new Error('unverständliche Antwort');
      return { liste: j.verbindungen.map(function (v) { return vendoFahrt(v, von, nach, nachText); }).filter(Boolean), spaeter: j.spaeterContext || (j.verbindungReference && j.verbindungReference.later) || '' };
    });
  }
  function zugWeb(von, nach, nachText, opt, ref, gruende) {
    var body = {
      abfahrtsHalt: vendoOrt(von, von.name || 'Standort'), ankunftsHalt: vendoOrt(nach, nachText || 'Ziel'),
      anfrageZeitpunkt: isoOrt(opt.wann || new Date(), false), ankunftSuche: opt.ankunft ? 'ANKUNFT' : 'ABFAHRT',
      klasse: 'KLASSE_2', produktgattungen: opt.nurBus ? ['BUS', 'ANRUFPFLICHTIG'] : ['ICE', 'EC_IC', 'IR', 'REGIONAL', 'SBAHN', 'BUS', 'SCHIFF', 'UBAHN', 'TRAM', 'ANRUFPFLICHTIG'],
      reisende: [{ typ: 'ERWACHSENER', ermaessigungen: [{ art: 'KEINE_ERMAESSIGUNG', klasse: 'KLASSENLOS' }], alter: [], anzahl: 1 }],
      schnelleVerbindungen: true, sitzplatzOnly: false, bikeCarriage: false, reservierungsKontingenteVorhanden: false,
      nurDeutschlandTicketVerbindungen: false, deutschlandTicketVorhanden: false
    };
    if (ref) body.pagingReference = ref;
    var urls = ['https://www.bahn.de/web/api/angebote/fahrplan', 'https://int.bahn.de/web/api/angebote/fahrplan'], i = 0;
    function frag() {
      var u = urls[i];
      return B.json({ methode: 'POST', url: u, kopf: { Accept: 'application/json', 'Content-Type': 'application/json', 'Accept-Language': 'de' }, daten: JSON.stringify(body), zeit: 20000 }).catch(function (e) {
        gruende.push('Handy → ' + wirt(u) + ': ' + grundText(e));
        if (++i < urls.length) return frag();
        throw e;
      });
    }
    return frag().then(function (j) {
      if (!j || typeof j !== 'object' || !Array.isArray(j.verbindungen)) throw new Error('unverständliche Antwort');
      return { liste: j.verbindungen.map(function (v) { return vendoFahrt(v, von, nach, nachText); }).filter(Boolean), spaeter: (j.verbindungReference && j.verbindungReference.later) || j.spaeterContext || '' };
    });
  }
  /* ---------- Antworten von DB Navigator und bahn.de in dasselbe Format bringen wie transport.rest ---------- */
  function lidTeile(s) { var o = {}; String(s || '').split('@').forEach(function (t) { var i = t.indexOf('='); if (i > 0) o[t.slice(0, i)] = t.slice(i + 1); }); return o; }
  /** Ort aus einem Halt / abgangsOrt: { name, latitude, longitude } */
  function vendoStelle(x, name) {
    if (!x && !name) return null;
    if (typeof x === 'string') { name = name || x; x = null; }
    x = x || {};
    var lid = lidTeile(x.locationId || x.id), pos = x.position || x.coordinates || {};
    var lat = pos.latitude != null ? +pos.latitude : x.lat != null ? +x.lat : lid.Y ? lid.Y / 1e6 : null;
    var lon = pos.longitude != null ? +pos.longitude : x.lon != null ? +x.lon : lid.X ? lid.X / 1e6 : null;
    var n = x.name || name || lid.O || '';
    return { name: n, latitude: lat, longitude: lon, adresse: lid.A === '2' };
  }
  /** Fußweg: Echtzeit hat manchmal eine falsche Zeitzone (bekannter Fehler der Bahn) → Zone der Planzeit übernehmen */
  function zoneWiePlan(plan, echt) {
    if (!plan || !echt) return echt;
    var re = /([+-]\d\d:\d\d|Z)$/, z = re.exec(plan);
    return z ? String(echt).replace(re, '') + z[0] : echt;
  }
  function vendoAusfall(r) {
    if (!r) return false;
    if (r.canceled || r.cancelled || r.ausfall || r.journeyCancelled || r.originCancelled || r.destinationCancelled) return true;
    var n = [].concat(r.risNotizen || [], r.echtzeitNotizen || [], r.meldungen || []);
    return n.some(function (m) { return m && (m.key === 'text.realtime.stop.cancelled' || m.type === 'HALT_AUSFALL' || m.text === 'Halt entfällt' || /fällt aus|cancelled/i.test(m.text || '')); });
  }
  var VENDO_PROD = { ICE: 'nationalExpress', EC_IC: 'national', IC_EC: 'national', IR: 'regionalExpress', REGIONAL: 'regional', RB: 'regional', SBAHN: 'suburban', BUS: 'bus', SCHIFF: 'ferry', UBAHN: 'subway', TRAM: 'tram', STR: 'tram', ANRUFPFLICHTIG: 'taxi', ANRUFPFLICHTIGEVERKEHRE: 'taxi' };
  function vendoLeg(pt) {
    var vm = pt.verkehrsmittel || {}, typ = vm.typ || pt.typ || '', halte = Array.isArray(pt.halte) && pt.halte.length ? pt.halte : [];
    var h0 = halte[0], hn = halte[halte.length - 1];
    var o = (h0 && vendoStelle(h0.ort || h0)) || vendoStelle(pt.abgangsOrt) || vendoStelle(null, pt.abfahrtsOrt);
    var d = (hn && vendoStelle(hn.ort || hn)) || vendoStelle(pt.ankunftsOrt) || vendoStelle(null, pt.ankunftsOrt);
    var fuss = typ === 'WALK' || typ === 'FUSSWEG' || typ === 'TRANSFER';
    var abP = pt.abfahrtsZeitpunkt || pt.abgangsDatum || (h0 && (h0.abgangsDatum || h0.abfahrtsZeitpunkt));
    var abE = pt.ezAbfahrtsZeitpunkt || pt.ezAbgangsDatum || (h0 && (h0.ezAbgangsDatum || h0.ezAbfahrtsZeitpunkt));
    var anP = pt.ankunftsZeitpunkt || pt.ankunftsDatum || (hn && (hn.ankunftsDatum || hn.ankunftsZeitpunkt));
    var anE = pt.ezAnkunftsZeitpunkt || pt.ezAnkunftsDatum || (hn && (hn.ezAnkunftsDatum || hn.ezAnkunftsZeitpunkt));
    if (fuss) { abE = zoneWiePlan(abP, abE); anE = zoneWiePlan(anP, anE); }
    function sek(p, e) { var a = dbZeit(p), b = dbZeit(e); return a && b ? Math.round((b - a) / 1000) : null; }
    var l = {
      walking: fuss, origin: o, destination: d,
      plannedDeparture: abP || null, departure: abE || abP || null, departureDelay: sek(abP, abE),
      plannedArrival: anP || null, arrival: anE || anP || null, arrivalDelay: sek(anP, anE),
      distance: pt.distanz || 0,
      cancelled: !!(pt.cancelled || pt.canceled || vendoAusfall(h0) || vendoAusfall(hn))
    };
    if (fuss) {
      if (!l.distance && o && d && o.latitude != null && d.latitude != null) l.distance = Math.round(G.abstand({ lat: o.latitude, lon: o.longitude }, { lat: d.latitude, lon: d.longitude }));
      return l;
    }
    var g = vm.produktGattung || pt.produktGattung || '';
    var name = vm.name || vm.mittelText || pt.mitteltext || vm.langText || pt.langtext || pt.kurztext || '';
    if (/^(Bus|STR)\s/.test(vm.langText || '') && !name) name = vm.langText;
    l.line = { name: txt(name) || (VENDO_PROD[g] === 'bus' ? 'Bus' : 'Zug'), product: VENDO_PROD[g] || '', fahrtNr: String(vm.nummer || pt.verkehrsmittelNummer || '') };
    if (l.line.product === 'bus' || l.line.product === 'taxi') l.line.mode = 'bus';
    l.direction = vm.richtung || pt.richtung || '';
    if (h0) l.departurePlatform = h0.ezGleis || h0.gleis || '';
    if (h0) l.plannedDeparturePlatform = h0.gleis || '';
    if (hn) l.arrivalPlatform = hn.ezGleis || hn.gleis || '';
    if (hn) l.plannedArrivalPlatform = hn.gleis || '';
    // Hinweise (Verspätungsgrund, Ausfall, Bauarbeiten)
    var noti = [].concat(pt.echtzeitNotizen || [], pt.risNotizen || [], pt.himNotizen || [], pt.himMeldungen || [], pt.priorisierteMeldungen || []);
    l.remarks = noti.map(function (m) { var t = m && (m.text || m.value || m.ueberschrift || m.nachrichtKurz); return t ? { type: 'warning', summary: t } : null; }).filter(Boolean);
    // Streckenverlauf: Polylinie, falls geliefert, sonst über alle Halte (besser als Luftlinie)
    var pts = [];
    try {
      var pg = pt.polylineGroup, desc = pg && (pg.polylineDescriptions || pg.polylineDesc);
      if (desc && desc.length) {
        var lang = desc.reduce(function (m, x) { return (x.coordinates || []).length > (m.coordinates || []).length ? x : m; });
        (lang.coordinates || []).forEach(function (c) { var lo = c.lng != null ? c.lng : c.longitude, la = c.lat != null ? c.lat : c.latitude; if (lo != null && la != null) pts.push([+lo, +la]); });
      }
    } catch (e) {}
    if (pts.length < 2) halte.forEach(function (h) { var s = vendoStelle(h.ort || h); if (s && s.latitude != null) pts.push([s.longitude, s.latitude]); });
    if (pts.length >= 2) l.polyline = { features: pts.map(function (c) { return { geometry: { coordinates: c } }; }) };
    return l;
  }
  function vendoFahrt(v, von, nach, nachText) {
    var j = v && (v.verbindung || v); if (!j || !Array.isArray(j.verbindungsAbschnitte)) return null;
    var legs = j.verbindungsAbschnitte.map(vendoLeg);
    // fehlende Koordinaten (Fußwege bei bahn.de) mit den Nachbarn füllen
    legs.forEach(function (l, i) {
      if (l.origin && l.origin.latitude == null) { var p = i ? legs[i - 1].destination : { latitude: von.lat, longitude: von.lon }; if (p && p.latitude != null) { l.origin.latitude = p.latitude; l.origin.longitude = p.longitude; } }
      if (l.destination && l.destination.latitude == null) { var n = i < legs.length - 1 ? legs[i + 1].origin : { latitude: nach.lat, longitude: nach.lon }; if (n && n.latitude != null) { l.destination.latitude = n.latitude; l.destination.longitude = n.longitude; } }
      // Start/Ziel als Adresse: lesbare Namen statt der Koordinaten-Adresse
      if (i === 0 && l.origin && l.origin.adresse) l.origin.name = von.name || 'Start';
      if (i === legs.length - 1 && l.destination && l.destination.adresse) l.destination.name = nachText || 'Ziel';
    });
    var f = fahrt({ legs: legs });
    if (!f) return null;
    // Preis („ab 43,99 €“) – DB Navigator: angebote.preise.gesamt.ab, bahn.de: angebotsPreis
    var pr = (v && (v.angebotsPreis || (v.angebote && v.angebote.preise && v.angebote.preise.gesamt && v.angebote.preise.gesamt.ab))) || j.angebotsPreis || j.abPreis;
    if (pr && pr.betrag) f.preis = { betrag: +pr.betrag, teil: !!(v.hasTeilpreis || j.hasTeilpreis || (v.angebote && v.angebote.preise && v.angebote.preise.istTeilpreis)) };
    // Für die Buchung: erster und letzter Halt mit Zug/Bus (Bahn-Kennung), Abfahrt laut Plan
    var roh = j.verbindungsAbschnitte.filter(function (pt) { var t = (pt.verkehrsmittel && pt.verkehrsmittel.typ) || pt.typ || ''; return !/^(WALK|FUSSWEG|TRANSFER)$/.test(t); });
    if (roh.length) {
      var hs = function (pt, letzt) { var hl = pt.halte || [], x = hl.length ? (letzt ? hl[hl.length - 1] : hl[0]) : null, o = x ? (x.ort || x) : (letzt ? pt.ankunftsOrt : pt.abgangsOrt); if (!o || typeof o !== 'object') return null; var lid = o.locationId || o.id || '', eva = evaOhneNull(o.evaNr || o.extId || lidTeile(lid).L); return { name: o.name || lidTeile(lid).O || '', lid: lid, eva: eva }; };
      f.buchung = { von: hs(roh[0], false), nach: hs(roh[roh.length - 1], true), ab: f.erster && f.erster.abPlan };
    }
    return f;
  }
  /* ---------- Bahnhöfe in der Nähe und Live-Abfahrtstafel ----------
   * 1. Wahl: direkt bei der Deutschen Bahn (bahn.de, dieselben Daten wie im DB Navigator, ohne Schlüssel)
   * 2. Wahl: transport.rest (privater Zusatzdienst, fällt öfter aus)
   * Bahnhofsliste zusätzlich aus OpenStreetMap, damit sie auch erscheint, wenn die Bahn gerade nicht antwortet. */
  var ZUG = ['nationalExpress', 'national', 'regionalExpress', 'regional', 'suburban'];
  var DBZUG = { ICE: 'nationalExpress', EC_IC: 'national', IR: 'regionalExpress', REGIONAL: 'regional', SBAHN: 'suburban' };
  V.DIENST.dbweb = ['https://www.bahn.de/web/api/reiseloesung', 'https://int.bahn.de/web/api/reiseloesung'];
  function dbFrage(pfad, gruende) {
    return bahnReihe(V.DIENST.dbweb.map(function (b) { return b + pfad; }), { Accept: 'application/json', 'Accept-Language': 'de' }, 15000, gruende);
  }
  function evaOhneNull(x) { return String(x || '').replace(/^0+/, ''); }
  /** Bahnhöfe (nur mit Zügen, ohne reine Bushaltestellen) um einen Punkt, nächste zuerst */
  V.bahnhoefe = function (p, meter) {
    meter = meter || 8000;
    var k = p.lat.toFixed(2) + ',' + p.lon.toFixed(2) + ',' + meter;
    return V.merk('bahnhof', k, { frisch: 7 * ZW_TAG, max: 40 }, function () { return bahnhoefeHolen(p, meter); }).then(function (l) {
      // Entfernung vom genauen Standort neu rechnen (der Speicher gilt für rund 1 km)
      return l.map(function (b) { return Object.assign({}, b, { weit: Math.round(G.abstand(p, b)) }); }).filter(function (b) { return b.weit <= meter + 1000; }).sort(function (a, b) { return a.weit - b.weit; });
    });
  };
  function liste(l, p) {
    var gesehen = {}, aus = [];
    l.forEach(function (b) { var n = b.name.toLowerCase(); if (gesehen[n] || b.lat == null) return; gesehen[n] = 1; b.weit = Math.round(G.abstand(p, b)); aus.push(b); });
    aus.sort(function (a, b) { return a.weit - b.weit; });
    if (!aus.length) throw new Error('leer');
    return aus;
  }
  /* Große Umkreise (über 15 km) verkraften die Bahn-Schnittstellen nicht in einer Abfrage.
   * Deshalb: eine Abfrage mit 15 km um den Punkt und weitere 15-km-Abfragen auf einem Ring drumherum,
   * Ergebnisse zusammenführen und auf den gewünschten Umkreis zuschneiden. */
  var BF_STUECK = 15000;
  function versetzt(p, meter, grad) {
    var w = grad * Math.PI / 180;
    return { lat: p.lat + (meter * Math.cos(w)) / 111320, lon: p.lon + (meter * Math.sin(w)) / (111320 * Math.cos(p.lat * Math.PI / 180)) };
  }
  function gekachelt(holen, p, meter) {
    if (meter <= BF_STUECK) return holen(p, meter);
    return holen(p, BF_STUECK).then(function (mitte) {
      var abst = meter - BF_STUECK + 5000, punkte = [], alle = mitte.slice();
      for (var g = 0; g < 360; g += 45) punkte.push(versetzt(p, abst, g));
      // in Vierergruppen abfragen, damit die Bahn nicht wegen zu vieler Anfragen auf einmal sperrt
      function gruppe(i) {
        if (i >= punkte.length) return Promise.resolve();
        return Promise.all(punkte.slice(i, i + 4).map(function (q) { return holen(q, BF_STUECK).catch(function () { return []; }); }))
          .then(function (t) { t.forEach(function (l) { alle = alle.concat(l); }); return gruppe(i + 4); });
      }
      return gruppe(0).then(function () { return alle.filter(function (b) { return G.abstand(p, b) <= meter + 1000; }); });
    });
  }
  function bahnhoefeHolen(p, meter) {
    return gekachelt(bfDb, p, meter).then(function (l) { return liste(l, p); })
      .catch(function () { return gekachelt(bfRest, p, meter).then(function (l) { return liste(l, p); }); })
      .catch(function () { return bfOsm(p, meter).then(function (l) { return liste(l, p); }); })
      .catch(function (e) { if (e && e.message === 'leer') return []; throw e; });
  }
  function bfDb(p, meter) {
    return dbFrage('/orte/nearby?lat=' + p.lat.toFixed(5) + '&long=' + p.lon.toFixed(5) + '&radius=' + meter + '&maxNo=25').then(function (j) {
      var roh = Array.isArray(j) ? j : (j && (j.orte || j.locations)) || [], l = [];
      if (!Array.isArray(roh)) throw new Error('Unerwartete Antwort');
      roh.forEach(function (x) {
        var pr = {}; (x.products || x.produktGattungen || []).forEach(function (g) { if (DBZUG[g]) pr[DBZUG[g]] = 1; });
        var id = evaOhneNull(x.extId || x.evaNr);
        if (!id || x.lat == null || !ZUG.some(function (z) { return pr[z]; })) return;
        l.push({ id: id, name: x.name || 'Bahnhof', lat: +x.lat, lon: +x.lon,
          fern: !!(pr.nationalExpress || pr.national), regio: !!(pr.regionalExpress || pr.regional), sbahn: !!pr.suburban });
      });
      return l;
    });
  }
  function bfRest(p, meter) {
    return bahnFrage('/locations/nearby?latitude=' + p.lat.toFixed(5) + '&longitude=' + p.lon.toFixed(5) + '&results=15&distance=' + meter + '&stops=true&poi=false&addresses=false&linesOfStops=false&language=de').then(function (j) {
      var roh = Array.isArray(j) ? j : (j && (j.locations || j.stops)) || [], l = [];
      roh.forEach(function (x) {
        var pr = x.products || {}, loc = x.location || x;
        if (!ZUG.some(function (z) { return pr[z]; }) || loc.latitude == null) return;
        l.push({ id: String(x.id), name: x.name || 'Bahnhof', lat: +loc.latitude, lon: +loc.longitude,
          fern: !!(pr.nationalExpress || pr.national), regio: !!(pr.regionalExpress || pr.regional), sbahn: !!pr.suburban });
      });
      return l;
    });
  }
  /** Notlösung: Bahnhöfe aus OpenStreetMap. Die Bahn-Nummer (EVA) steht meist in uic_ref; sonst wird sie beim Öffnen der Tafel gesucht. */
  function bfOsm(p, meter) {
    var ll = p.lat.toFixed(5) + ',' + p.lon.toFixed(5);
    var q = '[out:json][timeout:20];nwr["railway"~"^(station|halt)$"]["station"!~"subway|light_rail|monorail|funicular"]["usage"!="tourism"](around:' + Math.min(meter, 20000) + ',' + ll + ');out center tags 40;';
    return V.osm(q, 7 * 86400).then(function (j) {
      var l = [];
      (j.elements || []).forEach(function (e) {
        var t = e.tags || {}, o = osmOrt(e); if (o.lat == null || !t.name) return;
        if (/^(disused|abandoned|razed)$/.test(t.railway || '') || t['disused:railway']) return;
        var uic = String(t.uic_ref || t['railway:ref:DBAG:eva'] || '').trim();
        var sb = t.station === 'suburban' || /S-Bahn/i.test(t.network || '');
        l.push({ id: /^80\d{5}$/.test(uic) ? uic : '', name: t.name, lat: o.lat, lon: o.lon, fern: false, regio: !sb, sbahn: sb, osm: true });
      });
      return l;
    });
  }
  /** Bahn-Nummer eines Bahnhofs über den Namen suchen (für Bahnhöfe aus OpenStreetMap) */
  var idMerker = {};
  function bfId(b, gruende) {
    if (b.id) return Promise.resolve(b.id);
    if (idMerker[b.name]) return Promise.resolve(idMerker[b.name]);
    var gNavi = [];
    return naviId(b, gNavi).catch(function () { return null; }).then(function (nid) {
      if (nid) { idMerker[b.name] = nid; b.id = nid; return nid; }
      gruende && gNavi.forEach(function (x) { gruende.push(x); });
      return bfIdWeb(b, gruende);
    });
  }
  function bfIdWeb(b, gruende) {
    return dbFrage('/orte?suchbegriff=' + encodeURIComponent(b.name) + '&typ=ALL&limit=8', gruende).then(function (j) {
      var best = null, bw = 3000;
      (Array.isArray(j) ? j : []).forEach(function (x) {
        var id = evaOhneNull(x.extId); if (!id || x.lat == null) return;
        var w = G.abstand(b, { lat: +x.lat, lon: +x.lon }); if (w < bw) { bw = w; best = id; }
      });
      if (!best) { var f = new Error('Bahnhof nicht gefunden'); f.gruende = (gruende || []).concat(['Bahn kennt „' + b.name + '“ nicht als Haltestelle']); throw f; }
      idMerker[b.name] = best; b.id = best; return best;
    });
  }
  function hm(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function tag(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /** bahn.de liefert Ortszeit ohne Zeitzone („2026-10-15T16:31:00“) – das Handy steht in Deutschland, also passt die lokale Zeit */
  function dbZeit(t) { if (!t) return null; var d = new Date(String(t).replace(' ', 'T')); return isNaN(d) ? null : d; }
  /* Welche Verkehrsmittel eine Tafel zeigt: zug = Bahnhöfe (wie bisher), bus = alles an einer Haltestelle, stadt = nur S- und U-Bahn */
  var DB_ALLE = { ICE: 'nationalExpress', EC_IC: 'national', IR: 'regionalExpress', REGIONAL: 'regional', SBAHN: 'suburban', BUS: 'bus', SCHIFF: 'ferry', UBAHN: 'subway', TRAM: 'tram', ANRUFPFLICHTIG: 'bus' };
  var NAVI_ALLE = { ICE: 'nationalExpress', IC_EC: 'national', IR: 'regionalExpress', RB: 'regional', SBAHN: 'suburban', BUS: 'bus', SCHIFF: 'ferry', UBAHN: 'subway', STR: 'tram', ANRUFPFLICHTIGEVERKEHRE: 'bus' };
  function tafelProdukt(art, g, navi) {
    if (!art || art === 'zug') return (navi ? NAVIZUG : DBZUG)[g] || null;
    var p = (navi ? NAVI_ALLE : DB_ALLE)[g] || (g ? 'bus' : '');
    if (art === 'stadt') return p === 'suburban' || p === 'subway' ? p : null;
    return p;
  }
  function tafelDb(id, ankunft, gruende, art) {
    var art = ankunft ? 'ankuenfte' : 'abfahrten', jetzt = new Date(Date.now() - 5 * 60000), spaeter = new Date(jetzt.getTime() + 50 * 60000);
    function frag(d, g) { return dbFrage('/' + art + '?ortExtId=' + encodeURIComponent(id) + '&datum=' + tag(d) + '&zeit=' + encodeURIComponent(hm(d)) + '&mitVias=true', g); }
    // Die Bahn gibt pro Abfrage etwa eine Stunde zurück – zwei Abfragen decken die 90 Minuten sicher ab
    return Promise.all([frag(jetzt, gruende), frag(spaeter, []).catch(function () { return null; })]).then(function (t) {
      var gesehen = {}, l = [];
      t.forEach(function (j) {
        if (!j) return;
        var roh = j.entries || j.bahnhofstafelAbfahrtPositionen || j.bahnhofstafelAnkunftPositionen || j.items || [];
        if (roh.length && Array.isArray(roh[0])) roh = [].concat.apply([], roh);
        roh.forEach(function (x) {
          var vm = x.verkehrmittel || x.verkehrsmittel || {}, g = vm.produktGattung || '', pr0 = tafelProdukt(art, g, false);
          if (g && !pr0) return;   // passt nicht zur Tafel (z. B. Bus am Bahnhof)
          var key = (x.journeyId || x.zugId || '') + '|' + (x.zeit || '');
          if (gesehen[key]) return; gesehen[key] = 1;
          var plan = dbZeit(x.zeit), echt = dbZeit(x.ezZeit), meld = x.meldungen || [];
          var faellt = !!(x.cancelled || x.canceled) || meld.some(function (m) { return m && (m.type === 'HALT_AUSFALL' || /fällt aus|Halt entfällt|entfällt/i.test(m.text || '')); });
          var verz = echt && plan ? Math.round((echt - plan) / 60000) : null;
          l.push({ fahrtId: x.journeyId || '', plan: plan, echt: echt || plan, verz: verz, live: !!echt, linie: vm.mittelText && /^(RE|RB|S)\s?\d/.test(vm.mittelText) ? vm.mittelText : (vm.name || vm.langText || vm.mittelText || 'Zug'),
            produkt: pr0 || '', richtung: ankunft ? (x.terminus || (x.ueber && x.ueber[0]) || '') : (x.terminus || ''),
            gleis: x.ezGleis || x.gleis || '', gleisPlan: x.gleis || '', faellt: faellt,
            hinweise: meld.filter(function (m) { return m && m.text && m.prioritaet !== 'NIEDRIG' && m.type !== 'HALT_AUSFALL'; }).map(function (m) { return txt(m.text); }).filter(Boolean).slice(0, 2) });
        });
      });
      return l;
    });
  }
  /* ---------- DB Navigator (dieselbe Schnittstelle wie die DB-Navigator-App) ---------- */
  var NAVI = 'https://app.services-bahn.de/mob/';
  var NAVIZUG = { ICE: 'nationalExpress', IC_EC: 'national', IR: 'regionalExpress', RB: 'regional', SBAHN: 'suburban' };
  function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function naviFrage(pfad, typ, body, gruende, zeit) {
    var ct = 'application/x.db.vendo.mob.' + typ + '+json', url = NAVI + pfad, daten = JSON.stringify(body);
    return B.json({ methode: 'POST', url: url, kopf: { Accept: ct, 'Content-Type': ct, 'Accept-Language': 'de', 'X-Correlation-ID': uuid() + '_' + uuid() }, daten: daten, zeit: zeit || 15000 }).catch(function (e) {
      gruende.push('Handy → ' + wirt(url) + ': ' + grundText(e));
      return bahnUeberServer(url, gruende, { methode: 'POST', typ: typ, daten: daten });
    });
  }
  function tafelNavi(id, ankunft, gruende, art) {
    var jetzt = new Date(Date.now() - 5 * 60000), spaeter = new Date(jetzt.getTime() + 50 * 60000);
    var vmListe = art === 'bus' ? ['ALL'] : art === 'stadt' ? ['SBAHNEN', 'UBAHN'] : ['HOCHGESCHWINDIGKEITSZUEGE', 'INTERCITYUNDEUROCITYZUEGE', 'INTERREGIOUNDSCHNELLZUEGE', 'NAHVERKEHRSONSTIGEZUEGE', 'SBAHNEN'];
    function frag(d, g) {
      return naviFrage('bahnhofstafel/' + (ankunft ? 'ankunft' : 'abfahrt'), 'bahnhofstafeln.v2', { anfragezeit: hm(d), datum: tag(d), ursprungsBahnhofId: 'A=1@L=' + id + '@',
        verkehrsmittel: vmListe }, g);
    }
    return Promise.all([frag(jetzt, gruende), frag(spaeter, []).catch(function () { return null; })]).then(function (t) {
      if (!t[0] || typeof t[0] !== 'object') throw new Error('unverständliche Antwort');
      var gesehen = {}, l = [];
      t.forEach(function (j) {
        if (!j) return;
        (j.bahnhofstafelAbfahrtPositionen || j.bahnhofstafelAnkunftPositionen || []).forEach(function (x) {
          var pr = tafelProdukt(art, x.produktGattung, true); if (x.produktGattung && !pr) return;
          var plan = dbZeit(ankunft ? x.ankunftsDatum : x.abgangsDatum), echt = dbZeit(ankunft ? x.ezAnkunftsDatum : x.ezAbgangsDatum);
          var key = (x.zuglaufId || x.mitteltext || '') + '|' + (plan ? +plan : ''); if (gesehen[key] || !plan) return; gesehen[key] = 1;
          var notiz = (x.echtzeitNotizen || []).map(function (m) { return txt(m && m.text); }).filter(Boolean);
          var faellt = !!(x.ausfall || x.cancelled) || notiz.some(function (m) { return /fällt aus|Halt entfällt|entfällt/i.test(m); });
          l.push({ plan: plan, echt: echt || plan, verz: echt ? Math.round((echt - plan) / 60000) : null, live: !!echt, linie: x.mitteltext || x.kurztext || 'Zug', produkt: pr || '', fahrtId: x.zuglaufId || '',
            richtung: x.richtung || (x.abgangsOrt && x.abgangsOrt.name) || '', gleis: x.ezGleis || x.gleis || '', gleisPlan: x.gleis || '', faellt: faellt,
            hinweise: notiz.filter(function (m) { return !/Halt entfällt/i.test(m); }).slice(0, 2) });
        });
      });
      return l;
    });
  }
  /** Bahn-Nummer über die Suche des DB Navigators (falls bahn.de gesperrt ist) */
  function naviId(b, gruende) {
    return naviFrage('location/search', 'location.v3', { locationTypes: ['ST'], searchTerm: b.name, maxResults: 8 }, gruende).then(function (j) {
      var best = null, bw = 3000;
      (Array.isArray(j) ? j : []).forEach(function (x) {
        var id = evaOhneNull(x.evaNr || x.extId), c = x.coordinates || {}; if (!id || c.latitude == null) return;
        var w = G.abstand(b, { lat: +c.latitude, lon: +c.longitude }); if (w < bw) { bw = w; best = id; }
      });
      return best;
    });
  }
  /* ---------- bahnhof.de (Abfahrtstafeln der DB-Bahnhofsseiten) ---------- */
  var HOFZUG = { HIGH_SPEED_TRAIN: 'nationalExpress', INTERCITY_TRAIN: 'national', INTER_REGIONAL_TRAIN: 'regionalExpress', REGIONAL_TRAIN: 'regional', CITY_TRAIN: 'suburban' };
  function tafelHof(id, ankunft, gruende) {
    var url = 'https://www.bahnhof.de/api/boards/' + (ankunft ? 'arrivals' : 'departures') + '?evaNumbers=' + encodeURIComponent(id) + '&duration=90&sortBy=TIME_SCHEDULE&locale=de' +
      Object.keys(HOFZUG).map(function (k) { return '&filterTransports=' + k; }).join('');
    return bahnReihe([url], { Accept: 'application/json' }, 15000, gruende).then(function (j) {
      if (!j || !Array.isArray(j.entries)) throw new Error('unverständliche Antwort');
      var roh = [].concat.apply([], j.entries.map(function (g) { return Array.isArray(g) ? g : [g]; })), l = [];
      roh.forEach(function (x) {
        var pr = HOFZUG[x.type]; if (x.type && !pr) return;
        var plan = dbZeit(x.timeSchedule), echt = x.timeType !== 'SCHEDULE' ? dbZeit(x.timeDelayed) : null; if (!plan) return;
        var m = x.messages || {}, meld = [].concat(m.delay || [], m.cancelation || [], m.common || []).filter(function (y) { return y && y.text && (y.important || y.change); }).map(function (y) { return txt(y.text); });
        l.push({ plan: plan, echt: echt || plan, verz: echt ? Math.round((echt - plan) / 60000) : null, live: !!echt, linie: x.lineName || 'Zug', produkt: pr || '',
          richtung: ankunft ? ((x.origin && x.origin.name) || (x.destination && x.destination.name) || '') : ((x.destination && x.destination.name) || ''),
          gleis: x.platform || x.platformSchedule || '', gleisPlan: x.platformSchedule || '', faellt: !!x.canceled, hinweise: meld.slice(0, 2) });
      });
      return l;
    });
  }
  function tafelRest(id, ankunft, gruende, wasArt) {
    var art = ankunft ? 'arrivals' : 'departures';
    var filter = wasArt === 'bus' ? '' : wasArt === 'stadt' ? '&nationalExpress=false&national=false&regionalExpress=false&regional=false&bus=false&ferry=false&tram=false&taxi=false' : '&bus=false&ferry=false&subway=false&tram=false&taxi=false';
    return bahnFrage('/stops/' + encodeURIComponent(id) + '/' + art + '?duration=90&results=30&remarks=true&language=de' + filter, gruende).then(function (j) {
      var roh = Array.isArray(j) ? j : (j && j[art]) || [];
      return roh.map(function (x) {
        var plan = zeit(x.plannedWhen || x.when), echt = zeit(x.when || x.plannedWhen), d = x.delay != null ? Math.round(x.delay / 60) : null;
        if (d == null && plan && echt && x.when) d = Math.round((echt - plan) / 60000);
        return { plan: plan, echt: echt, verz: d, live: x.delay != null || (x.when && x.when !== x.plannedWhen), linie: (x.line && (x.line.name || x.line.fahrtNr)) || 'Zug',
          produkt: x.line && x.line.product || '', richtung: ankunft ? (x.provenance || (x.origin && x.origin.name) || '') : (x.direction || (x.destination && x.destination.name) || ''),
          gleis: x.platform || x.plannedPlatform || '', gleisPlan: x.plannedPlatform || '', faellt: !!x.cancelled,
          hinweise: (x.remarks || []).filter(function (r) { return r && (r.type === 'warning' || r.type === 'status'); }).map(function (r) { return txt(r.summary || r.text); }).filter(Boolean).slice(0, 2) };
      });
    });
  }
  /** Abfahrten oder Ankünfte der nächsten 90 Minuten – live, mit Verspätung, Gleis und Gleiswechsel. b = Bahnhof oder Bahn-Nummer */
  V.tafel = function (b, ankunft, art) {
    if (typeof b !== 'object') b = { id: String(b) };
    var gruende = [], zug = !art || art === 'zug';
    return (zug ? bfId(b, gruende) : haltId(b, art, gruende)).then(function (id) {
      // Reihenfolge: DB Navigator → bahnhof.de (nur Bahnhöfe) → bahn.de → transport.rest (der erste, der antwortet, gewinnt)
      var w = tafelNavi(id, ankunft, gruende, art);
      if (zug) w = w.catch(function () { return tafelHof(id, ankunft, gruende); });
      return w.catch(function () { return tafelDb(id, ankunft, gruende, art); })
        .catch(function () { return tafelRest(id, ankunft, gruende, art); });
    }).catch(function (e) { if (e && !e.gruende) e.gruende = gruende.length ? gruende : [grundText(e)]; throw e; }).then(function (l) {
      var von = Date.now() - 3 * 60000, bis = Date.now() + 90 * 60000;
      return l.filter(function (x) { return x.plan && (x.echt || x.plan) >= von && x.plan <= bis; }).sort(function (a, b) { return a.plan - b.plan; });
    });
  };
  /** Kurzfassung einer Tafel: { pk, sp, au } */
  V.tafelSumme = function (l) { var s = { pk: 0, sp: 0, au: 0 }; l.forEach(function (x) { if (x.faellt) s.au++; else if (x.verz >= 6) s.sp++; else if (x.verz != null) s.pk++; }); return s; };
  /** Liegt das Ziel an einem Bahnhof (höchstens 700 m)? Liefert den Bahnhof oder null */
  V.zielBahnhof = function (p) {
    if (!p || p.lat == null) return Promise.resolve(null);
    return V.bahnhoefe(p, 3000).then(function (l) { return l[0] && l[0].weit <= 700 ? l[0] : null; }).catch(function () { return null; });
  };

  /* ---------- Ein Zug aus der Abfahrtstafel: weitere Halte, Preise, Ticket ---------- */
  function naviGet(pfad, typ, gruende) {
    var ct = 'application/x.db.vendo.mob.' + typ + '+json', url = NAVI + pfad;
    return B.json({ url: url, kopf: { Accept: ct, 'Accept-Language': 'de', 'X-Correlation-ID': uuid() + '_' + uuid() }, zeit: 15000 }).catch(function (e) {
      gruende.push('Handy → ' + wirt(url) + ': ' + grundText(e));
      return bahnUeberServer(url, gruende, { methode: 'GET', typ: typ });
    });
  }
  /** Alle Halte eines Zuges: [{ name, eva, lid, an, ab, gleis, lat, lon }] */
  V.zuglauf = function (fahrtId) {
    var gruende = [];
    return naviGet('zuglauf/' + encodeURIComponent(fahrtId), 'zuglauf.v2', gruende).then(function (j) {
      var h = j && (j.halte || j.stops);
      if (!Array.isArray(h) || !h.length) throw new Error('keine Halte');
      return h.map(function (x) {
        var o = x.ort || x, lid = o.locationId || o.id || '', pos = o.position || o.coordinates || {};
        return { name: o.name || lidTeile(lid).O || '', eva: evaOhneNull(o.evaNr || o.extId || lidTeile(lid).L), lid: lid,
          an: dbZeit(x.ezAnkunftsDatum || x.ankunftsDatum), anPlan: dbZeit(x.ankunftsDatum), ab: dbZeit(x.ezAbgangsDatum || x.abgangsDatum), abPlan: dbZeit(x.abgangsDatum),
          gleis: x.ezGleis || x.gleis || '', faellt: vendoAusfall(x), lat: pos.latitude, lon: pos.longitude };
      });
    }).catch(function (e) { if (!e.gruende) e.gruende = gruende; throw e; });
  };
  function grundAnfrage(klasse) {
    return {
      autonomeReservierung: false, einstiegsTypList: ['STANDARD'],
      fahrverguenstigungen: { deutschlandTicketVorhanden: false, nurDeutschlandTicketVerbindungen: false },
      klasse: klasse === 1 ? 'KLASSE_1' : 'KLASSE_2',
      reisendenProfil: { reisende: [{ ermaessigungen: ['KEINE_ERMAESSIGUNG KLASSENLOS'], reisendenTyp: 'ERWACHSENER' }] },
      reservierungsKontingenteVorhanden: false
    };
  }
  function linNorm(t) { return String(t || '').replace(/\s+/g, '').toUpperCase(); }
  /** Angebote (Super Sparpreis, Sparpreis, Flexpreis …) aus der Antwort der Bahn */
  function angeboteLesen(ang) {
    var aus = [], gesehen = {};
    function auspacken(w) { var teil = false; while (w && w.reisePosition) { teil = teil || !!(w.teilpreisInformationen && w.teilpreisInformationen.length); w = w.reisePosition; } return w ? Object.assign({}, w, { _teil: teil || !!w.teilpreis }) : null; }
    ((ang && ang.angebotsCluster) || []).forEach(function (c) {
      (c.angebotsSubCluster || []).forEach(function (sc) {
        (sc.angebotsPositionen || []).forEach(function (p) {
          var ef = p.einfacheFahrt || {}, kand = [ef.standard && ef.standard.reisePosition, p.verbundAngebot && (p.verbundAngebot.reisePosition || (p.verbundAngebot.standard && p.verbundAngebot.standard.reisePosition))];
          kand.map(auspacken).forEach(function (r) {
            if (!r || !r.preis || r.preis.betrag == null || (r.typ && r.typ !== 'REISEANGEBOT' && r.typ !== 'VERBUNDANGEBOT')) return;
            var k = (r.name || '') + '|' + r.preis.betrag; if (gesehen[k]) return; gesehen[k] = 1;
            var kond = (r.konditionsAnzeigen || r.konditionen || []).map(function (x) { return txt(x.anzeigeUeberschrift || x.textKurz || x.bezeichnung); }).filter(Boolean).slice(0, 4);
            aus.push({ name: r.name || 'Ticket', betrag: +r.preis.betrag, teil: r._teil, kond: kond, info: txt(r.leuchtturmInfo && r.leuchtturmInfo.text || r.leuchtturmText || '') });
          });
        });
      });
    });
    return aus.sort(function (a, b) { return a.betrag - b.betrag; });
  }
  /** Preise für genau diesen Zug von Halt „von“ bis Halt „nach“: { fahrt, angebote, ab } */
  V.preise = function (von, nach, zug, klasse) {
    var gruende = [], ab = zug.plan || new Date();
    var body = grundAnfrage(klasse);
    body.reiseHin = { wunsch: { abgangsLocationId: von.lid || 'A=1@L=' + von.eva + '@', zielLocationId: nach.lid || 'A=1@L=' + nach.eva + '@', verkehrsmittel: ['ALL'], alternativeHalteBerechnung: false,
      zeitWunsch: { reiseDatum: isoOrt(new Date(ab.getTime() - 60000), true), zeitPunktArt: 'ABFAHRT' } } };
    return naviFrage('angebote/fahrplan', 'verbindungssuche.v9', body, gruende, 25000).then(function (j) {
      var vs = (j && j.verbindungen) || [], treffer = null;
      vs.forEach(function (v) {
        if (treffer) return;
        var vb = v.verbindung || v, fz = (vb.verbindungsAbschnitte || []).filter(function (pt) { return ((pt.verkehrsmittel && pt.verkehrsmittel.typ) || pt.typ) === 'FAHRZEUG' || pt.typ === 'PUBLICTRANSPORT' || (pt.verkehrsmittel && pt.verkehrsmittel.typ === 'PUBLICTRANSPORT'); });
        var e = fz[0]; if (!e) return;
        var t = dbZeit(e.abgangsDatum || e.abfahrtsZeitpunkt);
        var gleich = (zug.fahrtId && e.zuglaufId && e.zuglaufId.split('#ZE#')[0] === zug.fahrtId.split('#ZE#')[0]) || (linNorm(e.mitteltext || (e.verkehrsmittel && e.verkehrsmittel.mittelText)) === linNorm(zug.linie) && t && Math.abs(t - ab) < 90000);
        if (gleich) treffer = v;
      });
      if (!treffer) { var f = new Error('Für diesen Zug liefert die Bahn gerade keine Verbindung bis ' + nach.name + '.'); f.gruende = gruende; throw f; }
      var vb = treffer.verbindung || treffer, fahrtX = vendoFahrt(treffer, { lat: 0, lon: 0 }, { lat: 0, lon: 0 }, nach.name);
      var angebote = angeboteLesen(treffer.angebote);
      if (angebote.length || !vb.kontext) return { fahrt: fahrtX, angebote: angebote, kontext: vb.kontext };
      // Einzelne Angebote holt die Bahn erst mit einer zweiten Anfrage („recon“)
      var b2 = grundAnfrage(klasse); b2.verbindungHin = { kontext: vb.kontext };
      return naviFrage('angebote/recon', 'verbindungssuche.v9', b2, gruende, 25000).then(function (r) {
        return { fahrt: fahrtX, angebote: angeboteLesen(r && r.angebote), kontext: vb.kontext };
      }, function () { return { fahrt: fahrtX, angebote: [], kontext: vb.kontext }; });
    }).then(function (x) {
      if (!x.angebote.length && x.fahrt && x.fahrt.preis) x.angebote = [{ name: 'Preis ab', betrag: x.fahrt.preis.betrag, teil: x.fahrt.preis.teil, kond: [] }];
      return x;
    }).catch(function (e) { if (!e.gruende) e.gruende = gruende; throw e; });
  };

  /* ---------- Bushaltestellen und U-/S-Bahn-Stationen ----------
   * 1. Wahl: DB Navigator „in der Nähe“ (liefert gleich die Bahn-Kennung für die Abfahrtstafel)
   * 2. Wahl: OpenStreetMap (Kennung wird beim Öffnen der Tafel über die Lage gesucht) */
  var HALT_PROD = {
    bus: ['BUSSE', 'ANRUFPFLICHTIGEVERKEHRE'],
    stadt: ['SBAHNEN', 'UBAHN']
  };
  var PROD_NAME = { BUSSE: 'bus', BUS: 'bus', ANRUFPFLICHTIGEVERKEHRE: 'bus', ANRUFPFLICHTIG: 'bus', SBAHNEN: 'sbahn', SBAHN: 'sbahn', UBAHN: 'ubahn', STRASSENBAHN: 'tram', STR: 'tram', TRAM: 'tram',
    HOCHGESCHWINDIGKEITSZUEGE: 'zug', ICE: 'zug', INTERCITYUNDEUROCITYZUEGE: 'zug', IC_EC: 'zug', EC_IC: 'zug', INTERREGIOUNDSCHNELLZUEGE: 'zug', IR: 'zug', NAHVERKEHRSONSTIGEZUEGE: 'zug', RB: 'zug', REGIONAL: 'zug', SCHIFFE: 'schiff', SCHIFF: 'schiff' };
  function haltProdukte(x) {
    var roh = x.products || x.produktGattungen || x.produkte || [], m = {};
    (Array.isArray(roh) ? roh : []).forEach(function (p) { var k = PROD_NAME[typeof p === 'string' ? p : (p && (p.produktGattung || p.name))]; if (k) m[k] = 1; });
    return m;
  }
  /** art: 'bus' oder 'stadt' (S- und U-Bahn). Liefert [{ id, name, lat, lon, weit, bus, sbahn, ubahn, tram, zug }] */
  V.haltestellen = function (p, meter, art) {
    meter = Math.min(meter || 1500, 10000);
    var k = p.lat.toFixed(3) + ',' + p.lon.toFixed(3) + ',' + meter;
    return V.merk('halt_' + art, k, { frisch: 7 * ZW_TAG, max: 40 }, function () {
      return haltNavi(p, meter, art).catch(function () { return haltOsm(p, meter, art); }).then(function (l) { return haltListe(l, p); });
    }).then(function (l) { return nachAbstand(l, p).filter(function (b) { return b.weit <= meter + 300; }); });
  };
  function haltListe(l, p) {
    // gleiche Haltestelle auf beiden Straßenseiten (gleicher Name, < 300 m) nur einmal
    var aus = [];
    l.forEach(function (b) {
      if (b.lat == null || !b.name) return;
      var d = aus.filter(function (a) { return a.name.toLowerCase() === b.name.toLowerCase() && G.abstand(a, b) < 300; })[0];
      if (d) { ['bus', 'sbahn', 'ubahn', 'tram', 'zug'].forEach(function (k) { if (b[k]) d[k] = true; }); if (!d.id && b.id) d.id = b.id; return; }
      aus.push(b);
    });
    return aus.map(function (b) { b.weit = Math.round(G.abstand(p, b)); return b; }).sort(function (a, b) { return a.weit - b.weit; });
  }
  function haltNavi(p, meter, art) {
    return naviFrage('location/nearby', 'location.v3', { area: { coordinates: { longitude: +p.lon.toFixed(6), latitude: +p.lat.toFixed(6) }, radius: meter }, maxResults: 60, products: HALT_PROD[art] }, []).then(function (j) {
      var roh = Array.isArray(j) ? j : (j && (j.locations || j.orte)) || [];
      if (!Array.isArray(roh)) throw new Error('unverständliche Antwort');
      var l = [];
      roh.forEach(function (x) {
        var c = x.coordinates || x.position || {}, lid = lidTeile(x.locationId || x.id), pr = haltProdukte(x);
        var lat = c.latitude != null ? +c.latitude : lid.Y ? lid.Y / 1e6 : null, lon = c.longitude != null ? +c.longitude : lid.X ? lid.X / 1e6 : null;
        var id = evaOhneNull(x.evaNr || x.extId || lid.L);
        if (!id || lat == null) return;
        if (art === 'stadt' && !pr.sbahn && !pr.ubahn) return;
        if (art === 'bus' && !pr.bus && Object.keys(pr).length) return;
        l.push({ id: id, name: x.name || lid.O || 'Haltestelle', lat: lat, lon: lon, bus: !!pr.bus, sbahn: !!pr.sbahn, ubahn: !!pr.ubahn, tram: !!pr.tram, zug: !!pr.zug });
      });
      if (!l.length && roh.length) throw new Error('leer');
      return l;
    });
  }
  function haltOsm(p, meter, art) {
    var um = '(around:' + Math.min(meter, 10000) + ',' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) + ')';
    var q = art === 'bus'
      ? '[out:json][timeout:25];(node["highway"="bus_stop"]' + um + ';nwr["public_transport"="platform"]["bus"="yes"]' + um + ';);out center tags 150;'
      : '[out:json][timeout:25];(nwr["railway"~"^(station|halt)$"]["station"~"^(subway|light_rail|suburban)$"]' + um + ';nwr["railway"~"^(station|halt)$"]["subway"="yes"]' + um + ';nwr["railway"~"^(station|halt)$"]["network"~"S-Bahn"]' + um + ';nwr["railway"~"^(station|halt)$"]["operator"~"S-Bahn"]' + um + ';);out center tags 80;';
    return V.osm(q, 7 * 86400).then(function (j) {
      var l = [];
      (j.elements || []).forEach(function (e) {
        var t = e.tags || {}, o = osmOrt(e); if (o.lat == null || !t.name) return;
        if (/^(disused|abandoned|razed)$/.test(t.railway || '') || t['disused:railway']) return;
        var ub = t.station === 'subway' || t.subway === 'yes' || /U-Bahn/i.test(t.network || '');
        l.push({ id: '', name: t.name, lat: o.lat, lon: o.lon, bus: art === 'bus', sbahn: art !== 'bus' && !ub, ubahn: art !== 'bus' && ub, tram: false, zug: false, osm: true });
      });
      return l;
    });
  }
  /** Bahn-Kennung einer Haltestelle aus OpenStreetMap: Suche „in der Nähe“ (300 m) beim DB Navigator, gleicher Name bevorzugt */
  var haltIdMerker = {};
  function haltId(b, art, gruende) {
    if (b.id) return Promise.resolve(b.id);
    var key = b.name + '|' + b.lat.toFixed(4) + ',' + b.lon.toFixed(4);
    if (haltIdMerker[key]) return Promise.resolve(haltIdMerker[key]);
    return naviFrage('location/nearby', 'location.v3', { area: { coordinates: { longitude: b.lon, latitude: b.lat }, radius: 400 }, maxResults: 20, products: ['ALL'] }, gruende).then(function (j) {
      var n0 = String(b.name).toLowerCase(), best = null, bw = 1e9;
      (Array.isArray(j) ? j : []).forEach(function (x) {
        var c = x.coordinates || {}, id = evaOhneNull(x.evaNr || x.extId || lidTeile(x.locationId).L); if (!id || c.latitude == null) return;
        var w = G.abstand(b, { lat: +c.latitude, lon: +c.longitude }) - (String(x.name || '').toLowerCase().indexOf(n0) >= 0 ? 500 : 0);
        if (w < bw) { bw = w; best = id; }
      });
      if (!best) { var f = new Error('Haltestelle nicht gefunden'); f.gruende = (gruende || []).concat(['Bahn kennt „' + b.name + '“ nicht']); throw f; }
      haltIdMerker[key] = best; b.id = best; return best;
    }, function () { return bfIdWeb(b, gruende); });
  }

  /* ---------- Hamburg: S-Bahn- und U-Bahn-Netz (Linien aus OpenStreetMap, 30 Tage auf dem Handy gespeichert) ---------- */
  V.HH = { lat: 53.5511, lon: 9.9937 };
  var HH_FARBE = { S1: '#2f9e44', S11: '#2f9e44', S2: '#b51143', S21: '#b51143', S3: '#622181', S31: '#622181', S5: '#0098a1', S4: '#bd0c80', S6: '#7b6ab0', S7: '#e8601c',
    U1: '#0067b3', U2: '#e2001a', U3: '#f2c800', U4: '#009c8e', U5: '#a2723e' };
  V.hhFarbe = function (ref, osm) { return /^#[0-9a-f]{6}$/i.test(osm || '') ? osm : HH_FARBE[ref] || (/^U/.test(ref) ? '#0067b3' : '#2f9e44'); };
  var HH_Q = '[out:json][timeout:90];rel["type"="route"]["route"~"^(subway|train|light_rail)$"]["ref"~"^[SU][0-9]{1,2}$"](53.25,9.30,53.95,10.45)->.r;.r out body;way(r.r)["railway"~"^(rail|subway|light_rail|narrow_gauge)$"];out geom;';
  var hhLauf = null;
  /** Liefert { linien: [{ ref, farbe, name, von, nach, art, wege: [[[lon,lat],…],…] }], stand } */
  V.hhNetz = function (neuHolen) {
    var d = B.lesen('hhnetz', null);
    if (!neuHolen && d && d.linien && d.linien.length && Date.now() - (d.stand || 0) < 30 * ZW_TAG) return Promise.resolve(d);
    if (hhLauf) return hhLauf;
    hhLauf = osmDirekt(HH_Q, [], 90000).then(function (j) {
      if (!(j.elements || []).some(function (e) { return e.type === 'way' && e.geometry; })) throw new Error('leer');
      return j;
    }).catch(function (e) {
      // Ersatzweg über den eigenen Server (braucht die neue warenwirtschaft.php, sonst fehlen die Linienverläufe)
      var S = FV.S; if (!S || S.demo || !S.angemeldet()) throw e;
      return S.ruf('osm', { q: HH_Q, dauer: 30 * 86400 }, 95000);
    }).then(function (j) {
      var wege = {}, rels = [];
      (j.elements || []).forEach(function (e) {
        if (e.type === 'way' && Array.isArray(e.geometry)) wege[e.id] = e.geometry.map(function (g) { return [Math.round(g.lon * 1e5) / 1e5, Math.round(g.lat * 1e5) / 1e5]; });
        else if (e.type === 'relation') rels.push(e);
      });
      var nachRef = {};
      rels.forEach(function (r) {
        var t = r.tags || {}, ref = t.ref; if (!ref) return;
        var l = nachRef[ref] || (nachRef[ref] = { ref: ref, farbe: V.hhFarbe(ref, t.colour), name: t.name || ref, von: t.from || '', nach: t.to || '', art: /^U/.test(ref) ? 'ubahn' : 'sbahn', ids: {} });
        (r.members || []).forEach(function (m) { if (m.type === 'way' && wege[m.ref] && !/platform/.test(m.role || '')) l.ids[m.ref] = 1; });
      });
      var linien = Object.keys(nachRef).sort(function (a, b) { return a[0] === b[0] ? parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10) : a < b ? -1 : 1; }).map(function (k) {
        var l = nachRef[k]; l.wege = Object.keys(l.ids).map(function (id) { return wege[id]; }); delete l.ids; return l;
      }).filter(function (l) { return l.wege.length; });
      if (!linien.length) throw new Error('Keine Linien gefunden');
      var erg = { linien: linien, stand: Date.now() };
      B.schreiben('hhnetz', erg);
      return erg;
    }).then(function (x) { hhLauf = null; return x; }, function (e) { hhLauf = null; if (d && d.linien) return d; throw e; });
    return hhLauf;
  };
  /** Liegt ein Punkt im Hamburger Raum (bis 60 km vom Rathaus)? */
  V.beiHamburg = function (p) { return !!(p && p.lat != null && G.abstand(p, V.HH) < 60000); };

  /* ---------- Apotheken: alle in der Nähe (OpenStreetMap) und Notdienst (aponet.de über den eigenen Server) ---------- */
  var TAGE = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0, Di: 2, Mi: 3, Do: 4, So: 0 };
  /** Öffnungszeiten wie „Mo-Fr 08:00-18:30; Sa 08:30-13:00“: jetzt offen? Liefert { offen, bis, ab } oder null (unbekannt) */
  V.offen = function (oh, jetzt) {
    if (!oh) return null; jetzt = jetzt || new Date();
    if (/24\/7/.test(oh)) return { offen: true, bis: 'rund um die Uhr' };
    var wt = jetzt.getDay(), min = jetzt.getHours() * 60 + jetzt.getMinutes(), erkannt = false, heute = [];
    String(oh).split(';').forEach(function (regel) {
      regel = regel.trim(); if (!regel || /PH|SH|week|"/.test(regel)) return;
      var m = regel.match(/^((?:[A-Z][a-z](?:\s*-\s*[A-Z][a-z])?\s*,?\s*)+)\s+(.+)$/); if (!m) return;
      var tage = {}; m[1].split(',').forEach(function (t) {
        var x = t.trim().split(/\s*-\s*/); if (!(x[0] in TAGE)) return;
        var a = TAGE[x[0]], b = x[1] in TAGE ? TAGE[x[1]] : a; for (var i = a, n = 0; n < 7; i = (i + 1) % 7, n++) { tage[i] = 1; if (i === b) break; }
      });
      erkannt = true;
      if (!tage[wt]) return;
      if (/off|closed/.test(m[2])) { heute = []; return; }
      heute = [];
      m[2].split(',').forEach(function (z) { var y = z.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/); if (y) heute.push([+y[1] * 60 + +y[2], +y[3] * 60 + +y[4]]); });
    });
    if (!erkannt) return null;
    function hm(x) { return ('0' + Math.floor(x / 60)).slice(-2) + ':' + ('0' + x % 60).slice(-2); }
    for (var i = 0; i < heute.length; i++) { if (min >= heute[i][0] && min < heute[i][1]) return { offen: true, bis: hm(heute[i][1]) }; }
    var spaeter = heute.filter(function (x) { return x[0] > min; })[0];
    return { offen: false, ab: spaeter ? hm(spaeter[0]) : '' };
  };
  /** Entfernungen vom genauen Standort neu rechnen und sortieren */
  /* ---------- Schiffslinien (Fähren) aus OpenStreetMap: route=ferry, zu ganzen Linien zusammengesetzt ---------- */
  /** Linien im Umkreis von 15 km um p: { name, betreiber, web, dauer (s), auto (Autofähre), pk [[lon,lat]…], a, b (Enden mit Anleger-Namen), laenge (m) } */
  V.faehrLinien = function (p) {
    var r = raster(p), k = r.lat.toFixed(2) + ',' + r.lon.toFixed(2);
    return V.merk('fl', k, { frisch: 30 * ZW_TAG, alt: 180 * ZW_TAG, notfall: 365 * ZW_TAG, max: 20 }, function () { return faehrLinienHolen(r); });
  };
  function flDauer(t) {
    t = String(t || ''); var m = /^(\d{1,2}):(\d\d)/.exec(t); if (m) return (+m[1] * 60 + +m[2]) * 60;
    m = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(t); if (m && (m[1] || m[2])) return ((+m[1] || 0) * 60 + (+m[2] || 0)) * 60;
    return 0;
  }
  function flNah(a, b) { return Math.abs(a[0] - b[0]) < 0.004 && Math.abs(a[1] - b[1]) < 0.003; }
  /** Wege einer Linie zu durchgehenden Ketten verbinden (Richtung egal) */
  function flKetten(wl) {
    var offen = wl.slice(), aus = [];
    while (offen.length) {
      var w = offen.shift(), pk = w.pk.slice(), tags = w.tags, weiter = true;
      while (weiter) {
        weiter = false;
        for (var i = 0; i < offen.length; i++) {
          var o = offen[i].pk, a = pk[0], e = pk[pk.length - 1];
          if (flNah(e, o[0])) pk = pk.concat(o.slice(1));
          else if (flNah(e, o[o.length - 1])) pk = pk.concat(o.slice(0, -1).reverse());
          else if (flNah(a, o[o.length - 1])) pk = o.slice(0, -1).concat(pk);
          else if (flNah(a, o[0])) pk = o.slice(1).reverse().concat(pk);
          else continue;
          offen.splice(i, 1); weiter = true; break;
        }
      }
      aus.push({ pk: pk, tags: tags });
    }
    return aus;
  }
  function faehrLinienHolen(p) {
    var um = '(around:15000,' + p.lat.toFixed(4) + ',' + p.lon.toFixed(4) + ')';
    var q = '[out:json][timeout:25];way["route"="ferry"]' + um + '->.w;rel(bw.w)["route"="ferry"]->.r;way(r.r)->.rw;(.w;.rw;)->.a;.a out geom tags;.r out body;nwr(around.a:2500)["amenity"="ferry_terminal"]->.t;.t out center tags;';
    return V.osm(q, 7 * 86400).then(function (j) {
      var wege = {}, rels = [], anleger = [];
      (j.elements || []).forEach(function (e) {
        var t = e.tags || {};
        if (t.amenity === 'ferry_terminal') { var o = osmOrt(e); if (o.lat != null) anleger.push({ name: t['name:de'] || t.name || '', lat: o.lat, lon: o.lon }); return; }
        if (e.type === 'way' && e.geometry && e.geometry.length >= 2) wege[e.id] = { id: e.id, tags: t, pk: e.geometry.map(function (g) { return [+(+g.lon).toFixed(5), +(+g.lat).toFixed(5)]; }) };
        else if (e.type === 'relation') rels.push(e);
      });
      var gruppen = [], benutzt = {};
      rels.forEach(function (r) {
        var l = (r.members || []).filter(function (m) { return m.type === 'way' && wege[m.ref]; }).map(function (m) { return wege[m.ref]; });
        if (l.length) { gruppen.push({ tags: r.tags || {}, wege: l }); l.forEach(function (w) { benutzt[w.id] = 1; }); }
      });
      var rest = Object.keys(wege).map(function (k) { return wege[k]; }).filter(function (w) { return !benutzt[w.id]; });
      rest.forEach(function (w) { gruppen.push({ tags: null, wege: [w] }); });
      function ende(c) {
        var p0 = { lat: c[1], lon: c[0] }, best = null, bw = 2500;
        anleger.forEach(function (t) { var w = G.abstand(p0, t); if (w < bw) { bw = w; best = t; } });
        return best ? { lat: best.lat, lon: best.lon, name: best.name, anleger: true } : { lat: p0.lat, lon: p0.lon, name: '', anleger: false };
      }
      var aus = [], gesehen = {};
      gruppen.forEach(function (g) {
        flKetten(g.wege).forEach(function (k) {
          var t = Object.assign({}, k.tags || {}, g.tags || {}), pk = k.pk, laenge = 0;
          for (var i = 1; i < pk.length; i++) laenge += G.abstand({ lat: pk[i - 1][1], lon: pk[i - 1][0] }, { lat: pk[i][1], lon: pk[i][0] });
          if (laenge < 1500) return;
          var a = ende(pk[0]), b = ende(pk[pk.length - 1]);
          var key = [a.lat.toFixed(2) + a.lon.toFixed(2), b.lat.toFixed(2) + b.lon.toFixed(2)].sort().join('|');
          if (gesehen[key]) return; gesehen[key] = 1;
          aus.push({ name: t['name:de'] || t.name || '', betreiber: t.operator || '', web: t.website || t['contact:website'] || t.url || '', dauer: flDauer(t.duration),
            auto: t.motor_vehicle === 'yes' || t.motorcar === 'yes', pk: pk, a: a, b: b, laenge: Math.round(laenge) });
        });
      });
      return aus;
    });
  }
  /** Fähranleger und Schiffsanleger (40 km) um einen Punkt – OpenStreetMap */
  V.faehren = function (p) {
    var r = { lat: +p.lat.toFixed(2), lon: +p.lon.toFixed(2) }, k = r.lat.toFixed(2) + ',' + r.lon.toFixed(2);
    return V.merk('faehre', k, { frisch: 7 * ZW_TAG, alt: 90 * ZW_TAG, notfall: 365 * ZW_TAG, max: 20 }, function () { return faehrenHolen(r); }).then(function (l) { return nachAbstand(l, p); });
  };
  function faehrenHolen(p) {
    var q = '[out:json][timeout:20];nwr["amenity"="ferry_terminal"](around:40000,' + p.lat.toFixed(4) + ',' + p.lon.toFixed(4) + ');out center tags 80;';
    return V.osm(q, 7 * 86400).then(function (j) {
      var gesehen = {};
      return (j.elements || []).map(function (e) {
        var t = e.tags || {}, o = osmOrt(e); if (o.lat == null) return null;
        var name = t['name:de'] || t.name || ''; if (!name) return null;
        var key = name.toLowerCase(); if (gesehen[key]) return null; gesehen[key] = 1;
        return { name: name, lat: o.lat, lon: o.lon, betreiber: t.operator || '', web: t.website || t['contact:website'] || '' };
      }).filter(Boolean);
    });
  }
  function nachAbstand(l, p) { return l.map(function (a) { return Object.assign({}, a, { weit: Math.round(G.abstand(p, a)) }); }).sort(function (a, b) { return a.weit - b.weit; }); }
  V.apotheken = function (p, meter) {
    meter = meter || 6000;
    var r = raster(p), k = r.lat.toFixed(2) + ',' + r.lon.toFixed(2) + ',' + meter;
    return V.merk('apo', k, { frisch: ZW_TAG, max: 30 }, function () { return apothekenHolen(r, meter); }).then(function (l) { return nachAbstand(l, p); });
  };
  function apothekenHolen(p, meter) {
    var q = '[out:json][timeout:20];nwr["amenity"="pharmacy"](around:' + meter + ',' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) + ');out center tags 60;';
    return V.osm(q, 86400).then(function (j) {
      var l = (j.elements || []).map(function (e) {
        var t = e.tags || {}, lat = e.lat != null ? e.lat : e.center && e.center.lat, lon = e.lon != null ? e.lon : e.center && e.center.lon;
        if (lat == null) return null;
        return { name: t.name || 'Apotheke', strasse: [t['addr:street'] || '', t['addr:housenumber'] || ''].join(' ').trim(), ort: [t['addr:postcode'] || '', t['addr:city'] || ''].join(' ').trim(),
          telefon: t.phone || t['contact:phone'] || '', zeiten: t.opening_hours || '', lat: lat, lon: lon, weit: Math.round(G.abstand(p, { lat: lat, lon: lon })) };
      }).filter(Boolean).sort(function (a, b) { return a.weit - b.weit; });
      return l;
    });
  }
  /** Postleitzahl zu einem Punkt (für die Notdienst-Suche) */
  V.plz = function (p) {
    var k = p.lat.toFixed(2) + ',' + p.lon.toFixed(2);
    return V.merk('plz', k, { frisch: 180 * ZW_TAG, max: 120 }, function () { return plzHolen(p); });
  };
  function plzHolen(p) {
    return B.json({ url: G.DIENST.nominatim + '/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=de&lat=' + p.lat.toFixed(5) + '&lon=' + p.lon.toFixed(5), zeit: 12000 }).then(function (j) {
      var z = j && j.address && String(j.address.postcode || '').replace(/\D/g, '');
      if (!z || z.length !== 5) throw new Error('Keine Postleitzahl');
      return { plz: z, ort: j.address.city || j.address.town || j.address.village || j.address.municipality || '' };
    });
  }
  /** Notdienst-Apotheken (heute) über die Verwaltung */
  V.notdienst = function (plz) {
    var heute = G.iso(new Date());
    return V.merk('notdienst', plz + '|' + heute, { frisch: 1800000, alt: 0, notfall: ZW_TAG, max: 10 }, function () {
      return FV.S.ruf('apotheken_notdienst', { plz: plz, radius: 15 }, 30000).then(function (r) { return r.apotheken || []; });
    }).then(function (l) {
      return l.map(function (a0) { var a = Object.assign({}, a0); a.von = a.von ? new Date(a.von) : null; a.bis = a.bis ? new Date(a.bis) : null; return a; });
    });
  };

  /* ---------- Ärzte und ärztlicher Notdienst (OpenStreetMap) ---------- */
  var FACH = { general: 'Allgemeinmedizin', paediatrics: 'Kinderarzt', ophthalmology: 'Augenarzt', orthopaedics: 'Orthopädie', gynaecology: 'Frauenarzt', dermatology: 'Hautarzt',
    otolaryngology: 'HNO-Arzt', internal: 'Innere Medizin', dentist: 'Zahnarzt', dental_oral_maxillo_facial_surgery: 'Kieferchirurgie', orthodontics: 'Kieferorthopädie', psychiatry: 'Psychiatrie',
    psychotherapist: 'Psychotherapie', urology: 'Urologie', cardiology: 'Kardiologie', neurology: 'Neurologie', radiology: 'Radiologie', surgery: 'Chirurgie', gastroenterology: 'Gastroenterologie',
    pneumology: 'Lungenarzt', diabetology: 'Diabetologie', physiotherapist: 'Physiotherapie', emergency: 'Notfallmedizin', anaesthetics: 'Anästhesie', nephrology: 'Nierenarzt', oncology: 'Onkologie' };
  function osmOrt(e) { return { lat: e.lat != null ? e.lat : e.center && e.center.lat, lon: e.lon != null ? e.lon : e.center && e.center.lon }; }
  /** Ärzte (6 km), Notaufnahmen und Bereitschaftsdienstpraxen (30 km) um einen Punkt */
  /* Praxen und Notaufnahmen werden getrennt gespeichert: hängt eine der beiden Abfragen, bleibt die andere trotzdem im Speicher. */
  V.arztPraxen = function (p) {
    var r = raster(p), k = r.lat.toFixed(2) + ',' + r.lon.toFixed(2);
    return V.merk('arzt', k, { frisch: ZW_TAG, max: 15 }, function () { return arztHolen(r, 'praxis'); }).then(function (l) { return nachAbstand(l, p); });
  };
  // Krankenhäuser ändern sich selten: eine Woche frisch, bis 90 Tage als Ersatz
  V.arztNot = function (p) {
    var r = raster(p), k = r.lat.toFixed(2) + ',' + r.lon.toFixed(2);
    return V.merk('arztnot', k, { frisch: 7 * ZW_TAG, alt: 90 * ZW_TAG, notfall: 90 * ZW_TAG, max: 15 }, function () { return arztHolen(r, 'not'); }).then(function (l) { return nachAbstand(l, p); });
  };
  /** Beides zusammen (für die Karte) */
  V.aerzte = function (p) {
    function weich(pr) { return pr.then(function (l) { return { l: l }; }, function (e) { return { fehler: e }; }); }
    return Promise.all([weich(V.arztPraxen(p)), weich(V.arztNot(p))]).then(function (t) {
      if (t[0].fehler && t[1].fehler) throw t[0].fehler;
      return { aerzte: t[0].l || [], notdienst: t[1].l || [], praxisFehler: t[0].fehler || null, notFehler: t[1].fehler || null };
    });
  };
  /** Notaufnahmen: Rechteck statt Kreis – das schränken die Server zuerst räumlich ein und antworten schnell.
   *  (Die frühere Suche nach „emergency=yes“ traf weltweit Millionen Wege mit Zufahrt für Rettungswagen und lief deshalb immer in die Zeitgrenze.) */
  function notAbfrage(p) {
    var dl = 0.27, dn = 0.27 / Math.cos(p.lat * Math.PI / 180);   // rund 30 km in jede Richtung
    var bb = (p.lat - dl).toFixed(3) + ',' + (p.lon - dn).toFixed(3) + ',' + (p.lat + dl).toFixed(3) + ',' + (p.lon + dn).toFixed(3);
    return '[out:json][timeout:25][bbox:' + bb + '];(nwr["amenity"="hospital"];nwr["healthcare"="hospital"];nwr["amenity"~"^(doctors|clinic)$"]["name"~"Bereitschaft|Notdienst|Notfallpraxis|Notarztpraxis",i];);out center tags 80;';
  }
  function arztHolen(p, art) {
    var ll = p.lat.toFixed(5) + ',' + p.lon.toFixed(5);
    // Nur Abfragen, die die Kartenserver über ihr Stichwortverzeichnis schnell beantworten (Schlüssel UND Wert angegeben)
    var q = art === 'praxis'
      ? '[out:json][timeout:20];(nwr["amenity"~"^(doctors|dentist|clinic)$"](around:6000,' + ll + ');nwr["healthcare"~"^(doctor|dentist)$"](around:6000,' + ll + '););out center tags 120;'
      : notAbfrage(p);
    return V.osm(q, art === 'praxis' ? 86400 : 7 * 86400).then(function (j) {
      var gesehen = {}, aus = [];
      (j.elements || []).forEach(function (e) {
        var t = e.tags || {}, o = osmOrt(e), gk = e.type + (e.id != null ? e.id : o.lat + ',' + o.lon); if (o.lat == null || gesehen[gk]) return; gesehen[gk] = 1;
        var name = t.name || '';
        var bereit = /bereitschaft|notdienstpraxis|notfallpraxis|notarztpraxis/i.test(name), klinik = t.amenity === 'hospital' || t.healthcare === 'hospital';
        var notaufnahme = klinik && t.emergency !== 'no';
        var fach = String(t['healthcare:speciality'] || '').split(';').map(function (x) { return FACH[x.trim()] || ''; }).filter(Boolean);
        if (t.amenity === 'dentist' || t.healthcare === 'dentist') fach.unshift('Zahnarzt');
        var x = { name: name || (klinik ? 'Krankenhaus' : t.amenity === 'dentist' ? 'Zahnarztpraxis' : 'Arztpraxis'), art: bereit ? 'bereitschaft' : klinik ? 'klinik' : 'arzt',
          fach: fach.filter(function (f, i) { return fach.indexOf(f) === i; }).join(', '), strasse: [t['addr:street'] || '', t['addr:housenumber'] || ''].join(' ').trim(),
          ort: [t['addr:postcode'] || '', t['addr:city'] || ''].join(' ').trim(), telefon: t.phone || t['contact:phone'] || '', zeiten: t.opening_hours || '',
          lat: o.lat, lon: o.lon, weit: Math.round(G.abstand(p, o)), web: t.website || t['contact:website'] || '' };
        if (art === 'not') { if ((bereit || notaufnahme) && x.weit <= 32000) { x.notaufnahme = notaufnahme; aus.push(x); } }
        else if (!klinik && !bereit) aus.push(x);
      });
      aus.sort(function (a, b) { return a.weit - b.weit; });
      return aus.slice(0, art === 'praxis' ? 80 : 30);   // genug für die Liste, hält den Speicher klein
    });
  }

  /* ---------- Flughäfen und Live-Flugtafel ---------- */
  /** Flughäfen mit Linienflügen (IATA-Code) im Umkreis von 150 km */
  V.flughaefen = function (p) {
    var r = { lat: +p.lat.toFixed(1), lon: +p.lon.toFixed(1) }, k = r.lat.toFixed(1) + ',' + r.lon.toFixed(1);
    return V.merk('flug', k, { frisch: 30 * ZW_TAG, alt: 365 * ZW_TAG, notfall: 365 * ZW_TAG, max: 20 }, function () { return flughaefenHolen(r); }).then(function (l) { return nachAbstand(l, p); });
  };
  function flughaefenHolen(p) {
    var q = '[out:json][timeout:20];nwr["aeroway"="aerodrome"]["iata"](around:150000,' + p.lat.toFixed(4) + ',' + p.lon.toFixed(4) + ');out center tags 40;';
    return V.osm(q, 7 * 86400).then(function (j) {
      var l = (j.elements || []).map(function (e) {
        var t = e.tags || {}, o = osmOrt(e); if (o.lat == null || !/^[A-Z]{3}$/.test(t.iata || '')) return null;
        if (/military|private/.test(t['aerodrome:type'] || '') || t.military) return null;
        return { name: t['name:de'] || t.name || t.iata, iata: t.iata, icao: t.icao || '', lat: o.lat, lon: o.lon, weit: Math.round(G.abstand(p, o)), web: t.website || '', gross: /international/.test(t['aerodrome:type'] || t.aerodrome || '') };
      }).filter(Boolean).sort(function (a, b) { return a.weit - b.weit; });
      return l;
    });
  }
  /** Abflüge und Ankünfte (über die Verwaltung, Quelle AeroDataBox) */
  V.flugtafel = function (iata) {
    return FV.S.ruf('flugtafel', { iata: iata }, 30000).then(function (r) {
      function f(x) { x.plan = x.plan ? new Date(x.plan) : null; x.neu = x.neu ? new Date(x.neu) : null; return x; }
      return { ab: (r.abfluege || []).map(f), an: (r.ankuenfte || []).map(f), stand: r.stand || '' };
    });
  };

  function zeit(t) { return t ? new Date(t) : null; }
  /* Verkehrsmittel → Art (Symbol + Farbe wie bei Google/DB: Fernzug rot, Regio grau, S-Bahn grün, Bus lila …) */
  var OEV_ART = { nationalExpress: 'fern', national: 'fern', regionalExpress: 'regio', regional: 'regio', suburban: 'sbahn', subway: 'ubahn', tram: 'tram', bus: 'bus', ferry: 'faehre', taxi: 'bus' };
  V.OEV = {
    fern: { farbe: '#ec0016', sym: 'zug', name: 'Fernzug' }, regio: { farbe: '#8c96a3', sym: 'zug', name: 'Regionalzug' }, sbahn: { farbe: '#3a9a46', sym: 'zug', name: 'S-Bahn' },
    ubahn: { farbe: '#2e6fd8', sym: 'tram', name: 'U-Bahn' }, tram: { farbe: '#d23c6e', sym: 'tram', name: 'Straßenbahn' }, bus: { farbe: '#8e4fc7', sym: 'bus', name: 'Bus' },
    faehre: { farbe: '#1b9fc6', sym: 'schiff', name: 'Fähre' }, fuss: { farbe: '#d9d4c7', sym: 'fuss', name: 'Zu Fuß' }
  };
  function oevArt(l) {
    var p = l.line && (l.line.product || '') || '', m = l.line && l.line.mode || l.mode || '', n = (l.line && l.line.name || '');
    if (OEV_ART[p]) return OEV_ART[p];
    if (/^(ICE|IC|EC|ECE|RJ|RJX|NJ|TGV|FLX)\b/.test(n)) return 'fern';
    if (/^S\s?\d/.test(n)) return 'sbahn';
    if (/^(RE|RB|IRE|MEX)\b/.test(n)) return 'regio';
    return m === 'bus' ? 'bus' : m === 'watercraft' ? 'faehre' : 'regio';
  }
  /** Kurzname fürs Schild: „Bus 656“ → „656“, „RE 1“ → „RE1“, „ICE 73“ bleibt */
  function kurzLinie(n, art) {
    n = String(n || '').trim();
    if (art === 'bus' || art === 'tram') n = n.replace(/^(Bus|STR|Tram|AST|ALT)\s+/i, '');
    return n.replace(/^(RE|RB|S|U|IRE)\s+(\d)/, '$1$2');
  }
  /** Streckenverlauf eines Abschnitts als [[lon,lat], …] (aus polylines=true, sonst Luftlinie) */
  function verlauf(l, a, b) {
    var p = [];
    try { (l.polyline && l.polyline.features || []).forEach(function (f) { var c = f.geometry && f.geometry.coordinates; if (c && c.length >= 2) p.push([+c[0], +c[1]]); }); } catch (e) {}
    if (p.length >= 2) return p;
    return a && b ? [[a.lon, a.lat], [b.lon, b.lat]] : [];
  }
  function fahrt(j) {
    var legs = (j.legs || []).map(function (l) {
      var zu = !!l.walking, art = zu ? 'fuss' : oevArt(l), name = (l.line && (l.line.name || l.line.fahrtNr)) || (art === 'bus' ? 'Bus' : 'Zug');
      var vo = l.origin && l.origin.location ? { lat: l.origin.location.latitude, lon: l.origin.location.longitude } : (l.origin && l.origin.latitude != null ? { lat: l.origin.latitude, lon: l.origin.longitude } : null);
      var no = l.destination && l.destination.location ? { lat: l.destination.location.latitude, lon: l.destination.location.longitude } : (l.destination && l.destination.latitude != null ? { lat: l.destination.latitude, lon: l.destination.longitude } : null);
      return { fuss: zu, art: art, farbe: V.OEV[art].farbe, kurz: zu ? '' : kurzLinie(name, art), punkte: verlauf(l, vo, no),
        linie: zu ? '' : name, produkt: l.line && (l.line.product || l.line.mode) || '',
        richtung: l.direction || '', von: (l.origin && (l.origin.name || l.origin.address)) || 'Start', nach: (l.destination && (l.destination.name || l.destination.address)) || 'Ziel',
        vonOrt: l.origin && l.origin.location ? { lat: l.origin.location.latitude, lon: l.origin.location.longitude } : (l.origin && l.origin.latitude != null ? { lat: l.origin.latitude, lon: l.origin.longitude } : null),
        nachOrt: l.destination && l.destination.location ? { lat: l.destination.location.latitude, lon: l.destination.location.longitude } : (l.destination && l.destination.latitude != null ? { lat: l.destination.latitude, lon: l.destination.longitude } : null),
        ab: zeit(l.departure || l.plannedDeparture), abPlan: zeit(l.plannedDeparture || l.departure), an: zeit(l.arrival || l.plannedArrival), anPlan: zeit(l.plannedArrival || l.arrival),
        abVerz: l.departureDelay != null ? Math.round(l.departureDelay / 60) : null, anVerz: l.arrivalDelay != null ? Math.round(l.arrivalDelay / 60) : null,
        gleis: l.departurePlatform || l.plannedDeparturePlatform || '', gleisAn: l.arrivalPlatform || l.plannedArrivalPlatform || '', meter: l.distance || 0, faellt: !!l.cancelled,
        hinweise: (l.remarks || []).filter(function (x) { return x && (x.type === 'warning' || x.type === 'status'); }).map(function (x) { return txt(x.summary || x.text); }).filter(Boolean).slice(0, 2) };
    }).filter(function (l) { return !(l.fuss && l.meter < 30 && l.ab && l.an && l.an - l.ab < 90000); });
    var zuege = legs.filter(function (l) { return !l.fuss; });
    if (!legs.length || !zuege.length) return null;
    var a = legs[0].ab, e = legs[legs.length - 1].an;
    // gleicher Weg (gleiche Haltestellen und Verkehrsmittel) → bei Google „Auch planmäßig um …“
    var weg = zuege.map(function (l) { return l.art + ':' + (l.art === 'bus' || l.art === 'tram' ? l.kurz : '') + ':' + l.von + '>' + l.nach; }).join('|');
    return { legs: legs, ab: a, an: e, weg: weg, dauer: a && e ? (e - a) / 1000 : 0, umstiege: Math.max(0, zuege.length - 1), faellt: legs.some(function (l) { return l.faellt; }),
      verz: Math.max.apply(null, zuege.map(function (l) { return Math.max(l.abVerz || 0, l.anVerz || 0); })), erster: zuege[0], letzter: zuege[zuege.length - 1] };
  }
})();
