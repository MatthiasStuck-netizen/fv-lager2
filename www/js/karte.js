/* Karte: MapLibre + OpenStreetMap-Daten (Vektorkacheln von OpenFreeMap), dunkel eingefärbt passend zum Design. */
(function () {
  'use strict';
  var G = FV.G, B = FV.B, K = FV.K = { map: null, bereit: false, folgt: false };
  var STIL_URL = 'https://tiles.openfreemap.org/styles/liberty';
  var feld = null, marken = {}, poiMarken = [], extraMarken = [], verkehrMarken = [], bahnMarken = [], apoMarken = [], arztMarken = [], flugMarken = [], busMarken = [], stadtMarken = [], netzMarken = [], netzDaten = null, warte = [], beiGeste = null, stilArt = '';

  /* ---------- Kartenstil einfärben: Nacht (dunkel, passend zum Design) oder Tag (hell) ---------- */
  var PAL = {
    nacht: { bg: '#17361f', fl: '#1b3f24', wasser: '#0e3a63', wald: '#123019', sand: '#4b4526', eis: '#73858c', sumpf: '#183c33', gras: '#20492a',
      wohnen: '#2a302c', gewerbe: '#2c2e31', gruen: '#24402b', nutz: '#22342a', park: '#1a4627', haus: '#454a4d', hausD: 0.75, flug: '#34373b', verkehrF: '#3a3f44',
      fluss: '#1a5d92', grenze: '#c9a24a', grenzeD: 0.45, rand: '#0b0e11', parkL: '#2b5a35', sonst: '#555b60',
      bahn: '#6f7680', ab: '#f2b632', bund: '#e9c869', land: '#ded8c4', weg: '#6f7a72', strasse: '#aab0b6',
      tWasser: '#a8cff2', tStrasse: '#f1ede2', tText: '#ffffff', halo: 'rgba(0,0,0,0.85)' },
    tag: { bg: '#f2efe9', fl: '#ede9e0', wasser: '#a5cff0', wald: '#cde4c1', sand: '#f2eac6', eis: '#f4f8fa', sumpf: '#d5e9d6', gras: '#e1edd4',
      wohnen: '#ebe6de', gewerbe: '#e8e2e8', gruen: '#d8ebcf', nutz: '#e8e4da', park: '#cbe6bc', haus: '#d9d2c7', hausD: 0.9, flug: '#e3e1ea', verkehrF: '#ffffff',
      fluss: '#86c0ea', grenze: '#9a7bb5', grenzeD: 0.6, rand: '#c7bfb0', parkL: '#b2d4a3', sonst: '#bdb8ae',
      bahn: '#8d9096', ab: '#f4a636', bund: '#f7cf64', land: '#ffffff', weg: '#b3a48c', strasse: '#ffffff',
      tWasser: '#2a679c', tStrasse: '#39342a', tText: '#24211c', halo: 'rgba(255,255,255,0.92)' }
  };
  K.hell = function () { return !!(FV.D && FV.D.hell()); };
  function strassenfarbe(id, f) {
    if (/rail|transit/.test(id)) return f.bahn;
    if (/motorway/.test(id)) return f.ab;
    if (/trunk|primary/.test(id)) return f.bund;
    if (/secondary|tertiary/.test(id)) return f.land;
    if (/path|pedestrian|cycle|steps|track|pier/.test(id)) return f.weg;
    return f.strasse;
  }
  /** Farben einer Grundkarten-Ebene für Tag oder Nacht (null = Ebene nicht anfassen) */
  function ebenenFarben(l, hell) {
    var f = hell ? PAL.tag : PAL.nacht, sl = l['source-layer'] || '', id = l.id, p = {};
    if (l.type === 'background') { p['background-color'] = f.bg; return p; }
    if (l.type === 'fill') {
      var c = f.fl;
      if (sl === 'water') c = f.wasser;
      else if (sl === 'landcover') c = /wood|forest|tree/.test(id) ? f.wald : /sand|beach/.test(id) ? f.sand : /ice|glacier/.test(id) ? f.eis : /wetland/.test(id) ? f.sumpf : f.gras;
      else if (sl === 'landuse') c = /residential|suburb/.test(id) ? f.wohnen : /industrial|commercial|retail|railway/.test(id) ? f.gewerbe : /cemetery|pitch|stadium|school|hospital|kindergarten/.test(id) ? f.gruen : f.nutz;
      else if (sl === 'park') c = f.park;
      else if (sl === 'building') { c = f.haus; p['fill-opacity'] = f.hausD; }
      else if (sl === 'aeroway') c = f.flug;
      else if (sl === 'transportation') c = f.verkehrF;
      p['fill-color'] = c; return p;
    }
    if (l.type === 'line') {
      if (sl === 'waterway' || sl === 'water') p['line-color'] = f.fluss;
      else if (sl === 'boundary') { p['line-color'] = f.grenze; p['line-opacity'] = f.grenzeD; }
      else if (sl === 'transportation' || sl === 'aeroway') p['line-color'] = /casing|outline/.test(id) ? f.rand : strassenfarbe(id, f);
      else if (sl === 'park' || sl === 'landuse' || sl === 'landcover') p['line-color'] = f.parkL;
      else p['line-color'] = f.sonst;
      return p;
    }
    if (l.type === 'symbol') {
      p['text-color'] = sl === 'water_name' || sl === 'waterway' ? f.tWasser : sl === 'transportation_name' ? f.tStrasse : f.tText;
      p['text-halo-color'] = f.halo; p['text-halo-width'] = 1.6; return p;
    }
    if (l.type === 'raster') { p['raster-brightness-max'] = hell ? 1 : 0.82; p['raster-saturation'] = hell ? 0 : -0.15; return p; }
    return null;
  }
  /** Ebenen, die das Navi nicht braucht (Geschäfte, Hausnummern, Muster …), fallen weg – unabhängig von Tag/Nacht */
  function entruempeln(st) {
    var weg = { poi: 1, housenumber: 1, mountain_peak: 1, aerodrome_label: 1 };
    st.layers = st.layers.filter(function (l) { return !weg[l['source-layer'] || ''] && l.type !== 'fill-extrusion' && !/poi|pattern/.test(l.id); });
    st.layers.forEach(function (l) { var p = l.paint = l.paint || {}; if (l.type === 'fill') { delete p['fill-pattern']; delete p['fill-outline-color']; } if (l.type === 'symbol') delete p['text-halo-blur']; });
    return st;
  }
  function einfaerben(st, hell) {
    if (hell == null) hell = K.hell();
    st.layers.forEach(function (l) { var p = ebenenFarben(l, hell); if (p) l.paint = Object.assign(l.paint || {}, p); });
    return st;
  }
  function kopie(x) { return JSON.parse(JSON.stringify(x)); }
  var EIGENE = /^(route|gefahren|verkehr|netz|oev|bahn-|see-|flug-|gelaende|live-)/;
  /** Tag/Nacht umschalten, ohne die Karte neu aufzubauen (Route, Marken und eigene Ebenen bleiben) */
  K.designNeu = function () {
    if (!K.map || !K.bereit) return;
    var hell = K.hell();
    try {
      K.map.getStyle().layers.forEach(function (l) {
        if (EIGENE.test(l.id)) return;
        var p = ebenenFarben(l, hell); if (!p) return;
        Object.keys(p).forEach(function (k) { try { K.map.setPaintProperty(l.id, k, p[k]); } catch (e) {} });
      });
      zusatzFarben(); gelaende(); liveFarben();
    } catch (e) {}
    var f = K.map.getContainer(); if (f && f.parentNode) f.parentNode.style.background = hell ? '#e9e5dc' : '';
  };
  var RASTER = { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19 } },
    layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-brightness-max': 0.82, 'raster-saturation': -0.15 } }] };
  function stilHolen() {
    var merker = B.lesen('kartenstil2', null) || B.lesen('kartenstil', null);   // Online-Stil; die Farben kommen je nach Tag/Nacht dazu (ältere Fassung wird einfach neu eingefärbt)
    function netz() {
      return fetch(STIL_URL).then(function (r) { if (!r.ok) throw new Error('stil'); return r.json(); }).then(function (st) {
        if (!st || !Array.isArray(st.layers) || !st.sources) throw new Error('stil');
        st = entruempeln(st);
        try { B.schreiben('kartenstil2', st); B.schreiben('kartenstil', null); } catch (e) {}
        return st;
      });
    }
    /* Offline-Karte auf dem Handy: Kacheln kommen aus der Datei (Einstellungen → Offline-Karten) – außer, der Fahrer hat auf „Online“ geschaltet */
    if (K.quelle() === 'offline') {
      FV.O.protokoll(); stilArt = 'offline';
      if (merker && merker.layers) { netz().catch(function () {}); return Promise.resolve(einfaerben(FV.O.stil(merker))); }
      var bis = new Promise(function (ok, fehl) { setTimeout(function () { fehl(new Error('zeit')); }, 6000); });
      return Promise.race([netz(), bis]).then(function (st) { return einfaerben(FV.O.stil(st)); }).catch(function () { return einfaerben(FV.O.grundstil()); });
    }
    if (merker && merker.layers) { netz().catch(function () {}); stilArt = 'vektor'; return Promise.resolve(einfaerben(kopie(merker))); }
    return netz().then(function (st) { stilArt = 'vektor'; return einfaerben(kopie(st)); }).catch(function () { stilArt = 'raster'; return einfaerben(kopie(RASTER)); });
  }

  /** Woher kommt die Karte? 'offline' (Datei auf dem Handy) oder 'online'. Ohne Wahl: offline, sobald eine Offline-Karte geladen ist. */
  K.quelle = function () {
    var q = (FV.app && FV.app.e && FV.app.e.kartenQuelle) || '', da = !!(FV.O && FV.O.aktiv());
    if (q === 'online') return 'online';
    return da ? 'offline' : 'online';
  };
  K.offlineDa = function () { return !!(FV.O && FV.O.aktiv()); };
  /** Kartenstil neu laden (nach Umschalten online/offline). Route, Linien, Marken und eigene Ebenen bleiben. */
  K.stilNeu = function () {
    if (!K.map) return Promise.resolve();
    return stilHolen().then(function (st) {
      var map = K.map;
      return new Promise(function (ok) {
        map.once('style.load', function () {
          try { ebenen(); gelaende(); liveEbenen(); K.live(liveListe); } catch (e) { console.error(e); }
          ok();
        });
        map.setStyle(st, { diff: false, transformStyle: function (alt, neu) {
          if (!alt) return neu;
          var eigen = {}, vorher = alt.sources || {};
          Object.keys(vorher).forEach(function (k) { if (vorher[k].type === 'geojson') eigen[k] = vorher[k]; });
          neu.sources = Object.assign({}, neu.sources, eigen);
          var eigeneEbenen = (alt.layers || []).filter(function (l) { return l.source && eigen[l.source]; });
          var i = 0; while (i < neu.layers.length && neu.layers[i].type !== 'symbol') i++;
          var unten = eigeneEbenen.filter(function (l) { return l.type !== 'symbol'; }), oben = eigeneEbenen.filter(function (l) { return l.type === 'symbol'; });
          neu.layers = neu.layers.slice(0, i).concat(unten, neu.layers.slice(i), oben);
          return neu;
        } });
      });
    });
  };

  /* ---------- Gelände: Schummerung (Relief) aus Höhendaten, auf Wunsch schräg von der Seite ----------
   * Höhen: Terrain Tiles von Mapzen/Amazon (frei, ohne Schlüssel). Braucht Internet; offline bleibt die Karte flach. */
  var DEM = { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Höhen: Mapzen Terrain Tiles' };
  function gelaende() {
    var map = K.map; if (!map) return;
    var an = !!(FV.app && FV.app.e && FV.app.e.gelaende), hell = K.hell();
    try {
      if (!an) {
        if (map.getLayer('gelaende-schatten')) map.removeLayer('gelaende-schatten');
        try { map.setTerrain(null); } catch (e) {}
        return;
      }
      if (!map.getSource('gelaende')) map.addSource('gelaende', Object.assign({}, DEM));
      if (!map.getSource('gelaende-3d')) map.addSource('gelaende-3d', Object.assign({}, DEM));
      var vor = null, ls = map.getStyle().layers;
      for (var i = 0; i < ls.length; i++) { var sl = ls[i]['source-layer'] || ''; if (sl === 'building' || sl === 'transportation' || ls[i].type === 'symbol') { vor = ls[i].id; break; } }
      if (!map.getLayer('gelaende-schatten')) map.addLayer({ id: 'gelaende-schatten', type: 'hillshade', source: 'gelaende', paint: {} }, vor || undefined);
      map.setPaintProperty('gelaende-schatten', 'hillshade-exaggeration', 0.75);
      map.setPaintProperty('gelaende-schatten', 'hillshade-shadow-color', hell ? '#5a5040' : '#000000');
      map.setPaintProperty('gelaende-schatten', 'hillshade-highlight-color', hell ? '#ffffff' : '#b8c7b0');
      map.setPaintProperty('gelaende-schatten', 'hillshade-accent-color', hell ? '#7a6a50' : '#0a140c');
      try { map.setTerrain({ source: 'gelaende-3d', exaggeration: 1.5 }); } catch (e) {}
    } catch (e) { console.error(e); }
  }
  K.gelaende = function (schraeg) {
    K.wenn(function () {
      gelaende();
      var an = !!(FV.app && FV.app.e && FV.app.e.gelaende);
      if (schraeg && !(FV.F && FV.F.aktiv)) K.map.easeTo({ pitch: an ? 55 : 0, duration: 700 });
    });
  };

  /* ---------- Karte anlegen / in eine Seite setzen ---------- */
  K.setzen = function (ziel) {
    if (!feld) { feld = document.createElement('div'); feld.id = 'karte'; }
    if (feld.parentNode !== ziel) ziel.insertBefore(feld, ziel.firstChild);
    if (K.map) { setTimeout(function () { if (K.map) K.map.resize(); }, 30); return Promise.resolve(K.map); }
    if (K._start) return K._start;
    if (!window.maplibregl) return Promise.reject(new Error('Karte nicht geladen'));
    K._start = stilHolen().then(function (stil) {
      var o = B.ort(), mitte = o ? [o.lon, o.lat] : [7.70, 53.20];
      var map = K.map = new maplibregl.Map({ container: feld, style: stil, center: mitte, zoom: o ? 13 : 9.5, attributionControl: false, maxPitch: 60, dragRotate: false, pitchWithRotate: false, fadeDuration: 0 });
      try { map.touchZoomRotate.disableRotation(); } catch (e) {}
      map.on('error', function (e) { if (window.FV_TEST) (FV_TEST.kartenfehler = FV_TEST.kartenfehler || []).push(String(e && e.error && e.error.message || e)); });
      ['dragstart', 'zoomstart'].forEach(function (ev) { map.on(ev, function (e) { if (e && e.originalEvent && beiGeste) beiGeste(); }); });
      return new Promise(function (ok) {
        var fertig = false;
        function los() {
          if (fertig) return; fertig = true;
          ebenen(); bilder(); gelaende(); liveEbenen(); K.bereit = true; warte.splice(0).forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
          ok(map);
        }
        map.on('load', los); setTimeout(los, 6000);
      });
    });
    return K._start;
  };
  K.wenn = function (f) { if (K.bereit) f(); else warte.push(f); };
  K.beiGeste = function (f) { beiGeste = f; };
  K.stilArt = function () { return stilArt; };
  function ebenen() {
    var map = K.map, vor;
    try { var ls = map.getStyle().layers; for (var i = 0; i < ls.length; i++) if (ls[i].type === 'symbol') { vor = ls[i].id; break; } } catch (e) {}
    var leer = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };
    if (!map.getSource('route')) map.addSource('route', { type: 'geojson', data: leer });
    if (!map.getSource('gefahren')) map.addSource('gefahren', { type: 'geojson', data: leer });
    var rund = { 'line-cap': 'round', 'line-join': 'round' };
    function eb(id, quelle, farbe, breite) {
      if (map.getLayer(id)) return;
      map.addLayer({ id: id, type: 'line', source: quelle, layout: rund, paint: { 'line-color': farbe, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, breite * 0.55, 13, breite, 17, breite * 1.9] } }, vor);
    }
    eb('route-rand', 'route', '#0a3f96', 9); eb('route', 'route', '#2b93ff', 6); eb('gefahren', 'gefahren', '#7f8a96', 6);
    if (!map.getSource('verkehr')) map.addSource('verkehr', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    // Hamburger S-/U-Bahn-Netz: farbige Linien unter der Route
    if (!map.getSource('netz')) map.addSource('netz', { type: 'geojson', data: netzDaten || { type: 'FeatureCollection', features: [] } });
    if (!map.getLayer('netz-rand')) map.addLayer({ id: 'netz-rand', type: 'line', source: 'netz', layout: rund, paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 13, 5, 16, 8] } }, map.getLayer('route-rand') ? 'route-rand' : vor);
    if (!map.getLayer('netz')) map.addLayer({ id: 'netz', type: 'line', source: 'netz', layout: rund, paint: { 'line-color': ['get', 'farbe'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.6, 13, 3.4, 16, 6] } }, map.getLayer('route-rand') ? 'route-rand' : vor);
    if (!map.getLayer('verkehr')) map.addLayer({ id: 'verkehr', type: 'line', source: 'verkehr', layout: rund, paint: { 'line-color': ['get', 'farbe'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 13, 7, 17, 12], 'line-opacity': 0.95 } }, vor);
    strecken(map.getLayer('netz-rand') ? 'netz-rand' : map.getLayer('route-rand') ? 'route-rand' : vor);
  }

  /* ---------- Bahnstrecken, Schiffs-/Fährstrecken (aus den Kartendaten) und Flugstrecken ----------
   * Bahn: OpenMapTiles „transportation“ class rail/transit, als Gleis gezeichnet (Linie mit hellen Querstrichen).
   * Schiff: class ferry, blau gestrichelt, mit Namen der Linie. Gilt für jede Kartenquelle (online, Deutschland, Spanien, Welt).
   * Flug: eigene Quelle mit Großkreisen (Flugtafel eines Flughafens, Live-Flugzeug). */
  var SFARBE = { nacht: { bahn: '#c3c9d2', bahnKern: '#3b4048', see: '#4fb3ff', seeText: '#9fd6ff', flug: '#c9a6ff', flugAkt: '#ffd36b', halo: 'rgba(0,0,0,.85)' },
                 tag: { bahn: '#4d535c', bahnKern: '#ffffff', see: '#1a7fd1', seeText: '#145a96', flug: '#7a3fd0', flugAkt: '#d9480f', halo: 'rgba(255,255,255,.95)' } };
  function vektorQuellen(map) {
    var st = map.getStyle(), l = [];
    Object.keys(st.sources || {}).forEach(function (k) { if (st.sources[k].type === 'vector') l.push(k); });
    return l;
  }
  function schrift(map) {
    try { var ls = map.getStyle().layers; for (var i = 0; i < ls.length; i++) { var f = ls[i].layout && ls[i].layout['text-font']; if (Array.isArray(f) && typeof f[0] === 'string') return f; } } catch (e) {}
    return null;
  }
  function strecken(vor) {
    var map = K.map, f = K.hell() ? SFARBE.tag : SFARBE.nacht, e = (FV.app && FV.app.e) || {};
    var rund = { 'line-cap': 'round', 'line-join': 'round' }, glyphen = !!map.getStyle().glyphs, font = schrift(map);
    var bahnFilter = ['all', ['match', ['get', 'class'], ['rail', 'transit'], true, false], ['!=', ['get', 'brunnel'], 'tunnel']];
    var seeFilter = ['==', ['get', 'class'], 'ferry'];
    vektorQuellen(map).forEach(function (q) {
      var sicht = function (k) { return { visibility: e[k] === false ? 'none' : 'visible' }; };
      if (!map.getLayer('bahn-' + q)) map.addLayer({ id: 'bahn-' + q, type: 'line', source: q, 'source-layer': 'transportation', filter: bahnFilter, minzoom: 5,
        layout: Object.assign({ 'line-join': 'round' }, sicht('bahnnetz')), paint: { 'line-color': f.bahn, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 9, 1.8, 13, 3.4, 17, 6] } }, vor);
      if (!map.getLayer('bahn-kern-' + q)) map.addLayer({ id: 'bahn-kern-' + q, type: 'line', source: q, 'source-layer': 'transportation', filter: bahnFilter, minzoom: 9,
        layout: Object.assign({ 'line-join': 'round' }, sicht('bahnnetz')), paint: { 'line-color': f.bahnKern, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 13, 1.6, 17, 3], 'line-dasharray': [2, 2.5] } }, vor);
      if (!map.getLayer('see-' + q)) map.addLayer({ id: 'see-' + q, type: 'line', source: q, 'source-layer': 'transportation', filter: seeFilter,
        layout: Object.assign({}, rund, sicht('seewege')), paint: { 'line-color': f.see, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 9, 2.2, 14, 3.5], 'line-dasharray': [2, 1.6], 'line-opacity': 0.95 } }, vor);
      if (glyphen && font && !map.getLayer('see-name-' + q)) map.addLayer({ id: 'see-name-' + q, type: 'symbol', source: q, 'source-layer': 'transportation_name', filter: seeFilter, minzoom: 8,
        layout: Object.assign({ 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']], 'text-font': font, 'text-size': 12, 'text-max-angle': 30, 'symbol-spacing': 300 }, sicht('seewege')),
        paint: { 'text-color': f.seeText, 'text-halo-color': f.halo, 'text-halo-width': 1.6 } });
    });
    var leer = { type: 'FeatureCollection', features: [] };
    if (!map.getSource('flug-strecken')) map.addSource('flug-strecken', { type: 'geojson', data: flugDaten || leer });
    if (!map.getLayer('flug-linie')) map.addLayer({ id: 'flug-linie', type: 'line', source: 'flug-strecken', layout: Object.assign({}, rund, { visibility: e.flugrouten === false ? 'none' : 'visible' }),
      paint: { 'line-color': ['case', ['==', ['get', 'akt'], true], f.flugAkt, f.flug], 'line-width': ['case', ['==', ['get', 'akt'], true], 3.2, ['interpolate', ['linear'], ['get', 'n'], 1, 1.4, 6, 2.6, 20, 4]],
        'line-opacity': 0.9, 'line-dasharray': [3, 1.5] } });
  }
  var flugDaten = null;
  /** Farben der Zusatz-Ebenen nach Tag/Nacht */
  function zusatzFarben() {
    var map = K.map, f = K.hell() ? SFARBE.tag : SFARBE.nacht;
    vektorQuellen(map).forEach(function (q) {
      try { map.setPaintProperty('bahn-' + q, 'line-color', f.bahn); map.setPaintProperty('bahn-kern-' + q, 'line-color', f.bahnKern); map.setPaintProperty('see-' + q, 'line-color', f.see); } catch (e) {}
      try { map.setPaintProperty('see-name-' + q, 'text-color', f.seeText); map.setPaintProperty('see-name-' + q, 'text-halo-color', f.halo); } catch (e) {}
    });
    try { map.setPaintProperty('flug-linie', 'line-color', ['case', ['==', ['get', 'akt'], true], f.flugAkt, f.flug]); } catch (e) {}
  }
  /** Schalter Bahnstrecken / Schiffsstrecken / Flugstrecken übernehmen */
  K.streckenNeu = function () {
    if (!K.map || !K.bereit) return;
    var e = (FV.app && FV.app.e) || {}, map = K.map;
    vektorQuellen(map).forEach(function (q) {
      ['bahn-', 'bahn-kern-'].forEach(function (v) { if (map.getLayer(v + q)) map.setLayoutProperty(v + q, 'visibility', e.bahnnetz === false ? 'none' : 'visible'); });
      ['see-', 'see-name-'].forEach(function (v) { if (map.getLayer(v + q)) map.setLayoutProperty(v + q, 'visibility', e.seewege === false ? 'none' : 'visible'); });
    });
    if (map.getLayer('flug-linie')) map.setLayoutProperty('flug-linie', 'visibility', e.flugrouten === false ? 'none' : 'visible');
  };
  /** Großkreis zwischen zwei Punkten als [[lon,lat], …] – über die Datumsgrenze ohne Sprung */
  K.grosskreis = function (a, b, n) {
    var r = Math.PI / 180, p1 = a.lat * r, l1 = a.lon * r, p2 = b.lat * r, l2 = b.lon * r; n = n || 64;
    var d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((p2 - p1) / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin((l2 - l1) / 2), 2)));
    if (!(d > 1e-6)) return [[a.lon, a.lat], [b.lon, b.lat]];
    var pk = [], vorher = null;
    for (var i = 0; i <= n; i++) {
      var t = i / n, A1 = Math.sin((1 - t) * d) / Math.sin(d), B1 = Math.sin(t * d) / Math.sin(d);
      var x = A1 * Math.cos(p1) * Math.cos(l1) + B1 * Math.cos(p2) * Math.cos(l2), y = A1 * Math.cos(p1) * Math.sin(l1) + B1 * Math.cos(p2) * Math.sin(l2), z = A1 * Math.sin(p1) + B1 * Math.sin(p2);
      var lon = Math.atan2(y, x) / r, lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / r;
      if (vorher != null) { while (lon - vorher > 180) lon -= 360; while (lon - vorher < -180) lon += 360; }
      vorher = lon; pk.push([lon, lat]);
    }
    return pk;
  };
  /** Flugstrecken zeichnen: liste = [{ von:{lat,lon}, nach:{lat,lon}, n: Anzahl Flüge, akt: hervorgehoben }] oder null */
  K.flugstrecken = function (liste) {
    flugDaten = { type: 'FeatureCollection', features: (liste || []).map(function (s) {
      return { type: 'Feature', geometry: { type: 'LineString', coordinates: K.grosskreis(s.von, s.nach) }, properties: { n: s.n || 1, akt: !!s.akt } };
    }) };
    K.wenn(function () { var q = K.map.getSource('flug-strecken'); if (q) q.setData(flugDaten); });
  };
  /** Live-Flugzeuge als Marken: [{ id, lat, lon, kurs, name, boden, akt }] – nur das Flugzeug dreht sich, der Name bleibt lesbar */
  var fzMarken = {}, fzDreher = null;
  var FLUGZEUG = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>';
  function fzDrehen() {
    var b = K.map ? K.map.getBearing() : 0;
    Object.keys(fzMarken).forEach(function (k) { var e = fzMarken[k].getElement(), f = e._fz, s = e.firstChild; if (f && s) s.style.transform = 'rotate(' + Math.round((f.kurs || 0) - b) + 'deg)'; });
  }
  K.flugzeuge = function (liste, beiTipp) {
    var neu = {};
    if (K.map) {
      if (fzDreher !== K.map) { fzDreher = K.map; K.map.on('rotate', fzDrehen); }
      (liste || []).forEach(function (f) {
        var m = fzMarken[f.id];
        if (!m) {
          var e = el(FLUGZEUG + '<span>' + FV.esc(f.name || '') + '</span>', 'm-flugzeug' + (f.boden ? ' boden' : ''));
          e.addEventListener('click', function (ev) { ev.stopPropagation(); if (beiTipp) beiTipp(e._fz); });
          m = new maplibregl.Marker({ element: e, anchor: 'center' }).setLngLat([f.lon, f.lat]).addTo(K.map);
        } else m.setLngLat([f.lon, f.lat]);
        m.getElement()._fz = f; m.getElement().classList.toggle('akt', !!f.akt);
        neu[f.id] = m;
      });
    }
    Object.keys(fzMarken).forEach(function (k) { if (!neu[k]) fzMarken[k].remove(); });
    fzMarken = neu; fzDrehen();
  };

  /* ---------- Züge und Schiffe live: Symbole mit Kennung, antippbar ----------
   * Quelle „live“: Punkte mit { art: zug|fern|sbahn|bus|tram|faehre|schiff, farbe, kurs (Grad oder -1), name, id } */
  var liveTipp = null, liveGehoert = null, liveDaten = { type: 'FeatureCollection', features: [] };
  /* Symbole für Züge, Busse, Straßenbahnen und Schiffe: runde Plakette in der Farbe der Linie bzw. des Schiffstyps mit
   * weißem Bild (Zug, Bus, Bahn, Schiff) – das Bild steht immer aufrecht. Fährt das Fahrzeug, zeigt ein kleiner Pfeil am Rand die Richtung. */
  var SYM_DATEN = {};
  function symPfade(name) {
    if (SYM_DATEN[name]) return SYM_DATEN[name];
    var l = [], m, re = /\sd="([^"]+)"/g, t = (FV.SYMBOLE && FV.SYMBOLE[name]) || '';
    while ((m = re.exec(t))) { try { l.push(new Path2D(m[1])); } catch (e) {} }
    return (SYM_DATEN[name] = l);
  }
  function hellFarbe(f) { var c = /^#?([0-9a-f]{6})$/i.exec(f || ''); if (!c) return false; var n = parseInt(c[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 175; }
  function leinwand(groesse) { var r = window.devicePixelRatio > 1 ? 2 : 1, c = document.createElement('canvas'); c.width = c.height = groesse * r; return { c: c, g: c.getContext('2d'), r: r, n: groesse * r }; }
  function alsBild(l) { var d = l.g.getImageData(0, 0, l.n, l.n); return { bild: { width: l.n, height: l.n, data: new Uint8Array(d.data.buffer) }, r: l.r }; }
  var PLAKETTE = 34, PFEILFELD = 54;
  function plakette(sym, farbe) {
    var l = leinwand(PLAKETTE), g = l.g, n = l.n, m = n / 2, rand = K.hell() ? '#ffffff' : '#05080b';
    g.beginPath(); g.arc(m, m, n * 0.42, 0, Math.PI * 2); g.fillStyle = farbe; g.fill();
    g.lineWidth = 2 * l.r; g.strokeStyle = rand; g.stroke();
    var pf = symPfade(sym), gr = n * 0.56 / 24;
    g.save(); g.translate(m - 12 * gr, m - 12 * gr); g.scale(gr, gr);
    g.fillStyle = hellFarbe(farbe) ? '#0b0f15' : '#ffffff';
    pf.forEach(function (p) { g.fill(p); });
    g.restore();
    return alsBild(l);
  }
  function pfeil(farbe) {
    var l = leinwand(PFEILFELD), g = l.g, n = l.n, m = n / 2, r = l.r;
    g.beginPath(); g.moveTo(m, 1.5 * r); g.lineTo(m + 8 * r, 12.5 * r); g.lineTo(m - 8 * r, 12.5 * r); g.closePath();
    g.fillStyle = farbe; g.fill(); g.lineWidth = 1.6 * r; g.strokeStyle = K.hell() ? '#ffffff' : '#05080b'; g.stroke();
    return alsBild(l);
  }
  function bild(art, sym, farbe) {
    var id = 'fv-' + art + '-' + sym + '-' + farbe + (K.hell() ? '-h' : '');
    if (K.map && !K.map.hasImage(id)) { try { var b = art === 'pfeil' ? pfeil(farbe) : plakette(sym, farbe); K.map.addImage(id, b.bild, { pixelRatio: b.r }); } catch (e) {} }
    return id;
  }
  function bilder() {}
  function liveEbenen() {
    var map = K.map; if (!map) return;
    var hell = K.hell(), glyphen = !!map.getStyle().glyphs, font = schrift(map);
    if (!map.getSource('live')) map.addSource('live', { type: 'geojson', data: liveDaten });
    var groesse = ['interpolate', ['linear'], ['zoom'], 5, 0.62, 9, 0.85, 13, 1.1];
    if (!map.getLayer('live-richtung')) map.addLayer({ id: 'live-richtung', type: 'symbol', source: 'live', filter: ['==', ['get', 'hatKurs'], true],
      layout: { 'icon-image': ['get', 'pfeil'], 'icon-size': groesse, 'icon-rotate': ['get', 'dreh'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['get', 'rang'] }, paint: {} });
    if (!map.getLayer('live-symbol')) map.addLayer({ id: 'live-symbol', type: 'symbol', source: 'live',
      layout: { 'icon-image': ['get', 'bild'], 'icon-size': groesse, 'icon-rotation-alignment': 'viewport',
        'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['get', 'rang'] },
      paint: {} });
    if (glyphen && font && !map.getLayer('live-name')) map.addLayer({ id: 'live-name', type: 'symbol', source: 'live', minzoom: 8.5,
      layout: { 'text-field': ['get', 'name'], 'text-font': font, 'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 14, 12.5], 'text-offset': [0, 1.15], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 12 },
      paint: { 'text-color': ['get', 'farbe'], 'text-halo-color': hell ? 'rgba(255,255,255,.95)' : 'rgba(0,0,0,.9)', 'text-halo-width': 1.6 } });
    if (liveGehoert !== map) {
      liveGehoert = map;
      ['live-symbol', 'live-name'].forEach(function (id) {
        map.on('click', id, function (ev) { var f = ev.features && ev.features[0]; if (f && liveTipp) { ev.originalEvent && ev.originalEvent.stopPropagation && ev.originalEvent.stopPropagation(); liveTipp(f.properties.typ, f.properties.id); } });
        map.on('mouseenter', id, function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, function () { map.getCanvas().style.cursor = ''; });
      });
    }
  }
  function liveFarben() {
    var map = K.map, hell = K.hell(); if (!map) return;
    K.live(liveListe);   // Symbole mit passendem Rand neu
    try { map.setPaintProperty('live-name', 'text-halo-color', hell ? 'rgba(255,255,255,.95)' : 'rgba(0,0,0,.9)'); } catch (e) {}
  }
  /** Live-Punkte setzen. liste = [{ typ: 'zug'|'schiff', id, lat, lon, kurs, art, farbe, name, rang }] · beiTipp(typ, id) */
  var liveListe = [];
  K.live = function (liste, beiTipp) {
    if (beiTipp) liveTipp = beiTipp;
    liveListe = liste || [];
    K.wenn(function () {
      liveDaten = { type: 'FeatureCollection', features: liveListe.map(function (x) {
        var kurs = x.kurs != null && x.kurs >= 0 ? x.kurs : null, farbe = x.farbe || '#1b9fc6', sym = x.sym || (x.typ === 'schiff' || x.typ === 'faehre' ? 'schiff' : 'zug');
        return { type: 'Feature', geometry: { type: 'Point', coordinates: [x.lon, x.lat] },
          properties: { typ: x.typ, id: String(x.id), name: x.name || '', farbe: farbe, dreh: kurs == null ? 0 : kurs, hatKurs: kurs != null, rang: x.rang || 0,
            bild: bild('plakette', sym, farbe), pfeil: kurs == null ? '' : bild('pfeil', '', farbe) } };
      }) };
      var q = K.map.getSource('live'); if (q) q.setData(liveDaten);
    });
  };
  K.sichtbar = function () { return !!(K.map && K.map.getContainer && K.map.getContainer().isConnected); };

  /* ---------- Marken ---------- */
  function el(html, klasse) { var d = document.createElement('div'); if (klasse) d.className = klasse; d.innerHTML = html; return d; }
  var PIN = '<svg viewBox="0 0 34 44" width="34" height="44"><path d="M17 1C8.2 1 1 8 1 16.8 1 28.5 17 43 17 43s16-14.5 16-26.2C33 8 25.8 1 17 1z" fill="#e2231a" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16.5" r="5.5" fill="#5a0b08"/></svg>';
  var AUTO = '<svg viewBox="0 0 44 60" width="44" height="60"><ellipse cx="22" cy="31" rx="19" ry="27" fill="#1a73e8" opacity=".28"/>' +
    '<path d="M11 14c0-6 4-9 11-9s11 3 11 9v32c0 5-4 8-11 8s-11-3-11-8z" fill="#ffffff" stroke="#1a56c4" stroke-width="2.2"/>' +
    '<path d="M13.5 22c0-2 3.5-4 8.500-4s8.500 2 8.500 4l-1.800 6h-13.400z" fill="#14315e"/><path d="M15 42h14l1.200 5c0 2-3 3-8.200 3s-8.200-1-8.200-3z" fill="#14315e"/>' +
    '<rect x="13.300" y="29.500" width="2" height="11" rx="1" fill="#14315e"/><rect x="28.700" y="29.500" width="2" height="11" rx="1" fill="#14315e"/>' +
    '<rect x="13" y="7.500" width="5" height="2.600" rx="1.300" fill="#ffd95a"/><rect x="26" y="7.500" width="5" height="2.600" rx="1.300" fill="#ffd95a"/></svg>';
  function marke(name, lon, lat, element, opt) {
    if (marken[name]) { marken[name].remove(); delete marken[name]; }
    if (lon == null || !K.map) return null;
    var o = Object.assign({ element: element }, opt || {});
    marken[name] = new maplibregl.Marker(o).setLngLat([lon, lat]).addTo(K.map);
    return marken[name];
  }
  K.hat = function (name) { return !!marken[name]; };
  K.ziel = function (z, schild, links) {
    marke('ziel', z && z.lon, z && z.lat, el(PIN, 'm-ziel'), { anchor: 'bottom' });
    marke('zielschild', z && schild ? z.lon : null, z && z.lat, el(schild || '', 'm-schild'), { anchor: links ? 'right' : 'left', offset: [links ? -22 : 22, -30] });
  };
  K.start = function (p, schild, links) {
    marke('start', p && p.lon, p && p.lat, el('', 'm-start'), { anchor: 'center' });
    marke('startschild', p && schild ? p.lon : null, p && p.lat, el(schild || '', 'm-schild'), { anchor: links ? 'right' : 'left', offset: [links ? -18 : 18, 0] });
  };
  var TRANSPORTER = '<svg viewBox="0 0 44 66" width="44" height="66"><ellipse cx="22" cy="34" rx="20" ry="31" fill="#1a73e8" opacity=".28"/>' +
    '<rect x="6.5" y="15.5" width="4.5" height="3.2" rx="1.2" fill="#1a56c4"/><rect x="33" y="15.5" width="4.5" height="3.2" rx="1.2" fill="#1a56c4"/>' +
    '<path d="M10 13c0-6.5 4.5-10 12-10s12 3.5 12 10v46c0 3-2 5-5 5H15c-3 0-5-2-5-5z" fill="#ffffff" stroke="#1a56c4" stroke-width="2.2"/>' +
    '<path d="M12.6 17.5c0-2.2 4-3.8 9.4-3.8s9.4 1.6 9.4 3.8l-1.4 5.3H14z" fill="#14315e"/>' +
    '<path d="M11 26.5h22" stroke="#8d99ab" stroke-width="1.8"/><path d="M14 33.5h16M14 40.5h16M14 47.5h16M14 54.5h16" stroke="#cfd6e0" stroke-width="1.5" stroke-linecap="round"/>' +
    '<rect x="12.8" y="6.3" width="5" height="2.6" rx="1.3" fill="#ffd95a"/><rect x="26.2" y="6.3" width="5" height="2.6" rx="1.3" fill="#ffd95a"/>' +
    '<rect x="12" y="60.6" width="4.5" height="2" rx="1" fill="#e2231a"/><rect x="27.5" y="60.6" width="4.5" height="2" rx="1" fill="#e2231a"/></svg>';
  /** Ist als Fahrzeug ein Transporter gewählt? (Name des Fahrzeugs bzw. Einstellung PKW/Transporter) */
  K.istTransporter = function () {
    var e = (FV.app && FV.app.e) || {};
    if (e.kmArt === 'transporter') return true;
    if (e.kmArt === 'pkw') return false;
    return /transporter|sprinter|crafter|ducato|transit|movano|master|boxer|jumper|vito|kasten|lkw|daily|trafic|vivaro|jumpy|expert|proace/i.test(e.fahrzeugName || '');
  };
  var PFEIL = '<svg viewBox="0 0 44 44" width="40" height="40"><circle cx="22" cy="22" r="20" fill="#1a73e8" opacity=".25"/><circle cx="22" cy="22" r="13" fill="#fff" stroke="#1a56c4" stroke-width="2"/><path d="M22 12l7 17-7-4-7 4z" fill="#1a56c4"/></svg>';
  var autoArt = '';
  K.auto = function (p, kurs) {
    if (!p) { marke('auto'); autoArt = ''; return; }
    var art = FV.F && FV.F.aktiv && FV.F.modus && FV.F.modus() !== 'auto' ? 'pfeil' : K.istTransporter() ? 'transporter' : 'auto';
    if (marken.auto && art !== autoArt) marke('auto');
    autoArt = art;
    if (marken.auto) { marken.auto.setLngLat([p.lon, p.lat]); marken.auto.setRotation(kurs || 0); return; }
    var m = marke('auto', p.lon, p.lat, el(art === 'pfeil' ? PFEIL : art === 'transporter' ? TRANSPORTER : AUTO, 'm-auto'), { anchor: 'center', rotationAlignment: 'map', pitchAlignment: 'viewport' });
    if (m) m.setRotation(kurs || 0);
  };
  K.pois = function (liste, beiTipp) {
    poiMarken.forEach(function (m) { m.remove(); }); poiMarken = [];
    if (!K.map) return;
    (liste || []).forEach(function (p) {
      var e = el(FV.sym({ laden: 'laden', tanken: 'tanken', essen: 'kaffee' }[p.art] || 'wc'), 'm-poi ' + p.art);
      e.addEventListener('click', function (ev) { ev.stopPropagation(); if (beiTipp) beiTipp(p); });
      poiMarken.push(new maplibregl.Marker({ element: e, anchor: 'center' }).setLngLat([p.lon, p.lat]).addTo(K.map));
    });
  };
  /** Verkehrsmeldungen: farbige Strecke (rot = gesperrt/Stau, orange = stockend, gelb = Baustelle) und Warnzeichen */
  var V_FARBE = { sperrung: '#e2231a', unfall: '#e2231a', stau: '#ff5a1f', gefahr: '#ffb020', baustelle: '#f2c230' };
  K.verkehr = function (liste, beiTipp) {
    verkehrMarken.forEach(function (m) { m.remove(); }); verkehrMarken = [];
    if (!K.map) return;
    var feats = [];
    (liste || []).forEach(function (m) {
      var k = FV.V ? FV.V.klasse(m) : 'gefahr', farbe = V_FARBE[k] || V_FARBE.gefahr;
      if (m.punkte && m.punkte.length > 1) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: m.punkte }, properties: { farbe: farbe } });
      var e = el(FV.sym(k === 'baustelle' ? 'baustelle' : 'warnung'), 'm-verkehr ' + k);
      e.addEventListener('click', function (ev) { ev.stopPropagation(); if (beiTipp) beiTipp(m); });
      verkehrMarken.push(new maplibregl.Marker({ element: e, anchor: 'center' }).setLngLat([m.lon, m.lat]).addTo(K.map));
    });
    K.wenn(function () { var q = K.map.getSource('verkehr'); if (q) q.setData({ type: 'FeatureCollection', features: feats }); });
  };
  /** Bahnhöfe: blaues Zugzeichen mit Namen */
  K.bahnhoefe = function (liste, beiTipp) {
    bahnMarken.forEach(function (m) { m.remove(); }); bahnMarken = [];
    if (!K.map) return;
    (liste || []).forEach(function (b) {
      var e = el(FV.sym('zug') + '<span>' + FV.esc(b.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()) + '</span>', 'm-bahnhof');
      e.addEventListener('click', function (ev) { ev.stopPropagation(); if (beiTipp) beiTipp(b); });
      bahnMarken.push(new maplibregl.Marker({ element: e, anchor: 'left', offset: [-13, 0] }).setLngLat([b.lon, b.lat]).addTo(K.map));
    });
  };
  /** Apotheken: rotes Kreuz, Notdienst grün mit Schild „Notdienst“ */
  K.apotheken = function (liste, beiTipp) {
    apoMarken.forEach(function (m) { m.remove(); }); apoMarken = [];
    if (!K.map) return;
    (liste || []).forEach(function (a) {
      var e = el(FV.sym('apotheke') + (a.notdienst ? '<span>Notdienst</span>' : ''), 'm-apo' + (a.notdienst ? ' notd' : ''));
      e.addEventListener('click', function (ev) { ev.stopPropagation(); if (beiTipp) beiTipp(a); });
      apoMarken.push(new maplibregl.Marker({ element: e, anchor: 'left', offset: [-12, 0] }).setLngLat([a.lon, a.lat]).addTo(K.map));
    });
  };
  function markenSetzen(arr, liste, bau, beiTipp) {
    arr.forEach(function (m) { m.remove(); }); arr.length = 0;
    if (!K.map) return;
    (liste || []).forEach(function (x) {
      var e = bau(x); e.addEventListener('click', function (ev) { ev.stopPropagation(); if (beiTipp) beiTipp(x); });
      arr.push(new maplibregl.Marker({ element: e, anchor: 'left', offset: [-12, 0] }).setLngLat([x.lon, x.lat]).addTo(K.map));
    });
  }
  /** Ärzte: blaues Kreuz; Notaufnahme/Bereitschaftspraxis rot mit Schild */
  K.aerzte = function (liste, beiTipp) {
    markenSetzen(arztMarken, liste, function (a) {
      var nd = a.art !== 'arzt';
      return el(FV.sym('arzt') + (nd ? '<span>' + (a.art === 'bereitschaft' ? 'Bereitschaft' : 'Notaufnahme') + '</span>' : ''), 'm-arzt' + (nd ? ' notd' : ''));
    }, beiTipp);
  };
  /** Flughäfen: Flugzeug mit Kürzel */
  K.flughaefen = function (liste, beiTipp) {
    markenSetzen(flugMarken, liste, function (f) { return el(FV.sym('flug') + '<span>' + FV.esc(f.iata) + '</span>', 'm-flug'); }, beiTipp);
  };
  /** Bushaltestellen: kleines lila Bus-Schild (Name ab Zoom 15) · U-/S-Bahn: grünes S bzw. blaues U mit Namen */
  K.haltestellen = function (art, liste, beiTipp) {
    markenSetzen(art === 'bus' ? busMarken : stadtMarken, liste, function (b) {
      var name = FV.esc(String(b.name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim());
      if (art === 'bus') return el(FV.sym('bus') + '<span>' + name + '</span>', 'm-bus');
      return el((b.sbahn ? '<b class="hs s">S</b>' : '') + (b.ubahn ? '<b class="hs u">U</b>' : '') + (!b.sbahn && !b.ubahn ? '<b class="hs s">S</b>' : '') + '<span>' + name + '</span>', 'm-stadt');
    }, beiTipp);
    zoomKlasse();
  };
  /** Namen der Bushaltestellen erst ab Zoom 15 zeigen, sonst wird die Karte unlesbar */
  var zoomHoerer = false;
  function zoomKlasse() {
    if (!K.map) return;
    var f = K.map.getContainer && K.map.getContainer(); if (f) f.classList.toggle('nah15', K.map.getZoom() >= 15);
    if (!zoomHoerer || zoomHoerer !== K.map) { zoomHoerer = K.map; K.map.on('zoom', function () { var c = K.map.getContainer(); if (c) c.classList.toggle('nah15', K.map.getZoom() >= 15); }); }
  }
  /** Hamburger S-/U-Bahn-Netz: netz = Ergebnis von V.hhNetz() oder null; Linienschilder antippbar */
  K.netz = function (netz, beiTipp) {
    netzMarken.forEach(function (m) { m.remove(); }); netzMarken = [];
    var feats = [];
    (netz && netz.linien || []).forEach(function (l) {
      feats.push({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: l.wege }, properties: { farbe: l.farbe, ref: l.ref } });
    });
    netzDaten = { type: 'FeatureCollection', features: feats };
    K.wenn(function () {
      var q = K.map.getSource('netz'); if (q) q.setData(netzDaten);
      // je Linie ein Schild an einem Punkt in der Mitte des längsten Abschnitts (Schilder verschieben sich gegeneinander, damit sie sich nicht verdecken)
      (netz && netz.linien || []).forEach(function (l, i) {
        var lang = l.wege.reduce(function (m, w) { return w.length > m.length ? w : m; }, []); if (!lang.length) return;
        var pt = lang[Math.floor(lang.length * (0.25 + (i % 4) * 0.15))] || lang[0];
        var e = el('<b>' + FV.esc(l.ref) + '</b>', 'm-linie ' + (l.art === 'ubahn' ? 'u' : 's'));
        e.style.background = l.farbe; if (l.ref === 'U3') e.style.color = '#1b1b1b';
        e.addEventListener('click', function (ev) { ev.stopPropagation(); if (beiTipp) beiTipp(l); });
        netzMarken.push(new maplibregl.Marker({ element: e, anchor: 'center' }).setLngLat(pt).addTo(K.map));
      });
    });
  };
  K.nummern = function (liste, beiTipp) {
    extraMarken.forEach(function (m) { m.remove(); }); extraMarken = [];
    if (!K.map) return;
    (liste || []).forEach(function (p) {
      var e = el(String(p.nr), 'm-nr');
      e.addEventListener('click', function (ev) { ev.stopPropagation(); if (beiTipp) beiTipp(p); });
      extraMarken.push(new maplibregl.Marker({ element: e, anchor: 'center' }).setLngLat([p.lon, p.lat]).addTo(K.map));
    });
  };

  /* ---------- Route zeichnen, Kamera ---------- */
  function linie(punkte) { return { type: 'Feature', geometry: { type: 'LineString', coordinates: punkte || [] }, properties: {} }; }
  K.route = function (r) { K.wenn(function () { var s = K.map.getSource('route'); if (s) s.setData(linie(r ? r.punkte : [])); var g = K.map.getSource('gefahren'); if (g) g.setData(linie([])); }); };
  K.gefahren = function (r, s) {
    if (!K.bereit) return;
    var g = K.map.getSource('gefahren'); if (!g) return;
    g.setData(linie(s ? r.punkte.slice(0, s.idx + 1).concat([[s.lon, s.lat]]) : []));
  };
  K.rahmen = function (punkte, rand) {
    K.wenn(function () {
      if (!punkte || !punkte.length) return;
      var g = G.grenzen(punkte);
      if (punkte.length === 1 || (g[0][0] === g[1][0] && g[0][1] === g[1][1])) { K.map.easeTo({ center: punkte[0], zoom: 14, bearing: 0, pitch: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 500 }); return; }
      K.map.fitBounds(g, { padding: rand || { top: 60, bottom: 40, left: 40, right: 60 }, bearing: 0, pitch: 0, duration: 600, maxZoom: 16 });
    });
  };
  /** Kamera sitzt fest am Auto: Auto im unteren Drittel, Karte in Fahrtrichtung gedreht */
  K.folgen = function (p, kurs, zoom, sofort) {
    if (!K.bereit) return;
    var h = K.map.getContainer().clientHeight || 400;
    var o = { center: [p.lon, p.lat], bearing: kurs || 0, zoom: zoom, pitch: 48, padding: { top: Math.round(h * 0.42), bottom: 0, left: 0, right: 0 }, duration: sofort ? 0 : 950, easing: function (t) { return t; } };
    if (sofort) K.map.jumpTo(o); else K.map.easeTo(o);
  };
  K.mitte = function (p, zoom) { K.wenn(function () { K.map.easeTo({ center: [p.lon, p.lat], zoom: zoom || Math.max(K.map.getZoom(), 14), bearing: 0, pitch: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 500 }); }); };
  K.zoom = function (d) { if (K.bereit) { if (d > 0) K.map.zoomIn(); else K.map.zoomOut(); } };

  /* ---------- Kartenteile entlang der Route vorladen (bleiben im Zwischenspeicher, auch bei kurzem Funkloch) ---------- */
  K.vorladen = function (r) {
    if (!K.bereit || stilArt !== 'vektor') return;
    var muster = null;
    try { var qs = K.map.getStyle().sources; Object.keys(qs).forEach(function (k) { var q = K.map.getSource(k); if (!muster && q && q.type === 'vector' && q.tiles && q.tiles[0]) muster = q.tiles[0]; }); } catch (e) {}
    if (!muster) return;
    var z = 14, n = Math.pow(2, z), set = {}, liste = [];
    for (var w = 0; w <= r.laenge; w += 400) {
      var p = G.punktBei(r, w), x = Math.floor((p.lon + 180) / 360 * n);
      var y = Math.floor((1 - Math.log(Math.tan(p.lat * Math.PI / 180) + 1 / Math.cos(p.lat * Math.PI / 180)) / Math.PI) / 2 * n);
      var k = x + '/' + y; if (!set[k]) { set[k] = 1; liste.push(muster.replace('{z}', z).replace('{x}', x).replace('{y}', y)); }
      if (liste.length >= 160) break;
    }
    var i = 0;
    function weiter() { if (i >= liste.length) return; fetch(liste[i++]).then(function (x) { return x.arrayBuffer(); }).catch(function () {}).then(weiter); }
    weiter(); weiter(); weiter();
  };
  /* ---------- Zug/Bus-Verbindung zeichnen: farbige Abschnitte je Verkehrsmittel, Fußwege gepunktet, Umstiege als Punkte ---------- */
  var oevMarken = [];
  function oevEbenen() {
    var map = K.map, vor;
    try { var ls = map.getStyle().layers; for (var i = 0; i < ls.length; i++) if (ls[i].type === 'symbol') { vor = ls[i].id; break; } } catch (e) {}
    if (!map.getSource('oev')) map.addSource('oev', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    var rund = { 'line-cap': 'round', 'line-join': 'round' }, breit = function (b) { return ['interpolate', ['linear'], ['zoom'], 6, b * 0.6, 12, b, 16, b * 1.7]; };
    if (!map.getLayer('oev-rand')) map.addLayer({ id: 'oev-rand', type: 'line', source: 'oev', filter: ['!=', ['get', 'fuss'], true], layout: rund, paint: { 'line-color': '#05080b', 'line-width': breit(9) } }, vor);
    if (!map.getLayer('oev')) map.addLayer({ id: 'oev', type: 'line', source: 'oev', filter: ['!=', ['get', 'fuss'], true], layout: rund, paint: { 'line-color': ['get', 'farbe'], 'line-width': breit(6) } }, vor);
    if (!map.getLayer('oev-fuss')) map.addLayer({ id: 'oev-fuss', type: 'line', source: 'oev', filter: ['==', ['get', 'fuss'], true], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e9e4d6', 'line-width': breit(4), 'line-dasharray': [0.1, 1.8] } }, vor);
  }
  var oevAkt = null;
  K.oev = function (f) {
    oevMarken.forEach(function (m) { m.remove(); }); oevMarken = [];
    oevAkt = f;
    // Bahnstrecken schienengenau nachladen (Transitous) und dann neu zeichnen
    if (f && FV.LIVE && FV.LIVE.gleise) FV.LIVE.gleise(f, function (ff) { if (oevAkt === ff) K.oev(ff); });
    K.wenn(function () {
      oevEbenen();
      var feats = [];
      (f ? f.legs : []).forEach(function (l) { if (l.punkte && l.punkte.length >= 2) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.punkte }, properties: { farbe: l.farbe, fuss: !!l.fuss } }); });
      K.map.getSource('oev').setData({ type: 'FeatureCollection', features: feats });
      if (!f) return;
      // Umstiegs-Punkte: weißer Kreis mit Rand in der Farbe des nächsten Verkehrsmittels
      f.legs.forEach(function (l, i) {
        if (i === 0 || !l.punkte || !l.punkte.length || l.fuss) return;
        var e = el('', 'm-halt'); e.style.borderColor = l.farbe; e.title = l.von;
        oevMarken.push(new maplibregl.Marker({ element: e, anchor: 'center' }).setLngLat(l.punkte[0]).addTo(K.map));
      });
    });
  };
  /** Route der Zielführung über die Linien der Bus-/Bahn-Verbindung legen (Reise-Navigation) */
  K.routeNachOben = function () {
    K.wenn(function () {
      var map = K.map, vor; try { var ls = map.getStyle().layers; for (var i = 0; i < ls.length; i++) if (ls[i].type === 'symbol') { vor = ls[i].id; break; } } catch (e) {}
      ['route-rand', 'route', 'gefahren'].forEach(function (id) { if (map.getLayer(id)) try { map.moveLayer(id, vor); } catch (e) {} });
    });
  };
  K.leeren = function () { K.flugstrecken(null); K.flugzeuge([]); K.live([]); K.oev(null); K.route(null); K.ziel(null); K.start(null); K.auto(null); K.pois([]); K.nummern([]); K.verkehr([]); K.bahnhoefe([]); K.apotheken([]); K.aerzte([]); K.flughaefen([]); K.haltestellen('bus', []); K.haltestellen('stadt', []); K.netz(null); };
})();
