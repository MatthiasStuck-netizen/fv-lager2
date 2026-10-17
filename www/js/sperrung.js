/* Eigene Sperrungen: In der Zielführung auf „Sperrung“ drücken, dann auf die gesperrte Straße tippen (oder „Straße vor mir“).
 * Auf der Karte erscheint ein Sperrungs-Schild, und die Route wird sofort so neu berechnet, dass sie die Stelle umfährt.
 * Die Sperrung gilt 12 Stunden für alle Routen (Valhalla exclude_polygons), Schild antippen → aufheben. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, K = FV.K, sym = FV.sym, Tun = FV.Tun;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }
  var SP = FV.SP = {};
  var DAUER = 12 * 3600000, HALB = 12;   // Meter: halbe Kantenlänge des Vierecks um die gesperrte Stelle
  var liste = laden(), marken = {}, karteGehoert = null, warten = false, wartT = null, klickFn = null;

  function laden() { var l = B.lesen('sperrungen', []); return Array.isArray(l) ? l.filter(function (s) { return s && s.lat != null && Date.now() - s.t < DAUER; }) : []; }
  function speichern() { B.schreiben('sperrungen', liste); }
  function aufraeumen() { var n = liste.length; liste = liste.filter(function (s) { return Date.now() - s.t < DAUER; }); if (n !== liste.length) { speichern(); zeichnen(); } }
  SP.liste = function () { aufraeumen(); return liste.slice(); };

  /** Vielecke für die Routenberechnung */
  SP.flaechen = function () {
    aufraeumen();
    return liste.map(function (s) {
      var dLat = HALB / 110540, dLon = HALB / (111320 * Math.cos(s.lat * Math.PI / 180));
      return [[s.lon - dLon, s.lat - dLat], [s.lon + dLon, s.lat - dLat], [s.lon + dLon, s.lat + dLat], [s.lon - dLon, s.lat + dLat], [s.lon - dLon, s.lat - dLat]];
    });
  };

  /* ---------- Schilder auf der Karte ---------- */
  function markeBauen(s) {
    var d = document.createElement('div');
    d.className = 'm-sperre';
    d.innerHTML = '<i></i><b>Sperrung</b>';
    d.addEventListener('click', function (ev) { ev.stopPropagation(); blatt(s); });
    return new maplibregl.Marker({ element: d, anchor: 'bottom' }).setLngLat([s.lon, s.lat]).addTo(K.map);
  }
  function zeichnen() {
    if (!K.map) return;
    if (karteGehoert !== K.map) { marken = {}; karteGehoert = K.map; }
    var neu = {};
    liste.forEach(function (s) { neu[s.id] = marken[s.id] || markeBauen(s); });
    Object.keys(marken).forEach(function (k) { if (!neu[k]) marken[k].remove(); });
    marken = neu;
  }
  SP.zeichnen = zeichnen;
  setInterval(function () { if (K.map && (karteGehoert !== K.map || Object.keys(marken).length !== liste.length)) zeichnen(); aufraeumen(); }, 2000);

  function blatt(s) {
    var seit = G.uhr(new Date(s.t)), bis = G.uhr(new Date(s.t + DAUER));
    A().blatt('<h2><span class="sperrsym"><i></i></span><span>Sperrung' + (s.name ? ' · ' + FV.esc(s.name) : '') + '<br><small style="font-weight:400;font-size:13px">eingetragen um ' + seit + ' · gilt bis ' + bis + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<p class="klein2">Alle Routen fahren um diese Stelle herum.</p>' +
      '<button class="rotk knopf breit" data-tun="sperrung-weg" data-id="' + s.id + '">' + sym('muell') + 'Sperrung aufheben</button>' +
      (liste.length > 1 ? '<div style="height:8px"></div><button class="rand knopf breit" data-tun="sperrung-alle-weg">' + sym('muell') + 'Alle ' + liste.length + ' Sperrungen aufheben</button>' : ''));
  }
  Tun['sperrung-weg'] = function (el) { var id = el.getAttribute('data-id'); liste = liste.filter(function (s) { return s.id !== id; }); speichern(); zeichnen(); A().blattZu(); A().toast('Sperrung aufgehoben.'); };
  Tun['sperrung-alle-weg'] = function () { liste = []; speichern(); zeichnen(); A().blattZu(); A().toast('Alle Sperrungen aufgehoben.'); };

  /* ---------- Stelle auf die Straße setzen ---------- */
  /** Auf die nächste befahrbare Straße setzen: zuerst auf unsere Route (liegt genau auf der Straße), sonst Valhalla „locate“ */
  function einrasten(p) {
    var r = FV.F && FV.F.route;
    // Fingerbreite (ca. 28 Bildpunkte) in Metern bei der aktuellen Kartenansicht – so weit daneben zählt noch als „auf der Route“
    var mpp = K.map ? 78271.5 * Math.cos(p.lat * Math.PI / 180) / Math.pow(2, K.map.getZoom()) : 1, tol = Math.max(25, Math.min(250, 28 * mpp));
    if (r && !r.oev) { var s = G.einrasten(r, p); if (s && s.entf <= tol) return Promise.resolve({ lat: s.lat, lon: s.lon, aufRoute: true }); }
    var body = { locations: [{ lat: p.lat, lon: p.lon }], costing: 'auto', verbose: false };
    return B.json({ methode: 'POST', url: G.DIENST.valhalla + '/locate', kopf: { 'Content-Type': 'application/json' }, daten: JSON.stringify(body), zeit: 8000 }).then(function (j) {
      var e = j && j[0] && j[0].edges && j[0].edges[0];
      if (e && e.correlated_lat != null) {
        var q = { lat: +e.correlated_lat, lon: +e.correlated_lon };
        if (G.abstand(p, q) <= 60) return q;
      }
      return { lat: p.lat, lon: p.lon };
    }).catch(function () { return { lat: p.lat, lon: p.lon }; });
  }
  function strasseBei(p) {
    var r = FV.F && FV.F.route; if (!r) return '';
    var s = G.einrasten(r, p); if (!s || s.entf > 5) return '';
    for (var i = r.schritte.length - 1; i >= 0; i--) if (r.schritte[i].ab <= s.idx) return r.schritte[i].strasse || '';
    return '';
  }
  /** Sperrung eintragen und – wenn die Zielführung läuft – sofort drumherum fahren */
  SP.setzen = function (p) {
    return einrasten(p).then(function (q) {
      var s = { id: 's' + Date.now().toString(36), lat: +q.lat.toFixed(6), lon: +q.lon.toFixed(6), t: Date.now(), name: strasseBei(q) };
      liste.push(s); liste = liste.slice(-30); speichern(); zeichnen();
      try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
      var F = FV.F;
      if (!F || !F.aktiv || !F.umfahren) { A().toast('Sperrung eingetragen. Alle Routen fahren drumherum.', 3500); return s; }
      A().toast('Sperrung eingetragen – Route wird neu berechnet …', 4000);
      return F.umfahren(s).then(function (erg) {
        if (!erg.betroffen) { sag('Sperrung eingetragen. Ihre Route ist nicht betroffen.'); A().toast('Sperrung eingetragen – Ihre Route führt dort nicht entlang.', 4000); return s; }
        var mehr = erg.mehr > 60 ? ' Die Umleitung dauert etwa ' + FV.V.minSprache(erg.mehr) + ' länger.' : '';
        sag('Sperrung eingetragen. Ich leite Sie um.' + mehr);
        A().toast('Umleitung um die Sperrung' + (erg.mehr > 60 ? ' · ca. ' + G.minuten(erg.mehr) + ' länger' : ''), 5000);
        return s;
      }).catch(function () {
        sag('Ich finde keine Umfahrung. Bitte Sperrung prüfen.');
        A().toast('Keine Umfahrung gefunden – Sperrung bleibt eingetragen (antippen zum Aufheben).', 6000);
        return s;
      });
    });
  };
  function sag(t) { var e = A().e || {}; if (e.ansage !== false) B.sprich(t); }

  /* ---------- Knopf in der Zielführung ---------- */
  SP.knopf = function () {
    return '<button class="fahrknopf sperrknopf" data-tun="sperrung" id="sperrknopf" aria-label="Sperrung melden"><span class="sperrsym"><i></i></span><small>Sperrung</small></button>' +
      '<div class="sperrhinweis" id="sperrhinweis" hidden><b>Auf die gesperrte Straße tippen</b>' +
      '<div class="zweier"><button class="gold knopf" data-tun="sperrung-vorne">' + sym('a_gerade') + 'Straße vor mir</button>' +
      '<button class="rand knopf" data-tun="sperrung-ab">' + sym('zu') + 'Abbrechen</button></div></div>';
  };
  function modus(an) {
    warten = an; clearTimeout(wartT);
    var k = $('#sperrknopf'), hw = $('#sperrhinweis');
    if (k) k.classList.toggle('wartet', an);
    if (hw) hw.hidden = !an;
    if (K.map && klickFn) { K.map.off('click', klickFn); klickFn = null; }
    if (K.map) K.map.getContainer().classList.toggle('sperrziel', an);
    if (!an) return;
    klickFn = function (ev) {
      var ll = ev.lngLat; modus(false);
      SP.setzen({ lat: ll.lat, lon: ll.lng });
    };
    K.map.on('click', klickFn);
    wartT = setTimeout(function () { modus(false); }, 30000);   // nach 30 Sekunden ohne Tippen von selbst zurück
  }
  Tun.sperrung = function () { if (!K.map) return; modus(!warten); };
  Tun['sperrung-ab'] = function () { modus(false); };
  /** Die Straße direkt vor dem Fahrzeug sperren (ohne genau zu zielen) */
  Tun['sperrung-vorne'] = function () {
    modus(false);
    var F = FV.F, r = F && F.route, w = F && F.weg ? F.weg() : 0;
    if (!r || r.oev) { A().toast('Das geht nur während einer Autofahrt.'); return; }
    var kmh = F.stand && F.stand.kmh || 30, vor = Math.max(60, Math.min(400, kmh / 3.6 * 8));
    if (w + vor >= r.laenge - 10) { A().toast('Das Ziel ist schon zu nah.'); return; }
    SP.setzen(G.punktBei(r, w + vor));
  };
  SP.aus = function () { if (warten) modus(false); };
})();
