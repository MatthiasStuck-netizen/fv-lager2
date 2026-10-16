/* Zielführung: Position auf der Route, nächste Abbiegung, Ansagen, Neuberechnung, Kamera. */
(function () {
  'use strict';
  var G = FV.G, B = FV.B, K = FV.K;
  var F = FV.F = { aktiv: false, sichtbar: false, route: null, ziel: null, stand: null };
  var o = null, hoerer = null, zustand = null, folgeTimer = null, simTimer = null, verkehrTimer = null, zeitTimer = null, vGesagt = {};
  var VERKEHR_ALLE = 240000;   // alle 4 Minuten neue Verkehrsmeldungen holen

  function neuerZustand() { return { weg: 0, idx: 0, abseits: 0, neuUm: 0, rechnet: false, neuGesagt: false, fehl: 0, zoom: 16, gesagt: {}, wcGesagt: {}, start: Date.now(), angekommen: false, letzter: null }; }
  F.modus = function () { return F.route && F.route.modus || 'auto'; };

  F.start = function (route, ziel, opt) {
    F.stopp(true);
    F.route = route; F.ziel = ziel; o = opt || {}; zustand = neuerZustand(); F.aktiv = true; K.folgt = true; F.stand = null;
    document.body.classList.add('navi');
    B.ortStart(); B.wach(true);
    hoerer = B.beiOrt(ort);
    K.beiGeste(function () { if (!F.aktiv) return; K.folgt = false; clearTimeout(folgeTimer); folgeTimer = setTimeout(function () { K.folgt = true; if (zustand && zustand.letzter) kamera(zustand.letzter, true); }, 8000); if (o.beiFolgen) o.beiFolgen(false); });
    var s0 = route.schritte[0];
    var um = route.umleitung && FV.V ? 'Wegen ' + FV.V.sprache(route.umleitung.grund) + ' fahren wir eine Umleitung. ' : '';
    sag(um + (s0 ? s0.ansage + ' ' : '') + 'Die Strecke ist ' + G.km(route.laenge).replace(' km', ' Kilometer') + ' lang.');
    var p = B.ort(); if (p && !route.nurZeit) ort(p);
    vGesagt = {};
    /* Zug, Bus, Schiff, Flug: Fahrplan als Ersatz für GPS (im Flugzeug immer, sonst wenn das GPS gerade schweigt) */
    clearInterval(zeitTimer); zeitTimer = null;
    if (route.oev && route.zeitAb && route.zeitAn) { zeitTimer = setInterval(zeitTakt, 5000); setTimeout(zeitTakt, 300); }
    clearInterval(verkehrTimer); verkehrTimer = null;
    if (F.modus() === 'auto' && FV.V) { verkehrTimer = setInterval(verkehrPruefen, VERKEHR_ALLE); setTimeout(verkehrPruefen, route.verkehrStand && Date.now() - route.verkehrStand < 60000 ? 60000 : 4000); }
  };
  F.stopp = function (leise) {
    if (hoerer) { hoerer(); hoerer = null; }
    clearInterval(zeitTimer); zeitTimer = null;
    clearTimeout(folgeTimer); clearInterval(simTimer); simTimer = null; B.probe = false; clearInterval(verkehrTimer); verkehrTimer = null;
    if (F.aktiv && !leise) B.still();
    F.aktiv = false; K.beiGeste(null); B.wach(false);
    document.body.classList.remove('navi');
  };
  /** Die Fahrt-Seite ist zu sehen (an) oder der Fahrer schaut gerade auf eine andere Seite (aus).
   *  Die Zielführung läuft in beiden Fällen weiter; die Karte wird nur bewegt, solange sie zu sehen ist. */
  F.sicht = function (an) {
    F.sichtbar = !!an;
    if (an && F.aktiv && zustand && zustand.letzter) { K.auto(zustand.letzter.pos, zustand.letzter.kurs); kamera(zustand.letzter, true); }
  };
  F.zentrieren = function () { K.folgt = true; clearTimeout(folgeTimer); if (zustand && zustand.letzter) kamera(zustand.letzter, false); if (o && o.beiFolgen) o.beiFolgen(true); };
  F.uebersicht = function () { K.folgt = false; clearTimeout(folgeTimer); K.rahmen(F.route.punkte, { top: 110, bottom: 90, left: 40, right: 60 }); if (o && o.beiFolgen) o.beiFolgen(false); };

  function sag(t) { if (!o || o.ton !== false) { if (FV.app && FV.app.e && FV.app.e.ansage === false) return; B.sprich(t); } }
  function klein(t) { t = String(t || '').replace(/\.\s*$/, ''); return t.charAt(0).toLowerCase() + t.slice(1); }

  function kamera(k, sofort) {
    if (!K.folgt || !F.sichtbar) return;
    K.folgen(k.pos, k.kurs, zustand.zoom, sofort);
  }
  function zoomZiel(kmh, bisAbbiegen, limit) {
    var z = kmh < 25 ? 17 : kmh < 45 ? 16.5 : kmh < 70 ? 15.8 : kmh < 95 ? 15.1 : 14.4;
    if (limit && limit <= 50) z = Math.max(z, 16.4);          // in Ortschaften näher heran
    if (bisAbbiegen < 300) z = Math.max(z, 16.9);              // vor dem Abbiegen heranzoomen
    else if (bisAbbiegen < 700) z = Math.max(z, 16);
    return z;
  }

  /** Position nach Fahrplan: Anteil der Fahrzeit = Anteil der Strecke */
  function zeitTakt() {
    if (!F.aktiv || !F.route || !F.route.oev || zustand.angekommen) return;
    var r = F.route, q = B.ort(), jetzt = Date.now();
    if (!r.nurZeit && q && jetzt - (q.zeit || 0) < 45000 && (q.genau || 0) < 150) return;   // echtes GPS ist da
    var ab = +r.zeitAb, an = +r.zeitAn, t = an > ab ? Math.max(0, Math.min(1, (jetzt - ab) / (an - ab))) : 0;
    var w = r.laenge * t, a = G.punktBei(r, w), b = G.punktBei(r, Math.min(r.laenge, w + 50));
    ort({ lat: a.lat, lon: a.lon, genau: 10, tempo: jetzt >= ab && jetzt < an ? r.laenge / Math.max(60, (an - ab) / 1000) : 0, kurs: G.kurs(a, b), zeit: jetzt, fahrplan: true });
  }
  F.zeitTakt = zeitTakt;
  function ort(p) {
    if (!F.aktiv || !F.route || zustand.angekommen) return;
    var r = F.route, z = zustand, jetzt = Date.now();
    if (r.nurZeit && !p.fahrplan) return;   // im Flugzeug zählt nur der Flugplan
    if (p.genau > (r.oev ? 150 : 80)) return;
    var s = G.einrasten(r, p, z.idx - 4, z.idx + 90);
    if (!s || s.entf > 80) s = G.einrasten(r, p) || s;
    if (!s) return;
    var grenze = r.oev ? 600 : 40 + Math.min(p.genau || 0, 30);
    if (s.entf > grenze) z.abseits++; else { z.abseits = 0; z.neuGesagt = false; z.fehl = 0; }
    // Klappt die Neuberechnung nicht (Funkloch), wird in wachsenden Abständen still weiter versucht: 9, 18, 36, höchstens 60 Sekunden
    var pause = Math.min(60000, 9000 * Math.pow(2, z.fehl));
    if (z.abseits >= 4 && !z.rechnet && jetzt - z.neuUm > pause && !r.oev) { neuRechnen(p); }   // Gleise, Wasser und Luft rechnet man nicht neu
    var aufRoute = s.entf <= grenze;
    if (aufRoute) { z.weg = s.weg; z.idx = s.idx; }
    var kmh = p.tempo >= 0 ? p.tempo * 3.6 : 0;
    var kurs = (p.tempo > 2 && p.kurs >= 0) ? p.kurs : s.kurs;
    var pos = aufRoute ? { lat: s.lat, lon: s.lon } : { lat: p.lat, lon: p.lon };

    /* nächste Abbiegung */
    var sch = r.schritte, n = -1, akt = 0;
    for (var i = 1; i < sch.length; i++) { if (sch[i].weg > z.weg + 4) { n = i; break; } akt = i; }
    var rest = Math.max(0, r.laenge - z.weg);
    var bis = n >= 0 ? sch[n].weg - z.weg : rest, schritt = n >= 0 ? sch[n] : sch[sch.length - 1];
    /* Restzeit: Rest des laufenden Abschnitts + alle folgenden */
    var ende = n >= 0 ? sch[n].weg : r.laenge, abschnitt = Math.max(1, ende - sch[akt].weg);
    var restS = (sch[akt].dauer || 0) * Math.min(1, Math.max(0, (ende - z.weg) / abschnitt));
    for (var k = akt + 1; k < sch.length; k++) restS += sch[k].dauer || 0;

    /* Ansagen */
    if (n >= 0 && aufRoute) {
      var v = Math.max(3, p.tempo > 0 ? p.tempo : 8), fern = Math.max(250, Math.min(1200, v * 25)), nah = Math.max(40, Math.min(160, v * 5.5));
      if (r.oev) { fern = Math.max(2500, Math.min(15000, v * 180)); nah = Math.max(500, Math.min(3000, v * 45)); }   // im Zug rechtzeitig vor dem Aussteigen
      var davor = sch[n].weg - sch[n - 1].weg, m = z.gesagt[n] || 0;
      if (m < 2 && bis <= nah) { z.gesagt[n] = 2; sag(schritt.ziel ? (r.oev ? schritt.ansage : r.zielName ? 'Sie erreichen gleich ' + r.zielName + '.' : 'Sie erreichen gleich Ihr Ziel.') : schritt.ansage); }
      else if (m < 1 && bis <= fern && bis > nah * 1.8 && davor > fern * 0.7) { z.gesagt[n] = 1; sag('In ' + G.meterSprache(bis) + ' ' + klein(schritt.hinweis || schritt.text) + '.'); }
    }
    /* Parkplatz mit WC drei Kilometer vorher ansagen */
    var wcIn = -1, e = FV.app && FV.app.e || {};
    (r.pois || []).forEach(function (q, qi) {
      if (q.art !== 'wc' || q.weg <= z.weg + 30) return;
      var d = q.weg - z.weg;
      if (wcIn < 0 || d < wcIn) wcIn = d;
      if (e.wc !== false && e.wcAnsage !== false && !z.wcGesagt[qi] && d <= 3150 && d >= 2500) { z.wcGesagt[qi] = 1; sag('In drei Kilometern Parkplatz mit WC.'); }
    });

    /* Verkehrsmeldungen vor uns: rund zwei Kilometer vorher ansagen, und die nächste für die Anzeige merken */
    var vor = null;
    (r.verkehr || []).forEach(function (m) {
      if (m.bis < z.weg - 30) return;
      var d = m.ab - z.weg;
      if (!vor || d < vor.in) vor = { m: m, in: Math.max(0, d) };
      if (!vGesagt[m.id] && aufRoute && d <= 2600 && d >= 500 && e.ansage !== false) {
        vGesagt[m.id] = 1;
        var verz = m.verzoegerung >= 60 ? ', etwa ' + FV.V.minSprache(m.verzoegerung) + ' Verzögerung' : '';
        sag('In ' + G.meterSprache(d) + ' ' + FV.V.sprache(m) + verz + '.');
      }
    });

    var limit = G.limitBei(r, z.idx);
    var zz = zoomZiel(kmh, bis, limit); z.zoom += Math.max(-0.35, Math.min(0.35, zz - z.zoom));
    z.letzter = { pos: pos, kurs: kurs };
    if (F.sichtbar) { K.auto(pos, kurs); K.gefahren(r, aufRoute ? s : null); } kamera(z.letzter, false);

    var vz = 0; (r.verkehr || []).forEach(function (m) { if (m.bis >= z.weg - 30) vz += m.verzoegerung || 0; }); restS += vz;   // Staus verlängern die Fahrzeit
    F.stand = { bis: bis, schritt: schritt, restM: rest, restS: restS, ankunft: new Date(jetzt + restS * 1000), kmh: Math.round(kmh), limit: limit, wcIn: wcIn, aufRoute: aufRoute, rechnet: z.rechnet, verkehr: vor, umleitung: !!r.umleitung };
    if (o.beiStand) o.beiStand(F.stand);

    /* Warnpieper: mehr als 5 km/h über dem Tempolimit → kurz piepen, solange zu schnell alle 10 Sekunden wieder */
    if (e.pieper !== false && limit && kmh > limit + 5 && (p.genau || 0) < 40) {
      if (!z.zuSchnellUm || jetzt - z.zuSchnellUm >= 10000) { z.zuSchnellUm = jetzt; B.piep(); }
    } else if (!limit || kmh <= limit + 2) z.zuSchnellUm = 0;

    /* Ziel erreicht */
    if (aufRoute && rest < (r.oev ? 250 : 35) && (p.genau || 0) < (r.oev ? 160 : 60) && !(r.oev && r.zeitAn && p.fahrplan && jetzt < +r.zeitAn)) {
      z.angekommen = true; sag(r.oev ? 'Sie sind in ' + (r.zielName || 'der Zielhaltestelle') + ' angekommen.' : r.zielName ? 'Sie haben ' + r.zielName + ' erreicht.' : 'Sie haben Ihr Ziel erreicht.');
      var cb = o.beiZiel; F.stopp(true); if (cb) cb();
    }
  }

  function neuRechnen(p) {
    var z = zustand; z.rechnet = true; z.neuUm = Date.now();
    if (!z.neuGesagt) { z.neuGesagt = true; sag('Die Route wird neu berechnet.'); }   // nur einmal je Abweichung, nicht bei jedem Versuch
    var alt = F.route;
    G.route({ lat: p.lat, lon: p.lon, kurs: p.kurs, tempo: p.tempo }, F.ziel, { modus: F.modus(), meiden: alt && alt.meiden }).then(function (r) {
      if (alt && alt.umleitung) r.umleitung = alt.umleitung;
      if (!F.aktiv || zustand !== z) return;   // inzwischen beendet oder eine andere Route gestartet
      var gesamtStart = zustand.start; F.route = r; zustand = neuerZustand(); zustand.start = gesamtStart; zustand.neuUm = Date.now(); zustand.gesagt[0] = 2;
      if (F.sichtbar) K.route(r);
      G.limits(r); G.pois(r).then(function () { if (o.beiPois) o.beiPois(r.pois); });
      if (o.beiNeu) o.beiNeu(r);
      if (r.modus === 'auto' && FV.V) FV.V.laden(r, 0).then(function () { if (F.route === r && o.beiVerkehr) o.beiVerkehr(r.verkehr); }).catch(function () {});
      var q = B.ort(); if (q) ort(q);
    }).catch(function () { if (zustand === z) { z.rechnet = false; z.fehl++; z.neuUm = Date.now(); } });
  }
  /** Route gegen eine andere tauschen (Umleitung), ohne dass sich Ansagen wiederholen */
  function tauschen(r) {
    var gesamtStart = zustand.start; F.route = r; zustand = neuerZustand(); zustand.start = gesamtStart; zustand.neuUm = Date.now(); zustand.gesagt[0] = 2;
    if (F.sichtbar) K.route(r);
    G.limits(r); G.pois(r).then(function () { if (o.beiPois) o.beiPois(r.pois); });
    if (o.beiNeu) o.beiNeu(r);
    var q = B.ort(); if (q) ort(q);
  }

  /* ---------- Verkehr: Meldungen holen, bei Sperrung/Unfall/Stau die beste Umleitung nehmen ---------- */
  var pruefLauf = false;
  function verkehrPruefen() {
    if (!F.aktiv || !F.route || pruefLauf || zustand.rechnet || F.modus() !== 'auto' || !FV.V) return;
    var r = F.route, z = zustand, p = B.ort() || (z.letzter && z.letzter.pos);
    if (!p) return;
    var e = FV.app && FV.app.e || {};
    pruefLauf = true;
    var von = { lat: p.lat, lon: p.lon, kurs: p.kurs, tempo: p.tempo };
    var weiter = e.umleiten === false ? FV.V.laden(r, z.weg).then(function (l) { return { meldungen: l, neu: null }; }) : FV.V.pruefen(r, von, F.ziel, z.weg);
    weiter.then(function (erg) {
      pruefLauf = false;
      if (!F.aktiv || F.route !== r || zustand !== z) return;
      if (o.beiVerkehr) o.beiVerkehr(r.verkehr || []);
      if (!erg.neu) return;
      var g = erg.grund, nr = erg.neu;
      nr.umleitung = { grund: g, spart: erg.spart, mehr: erg.mehr, um: Date.now() };
      var satz = 'Achtung, ' + FV.V.sprache(g) + '. ';
      if (g.gesperrt) satz += 'Die Strecke ist gesperrt. Ich leite Sie um' + (erg.mehr > 90 ? '. Die Umleitung dauert etwa ' + FV.V.minSprache(erg.mehr) + ' länger.' : '.');
      else satz += 'Ich leite Sie um. Sie sparen etwa ' + FV.V.minSprache(erg.spart) + '.';
      sag(satz);
      tauschen(nr);
      if (o.beiUmleitung) o.beiUmleitung(nr.umleitung);
      if (o.beiVerkehr) o.beiVerkehr(nr.verkehr || []);
    }).catch(function () { pruefLauf = false; });
  }
  F.verkehrJetzt = function () { if (FV.V && FV.V.leeren) FV.V.leeren(); verkehrPruefen(); };

  /* ---------- Probefahrt (Vorschau/Test): fährt die Route automatisch ab ---------- */
  F.probefahrt = function (kmh, ab) {
    clearInterval(simTimer); B.probe = true;
    var weg = ab || 0, r = F.route, v = (kmh || 60) / 3.6;
    function tick() {
      if (!F.aktiv) { clearInterval(simTimer); return; }
      r = F.route; weg = Math.min(r.laenge, weg + v);
      var a = G.punktBei(r, weg), b = G.punktBei(r, Math.min(r.laenge, weg + 15));
      B._simOrt({ lat: a.lat, lon: a.lon, genau: 5, tempo: v, kurs: G.kurs(a, b), zeit: Date.now() });
    }
    simTimer = setInterval(tick, 1000); tick();
  };
  F.simSetze = function (weg, kmh) {
    var r = F.route, a = G.punktBei(r, weg), b = G.punktBei(r, Math.min(r.laenge, weg + 15));
    B._simOrt({ lat: a.lat, lon: a.lon, genau: 5, tempo: (kmh || 60) / 3.6, kurs: G.kurs(a, b), zeit: Date.now() });
  };
})();
