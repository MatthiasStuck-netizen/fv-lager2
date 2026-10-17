/* Kostenlose Parkplätze: alle Parkplätze aus OpenStreetMap mit „fee=no“ (ausdrücklich kostenlos) – überall, in jeder Stadt.
 * Ebene „Kostenlose Parkplätze“ (Schalter im Ebenen-Feld, in der Zielführung und in den Einstellungen): zeigt alle im
 * sichtbaren Kartenausschnitt und lädt beim Verschieben nach (ab Zoom 12, Kacheln 0,1° × 0,1°, 7 Tage gemerkt).
 * Antippen: Details (Art, Plätze, Höchstparkdauer, Parkscheibe, Zeiten, Höhe) und Hinfahren.
 * Seite „Kostenlose Parkplätze in der Nähe“ und „… am Ziel“: Liste nach Entfernung. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, K = FV.K, V = FV.V, sym = FV.sym, Se = FV.Seiten, Tun = FV.Tun, X = FV.SX, h = X.h;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }
  var P = FV.PK = {};
  var KACHEL = 0.1, MIN_ZOOM = 12, MAX_MARKEN = 350, TAG = 86400000;
  var marken = {}, karteGehoert = null, bewegT = null, lauf = 0, wahl = null;

  function an() { var e = A() && A().e; return !!(e && e.parkenFrei !== false); }
  function kartenSichtbar() { return !!(K.map && K.map.getContainer && K.map.getContainer().isConnected); }

  /* ---------- Daten aus OpenStreetMap ---------- */
  function abfrage(s, w, n, o) {
    var bb = [s, w, n, o].map(function (x) { return x.toFixed(3); }).join(',');
    // nur ausdrücklich kostenlos; private, nur für Kunden/Anwohner und Behindertenparkplätze weglassen
    return '[out:json][timeout:25][bbox:' + bb + '];(' +
      'nwr["amenity"="parking"]["fee"~"^(no|free|0)$"]["access"!~"^(private|no|customers|permit|residents|delivery)$"]["parking"!~"^(garage_boxes|carports)$"];' +
      ');out center tags 800;';
  }
  function ort(e) { return { lat: e.lat != null ? e.lat : e.center && e.center.lat, lon: e.lon != null ? e.lon : e.center && e.center.lon }; }
  var ARTEN = { surface: 'Parkplatz', 'multi-storey': 'Parkhaus', underground: 'Tiefgarage', street_side: 'Parkstreifen', lane: 'Parken am Straßenrand', rooftop: 'Parkdeck', layby: 'Parkbucht', sheds: 'Überdacht' };
  function dauer(t) {
    var m = String(t || '').trim(); if (!m) return '';
    var x = m.match(/^(\d+(?:[.,]\d+)?)\s*(min|minutes?|h|hours?|std|d|days?)?$/i);
    if (x) { var z = x[1].replace('.', ','), e = (x[2] || 'min').toLowerCase(); return z + (/^h|^std/.test(e) ? (z === '1' ? ' Stunde' : ' Stunden') : /^d/.test(e) ? (z === '1' ? ' Tag' : ' Tage') : ' Minuten'); }
    var y = m.match(/^(\d{1,2}):(\d{2})$/); if (y) return (+y[1] ? +y[1] + ' Std. ' : '') + (+y[2] ? +y[2] + ' Min.' : '');
    return m;
  }
  function umwandeln(e) {
    var t = e.tags || {}, o = ort(e); if (o.lat == null) return null;
    var art = ARTEN[t.parking] || 'Parkplatz';
    var lkw = t.hgv === 'yes' || t.hgv === 'designated';
    var scheibe = t['parking_disc'] === 'yes' || /disc|scheibe/i.test(t['maxstay:conditional'] || '') || t.parking_disc === 'required';
    return {
      id: e.type + e.id, lat: o.lat, lon: o.lon, art: art,
      name: t.name || (art === 'Parkplatz' ? 'Kostenloser Parkplatz' : art + ' (kostenlos)'),
      plaetze: t.capacity || '', behindert: t['capacity:disabled'] && t['capacity:disabled'] !== 'no' ? t['capacity:disabled'] : '',
      dauer: dauer(t.maxstay), scheibe: scheibe ? 'Parkscheibe nötig' : '',
      zeiten: t.opening_hours || '', hoehe: t.maxheight ? String(t.maxheight).replace('.', ',') + ' m' : '',
      lkw: lkw ? 'auch für Lkw/Transporter' : (t.hgv === 'no' ? 'keine Lkw' : ''),
      wohnmobil: t.motorhome === 'yes' || t.caravan === 'yes' ? 'Wohnmobile erlaubt' : '',
      ueberdacht: t.covered === 'yes' || t.parking === 'multi-storey' || t.parking === 'underground' ? 'ja' : '',
      laden: t.capacity_charging || t['capacity:charging'] || '', betreiber: t.operator || '',
      strasse: [t['addr:street'] || '', t['addr:housenumber'] || ''].join(' ').trim(),
      ortname: [t['addr:postcode'] || '', t['addr:city'] || ''].join(' ').trim(),
      info: t.description || t.note || '', kleiner: !t.capacity || +t.capacity < 10
    };
  }
  function kachel(ky, kx) {
    var s = ky * KACHEL, w = kx * KACHEL, key = s.toFixed(2) + ',' + w.toFixed(2);
    return V.merk('parken', key, { frisch: 7 * TAG, alt: 60 * TAG, notfall: 365 * TAG, max: 200 }, function () {
      return V.osm(abfrage(s, w, s + KACHEL, w + KACHEL), 7 * 86400).then(function (j) { return (j.elements || []).map(umwandeln).filter(Boolean); });
    });
  }
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
  P.umkreis = function (p, meter) {
    meter = meter || 2000;
    var dLat = meter / 111320, dLon = meter / (111320 * Math.cos(p.lat * Math.PI / 180));
    return bereich(p.lat - dLat, p.lon - dLon, p.lat + dLat, p.lon + dLon, 16).then(function (l) {
      return l.map(function (x) { return Object.assign({}, x, { weit: Math.round(G.abstand(p, x)) }); })
        .filter(function (x) { return x.weit <= meter; }).sort(function (a, b) { return a.weit - b.weit; });
    });
  };

  /* ---------- Karte ---------- */
  function markeBauen(x) {
    var d = document.createElement('div');
    d.className = 'm-parkfrei' + (x.kleiner ? ' klein' : '');
    d.innerHTML = '<i>P</i><em>0 €</em><span>' + FV.esc(x.name) + '</span>';
    d.addEventListener('click', function (ev) { ev.stopPropagation(); blatt(x); });
    return new maplibregl.Marker({ element: d, anchor: 'left', offset: [-12, 0] }).setLngLat([x.lon, x.lat]).addTo(K.map);
  }
  function zeichnen(liste) {
    var neu = {};
    if (K.map && an()) liste.forEach(function (x) { neu[x.id] = marken[x.id] || markeBauen(x); });
    Object.keys(marken).forEach(function (k) { if (!neu[k]) marken[k].remove(); });
    marken = neu;
  }
  P.leeren = function () { Object.keys(marken).forEach(function (k) { marken[k].remove(); }); marken = {}; };
  function namenKlasse() { var c = K.map && K.map.getContainer(); if (c) c.classList.toggle('pknah', K.map.getZoom() >= 15.5); }
  function hoeren() {
    if (!K.map || karteGehoert === K.map) return;
    karteGehoert = K.map; marken = {};
    K.map.on('moveend', function () { clearTimeout(bewegT); bewegT = setTimeout(function () { P.neu(); }, 800); });
    K.map.on('zoom', namenKlasse);
  }
  /** Parkplätze im sichtbaren Ausschnitt laden und zeigen */
  P.neu = function (melden) {
    if (!an() || !kartenSichtbar()) { P.leeren(); return; }
    hoeren(); namenKlasse();
    var map = K.map, z = map.getZoom();
    if (z < MIN_ZOOM) { P.leeren(); if (melden) A().toast('Kostenlose Parkplätze erscheinen, sobald Sie näher heranzoomen.', 3000); return; }
    var b = map.getBounds(), meins = ++lauf, c = map.getCenter(), mitte = { lat: c.lat, lon: c.lng };
    bereich(b.getSouth(), b.getWest(), b.getNorth(), b.getEast(), 20).then(function (l) {
      if (meins !== lauf || !an()) return;
      var rand = 0.15 * (b.getNorth() - b.getSouth());
      l = l.filter(function (x) { return x.lat > b.getSouth() - rand && x.lat < b.getNorth() + rand && x.lon > b.getWest() - rand && x.lon < b.getEast() + rand; });
      if (l.length > MAX_MARKEN) { l.forEach(function (x) { x.ab = G.abstand(mitte, x); }); l.sort(function (p, q) { return p.ab - q.ab; }); l = l.slice(0, MAX_MARKEN); }
      zeichnen(l);
      if (melden) A().toast(l.length ? l.length + ' kostenlose' + (l.length === 1 ? 'r Parkplatz' : ' Parkplätze') + ' im Kartenausschnitt' : 'Im Kartenausschnitt ist kein kostenloser Parkplatz eingetragen.', 2500);
    }).catch(function () { if (melden && meins === lauf) A().toast('Parkplätze konnten gerade nicht geladen werden (OpenStreetMap antwortet nicht).', 3500); });
  };
  setInterval(function () { if (an() && kartenSichtbar() && karteGehoert !== K.map) P.neu(); }, 1500);
  var leerenAlt = K.leeren;
  K.leeren = function () { var r = leerenAlt.apply(K, arguments); P.leeren(); clearTimeout(bewegT); bewegT = setTimeout(function () { P.neu(); }, 600); return r; };

  /* ---------- Detailblatt ---------- */
  function zeile(s, k, t) { return t ? '<div class="detailzeile">' + sym(s) + '<div><small>' + k + '</small>' + t + '</div></div>' : ''; }
  function blatt(x) {
    wahl = x;
    var p = B.ort && B.ort(), weit = p && p.lat != null ? G.km(G.abstand(p, x)) + ' entfernt' : '';
    var o = x.zeiten && V.offen ? V.offen(x.zeiten) : null;
    var adr = [x.strasse, x.ortname].filter(Boolean).join(', ');
    A().blatt('<h2>' + sym('parken') + '<span>' + h(x.name) + '<br><small style="font-weight:400;font-size:13px">' + h(x.art) + ' · <b style="color:#3fcf74">kostenlos</b>' + (weit ? ' · ' + weit : '') + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="block">' +
      zeile('pin', 'Adresse', h(adr)) +
      zeile('parken', 'Plätze', h(x.plaetze) + (x.behindert ? ' · davon ' + h(x.behindert === 'yes' ? 'einige' : x.behindert) + ' für Behinderte' : '')) +
      zeile('uhr', 'Höchstparkdauer', h(x.dauer) + (x.scheibe ? ' · ' + x.scheibe : '')) +
      zeile('uhr', 'Geöffnet', x.zeiten ? h(x.zeiten) + (o ? ' · <b class="' + (o.offen ? 'offen' : 'zu') + '">' + (o.offen ? 'jetzt geöffnet' : 'jetzt geschlossen') + '</b>' : '') : '') +
      zeile('warnung', 'Durchfahrtshöhe', h(x.hoehe)) +
      zeile('lkw', 'Fahrzeuge', h([x.lkw, x.wohnmobil].filter(Boolean).join(' · '))) +
      zeile('laden', 'Ladeplätze', h(x.laden)) +
      zeile('info', 'Betreiber', h(x.betreiber)) +
      zeile('info', 'Hinweis', h(x.info)) + '</div>' +
      '<div class="zweier"><button class="gold knopf" data-tun="parkfrei-hin" data-m="auto">' + sym('auto') + 'Hinfahren</button>' +
      '<button class="rand knopf" data-tun="parkfrei-hin" data-m="fuss">' + sym('fuss') + 'Zu Fuß</button></div>' +
      '<p class="klein2">Als kostenlos eingetragen in OpenStreetMap – ohne Gewähr. Bitte Schilder vor Ort beachten.</p>');
  }
  P.blatt = blatt;
  Tun['parkfrei-hin'] = function (el) {
    var x = wahl; if (!x) return; A().blattZu();
    A().zeige('vorschau', { ziel: { name: x.name, adresse: [x.strasse, x.ortname].filter(Boolean).join(', ') || x.name, lat: x.lat, lon: x.lon, art: 'frei' }, modus: el.getAttribute('data-m') });
  };

  /* ---------- Seite: kostenlose Parkplätze in der Nähe / am Ziel ---------- */
  var liste = [], listLauf = 0;
  Tun.parkfrei = function (el) { A().blattZu(); A().zeige('parkfrei', { amZiel: !!(el && el.getAttribute('data-ziel')) }); };
  Se.parkfrei = function (p) {
    p = p || {};
    var z = A().z, ziel = p.amZiel && z.lauf && z.lauf.nach && z.lauf.nach.lat != null ? z.lauf.nach : null;
    X.seite(X.kopf(ziel ? 'Kostenlos parken am Ziel' : 'Kostenlose Parkplätze') + '<div class="rollen" id="pkliste">' + X.laedt('Kostenlose Parkplätze werden gesucht …') + '</div>');
    var meins = ++listLauf;
    (ziel ? Promise.resolve({ lat: ziel.lat, lon: ziel.lon }) : X.startpunkt()).then(function (pt) {
      return P.umkreis(pt, 2000).then(function (l) { return l.length >= 3 ? l : P.umkreis(pt, 6000); });
    }).then(function (l) {
      var box = $('#pkliste'); if (!box || meins !== listLauf) return;
      liste = l;
      if (!l.length) { box.innerHTML = '<div class="fehler">In der Nähe ist kein kostenloser Parkplatz in OpenStreetMap eingetragen.</div>'; return; }
      box.innerHTML = '<h3 class="ueber">' + sym('parken') + l.length + ' kostenlose' + (l.length === 1 ? 'r Parkplatz' : ' Parkplätze') + (ziel ? ' am Ziel' : ' in der Nähe') + '</h3>' + l.slice(0, 80).map(function (x, i) {
        var mehr = [x.art, G.km(x.weit), x.plaetze ? x.plaetze + ' Plätze' : '', x.dauer ? 'max. ' + x.dauer : '', x.scheibe ? 'Parkscheibe' : ''].filter(Boolean).join(' · ');
        return '<button class="eintrag" data-tun="parkfrei-wahl" data-i="' + i + '">' + sym('parken') + '<div class="txt"><b>' + h(x.name) + '</b><span>' + h(mehr) + '</span></div>' + sym('rechts') + '</button>';
      }).join('') + '<p class="klein2" style="text-align:center">Daten: OpenStreetMap (Parkplätze mit „kostenlos“). Ohne Gewähr – Schilder vor Ort gelten.</p>';
    }).catch(function () {
      var box = $('#pkliste'); if (box && meins === listLauf) box.innerHTML = '<div class="fehler">Die Kartendienste (OpenStreetMap) antworten gerade nicht. Bitte gleich noch einmal versuchen.</div><button class="rand knopf breit" style="margin-top:10px" data-tun="parkfrei">' + sym('neu') + 'Nochmal versuchen</button>';
    });
  };
  Tun['parkfrei-wahl'] = function (el) { var x = liste[+el.getAttribute('data-i')]; if (x) blatt(x); };
})();
