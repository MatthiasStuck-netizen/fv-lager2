/* Verkehr: aktuelle Meldungen (Stau, Unfall, Sperrung, Baustelle) entlang der Route, Umleitung, Zugverbindungen.
 * Quellen: Autobahn GmbH des Bundes (alle Autobahnen, frei) · TomTom Traffic (alle Straßen, Schlüssel aus der Verwaltung)
 * · Deutsche Bahn: bahn.de (Bahnhöfe, Abfahrtstafeln), Ersatz v6.db.transport.rest (Zugverbindungen). */
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
  V.merkLeeren = function () { ['apo', 'arzt', 'arztnot', 'bahnhof', 'flug', 'plz', 'notdienst'].forEach(function (k) { zwDa[k] = {}; B.schreiben('zw_' + k, null); }); };

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
  function osmDirekt(q, gruende) {
    gruende = gruende || [];
    function frag(i) {
      var url = G.DIENST.overpass[i];
      return B.json({ methode: 'POST', url: url, kopf: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'Referer': 'https://fehnverleih.de/' }, daten: 'data=' + encodeURIComponent(q), zeit: 20000 })
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
  V.zug = function (von, nach, nachText, wann) {
    var q = '/journeys?' + punktParam('from', von, von.name) + '&' + punktParam('to', nach, nachText) + '&results=5&stopovers=false&remarks=true&language=de' + (wann ? '&departure=' + encodeURIComponent(wann.toISOString()) : '');
    return bahnFrage(q).then(function (j) {
      var l = (j.journeys || []).map(fahrt).filter(Boolean);
      if (!l.length) throw new Error('Keine Zugverbindung gefunden.');
      return { liste: l, spaeter: j.laterRef || '' };
    });
  };
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
  function tafelDb(id, ankunft, gruende) {
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
          var vm = x.verkehrmittel || x.verkehrsmittel || {}, g = vm.produktGattung || '';
          if (g && !DBZUG[g]) return;   // Bus, Straßenbahn, Schiff weglassen
          var key = (x.journeyId || x.zugId || '') + '|' + (x.zeit || '');
          if (gesehen[key]) return; gesehen[key] = 1;
          var plan = dbZeit(x.zeit), echt = dbZeit(x.ezZeit), meld = x.meldungen || [];
          var faellt = !!(x.cancelled || x.canceled) || meld.some(function (m) { return m && (m.type === 'HALT_AUSFALL' || /fällt aus|Halt entfällt|entfällt/i.test(m.text || '')); });
          var verz = echt && plan ? Math.round((echt - plan) / 60000) : null;
          l.push({ plan: plan, echt: echt || plan, verz: verz, live: !!echt, linie: vm.mittelText && /^(RE|RB|S)\s?\d/.test(vm.mittelText) ? vm.mittelText : (vm.name || vm.langText || vm.mittelText || 'Zug'),
            produkt: DBZUG[g] || '', richtung: ankunft ? (x.terminus || (x.ueber && x.ueber[0]) || '') : (x.terminus || ''),
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
  function naviFrage(pfad, typ, body, gruende) {
    var ct = 'application/x.db.vendo.mob.' + typ + '+json', url = NAVI + pfad, daten = JSON.stringify(body);
    return B.json({ methode: 'POST', url: url, kopf: { Accept: ct, 'Content-Type': ct, 'X-Correlation-ID': uuid() + '_' + uuid() }, daten: daten, zeit: 15000 }).catch(function (e) {
      gruende.push('Handy → ' + wirt(url) + ': ' + grundText(e));
      return bahnUeberServer(url, gruende, { methode: 'POST', typ: typ, daten: daten });
    });
  }
  function tafelNavi(id, ankunft, gruende) {
    var jetzt = new Date(Date.now() - 5 * 60000), spaeter = new Date(jetzt.getTime() + 50 * 60000);
    function frag(d, g) {
      return naviFrage('bahnhofstafel/' + (ankunft ? 'ankunft' : 'abfahrt'), 'bahnhofstafeln.v2', { anfragezeit: hm(d), datum: tag(d), ursprungsBahnhofId: 'A=1@L=' + id + '@',
        verkehrsmittel: ['HOCHGESCHWINDIGKEITSZUEGE', 'INTERCITYUNDEUROCITYZUEGE', 'INTERREGIOUNDSCHNELLZUEGE', 'NAHVERKEHRSONSTIGEZUEGE', 'SBAHNEN'] }, g);
    }
    return Promise.all([frag(jetzt, gruende), frag(spaeter, []).catch(function () { return null; })]).then(function (t) {
      if (!t[0] || typeof t[0] !== 'object') throw new Error('unverständliche Antwort');
      var gesehen = {}, l = [];
      t.forEach(function (j) {
        if (!j) return;
        (j.bahnhofstafelAbfahrtPositionen || j.bahnhofstafelAnkunftPositionen || []).forEach(function (x) {
          var pr = NAVIZUG[x.produktGattung]; if (x.produktGattung && !pr) return;
          var plan = dbZeit(ankunft ? x.ankunftsDatum : x.abgangsDatum), echt = dbZeit(ankunft ? x.ezAnkunftsDatum : x.ezAbgangsDatum);
          var key = (x.zuglaufId || x.mitteltext || '') + '|' + (plan ? +plan : ''); if (gesehen[key] || !plan) return; gesehen[key] = 1;
          var notiz = (x.echtzeitNotizen || []).map(function (m) { return txt(m && m.text); }).filter(Boolean);
          var faellt = !!(x.ausfall || x.cancelled) || notiz.some(function (m) { return /fällt aus|Halt entfällt|entfällt/i.test(m); });
          l.push({ plan: plan, echt: echt || plan, verz: echt ? Math.round((echt - plan) / 60000) : null, live: !!echt, linie: x.mitteltext || x.kurztext || 'Zug', produkt: pr || '',
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
  function tafelRest(id, ankunft, gruende) {
    var art = ankunft ? 'arrivals' : 'departures';
    return bahnFrage('/stops/' + encodeURIComponent(id) + '/' + art + '?duration=90&results=30&remarks=true&language=de&bus=false&ferry=false&subway=false&tram=false&taxi=false', gruende).then(function (j) {
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
  V.tafel = function (b, ankunft) {
    if (typeof b !== 'object') b = { id: String(b) };
    var gruende = [];
    return bfId(b, gruende).then(function (id) {
      // Reihenfolge: DB Navigator → bahnhof.de → bahn.de → transport.rest (der erste, der antwortet, gewinnt)
      return tafelNavi(id, ankunft, gruende)
        .catch(function () { return tafelHof(id, ankunft, gruende); })
        .catch(function () { return tafelDb(id, ankunft, gruende); })
        .catch(function () { return tafelRest(id, ankunft, gruende); });
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
  function fahrt(j) {
    var legs = (j.legs || []).map(function (l) {
      var zu = !!l.walking;
      return { fuss: zu, linie: zu ? '' : (l.line && (l.line.name || l.line.fahrtNr)) || (l.mode === 'bus' ? 'Bus' : 'Zug'), produkt: l.line && (l.line.product || l.line.mode) || '',
        richtung: l.direction || '', von: (l.origin && l.origin.name) || 'Start', nach: (l.destination && l.destination.name) || 'Ziel',
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
    return { legs: legs, ab: a, an: e, dauer: a && e ? (e - a) / 1000 : 0, umstiege: Math.max(0, zuege.length - 1), faellt: legs.some(function (l) { return l.faellt; }),
      verz: Math.max.apply(null, zuege.map(function (l) { return Math.max(l.abVerz || 0, l.anVerz || 0); })), erster: zuege[0], letzter: zuege[zuege.length - 1] };
  }
})();
