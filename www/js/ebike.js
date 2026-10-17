/* E-Bike-Stationen: Ladestationen für E-Bikes/Pedelecs und E-Bike-Verleih aus OpenStreetMap.
 * Ebene „E-Bike-Stationen“ (Schalter im Ebenen-Feld und in den Einstellungen): zeigt alle Stationen im sichtbaren
 * Kartenausschnitt und lädt beim Verschieben nach. Antippen: Details, Hinfahren, mit dem Rad hin.
 * Seite „E-Bike-Stationen in der Nähe“: Liste nach Entfernung. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, K = FV.K, V = FV.V, sym = FV.sym, Se = FV.Seiten, Tun = FV.Tun, X = FV.SX, h = X.h;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }
  var EB = FV.EB = {};
  var KACHEL = 0.25, MIN_ZOOM = 10, MAX_MARKEN = 300, TAG = 86400000;
  var marken = {}, karteGehoert = null, bewegT = null, lauf = 0, wahl = null, hinweisZoom = false;

  function an() { var e = A() && A().e; return !!(e && e.ebike !== false); }
  function kartenSichtbar() { return !!(K.map && K.map.getContainer && K.map.getContainer().isConnected); }

  /* ---------- Daten aus OpenStreetMap (über die Verwaltung zwischengespeichert, sonst direkt) ---------- */
  var BIKE_KEY = '^(bicycle|ebike|e-bike|e_bike|pedelec|electric_bicycle)$';
  function abfrage(s, w, n, o) {
    var bb = [s, w, n, o].map(function (x) { return x.toFixed(3); }).join(',');
    return '[out:json][timeout:25][bbox:' + bb + '];(' +
      'nwr["amenity"="charging_station"][~"' + BIKE_KEY + '"~"^(yes|designated|only)$"];' +
      'nwr["amenity"="charging_station"][~"^socket:(bicycle|e-?bike|pedelec)"~"."];' +
      'nwr["amenity"="charging_station"]["name"~"e-?bike|pedelec|fahrrad",i];' +
      'nwr["amenity"="bicycle_charging"];' +
      'nwr["amenity"="bicycle_rental"][~"^(rental|bicycle_rental|bicycle_rental:type)$"~"e-?bike|pedelec|electric",i];' +
      'nwr["amenity"="bicycle_rental"]["name"~"e-?bike|pedelec",i];' +
      ');out center tags 500;';
  }
  function ort(e) { return { lat: e.lat != null ? e.lat : e.center && e.center.lat, lon: e.lon != null ? e.lon : e.center && e.center.lon }; }
  var STECKER = { schuko: 'Schuko', typ2: 'Typ 2', type2: 'Typ 2', bosch: 'Bosch', shimano: 'Shimano', yamaha: 'Yamaha', brose: 'Brose', panasonic: 'Panasonic', bafang: 'Bafang', cee_blue: 'CEE blau', usb: 'USB' };
  function umwandeln(e) {
    var t = e.tags || {}, o = ort(e); if (o.lat == null) return null;
    var verleih = t.amenity === 'bicycle_rental';
    var stecker = [];
    Object.keys(t).forEach(function (k) {
      var m = k.match(/^socket:([a-z0-9_]+)$/); if (!m || t[k] === 'no' || t[k] === '0') return;
      var name = STECKER[m[1]] || m[1].replace(/_/g, ' '), n = parseInt(t[k], 10);
      stecker.push(n > 0 ? n + '× ' + name : name);
    });
    var gebuehr = t.fee === 'no' ? 'kostenlos' : t.fee === 'yes' ? 'kostenpflichtig' + (t.charge ? ' (' + t.charge + ')' : '') : (t.charge || '');
    return {
      id: e.type + e.id, art: verleih ? 'verleih' : 'laden', lat: o.lat, lon: o.lon,
      name: t.name || (verleih ? 'E-Bike-Verleih' : 'E-Bike-Ladestation'),
      betreiber: t.operator || t.network || t.brand || '',
      strasse: [t['addr:street'] || '', t['addr:housenumber'] || ''].join(' ').trim(),
      ort: [t['addr:postcode'] || '', t['addr:city'] || t['addr:place'] || ''].join(' ').trim(),
      zeiten: t.opening_hours || '', gebuehr: gebuehr, plaetze: t.capacity || '', stecker: stecker.join(', '),
      schliessfach: t.lockers === 'yes' || /locker/.test(t['bicycle_parking'] || '') ? 'ja' : '',
      ueberdacht: t.covered === 'yes' ? 'ja' : '', zugang: t.access === 'customers' ? 'nur für Kunden' : t.access === 'private' ? 'privat' : '',
      telefon: t.phone || t['contact:phone'] || '', web: t.website || t['contact:website'] || t.url || '', info: t.description || t.note || ''
    };
  }
  /** eine Kachel (0,25° × 0,25°) holen – 7 Tage gespeichert, auf dem Handy und auf dem Server */
  function kachel(ky, kx) {
    var s = ky * KACHEL, w = kx * KACHEL, key = s.toFixed(2) + ',' + w.toFixed(2);
    return V.merk('ebike', key, { frisch: 7 * TAG, alt: 60 * TAG, notfall: 365 * TAG, max: 80 }, function () {
      return V.osm(abfrage(s, w, s + KACHEL, w + KACHEL), 7 * 86400).then(function (j) { return (j.elements || []).map(umwandeln).filter(Boolean); });
    });
  }
  /** alle Stationen in einem Bereich (Kacheln zusammensetzen, doppelte weg) */
  function bereich(s, w, n, o, maxKacheln) {
    var y0 = Math.floor(s / KACHEL), y1 = Math.floor(n / KACHEL), x0 = Math.floor(w / KACHEL), x1 = Math.floor(o / KACHEL), auftrag = [];
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) auftrag.push([y, x]);
    if (auftrag.length > (maxKacheln || 12)) return Promise.reject(new Error('zu groß'));
    var fehler = 0;
    return Promise.all(auftrag.map(function (k) { return kachel(k[0], k[1]).catch(function (e) { fehler++; if (fehler === auftrag.length) throw e; return []; }); })).then(function (t) {
      var gesehen = {}, alle = [];
      t.forEach(function (l) { l.forEach(function (x) { if (!gesehen[x.id]) { gesehen[x.id] = 1; alle.push(x); } }); });
      return alle;
    });
  }
  EB.umkreis = function (p, meter) {
    meter = meter || 10000;
    var dLat = meter / 111320, dLon = meter / (111320 * Math.cos(p.lat * Math.PI / 180));
    return bereich(p.lat - dLat, p.lon - dLon, p.lat + dLat, p.lon + dLon, 16).then(function (l) {
      return l.map(function (x) { return Object.assign({}, x, { weit: Math.round(G.abstand(p, x)) }); })
        .filter(function (x) { return x.weit <= meter; }).sort(function (a, b) { return a.weit - b.weit; });
    });
  };

  /* ---------- Karte ---------- */
  function markeBauen(x) {
    var d = document.createElement('div');
    d.className = 'm-ebike ' + x.art;
    d.innerHTML = sym('ebike') + '<span>' + FV.esc(x.name) + '</span>';
    d.addEventListener('click', function (ev) { ev.stopPropagation(); blatt(x); });
    return new maplibregl.Marker({ element: d, anchor: 'left', offset: [-13, 0] }).setLngLat([x.lon, x.lat]).addTo(K.map);
  }
  function zeichnen(liste) {
    var neu = {};
    if (K.map && an()) liste.forEach(function (x) { neu[x.id] = marken[x.id] || markeBauen(x); });
    Object.keys(marken).forEach(function (k) { if (!neu[k]) marken[k].remove(); });
    marken = neu;
  }
  EB.leeren = function () { Object.keys(marken).forEach(function (k) { marken[k].remove(); }); marken = {}; };
  function namenKlasse() { var c = K.map && K.map.getContainer(); if (c) c.classList.toggle('ebnah', K.map.getZoom() >= 14); }
  function hoeren() {
    if (!K.map || karteGehoert === K.map) return;
    karteGehoert = K.map; marken = {};
    K.map.on('moveend', function () { clearTimeout(bewegT); bewegT = setTimeout(function () { EB.neu(); }, 700); });
    K.map.on('zoom', namenKlasse);
  }
  /** Stationen im sichtbaren Ausschnitt laden und zeigen */
  EB.neu = function (melden) {
    if (!an() || !kartenSichtbar()) { EB.leeren(); return; }
    hoeren(); namenKlasse();
    var map = K.map, z = map.getZoom();
    if (z < MIN_ZOOM) {
      EB.leeren();
      if (melden || !hinweisZoom) { hinweisZoom = true; if (melden) A().toast('E-Bike-Stationen erscheinen, sobald Sie näher heranzoomen.', 3000); }
      return;
    }
    var b = map.getBounds(), meins = ++lauf, c = map.getCenter(), mitte = { lat: c.lat, lon: c.lng };
    bereich(b.getSouth(), b.getWest(), b.getNorth(), b.getEast(), 12).then(function (l) {
      if (meins !== lauf || !an()) return;
      var rand = 0.15 * (b.getNorth() - b.getSouth());
      l = l.filter(function (x) { return x.lat > b.getSouth() - rand && x.lat < b.getNorth() + rand && x.lon > b.getWest() - rand && x.lon < b.getEast() + rand; });
      if (l.length > MAX_MARKEN) { l.forEach(function (x) { x.ab = G.abstand(mitte, x); }); l.sort(function (p, q) { return p.ab - q.ab; }); l = l.slice(0, MAX_MARKEN); }
      zeichnen(l);
      if (melden) A().toast(l.length ? l.length + ' E-Bike-Station' + (l.length === 1 ? '' : 'en') + ' im Kartenausschnitt' : 'Im Kartenausschnitt ist keine E-Bike-Station eingetragen.', 2500);
    }).catch(function (e) { if (melden && meins === lauf) A().toast('E-Bike-Stationen konnten gerade nicht geladen werden (OpenStreetMap antwortet nicht).', 3500); });
  };
  // Kommt eine neue Karte (Seitenwechsel), dort ebenfalls zeigen
  setInterval(function () { if (an() && kartenSichtbar() && karteGehoert !== K.map) EB.neu(); }, 1500);
  var leerenAlt = K.leeren;
  K.leeren = function () { var r = leerenAlt.apply(K, arguments); EB.leeren(); clearTimeout(bewegT); bewegT = setTimeout(function () { EB.neu(); }, 600); return r; };

  /* ---------- Detailblatt ---------- */
  function zeile(s, k, t) { return t ? '<div class="detailzeile">' + sym(s) + '<div><small>' + k + '</small>' + t + '</div></div>' : ''; }
  function blatt(x) {
    wahl = x;
    var p = B.ort && B.ort(), weit = p && p.lat != null ? G.km(G.abstand(p, x)) + ' entfernt' : '';
    var o = x.zeiten && V.offen ? V.offen(x.zeiten) : null;
    var adr = [x.strasse, x.ort].filter(Boolean).join(', ');
    A().blatt('<h2>' + sym('ebike') + '<span>' + h(x.name) + '<br><small style="font-weight:400;font-size:13px">' + (x.art === 'verleih' ? 'E-Bike-Verleih' : 'E-Bike-Ladestation') + (weit ? ' · ' + weit : '') + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="block">' +
      zeile('pin', 'Adresse', h(adr || 'nicht eingetragen')) +
      zeile('info', 'Betreiber', h(x.betreiber)) +
      zeile('uhr', 'Öffnungszeiten', x.zeiten ? h(x.zeiten) + (o ? ' · <b class="' + (o.offen ? 'offen' : 'zu') + '">' + (o.offen ? 'jetzt geöffnet' : 'jetzt geschlossen') + '</b>' : '') : '') +
      zeile('laden', 'Anschlüsse', h(x.stecker)) +
      zeile('ebike', 'Plätze', h(x.plaetze)) +
      zeile('info', 'Kosten', h(x.gebuehr)) +
      zeile('info', 'Ladeschließfach', x.schliessfach) +
      zeile('info', 'Überdacht', x.ueberdacht) +
      zeile('warnung', 'Zugang', h(x.zugang)) +
      zeile('telefon', 'Telefon', h(x.telefon)) +
      zeile('info', 'Hinweis', h(x.info)) + '</div>' +
      '<div class="zweier">' + (x.telefon ? '<button class="rand knopf" data-tun="anrufen" data-tel="' + h(x.telefon) + '">' + sym('telefon') + 'Anrufen</button>' : '') +
      '<button class="gold knopf" data-tun="ebike-hin" data-m="auto">' + sym('auto') + 'Hinfahren</button></div><div style="height:8px"></div>' +
      '<div class="zweier"><button class="rand knopf" data-tun="ebike-hin" data-m="rad">' + sym('fahrrad') + 'Mit dem Rad</button>' +
      '<button class="rand knopf" data-tun="ebike-hin" data-m="fuss">' + sym('fuss') + 'Zu Fuß</button></div>' +
      (x.web ? '<div style="height:8px"></div><button class="rand knopf breit" data-tun="ebike-web">' + sym('info') + 'Webseite öffnen</button>' : '') +
      '<p class="klein2">Daten: OpenStreetMap – ohne Gewähr.</p>');
  }
  EB.blatt = blatt;
  Tun['ebike-hin'] = function (el) {
    var x = wahl; if (!x) return; A().blattZu();
    A().zeige('vorschau', { ziel: { name: x.name, adresse: [x.strasse, x.ort].filter(Boolean).join(', ') || x.name, lat: x.lat, lon: x.lon, art: 'frei' }, modus: el.getAttribute('data-m') });
  };
  Tun['ebike-web'] = function () { if (wahl && wahl.web) B.oeffnen(/^https?:/.test(wahl.web) ? wahl.web : 'https://' + wahl.web); };

  /* ---------- Seite: E-Bike-Stationen in der Nähe ---------- */
  var liste = [], listLauf = 0;
  Tun.ebikes = function () { A().blattZu(); A().zeige('ebikes', {}); };
  Se.ebikes = function () {
    X.seite(X.kopf('E-Bike-Stationen') + '<div class="rollen" id="ebliste">' + X.laedt('E-Bike-Stationen werden gesucht …') + '</div>');
    var meins = ++listLauf;
    X.startpunkt().then(function (pt) { return EB.umkreis(pt, 15000); }).then(function (l) {
      var box = $('#ebliste'); if (!box || meins !== listLauf) return;
      liste = l;
      if (!l.length) { box.innerHTML = '<div class="fehler">Im Umkreis von 15 km ist keine E-Bike-Station in OpenStreetMap eingetragen.</div>'; return; }
      box.innerHTML = '<h3 class="ueber">' + sym('ebike') + l.length + ' E-Bike-Station' + (l.length === 1 ? '' : 'en') + ' in der Nähe</h3>' + l.slice(0, 60).map(function (x, i) {
        return '<button class="eintrag" data-tun="ebike-wahl" data-i="' + i + '">' + sym('ebike') + '<div class="txt"><b>' + h(x.name) + '</b><span>' + (x.art === 'verleih' ? 'Verleih' : 'Laden') + ' · ' + G.km(x.weit) + (x.ort || x.strasse ? ' · ' + h([x.strasse, x.ort].filter(Boolean).join(', ')) : '') + '</span></div>' + sym('rechts') + '</button>';
      }).join('') + '<p class="klein2" style="text-align:center">Daten: OpenStreetMap (Ladestationen für E-Bikes/Pedelecs und E-Bike-Verleih). Ohne Gewähr.</p>';
    }).catch(function () {
      var box = $('#ebliste'); if (box && meins === listLauf) box.innerHTML = '<div class="fehler">Die Kartendienste (OpenStreetMap) antworten gerade nicht. Bitte gleich noch einmal versuchen.</div><button class="rand knopf breit" style="margin-top:10px" data-tun="ebikes">' + sym('neu') + 'Nochmal versuchen</button>';
    });
  };
  Tun['ebike-wahl'] = function (el) { var x = liste[+el.getAttribute('data-i')]; if (x) blatt(x); };
})();
