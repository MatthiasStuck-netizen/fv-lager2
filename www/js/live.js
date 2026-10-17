/* Züge und Schiffe live auf der Karte.
 * Züge (auch Busse, Straßenbahnen und Fähren mit Fahrplan): Transitous (MOTIS, offene Fahrplan- und Echtzeitdaten).
 *   Die Fahrt zwischen zwei Halten kommt als Linie mit Abfahrt/Ankunft; die Position wird alle 2 Sekunden entlang der Linie
 *   nach der Uhr weitergerechnet (genau wie auf transitous.org). Verspätungen sind drin, wo der Betreiber Echtzeit liefert.
 * Schiffe: AIS über aisstream.io (kostenloser Schlüssel). Die Verbindung hält der Android-Teil (aisstream lässt keine Browser zu).
 * Außerdem: Bahnstrecke einer Verbindung schienengenau (V.gleise), auch aus Transitous. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, K = FV.K, sym = FV.sym, Tun = FV.Tun, X = FV.SX, h = X.h;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }
  var L = FV.LIVE = {};
  var MOTIS = 'https://api.transitous.org';
  var version = null;   // welche API-Fassung der Server kann (v6 … v1)
  var VERSIONEN = ['v6', 'v5', 'v4', 'v3', 'v2', 'v1'];

  function zahl(x) { return typeof x === 'number' && isFinite(x) ? x : null; }
  function zeit(t) { return t ? new Date(t) : null; }
  /** MOTIS fragen; probiert die API-Fassungen durch, bis eine antwortet, und merkt sich die erste, die klappt */
  function motis(pfad, param, nurAb) {
    var reihe = version ? [version] : VERSIONEN.slice(nurAb ? VERSIONEN.indexOf(nurAb) : 0);
    function versuch(i) {
      var v = reihe[i];
      return B.json({ url: MOTIS + '/api/' + v + pfad + '?' + param, kopf: { Accept: 'application/json' }, zeit: 20000 }).then(function (j) { version = version || v; return j; }, function (e) {
        if (e && e.status === 404 && i + 1 < reihe.length) return versuch(i + 1);
        throw e;
      });
    }
    return versuch(0);
  }
  L.motis = motis;

  /* ====================== Züge live ====================== */
  var MODE = {   // MOTIS-Verkehrsmittel → Art, Farbe, Name
    HIGHSPEED_RAIL: ['fern', '#ec0016', 'Fernzug'], LONG_DISTANCE: ['fern', '#ec0016', 'Fernzug'], NIGHT_RAIL: ['fern', '#7a2fbf', 'Nachtzug'],
    REGIONAL_FAST_RAIL: ['regio', '#a3acb8', 'Regionalzug'], REGIONAL_RAIL: ['regio', '#a3acb8', 'Regionalzug'], RAIL: ['regio', '#a3acb8', 'Zug'],
    SUBURBAN: ['sbahn', '#3a9a46', 'S-Bahn'], METRO: ['sbahn', '#3a9a46', 'S-Bahn'], SUBWAY: ['ubahn', '#2e6fd8', 'U-Bahn'],
    TRAM: ['tram', '#d23c6e', 'Straßenbahn'], BUS: ['bus', '#8e4fc7', 'Bus'], COACH: ['bus', '#2fae5b', 'Fernbus'],
    FERRY: ['faehre', '#1b9fc6', 'Fähre'], AIRPLANE: ['flug', '#c9a6ff', 'Flug'], FUNICULAR: ['tram', '#d23c6e', 'Bergbahn'], AERIAL_LIFT: ['tram', '#d23c6e', 'Seilbahn'], AREAL_LIFT: ['tram', '#d23c6e', 'Seilbahn']
  };
  function modeInfo(m) { return MODE[m] || ['regio', '#a3acb8', 'Zug']; }
  var segmente = [], zugStand = { zeit: 0, fehler: '', laeuft: false, box: null }, zugWahl = null;
  function zugAn() { var e = A() && A().e; return !!(e && e.zuege !== false && K.sichtbar() && !document.hidden); }
  function schiffAn() { var e = A() && A().e; return !!(e && e.schiffe !== false && K.sichtbar() && !document.hidden); }
  /** Abschnitt (zwei Halte) mit Linie, für die Position nach der Uhr vorbereitet */
  function segment(s) {
    var pts = G.polylinie(s.polyline || '', 5);
    if (pts.length < 2) { var a = s.from, b = s.to; if (!a || !b) return null; pts = [[a.lon, a.lat], [b.lon, b.lat]]; }
    var kum = G.kumuliert(pts), info = modeInfo(s.mode), trip = (s.trips || [])[0] || {};
    var ab = zeit(s.departure), an = zeit(s.arrival), abPlan = zeit(s.scheduledDeparture), anPlan = zeit(s.scheduledArrival);
    if (!ab || !an) return null;
    var name = String(trip.displayName || trip.routeShortName || '').trim();
    return { id: String(trip.tripId || (name + ab.getTime())), name: name, mode: s.mode, art: info[0], farbe: s.routeColor && /^[0-9a-f]{6}$/i.test(s.routeColor) && info[0] !== 'regio' && info[0] !== 'fern' ? '#' + s.routeColor : info[1], artName: info[2],
      von: s.from && s.from.name || '', nach: s.to && s.to.name || '', ab: ab, an: an, abPlan: abPlan, anPlan: anPlan, echt: !!s.realTime,
      verz: abPlan ? Math.round((ab - abPlan) / 60000) : null, verzAn: anPlan ? Math.round((an - anPlan) / 60000) : null,
      pts: pts, kum: kum, laenge: kum[kum.length - 1] || 0, tripId: trip.tripId || '' };
  }
  /** Position auf dem Abschnitt zur Zeit t (null = gerade nicht unterwegs auf diesem Stück) */
  function position(sg, t) {
    if (t < sg.ab || t > sg.an) return null;
    var f = sg.an > sg.ab ? (t - sg.ab) / (sg.an - sg.ab) : 1, w = f * sg.laenge, k = sg.kum, i = 1;
    while (i < k.length - 1 && k[i] < w) i++;
    var a = sg.pts[i - 1], b = sg.pts[i], d = k[i] - k[i - 1], u = d > 0 ? (w - k[i - 1]) / d : 0;
    var lon = a[0] + (b[0] - a[0]) * u, lat = a[1] + (b[1] - a[1]) * u;
    var y = Math.sin((b[0] - a[0]) * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180), x = Math.cos(a[1] * Math.PI / 180) * Math.sin(b[1] * Math.PI / 180) - Math.sin(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.cos((b[0] - a[0]) * Math.PI / 180);
    return { lat: lat, lon: lon, kurs: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, anteil: f };
  }
  function zuegeHolen(sofort) {
    if (zugStand.laeuft || !zugAn() || !K.map) return;
    if (!sofort && Date.now() - zugStand.zeit < 55000) return;
    var map = K.map, b = map.getBounds(), z = Math.max(1, Math.round(map.getZoom()));
    if (z < 6) { segmente = []; zeichnen(); return; }   // ganz Europa: zu viele Züge, erst ab Landesansicht
    var jetzt = new Date(), bis = new Date(jetzt.getTime() + 180000);
    var p = 'zoom=' + z + '&min=' + b.getSouth().toFixed(5) + ',' + b.getWest().toFixed(5) + '&max=' + b.getNorth().toFixed(5) + ',' + b.getEast().toFixed(5) +
      '&startTime=' + encodeURIComponent(jetzt.toISOString()) + '&endTime=' + encodeURIComponent(bis.toISOString()) + '&precision=5&language=de';
    zugStand.laeuft = true; zugStand.zeit = Date.now();
    motis('/map/trips', p, 'v6').then(function (l) {
      zugStand.laeuft = false; zugStand.fehler = '';
      if (!Array.isArray(l)) throw new Error('unverständliche Antwort');
      segmente = l.map(segment).filter(Boolean);
      zeichnen();
    }).catch(function (e) { zugStand.laeuft = false; zugStand.fehler = e && e.message || 'nicht erreichbar'; });
  }

  /* ====================== Schiffe live (AIS) ====================== */
  var schiffe = [], schiffNach = {}, aisStand = { zustand: '', fehler: '', zeit: 0 };
  /** Schlüssel für aisstream.io: aus der Verwaltung (für alle Fahrer) oder selbst in den Einstellungen eingetragen */
  L.aisSchluessel = function () { var e = A().e, v = A().z.verkehr; return String(e.aisSchluessel || (v && v.aisstream) || '').trim(); };
  function schiffeHolen() {
    if (!schiffAn() || !K.map || !B.hatExtra()) { if (schiffe.length) { schiffe = []; zeichnen(); } return; }
    var k = L.aisSchluessel(); if (!k) return;
    var b = K.map.getBounds();
    if (K.map.getZoom() < 5.5) { if (schiffe.length) { schiffe = []; zeichnen(); } return; }
    var r = B.extra('aisStart', { schluessel: k, s: b.getSouth(), w: b.getWest(), n: b.getNorth(), o: b.getEast() });
    var st = B.extra('aisStand', '');
    if (!st || !st.ok) return;
    aisStand = { zustand: st.zustand, fehler: st.fehler || '', zeit: Date.now(), nachrichten: st.nachrichten };
    function ais(t) { return String(t || '').replace(/@+/g, ' ').replace(/\s+/g, ' ').trim(); }
    schiffe = (st.schiffe || []).map(function (x) {
      return { mmsi: x[0], lat: x[1], lon: x[2], sog: x[3], cog: x[4], kurs: x[5], name: ais(x[6]), rufz: ais(x[7]), typ: x[8] || 0, ziel: ais(x[9]), status: x[10], laenge: x[11], breite: x[12], imo: x[13] || '', tiefgang: x[14] || 0, eta: x[15] || '', zeit: x[16], klasseB: !!x[17] };
    });
    schiffNach = {}; schiffe.forEach(function (s) { schiffNach[s.mmsi] = s; });
    zeichnen();
    return r;
  }
  /* Schiffstyp (AIS) → Name und Farbe */
  function schiffArt(t) {
    if (t >= 60 && t <= 69) return ['Fähre / Passagierschiff', '#1b9fc6'];
    if (t >= 70 && t <= 79) return ['Frachtschiff', '#2fae5b'];
    if (t >= 80 && t <= 89) return ['Tanker', '#e2231a'];
    if (t === 30) return ['Fischerei', '#f2b632'];
    if (t === 31 || t === 32 || t === 52) return ['Schlepper', '#00a39a'];
    if (t === 36) return ['Segelboot', '#c9a6ff'];
    if (t === 37) return ['Sportboot', '#ff7ab8'];
    if (t === 33) return ['Baggerschiff', '#b08d57'];
    if (t === 35) return ['Marine', '#7f8a96'];
    if (t === 50) return ['Lotse', '#ffd36b'];
    if (t === 51) return ['Seenotrettung', '#ff5a1f'];
    if (t === 55) return ['Polizei / Behörde', '#4c7bd9'];
    if (t >= 40 && t <= 49) return ['Schnellboot', '#8fd3ff'];
    if (t >= 20 && t <= 29) return ['Bodeneffektfahrzeug', '#9aa3ad'];
    return ['Schiff', '#9fb3c8'];
  }
  /** Welche Silhouette: Fähre/Passagierschiff, Frachter, Tanker, Segelboot, kleines Boot (Sport, Lotse, Schlepper, Fischer …), sonst Schiff */
  function schiffForm(t) {
    if (t >= 60 && t <= 69) return 'schiff-faehre';
    if (t >= 70 && t <= 79) return 'schiff-fracht';
    if (t >= 80 && t <= 89) return 'schiff-tanker';
    if (t === 36) return 'schiff-segel';
    if (t === 37 || t === 30 || t === 31 || t === 32 || t === 50 || t === 51 || t === 52 || t === 53 || t === 55 || (t >= 40 && t <= 49)) return 'schiff-klein';
    return 'schiff-sonst';
  }
  var STATUS = ['in Fahrt (Maschine)', 'vor Anker', 'manövrierunfähig', 'eingeschränkt manövrierfähig', 'tiefgangbehindert', 'festgemacht', 'auf Grund', 'beim Fischen', 'unter Segeln', '', '', 'schleppt', 'schiebt', '', 'AIS-SART (Notfall)', ''];
  var MID = { 211: 'Deutschland', 218: 'Deutschland', 244: 'Niederlande', 245: 'Niederlande', 246: 'Niederlande', 219: 'Dänemark', 220: 'Dänemark', 205: 'Belgien', 226: 'Frankreich', 227: 'Frankreich', 228: 'Frankreich',
    232: 'Großbritannien', 233: 'Großbritannien', 234: 'Großbritannien', 235: 'Großbritannien', 257: 'Norwegen', 258: 'Norwegen', 259: 'Norwegen', 265: 'Schweden', 266: 'Schweden', 230: 'Finnland', 261: 'Polen',
    209: 'Zypern', 210: 'Zypern', 212: 'Zypern', 215: 'Malta', 229: 'Malta', 248: 'Malta', 249: 'Malta', 256: 'Malta', 255: 'Portugal (Madeira)', 263: 'Portugal', 224: 'Spanien', 225: 'Spanien', 247: 'Italien',
    636: 'Liberia', 637: 'Liberia', 351: 'Panama', 352: 'Panama', 353: 'Panama', 354: 'Panama', 355: 'Panama', 356: 'Panama', 357: 'Panama', 370: 'Panama', 371: 'Panama', 372: 'Panama', 373: 'Panama',
    538: 'Marshallinseln', 563: 'Singapur', 564: 'Singapur', 565: 'Singapur', 566: 'Singapur', 477: 'Hongkong', 304: 'Antigua und Barbuda', 305: 'Antigua und Barbuda', 308: 'Bahamas', 309: 'Bahamas', 311: 'Bahamas', 273: 'Russland', 271: 'Türkei', 240: 'Griechenland', 241: 'Griechenland', 239: 'Griechenland' };

  /* ====================== Zeichnen (alle 2 Sekunden) ====================== */
  function zeichnen() {
    if (!K.map) return;
    var t = new Date(), l = [];
    if (zugAn()) {
      var gesehen = {};
      segmente.forEach(function (sg) {
        var p = position(sg, t); if (!p || gesehen[sg.id]) return;
        gesehen[sg.id] = 1; sg.jetzt = p;
        var faehre = sg.art === 'faehre', bild = faehre ? 'schiff-faehre' : sg.art === 'bus' ? 'bus' : sg.art === 'tram' || sg.art === 'ubahn' ? 'tram' : sg.art === 'flug' ? 'flug' : 'zug';
        l.push({ typ: faehre ? 'faehre' : 'zug', sym: bild, id: sg.id, lat: p.lat, lon: p.lon, kurs: p.kurs, farbe: sg.farbe, name: sg.name + (sg.verz >= 3 ? ' +' + sg.verz : ''), rang: sg.art === 'fern' ? 3 : faehre ? 2 : 1 });
      });
    }
    if (schiffAn()) schiffe.forEach(function (s) {
      var k = s.kurs != null ? s.kurs : (s.sog > 0.5 && s.cog != null ? s.cog : null);
      l.push({ typ: 'schiff', sym: schiffForm(s.typ), id: s.mmsi, lat: s.lat, lon: s.lon, kurs: k, farbe: schiffArt(s.typ)[1], name: s.name || ('MMSI ' + s.mmsi), rang: 1 });
    });
    K.live(l, tipp);
  }
  function tipp(typ, id) {
    if (typ === 'schiff') { var s = schiffNach[id]; if (s) schiffBlatt(s); return; }
    var sg = segmente.filter(function (x) { return x.id === id; })[0]; if (sg) zugBlatt(sg);
  }
  setInterval(function () {
    if (!K.map || !K.sichtbar()) return;
    zuegeHolen(false);
    zeichnen();
  }, 2000);
  setInterval(function () { if (K.map && K.sichtbar()) schiffeHolen(); }, 5000);
  var gehoert = null, bewegT = null;
  L.karteDa = function () {
    if (!K.map || gehoert === K.map) return;
    gehoert = K.map;
    K.map.on('moveend', function () { clearTimeout(bewegT); bewegT = setTimeout(function () { zugStand.zeit = 0; zuegeHolen(true); schiffeHolen(); }, 900); });
  };
  L.neu = function () { zugStand.zeit = 0; if (!zugAn()) segmente = segmente; zuegeHolen(true); schiffeHolen(); zeichnen(); };
  L.zustand = function () { return { zuege: segmente.length, zugFehler: zugStand.fehler, schiffe: schiffe.length, ais: aisStand, aisMoeglich: B.hatExtra(), aisSchluessel: !!L.aisSchluessel() }; };

  /* ====================== Blätter ====================== */
  function zeile(s, k, t) { return t ? '<div class="detailzeile">' + sym(s) + '<div><small>' + k + '</small>' + t + '</div></div>' : ''; }
  function uhrVerz(ist, plan) {
    if (!ist) return '–';
    var v = plan ? Math.round((ist - plan) / 60000) : null;
    return G.uhr(plan || ist) + (v != null && v >= 1 ? ' <em class="spaet">+' + v + ' (' + G.uhr(ist) + ')</em>' : v != null && v <= 0 ? ' <em class="puenktlich">pünktlich</em>' : '');
  }
  function zugBlatt(sg) {
    zugWahl = sg;
    var p = sg.jetzt || position(sg, new Date()) || { anteil: 0 }, proz = Math.round((p.anteil || 0) * 100);
    A().blatt('<h2>' + sym(sg.art === 'faehre' ? 'schiff' : sg.art === 'bus' ? 'bus' : sg.art === 'tram' || sg.art === 'ubahn' ? 'tram' : 'zug') + '<span>' + h(sg.name || sg.artName) +
        '<br><small style="font-weight:400;font-size:13px">' + h(sg.artName) + '<span id="zbziel"></span></small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="block creme fzstrecke"><div class="fzorte"><div><b>' + h(G.uhr(sg.ab)) + '</b><span>' + h(sg.von) + '</span></div>' + sym('rechts', 'zbpfeil') +
        '<div><b>' + h(G.uhr(sg.an)) + '</b><span>' + h(sg.nach) + '</span></div></div><div class="offbalken"><i style="width:' + proz + '%"></i></div>' +
        '<small>' + h('Gerade unterwegs von ' + sg.von + ' nach ' + sg.nach + ' · etwa ' + proz + ' %') + '</small></div>' +
      '<div class="block">' + zeile('abflug', 'Abfahrt ' + h(sg.von), uhrVerz(sg.ab, sg.abPlan)) + zeile('ankunft', 'Ankunft ' + h(sg.nach), uhrVerz(sg.an, sg.anPlan)) +
        zeile('uhr', 'Jetzt', G.uhr(new Date())) +
        zeile('info', 'Daten', h(sg.echt ? 'mit Echtzeit (Verspätung) des Betreibers' : 'nach Fahrplan – für diese Linie gibt es keine Echtzeit')) + '</div>' +
      '<div id="zbhalte"></div>' +
      '<p class="klein2">Position nach Fahrplan und Echtzeit gerechnet (Transitous, offene Fahrplandaten) – kein GPS des Zuges, ohne Gewähr.</p>');
    if (!sg.tripId) return;
    motis('/trip', 'tripId=' + encodeURIComponent(sg.tripId) + '&language=de').then(function (j) {
      if (zugWahl !== sg) return;
      var leg = (j && j.legs || []).filter(function (x) { return x.mode && x.mode !== 'WALK'; })[0]; if (!leg) return;
      var ziel = leg.headsign || (leg.tripTo && leg.tripTo.name) || (leg.to && leg.to.name) || '';
      var zz = $('#zbziel'); if (zz && ziel) zz.textContent = ' · nach ' + ziel;
      var halte = [leg.from].concat(leg.intermediateStops || [], [leg.to]).filter(Boolean), jetzt = Date.now();
      var box = $('#zbhalte'); if (!box || halte.length < 2) return;
      box.innerHTML = '<h3 class="ueber">' + sym('zug') + 'Halte' + (leg.agencyName ? ' · ' + h(leg.agencyName) : '') + '</h3><div class="block halteliste">' + halte.map(function (hx) {
        var an = zeit(hx.arrival || hx.departure), plan = zeit(hx.scheduledArrival || hx.scheduledDeparture), vorbei = an && an.getTime() < jetzt - 30000;
        return '<div class="halt' + (vorbei ? ' vorbei' : '') + '"><b>' + (an ? G.uhr(plan || an) : '–') + '</b>' + (an && plan && an - plan >= 60000 ? '<em class="spaet">+' + Math.round((an - plan) / 60000) + '</em>' : '<em></em>') + '<span>' + h(hx.name || '') + '</span>' + (hx.track ? '<small>Gl. ' + h(hx.track) + '</small>' : '') + '</div>';
      }).join('') + '</div>';
    }).catch(function () {});
  }
  function schiffBlatt(s) {
    var art = schiffArt(s.typ), land = MID[Math.floor(s.mmsi / 1000000)] || '', alt = s.zeit > 1000 ? Math.max(0, Math.round((Date.now() - s.zeit) / 60000)) : null;
    var kn = s.sog != null ? s.sog : null;
    A().blatt('<h2>' + sym('schiff') + '<span>' + h(s.name || 'MMSI ' + s.mmsi) + '<br><small style="font-weight:400;font-size:13px">' + h([art[0], land].filter(Boolean).join(' · ')) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="block">' +
        zeile('info', 'Kennung', h(['MMSI ' + s.mmsi, s.imo ? 'IMO ' + s.imo : '', s.rufz ? 'Rufzeichen ' + s.rufz : ''].filter(Boolean).join(' · '))) +
        zeile('tempo', 'Geschwindigkeit', kn != null ? h(String(kn).replace('.', ',') + ' kn (' + Math.round(kn * 1.852) + ' km/h)') : 'unbekannt') +
        zeile('navi', 'Kurs', s.cog != null ? Math.round(s.cog) + '°' + (s.kurs != null && Math.abs(s.kurs - s.cog) > 10 ? ' · Bug zeigt ' + s.kurs + '°' : '') : '') +
        zeile('pin', 'Status', h(STATUS[s.status] || '')) +
        zeile('route', 'Ziel', h(s.ziel ? s.ziel + (s.eta ? ' · Ankunft geplant ' + s.eta : '') : '')) +
        zeile('lkw', 'Größe', s.laenge ? h(s.laenge + ' m lang, ' + s.breite + ' m breit' + (s.tiefgang ? ' · Tiefgang ' + String(s.tiefgang).replace('.', ',') + ' m' : '')) : '') +
        zeile('uhr', 'Letzte Meldung', alt == null ? '' : alt < 1 ? 'gerade eben' : 'vor ' + alt + ' Min.') + '</div>' +
      '<div class="zweier"><button class="rand knopf" data-tun="schiff-folgen" data-m="' + s.mmsi + '">' + sym('ort') + 'Auf der Karte</button><button class="rand knopf" data-tun="schiff-web" data-m="' + s.mmsi + '">' + sym('extern') + 'Mehr im Netz</button></div>' +
      '<p class="klein2">Position per AIS (aisstream.io), ohne Gewähr. Kleine Boote senden oft kein AIS.</p>');
  }
  Tun['schiff-folgen'] = function (el) { var s = schiffNach[+el.getAttribute('data-m')]; if (!s) return; A().blattZu(); K.mitte(s, 13); };
  Tun['schiff-web'] = function (el) { B.oeffnen('https://www.marinetraffic.com/de/ais/details/ships/mmsi:' + el.getAttribute('data-m')); };

  /* ====================== Bahnstrecke schienengenau ======================
   * Die Bahn-Auskunft liefert oft nur die Halte (gerade Linien dazwischen). Transitous kennt den Verlauf auf den Gleisen:
   * gleiche Verbindung (Abfahrt ±10 Min., gleiche Linie) suchen und deren Linie übernehmen. Klappt das nicht, bleibt alles wie es war. */
  var gleisMerker = {};
  function gleisLeg(l) {
    if (!l || l.fuss || l.art === 'flug' || l.art === 'auto' || !l.vonOrt || !l.nachOrt || !l.ab) return Promise.resolve(null);
    var key = [l.vonOrt.lat.toFixed(4), l.vonOrt.lon.toFixed(4), l.nachOrt.lat.toFixed(4), l.nachOrt.lon.toFixed(4), l.ab.getTime(), l.linie].join('|');
    if (gleisMerker[key] !== undefined) return Promise.resolve(gleisMerker[key]);
    var modes = l.art === 'bus' ? 'BUS,COACH' : l.art === 'tram' ? 'TRAM' : l.art === 'ubahn' ? 'SUBWAY' : l.art === 'faehre' ? 'FERRY' : 'RAIL';
    var p = 'fromPlace=' + l.vonOrt.lat.toFixed(6) + ',' + l.vonOrt.lon.toFixed(6) + '&toPlace=' + l.nachOrt.lat.toFixed(6) + ',' + l.nachOrt.lon.toFixed(6) +
      '&time=' + encodeURIComponent(new Date(l.ab.getTime() - 15 * 60000).toISOString()) + '&transitModes=' + modes + '&maxTransfers=0&maxPreTransitTime=900&maxPostTransitTime=900&numItineraries=4&searchWindow=3600&detailedLegs=true&language=de';
    var nr = String(l.linie || '').replace(/\s+/g, '').toUpperCase();
    return motis('/plan', p, 'v6').then(function (j) {
      var beste = null, besteW = 1e9;
      (j && j.itineraries || []).forEach(function (it) {
        (it.legs || []).forEach(function (x) {
          if (!x.legGeometry || !x.legGeometry.points || x.mode === 'WALK') return;
          var t = zeit(x.scheduledStartTime || x.startTime); if (!t) return;
          var w = Math.abs(t - (l.abPlan || l.ab)) / 60000, name = String(x.displayName || x.routeShortName || x.tripShortName || '').replace(/\s+/g, '').toUpperCase();
          if (nr && name && (nr.indexOf(name) >= 0 || name.indexOf(nr) >= 0)) w -= 30;
          if (w < besteW) { besteW = w; beste = x; }
        });
      });
      if (!beste || besteW > 12) return null;
      var pts = G.polylinie(beste.legGeometry.points, beste.legGeometry.precision || (version === 'v1' ? 7 : 6));
      if (pts.length < 3) return null;
      // passt die Linie zu Start und Ende? (sonst lieber nichts ändern)
      if (G.abstand({ lat: pts[0][1], lon: pts[0][0] }, l.vonOrt) > 3000 || G.abstand({ lat: pts[pts.length - 1][1], lon: pts[pts.length - 1][0] }, l.nachOrt) > 3000) return null;
      return pts;
    }).catch(function () { return null; }).then(function (pts) { gleisMerker[key] = pts; return pts; });
  }
  /** Alle Bahn-/Bus-Abschnitte einer Verbindung schienengenau machen. Ruft fertig() auf, wenn sich etwas geändert hat. */
  L.gleise = function (f, fertig) {
    if (!f || !f.legs || f.gleisGeprueft) return Promise.resolve(false);
    f.gleisGeprueft = true;
    return Promise.all(f.legs.map(function (l) {
      return gleisLeg(l).then(function (pts) { if (pts) { l.punkte = pts; l.schienengenau = true; return true; } return false; });
    })).then(function (x) { var neu = x.some(Boolean); if (neu && fertig) fertig(f); return neu; });
  };
})();
