/* Modellflugplätze (RC-Modellflug): alle in OpenStreetMap eingetragenen Plätze – „sport=model_aerodrome“,
 * „aerodrome=model“ und Modellflug-Pisten „aeroway=model_runway“.
 * Ebene „Modellflugplätze“ (Schalter im Ebenen-Feld der Karte, in der Zielführung und in den Einstellungen, anfangs aus):
 * zeigt alle im sichtbaren Kartenausschnitt und lädt beim Verschieben nach (ab Zoom 8, Kacheln 1° × 1°, 30 Tage gemerkt).
 * Antippen: Details (Verein, erlaubte Antriebe, Piste, Zeiten, Webseite) und Hinfahren. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, K = FV.K, V = FV.V, sym = FV.sym, Tun = FV.Tun, X = FV.SX, h = X.h;
  function A() { return FV.app; }
  var M = FV.MF = {};
  var KACHEL = 1, MIN_ZOOM = 8, MAX_MARKEN = 400, TAG = 86400000;
  var marken = {}, karteGehoert = null, bewegT = null, lauf = 0, wahl = null;

  function an() { var e = A() && A().e; return !!(e && e.modellflug === true); }
  function kartenSichtbar() { return !!(K.map && K.map.getContainer && K.map.getContainer().isConnected); }

  /* ---------- Daten aus OpenStreetMap ---------- */
  function abfrage(s, w, n, o) {
    var bb = [s, w, n, o].map(function (x) { return x.toFixed(3); }).join(',');
    return '[out:json][timeout:40][bbox:' + bb + '];(' +
      'nwr["sport"~"(^|;)model_aerodrome(;|$)"];' +
      'nwr["aerodrome"="model"];' +
      'nwr["aerodrome:type"="model"];' +
      'way["aeroway"="model_runway"];' +
      ');out center tags 600;';
  }
  function ort(e) { return { lat: e.lat != null ? e.lat : e.center && e.center.lat, lon: e.lon != null ? e.lon : e.center && e.center.lon }; }
  function janein(v) { return v === 'yes' ? true : v === 'no' ? false : null; }
  function umwandeln(e) {
    var t = e.tags || {}, o = ort(e); if (o.lat == null) return null;
    var piste = t.aeroway === 'model_runway';
    var erlaubt = [], verboten = [];
    [['model_aerodrome:electric', 'Elektro'], ['model_aerodrome:combustion', 'Verbrenner'], ['model_aerodrome:turbine', 'Turbine'], ['model_aerodrome:heli', 'Hubschrauber'], ['model_aerodrome:glider', 'Segler']].forEach(function (a) {
      var v = janein(t[a[0]]); if (v === true) erlaubt.push(a[1]); else if (v === false) verboten.push(a[1]);
    });
    return {
      id: e.type + e.id, lat: o.lat, lon: o.lon, piste: piste,
      name: t.name || (piste ? 'Modellflug-Piste' : 'Modellflugplatz'),
      verein: t.operator || t['club'] && t['club:name'] || '',
      erlaubt: erlaubt.join(', '), verboten: verboten.join(', '),
      hang: t['model_aerodrome:slope'] === 'yes' ? 'Hangflug' + (t.direction ? ' (Richtung ' + t.direction + ')' : '') : '',
      belag: { grass: 'Gras', asphalt: 'Asphalt', concrete: 'Beton', paved: 'befestigt', unpaved: 'unbefestigt', artificial_turf: 'Kunstrasen' }[t.surface] || t.surface || '',
      laenge: t.length ? String(t.length).replace('.', ',') + ' m' : '',
      zeiten: t.opening_hours || '', zugang: t.access === 'private' ? 'nur Vereinsmitglieder' : t.access === 'members' ? 'nur Mitglieder' : '',
      web: t.website || t['contact:website'] || t.url || '', tel: t.phone || t['contact:phone'] || '',
      strasse: [t['addr:street'] || '', t['addr:housenumber'] || ''].join(' ').trim(),
      ortname: [t['addr:postcode'] || '', t['addr:city'] || ''].join(' ').trim(),
      info: t.description || t.note || ''
    };
  }
  /** Pisten, die zu einem eingetragenen Platz gehören (näher als 600 m), nicht doppelt zeigen */
  function bereinigen(l) {
    var plaetze = l.filter(function (x) { return !x.piste; });
    return l.filter(function (x) { return !x.piste || !plaetze.some(function (p) { return G.abstand(p, x) < 600; }); });
  }
  function kachel(ky, kx) {
    var s = ky * KACHEL, w = kx * KACHEL, key = s + ',' + w;
    return V.merk('modellflug', key, { frisch: 30 * TAG, alt: 120 * TAG, notfall: 365 * TAG, max: 300 }, function () {
      return V.osm(abfrage(s, w, s + KACHEL, w + KACHEL), 30 * 86400).then(function (j) { return bereinigen((j.elements || []).map(umwandeln).filter(Boolean)); });
    });
  }
  function bereich(s, w, n, o) {
    var y0 = Math.floor(s / KACHEL), y1 = Math.floor(n / KACHEL), x0 = Math.floor(w / KACHEL), x1 = Math.floor(o / KACHEL), auftrag = [];
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) auftrag.push([y, x]);
    if (auftrag.length > 16) return Promise.reject(new Error('zu groß'));
    var fehler = 0;
    return Promise.all(auftrag.map(function (k) { return kachel(k[0], k[1]).catch(function (e) { fehler++; if (fehler === auftrag.length) throw e; return []; }); })).then(function (t) {
      var gesehen = {}, alle = [];
      t.forEach(function (l) { l.forEach(function (x) { if (!gesehen[x.id]) { gesehen[x.id] = 1; alle.push(x); } }); });
      return alle;
    });
  }

  /* ---------- Karte ---------- */
  function markeBauen(x) {
    var d = document.createElement('div');
    d.className = 'm-modell';
    d.innerHTML = '<i>' + sym('flug') + '</i><span>' + FV.esc(x.name) + '</span>';
    d.addEventListener('click', function (ev) { ev.stopPropagation(); blatt(x); });
    return new maplibregl.Marker({ element: d, anchor: 'left', offset: [-13, 0] }).setLngLat([x.lon, x.lat]).addTo(K.map);
  }
  function zeichnen(liste) {
    var neu = {};
    if (K.map && an()) liste.forEach(function (x) { neu[x.id] = marken[x.id] || markeBauen(x); });
    Object.keys(marken).forEach(function (k) { if (!neu[k]) marken[k].remove(); });
    marken = neu;
  }
  M.leeren = function () { Object.keys(marken).forEach(function (k) { marken[k].remove(); }); marken = {}; };
  function namenKlasse() { var c = K.map && K.map.getContainer(); if (c) c.classList.toggle('mfnah', K.map.getZoom() >= 11); }
  function hoeren() {
    if (!K.map || karteGehoert === K.map) return;
    karteGehoert = K.map; marken = {};
    K.map.on('moveend', function () { clearTimeout(bewegT); bewegT = setTimeout(function () { M.neu(); }, 800); });
    K.map.on('zoom', namenKlasse);
  }
  /** Modellflugplätze im sichtbaren Ausschnitt laden und zeigen (melden: nach dem Einschalten kurz sagen, wie viele) */
  M.neu = function (melden) {
    if (!an() || !kartenSichtbar()) { M.leeren(); return; }
    hoeren(); namenKlasse();
    var map = K.map, z = map.getZoom();
    if (z < MIN_ZOOM) { M.leeren(); if (melden) A().toast('Modellflugplätze erscheinen, sobald Sie etwas näher heranzoomen.', 3000); return; }
    var b = map.getBounds(), meins = ++lauf, c = map.getCenter(), mitte = { lat: c.lat, lon: c.lng };
    bereich(b.getSouth(), b.getWest(), b.getNorth(), b.getEast()).then(function (l) {
      if (meins !== lauf || !an()) return;
      var rand = 0.15 * (b.getNorth() - b.getSouth());
      l = l.filter(function (x) { return x.lat > b.getSouth() - rand && x.lat < b.getNorth() + rand && x.lon > b.getWest() - rand && x.lon < b.getEast() + rand; });
      if (l.length > MAX_MARKEN) { l.forEach(function (x) { x.ab = G.abstand(mitte, x); }); l.sort(function (p, q) { return p.ab - q.ab; }); l = l.slice(0, MAX_MARKEN); }
      zeichnen(l);
      if (melden) A().toast(l.length ? l.length + ' Modellflugpl' + (l.length === 1 ? 'atz' : 'ätze') + ' im Kartenausschnitt' : 'Im Kartenausschnitt ist kein Modellflugplatz eingetragen.', 2500);
    }).catch(function () { if (melden && meins === lauf) A().toast('Modellflugplätze konnten gerade nicht geladen werden (OpenStreetMap antwortet nicht).', 3500); });
  };
  setInterval(function () { if (an() && kartenSichtbar() && karteGehoert !== K.map) M.neu(); }, 1500);
  var leerenAlt = K.leeren;
  K.leeren = function () { var r = leerenAlt.apply(K, arguments); M.leeren(); clearTimeout(bewegT); bewegT = setTimeout(function () { M.neu(); }, 600); return r; };

  /* ---------- Detailblatt ---------- */
  function zeile(s, k, t) { return t ? '<div class="detailzeile">' + sym(s) + '<div><small>' + k + '</small>' + t + '</div></div>' : ''; }
  function blatt(x) {
    wahl = x;
    var p = B.ort && B.ort(), weit = p && p.lat != null ? G.km(G.abstand(p, x)) + ' entfernt' : '';
    var o = x.zeiten && V.offen ? V.offen(x.zeiten) : null;
    var adr = [x.strasse, x.ortname].filter(Boolean).join(', ');
    var web = x.web ? '<b data-tun="oeffnen" style="text-decoration:underline;cursor:pointer" data-url="' + h(/^https?:/i.test(x.web) ? x.web : 'https://' + x.web) + '">' + h(x.web.replace(/^https?:\/\//i, '').replace(/\/$/, '')) + '</b>' : '';
    A().blatt('<h2>' + sym('flug') + '<span>' + h(x.name) + '<br><small style="font-weight:400;font-size:13px">' + (x.piste ? 'Modellflug-Piste' : 'Modellflugplatz') + (weit ? ' · ' + weit : '') + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="block">' +
      zeile('pin', 'Adresse', h(adr)) +
      zeile('info', 'Verein / Betreiber', h(x.verein)) +
      zeile('flug', 'Erlaubt', h([x.erlaubt, x.hang].filter(Boolean).join(' · '))) +
      zeile('warnung', 'Nicht erlaubt', h(x.verboten)) +
      zeile('route', 'Piste', h([x.belag, x.laenge].filter(Boolean).join(' · '))) +
      zeile('uhr', 'Flugzeiten', x.zeiten ? h(x.zeiten) + (o ? ' · <b class="' + (o.offen ? 'offen' : 'zu') + '">' + (o.offen ? 'jetzt offen' : 'jetzt geschlossen') + '</b>' : '') : '') +
      zeile('warnung', 'Zugang', h(x.zugang)) +
      zeile('telefon', 'Telefon', h(x.tel)) +
      zeile('info', 'Webseite', web) +
      zeile('info', 'Hinweis', h(x.info)) + '</div>' +
      '<div class="zweier"><button class="gold knopf" data-tun="modellflug-hin" data-m="auto">' + sym('auto') + 'Hinfahren</button>' +
      '<button class="rand knopf" data-tun="modellflug-hin" data-m="fuss">' + sym('fuss') + 'Zu Fuß</button></div>' +
      '<p class="klein2">Aus OpenStreetMap – ohne Gewähr. Gastflieger bitte vorher beim Verein anfragen.</p>');
  }
  M.blatt = blatt;
  Tun['modellflug-hin'] = function (el) {
    var x = wahl; if (!x) return; A().blattZu();
    A().zeige('vorschau', { ziel: { name: x.name, adresse: [x.strasse, x.ortname].filter(Boolean).join(', ') || x.name, lat: x.lat, lon: x.lon, art: 'frei' }, modus: el.getAttribute('data-m') });
  };
})();
