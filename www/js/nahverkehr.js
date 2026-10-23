/* Seite „Suche Nahverkehr“ (Knopf unten in der Leiste):
 * Züge, U-Bahn, Straßenbahn, Busse, Schiffe oder Flugzeuge wählen, Namen eintippen (z. B. „Hamburg Airport“, „Leer Bahnhof“, „Norddeich Mole“)
 * → die Abfahrtstafel des besten Treffers geht sofort auf. Die übrigen Treffer stehen darunter zum Antippen. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, K = FV.K, sym = FV.sym, Se = FV.Seiten, Tun = FV.Tun, X = FV.SX, h = X.h;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }

  var ARTEN = [['zug', 'zug', 'Züge'], ['ubahn', 'tram', 'U-Bahn'], ['tram', 'tram', 'Straßenbahn'], ['bus', 'bus', 'Busse'], ['schiff', 'schiff', 'Schiffe'], ['flug', 'flug', 'Flugzeuge'], ['dampf', 'dampf', 'Dampfzüge'], ['esaeule', 'laden', 'E-Säulen']];
  var BEISPIEL = { zug: 'Bahnhof, z. B. Hamburg Hbf', ubahn: 'Station, z. B. Jungfernstieg', tram: 'Haltestelle, z. B. Bremen Domsheide', bus: 'Haltestelle, z. B. Leer Bahnhof', schiff: 'Anleger, z. B. Norddeich Mole', flug: 'Flughafen, z. B. Hamburg Airport', dampf: 'Ort, z. B. Norden – leer: in der Nähe', esaeule: 'Ort, z. B. Hamburg – leer: in der Nähe' };
  var WAS = { dampf: 'Dampfzug', zug: 'Bahnhof', ubahn: 'U-Bahn-Station', tram: 'Straßenbahn-Haltestelle', bus: 'Haltestelle', schiff: 'Schiffsanleger', flug: 'Flughafen' };
  function zustand() { var z = A().z; return z.nv || (z.nv = { art: 'zug', text: '', liste: null, titel: '' }); }
  var lauf = 0;

  Se.nahverkehr = function () {
    var s = zustand();
    X.seite(X.kopf('Suche Nahverkehr', '', false) + '<div class="rollen">' +
      '<div class="modi nvarten" style="padding:0 0 10px;display:grid;grid-template-columns:repeat(4,1fr)">' + ARTEN.map(function (a) { return '<button data-tun="nv-art" data-a="' + a[0] + '"' + (a[0] === s.art ? ' class="akt"' : '') + '>' + sym(a[1]) + '<span>' + a[2] + '</span></button>'; }).join('') + '</div>' +
      '<form data-form="nv-suchen"><div class="suchfeld">' + sym('suche') + '<input id="nvtext" placeholder="' + h(BEISPIEL[s.art]) + '" autocomplete="off" enterkeyhint="search" value="' + h(s.text) + '"><button type="button" data-tun="nv-leer" aria-label="Leeren">' + sym('zu') + '</button></div>' +
      '<button class="gold knopf breit" style="margin-top:10px">' + sym('suche') + 'Suchen</button></form>' +
      '<div id="nvliste" style="margin-top:8px"></div><div style="height:10px"></div></div>');
    if (s.art === 'dampf' && s.dampf) dampfZeigen(s.dampf);
    else if (s.art === 'esaeule' && s.es) esZeigen(s.es, true);
    else if (s.liste) zeigen(s.titel, s.liste);
  };
  Tun['nv-art'] = function (el) {
    var s = zustand(); s.art = el.getAttribute('data-a'); s.liste = null;
    [].forEach.call(document.querySelectorAll('.nvarten button'), function (b) { b.classList.toggle('akt', b === el); });
    var i = $('#nvtext'), box = $('#nvliste'); if (box) box.innerHTML = '';
    if (i) { i.placeholder = BEISPIEL[s.art]; if (i.value.trim()) Tun['nv-suchen'](); else i.focus(); }
  };
  Tun['nv-leer'] = function () { var i = $('#nvtext'), s = zustand(); s.text = ''; s.liste = null; if (i) { i.value = ''; i.focus(); } var b = $('#nvliste'); if (b) b.innerHTML = ''; };
  Tun['nv-suchen'] = function () {
    var i = $('#nvtext'), t = ((i && i.value) || '').trim(), s = zustand(), art = s.art, box = $('#nvliste'), meins = ++lauf;
    if (art === 'dampf') { if (i) i.blur(); s.text = t; dampfSuchen(t, meins); return; }
    if (art === 'esaeule') { if (i) i.blur(); s.text = t; esSuchen(t, meins); return; }
    if (!t) { A().toast('Bitte eintippen, wonach gesucht werden soll.'); if (i) i.focus(); return; }
    if (i) i.blur();   // Tastatur zu, damit die Tafel ganz zu sehen ist
    s.text = t; s.liste = null;
    box.innerHTML = X.laedt(WAS[art] + ' wird gesucht …');
    var offen = false; A().z.hafenGeoeffnet = false;
    var hafen = null;
    function anzeigen(l) {
      if (meins !== lauf) return;
      if (l.length && l[0].typ === 'hafen') hafen = l[0];
      else if (hafen) l = [hafen].concat(l);
      s.liste = l; s.titel = 'Treffer zu „' + t + '“';
      zeigen(s.titel, l);
      if (!offen && l.length && $('#nvliste')) { offen = true; oeffnen(l[0]); }
      else if (offen && hafen && l[0] === hafen && !$('#hafen') && !A().z.hafenGeoeffnet) { A().z.hafenGeoeffnet = true; oeffnen(hafen); }   // bester Treffer: Tafel sofort auf
    }
    // Nach höchstens 40 Sekunden ist Schluss – nie endlos „wird gesucht“
    frist(finden(t, art, function (teil) { if (teil.length) anzeigen(teil); }), 40000, null).then(function (l) {
      if (meins !== lauf) return;
      if (l === null) { if (!offen) fehler('Die Auskunft antwortet gerade nicht.'); return; }
      if (l.length || !offen) anzeigen(l);
    }).catch(function () { if (meins === lauf && !offen) fehler('Die Suche hat gerade nicht geklappt.'); });
    function fehler(text) {
      var b2 = $('#nvliste'); if (!b2) return;
      b2.innerHTML = '<div class="fehler">' + h(text) + ' Bitte Internet prüfen und noch einmal versuchen.</div><button class="rand knopf breit" style="margin-top:10px" data-tun="nv-suchen">' + sym('neu') + 'Nochmal versuchen</button>';
    }
  };

  /* ---------- Suchen ---------- */
  /** Wartet höchstens ms Millisekunden; danach (oder bei Fehler) kommt ersatz */
  function frist(w, ms, ersatz) {
    return new Promise(function (ok) {
      var t = setTimeout(function () { ok(ersatz); }, ms);
      w.then(function (x) { clearTimeout(t); ok(x); }, function () { clearTimeout(t); ok(ersatz); });
    });
  }
  var FLUG_WORT = /\b(flughafen|airport|aeroporto|aeropuerto|aeroport|aéroport|lufthavn|flygplats|luchthaven|flugplatz|international|intl\.?|airfield)\b/gi;
  /** teil(liste): erste Treffer, sobald eine Quelle geantwortet hat (Schiffe: Bahn zuerst, Anleger aus OpenStreetMap kommen dazu) */
  function finden(text, art, teil) {
    if (art === 'flug') {
      var rein = text.replace(FLUG_WORT, ' ').replace(/\s+/g, ' ').trim() || text;
      var l = FV.FL.suchen(rein);
      if (!l.length && rein !== text) l = FV.FL.suchen(text);
      if (l.length) return Promise.resolve(l.map(function (f) { return Object.assign(f, { typ: 'flug', weit: weitVonMir(f) }); }));
      // Kein Flughafen mit dem Namen: Ort suchen und die Flughäfen dort nehmen (z. B. „Ostrhauderfehn“ → Bremen)
      return frist(ortFinden(text), 20000, null).then(function (p) {
        if (!p) return [];
        return FV.FL.nahe(p, 200000).map(function (f) { return Object.assign(f, { typ: 'flug', abOrt: f.weit, weit: weitVonMir(f) }); });
      });
    }
    var bahn = frist(FV.V.stationSuche(text, art), 15000, []).then(function (l) {
      return l.map(function (b) { return Object.assign(b, { typ: art, weit: weitVonMir(b) }); });
    });
    if (art === 'schiff') {
      // Hafen-Tafel (alle Schiffe per AIS) als erster Treffer, sobald der Ort bekannt ist
      var ortP = frist(ortFinden(text), 20000, null);
      ortP.then(function (p) { if (p) teil([hafenEintrag(text, p)]); });
      // Bahn und OpenStreetMap gleichzeitig fragen – viele Fähren (z. B. Travemünde) kennt die Bahn nicht
      var osm = frist(ortP.then(function (p) { if (!p) throw new Error('kein Ort'); return anlegerAmOrt(p); }), 25000, null);
      bahn.then(function (l) { if (l.length) teil(l); });
      var hafenP = ortP;
      // Antwortet die Bahn nicht binnen 6 Sekunden, schon mal die Anleger aus OpenStreetMap zeigen
      Promise.all([osm, frist(bahn, 6000, [])]).then(function (t) { if (t[0] && !t[1].length) { var l0 = mischen([], t[0]); if (l0.length) teil(l0); } });
      return Promise.all([bahn, osm, hafenP]).then(function (t) { var l = mischen(t[0], t[1]); return t[2] ? [hafenEintrag(text, t[2])].concat(l) : l; });
    }
    return bahn.then(function (aus) {
      if (aus.length) return aus;
      // Bahn kennt den Namen nicht: als Ort suchen und Bahnhöfe bzw. Haltestellen dort zeigen
      return frist(ortFinden(text).then(function (p) {
        var w = art === 'zug' ? FV.V.bahnhoefe(p, 30000) : art === 'ubahn' ? FV.V.haltestellen(p, 5000, 'stadt').then(function (l3) { return l3.filter(function (b) { return b.ubahn; }); }) : art === 'tram' ? FV.V.haltestellen(p, 2000, 'tram') : FV.V.haltestellen(p, 1500, 'bus');
        return w.then(function (l2) { return l2.slice(0, 25).map(function (b) { return Object.assign({}, b, { typ: art, tafelArt: art === 'bus' ? 'nurbus' : art, abOrt: b.weit, weit: weitVonMir(b) }); }); });
      }), 20000, []);
    });
  }
  /** Schiffsanleger am gesuchten Ort: Bahn „in der Nähe“ und Fähranleger aus OpenStreetMap (beide mit Zeitgrenze) */
  function anlegerAmOrt(p) {
    return Promise.resolve(p).then(function (p) {
      return Promise.all([frist(FV.V.haltestellen(p, 10000, 'schiff'), 6000, []), frist(FV.V.faehren(p), 20000, [])]).then(function (t) {
        return { p: p, liste: t[0].concat(t[1]) };
      });
    });
  }
  function mischen(bahn, osm) {
    if (!osm) return bahn;
    var l = bahn.slice(), p = osm.p;
    osm.liste.forEach(function (a) {
      var gleich = l.filter(function (b) { return G.abstand(a, b) < 500; })[0];
      if (gleich) { if (!gleich.web && a.web) gleich.web = a.web; if (!gleich.betreiber && a.betreiber) gleich.betreiber = a.betreiber; return; }
      l.push(Object.assign({}, a, { typ: 'schiff', tafelArt: 'schiff', abOrt: Math.round(G.abstand(p, a)), weit: weitVonMir(a) }));
    });
    // Bahn-Treffer zuerst (die haben einen Fahrplan), dann nach Nähe zum gesuchten Ort
    var vonBahn = l.slice(0, bahn.length), rest = l.slice(bahn.length).sort(function (a, b) { return a.abOrt - b.abOrt; });
    return vonBahn.concat(rest).slice(0, 30);
  }
  function ortFinden(text) {
    return G.suche(text, B.ort(), true).then(function (l) {
      if (!l.length) throw new Error('nicht gefunden');
      return { lat: l[0].lat, lon: l[0].lon, name: l[0].name };
    });
  }
  function weitVonMir(x) { var o = B.ort(); return o && x.lat != null ? Math.round(G.abstand(o, x)) : null; }

  /* ---------- Anzeigen und Tafel öffnen ---------- */
  function zeigen(titel, l) {
    var box = $('#nvliste'), s = zustand(); if (!box) return;
    if (!l.length) { box.innerHTML = '<div class="fehler">Dazu wurde kein ' + WAS[s.art] + ' gefunden. Bitte anders schreiben, zum Beispiel mit Ort davor (Leer Bahnhof).</div>'; return; }
    box.innerHTML = '<h3 class="ueber">' + sym(s.art === 'ubahn' ? 'tram' : s.art) + h(titel) + '</h3>' + l.map(function (x, i) {
      var unter = [];
      if (x.typ === 'flug') unter.push(FV.FL.ortText(x));
      else if (x.typ === 'zug') { var a = X.bfArt(x) || [x.zug ? 'Zug' : '', x.sbahn ? 'S-Bahn' : '', x.ubahn ? 'U-Bahn' : ''].filter(Boolean).join(' · '); if (a) unter.push(a); }
      else if (x.typ === 'tram') unter.push([x.tram ? 'Straßenbahn' : '', x.ubahn ? 'U-Bahn' : '', x.bus ? 'Bus' : ''].filter(Boolean).join(' · '));
      else if (x.typ === 'ubahn') unter.push([x.ubahn ? 'U-Bahn' : '', x.sbahn ? 'S-Bahn' : '', x.bus ? 'Bus' : ''].filter(Boolean).join(' · '));
      else if (x.typ === 'schiff') unter.push(x.betreiber || (x.osm ? 'Fähranleger' : 'Fähre / Schiff'));
      if (x.abOrt != null && x.abOrt > 300) unter.push(G.km(x.abOrt) + ' vom Ort');
      if (x.weit != null) unter.push(G.km(x.weit) + ' von hier');
      if (x.typ === 'hafen') return '<div class="eintrag tippbar zielbf" data-tun="nv-oeffnen" data-i="' + i + '">' + sym('schiff') + '<div class="txt"><b>Hafen ' + h(x.name) + '</b><span>Alle Schiffe: im Hafen, läuft ein, läuft aus (live)</span></div><div class="ende"><span class="wert" style="font-size:13px">Schiffe</span>' + sym('rechts') + '</div></div>';
      return '<div class="eintrag tippbar' + (x.typ === 'flug' ? ' flug' : '') + (i === 0 ? ' zielbf' : '') + '" data-tun="nv-oeffnen" data-i="' + i + '">' + sym(x.typ === 'ubahn' ? 'tram' : x.typ) +
        '<div class="txt"><b>' + h(x.name) + (x.iata ? ' <small class="iata">' + h(x.iata) + '</small>' : '') + (x.typ === 'bus' && X.haltZeichen ? X.haltZeichen(x) : '') + '</b><span>' + h(unter.filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="ende"><span class="wert" style="font-size:13px">' + (x.typ === 'flug' ? 'Flüge' : 'Abfahrten') + '</span>' + sym('rechts') + '</div></div>';
    }).join('') + '<p class="klein2" style="text-align:center">' + (s.art === 'flug' ? 'Flugtafel: AeroDataBox (über die Verwaltung).' : s.art === 'schiff' ? 'Fahrplan: Deutsche Bahn, sonst bei der Reederei.' : 'Abfahrten und Ankünfte live von der Deutschen Bahn.') + ' Ohne Gewähr.</p>';
  }
  function oeffnen(x) {
    if (x.typ === 'hafen') { A().z.hafenGeoeffnet = true; hafenBlatt(x); return; }
    if (x.typ === 'flug') { X.flugBlatt(x, false); return; }
    X.tafelBlatt(x, false, x.tafelArt || x.typ, true);
  }
  /* ---------- Dampfzüge: Museums- und Dampfbahnen (OpenStreetMap, weltweit) ----------
   * Fahrtage stehen in keinem Fahrplan der Bahn – deshalb Liste mit Strecke, Betreiber und Link zu den Fahrtagen. */
  var DAMPF_KM = 60;
  function dampfSuchen(text, meins) {
    var s = zustand(), box = $('#nvliste'); s.dampf = null;
    box.innerHTML = X.laedt('Dampf- und Museumsbahnen werden gesucht …');
    var wo = text ? frist(ortFinden(text), 20000, null) : X.startpunkt().then(function (p) { return { lat: p.lat, lon: p.lon, name: 'Ihrem Standort' }; }, function () { return null; });
    wo.then(function (p) {
      if (meins !== lauf) return;
      if (!p) { dampfFehler(text ? 'Der Ort „' + text + '“ wurde nicht gefunden.' : 'Der Standort ist gerade nicht bekannt. Bitte einen Ort eintippen.'); return; }
      var fertig = 0, offen = 3, punkte = null, bahnen = null, wiki = null, gruende = [];
      var hinweis = setTimeout(function () { var b0 = $('#nvliste'); if (b0 && meins === lauf && !s.dampf) b0.innerHTML = X.laedt('Dampf- und Museumsbahnen werden gesucht … (das dauert in großen Städten etwas länger)'); }, 10000);
      function weiter() {
        if (meins !== lauf) return;
        if (punkte === null && bahnen === null && wiki === null) { if (fertig === offen) { clearTimeout(hinweis); dampfFehler('Die Kartendaten (OpenStreetMap und Wikidata) antworten gerade nicht.', gruende); } return; }
        var l = dampfMischen(p, bahnen || [], (punkte || []).concat(wiki || []));
        if (!l.length && fertig < offen) return;   // noch warten, vielleicht kommt noch etwas
        clearTimeout(hinweis);
        s.dampf = { ort: p.name || text, liste: l, laedt: fertig < offen };
        dampfZeigen(s.dampf);
      }
      function merkGrund(e) { if (e && Array.isArray(e.gruende)) e.gruende.forEach(function (g) { if (gruende.indexOf(g) < 0) gruende.push(g); }); else if (e) gruende.push(String(e.message || e)); return null; }
      // Drei Quellen gleichzeitig: Bahnhöfe/Museen und Strecken (OpenStreetMap) sowie Wikidata als zweiter Anbieter –
      // was zuerst kommt, steht zuerst da; fällt ein Anbieter aus, reichen die anderen.
      frist(dampfPunkte(p).catch(merkGrund), 45000, null).then(function (x) { punkte = x; fertig++; weiter(); });
      frist(dampfStrecken(p).catch(merkGrund), 45000, null).then(function (x) { bahnen = x; fertig++; weiter(); });
      frist(dampfWikidata(p).catch(function (e) { gruende.push('Wikidata: ' + String(e && e.message || e)); return null; }), 30000, null).then(function (x) { wiki = x; fertig++; weiter(); });
    });
  }
  function dampfFehler(t, gruende) {
    var b = $('#nvliste'); if (b) b.innerHTML = '<div class="fehler">' + h(t) + (gruende && gruende.length ? FV.V.grundHtml({ gruende: gruende }) : '') + '</div><button class="rand knopf breit" style="margin-top:10px" data-tun="nv-suchen">' + sym('neu') + 'Nochmal versuchen</button>';
  }
  /** Rechteck statt Kreis: das können die Kartenserver viel schneller beantworten (wichtig im dichten Ruhrgebiet) */
  function dampfBox(p) {
    var dl = DAMPF_KM / 111, dn = dl / Math.max(0.2, Math.cos(p.lat * Math.PI / 180));
    return '(' + [p.lat - dl, p.lon - dn, p.lat + dl, p.lon + dn].map(function (x) { return x.toFixed(3); }).join(',') + ')';
  }
  function dampfPunkte(p) {
    var bb = dampfBox(p);
    var q = '[out:json][timeout:30];(nwr["railway"~"^(station|halt)$"]["usage"="tourism"]' + bb + ';nwr["tourism"="museum"]["museum"~"railway|transport"]' + bb + ';nwr["tourism"="attraction"]["attraction"~"heritage_railway|train"]' + bb + ';);out center tags 200;';
    return FV.V.osmSchnell(q, 7 * 86400).then(function (j) {
      return (j.elements || []).map(function (e) {
        var t = e.tags || {}, c = e.center || (e.lat != null ? { lat: e.lat, lon: e.lon } : null); if (!c || !t.name) return null;
        return { art: /^(station|halt)$/.test(t.railway || '') ? 'halt' : 'museum', name: t.name, lat: c.lat, lon: c.lon, web: t.website || t['contact:website'] || t.url || '', betreiber: t.operator || '' };
      }).filter(Boolean);
    });
  }
  /** Strecken: zuerst die Gleise der Museumsbahnen im Rechteck (schnell), dann deren Routen über die Gleise
   *  (statt alle Routen im Rechteck zu durchsuchen – das war in großen Gebieten zu langsam für die Kartenserver). */
  function dampfStrecken(p) {
    var bb = dampfBox(p);
    var q = '[out:json][timeout:35];(way["railway"="preserved"]' + bb + ';way["railway"~"^(rail|narrow_gauge|light_rail)$"]["usage"="tourism"]' + bb + ';)->.w;' +
      '(rel(bw.w)["type"="route"]["route"~"^(train|railway|tracks)$"]["service"="tourism"];rel(bw.w)["type"="route"]["route"~"^(train|railway|tracks)$"]["heritage"];)->.r;' +
      '.r out center tags 100;.w out center tags 300;';
    return FV.V.osmSchnell(q, 7 * 86400).then(function (j) {
      var bahnen = {};
      (j.elements || []).forEach(function (e) {
        var t = e.tags || {}, c = e.center; if (!c) return;
        var name = t.name || [t.from, t.to].filter(Boolean).join(' – ') || t.operator; if (!name) return;
        var k = FV.norm(t.operator || name);
        var x = bahnen[k] || (bahnen[k] = { art: 'bahn', name: t.operator && t.operator.length < 60 ? t.operator : name, strecken: [], lat: c.lat, lon: c.lon, web: '', betreiber: t.operator || '' });
        var str = e.type === 'relation' ? ([t.from, t.to].filter(Boolean).join(' – ') || t.name || '') : '';
        if (str && x.strecken.indexOf(str) < 0) x.strecken.push(str);
        var web = t.website || t['contact:website'] || t.url || '';
        if (!x.web && web) x.web = web;
      });
      return Object.keys(bahnen).map(function (k) { return bahnen[k]; });
    });
  }
  /** Zweiter Anbieter: Wikidata (Museumsbahnen und Eisenbahnmuseen mit Koordinaten, weltweit, mit Webseite) */
  function dampfWikidata(p) {
    var q = 'SELECT ?item ?itemLabel ?coord ?web ?lab WHERE {' +
      ' hint:Query hint:optimizer "None".' +
      ' SERVICE wikibase:around { ?item wdt:P625 ?coord. bd:serviceParam wikibase:center "Point(' + p.lon.toFixed(4) + ' ' + p.lat.toFixed(4) + ')"^^geo:wktLiteral. bd:serviceParam wikibase:radius "' + DAMPF_KM + '". }' +
      ' ?item wdt:P31 ?typ. ?typ rdfs:label ?lab.' +
      ' FILTER(?lab IN ("heritage railway"@en, "tourist railway"@en, "museum railway"@en, "railway museum"@en))' +
      ' OPTIONAL { ?item wdt:P856 ?web. }' +
      ' SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }' +
      '} LIMIT 300';
    return B.json({ url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), kopf: { 'Accept': 'application/sparql-results+json' }, zeit: 28000 }).then(function (j) {
      var gesehen = {};
      return ((j.results && j.results.bindings) || []).map(function (r) {
        var id = r.item && r.item.value, name = r.itemLabel && r.itemLabel.value, m = String(r.coord && r.coord.value || '').match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
        if (!id || !m || !name || /^Q\d+$/.test(name) || gesehen[id]) return null;
        gesehen[id] = 1;
        var museum = /museum/.test(r.lab && r.lab.value || '');
        return { art: museum ? 'museum' : 'bahn', name: name, lat: +m[2], lon: +m[1], web: r.web ? r.web.value : '', betreiber: '', strecken: [] };
      }).filter(Boolean);
    });
  }
  function dampfMischen(p, bahnen, punkte) {
    var l = bahnen.map(function (b) { return Object.assign({}, b, { strecken: b.strecken.slice() }); });
    punkte.forEach(function (m) {
      if (m.art === 'halt') {
        var nah = l.filter(function (b) { return b.betreiber && m.betreiber && FV.norm(b.betreiber) === FV.norm(m.betreiber); })[0];
        if (nah) { if (!nah.web && m.web) nah.web = m.web; return; }
      }
      if (l.some(function (b) { return FV.norm(b.name) === FV.norm(m.name); })) return;
      l.push(Object.assign({}, m));
    });
    l.forEach(function (x) { x.abOrt = Math.round(G.abstand(p, x)); x.weit = weitVonMir(x); });
    var RANG = { bahn: 0, halt: 1, museum: 2 };
    return l.filter(function (x) { return x.abOrt <= DAMPF_KM * 1000 * 1.05; }).sort(function (a, b) { return RANG[a.art] - RANG[b.art] || a.abOrt - b.abOrt; }).slice(0, 40);
  }
  var DAMPF_ART = { bahn: 'Museums-/Dampfbahn', halt: 'Museumsbahnhof', museum: 'Eisenbahnmuseum' };
  function dampfZeigen(d) {
    var box = $('#nvliste'); if (!box) return;
    if (!d.liste.length) { box.innerHTML = '<div class="fehler">Im Umkreis von ' + DAMPF_KM + ' km um ' + h(d.ort) + ' ist keine Dampf- oder Museumsbahn eingetragen.</div>'; return; }
    box.innerHTML = '<h3 class="ueber">' + sym('dampf') + 'Dampf- und Museumsbahnen bei ' + h(d.ort) + '</h3>' + d.liste.map(function (x, i) {
      var unter = [DAMPF_ART[x.art], x.strecken && x.strecken.length ? x.strecken.slice(0, 2).join(', ') : '', x.abOrt > 300 ? G.km(x.abOrt) + ' vom Ort' : 'im Ort'].filter(Boolean);
      return '<div class="eintrag tippbar" data-tun="dampf-oeffnen" data-i="' + i + '">' + sym(x.art === 'museum' ? 'info' : 'dampf') +
        '<div class="txt"><b>' + h(x.name) + '</b><span>' + h(unter.join(' · ')) + '</span></div><div class="ende"><span class="wert" style="font-size:13px">' + (x.art === 'museum' ? 'Infos' : 'Fahrtage') + '</span>' + sym('rechts') + '</div></div>';
    }).join('') + (d.laedt ? X.laedt('Weitere werden noch gesucht …') : '') + '<p class="klein2" style="text-align:center">Museums- und Dampfbahnen: © OpenStreetMap-Mitwirkende. Die Fahrtage legen die Vereine selbst fest – sie stehen auf deren Webseite, nicht im Fahrplan der Bahn.</p>';
  }
  Tun['dampf-oeffnen'] = function (el) {
    var d = zustand().dampf, x = d && d.liste[+el.getAttribute('data-i')]; if (!x) return;
    A().z.dampfWahl = x;
    var mu = x.art === 'museum', wort = mu ? 'Öffnungszeiten' : 'Fahrtage';
    var such = 'https://www.google.com/search?q=' + encodeURIComponent(x.name + ' ' + wort + ' ' + new Date().getFullYear());
    A().blatt('<h2>' + sym('dampf') + '<span>' + h(x.name) + '<br><small style="font-weight:400;font-size:13px">' + h([DAMPF_ART[x.art], x.weit != null ? G.km(x.weit) + ' von hier' : ''].filter(Boolean).join(' · ')) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      (x.strecken && x.strecken.length ? '<div class="detailzeile">' + sym('route') + '<div><small>Strecke</small>' + x.strecken.map(h).join('<br>') + '</div></div>' : '') +
      (x.betreiber && x.betreiber !== x.name ? '<div class="detailzeile">' + sym('info') + '<div><small>Betreiber</small>' + h(x.betreiber) + '</div></div>' : '') +
      '<p class="klein2" style="margin:8px 2px">' + (mu ? 'Öffnungszeiten, Preise und Fahrtage mit Dampf stehen auf der Webseite des Museums.' : 'Wann der Dampfzug fährt, legt der Verein selbst fest. Die Fahrtage und Preise stehen auf seiner Webseite.') + '</p>' +
      (x.web ? '<button class="gold knopf breit" data-tun="oeffnen" data-url="' + h(/^https?:/i.test(x.web) ? x.web : 'https://' + x.web) + '">' + sym('extern') + wort + ' auf der Webseite</button><div style="height:8px"></div>' : '') +
      '<button class="' + (x.web ? 'rand' : 'gold') + ' knopf breit" data-tun="oeffnen" data-url="' + h(such) + '">' + sym('suche') + wort + ' im Internet suchen</button><div style="height:8px"></div>' +
      '<button class="rand knopf breit" data-tun="dampf-hin">' + sym('auto') + 'Hinfahren</button>');
    if (FV.BILD) {
      var bx = $('#blatt h2'); if (bx) bx.insertAdjacentHTML('afterend', FV.BILD.platz('Foto wird gesucht …'));
      FV.BILD.zeigen(FV.BILD.reihe([function () { return FV.BILD.wiki(x.name, 'de'); }, function () { return FV.BILD.wikiSuche(x.name, 'de'); },
        function () { return FV.BILD.wiki(mu ? 'Eisenbahnmuseum' : 'Museumsbahn', 'de', 'Beispielfoto'); }]), x.name);
    }
  };
  Tun['dampf-hin'] = function () {
    var x = A().z.dampfWahl; if (!x) return; A().blattZu();
    A().zeige('vorschau', { ziel: { name: x.name, adresse: DAMPF_ART[x.art], lat: x.lat, lon: x.lon, art: 'frei' }, modus: 'auto' });
  };
  /* ---------- E-Säulen: alle Ladesäulen für Autos in einer Stadt oder einem Dorf (OpenStreetMap, weltweit) ----------
   * Ort eintippen → ganzes Gemeindegebiet (OSM-Grenze), sonst Umkreis 3 km; leer → 5 km um den Standort.
   * Oben eine Karte mit allen Säulen, darunter die Liste. Antippen → Einzelheiten (Stecker, kW, Betreiber, Kosten) im App-Fenster. */
  var ES_SEITE = 100;
  var STECKER = [['type2_combo', 'CCS'], ['chademo', 'CHAdeMO'], ['tesla_supercharger_ccs', 'Tesla (CCS)'], ['tesla_supercharger', 'Tesla Supercharger'], ['type2', 'Typ 2'], ['type2_cable', 'Typ 2 mit Kabel'],
    ['type1_combo', 'CCS Typ 1'], ['type1', 'Typ 1'], ['schuko', 'Schuko'], ['cee_blue', 'CEE blau'], ['cee_red_16a', 'CEE rot 16 A'], ['cee_red_32a', 'CEE rot 32 A'], ['type3c', 'Typ 3']];
  function esSuchen(text, meins) {
    var s = zustand(), box = $('#nvliste'); s.es = null;
    box.innerHTML = X.laedt('E-Ladesäulen werden gesucht …');
    var wo = text ? frist(G.suche(text, B.ort(), true).then(function (l) { if (!l.length) throw new Error('leer'); return l[0]; }), 20000, null)
      : X.startpunkt().then(function (p) { return { lat: p.lat, lon: p.lon, name: 'Ihrem Standort', nahe: true }; }, function () { return null; });
    wo.then(function (p) {
      if (meins !== lauf) return;
      if (!p) { esFehler(text ? 'Der Ort „' + text + '“ wurde nicht gefunden.' : 'Der Standort ist gerade nicht bekannt. Bitte einen Ort eintippen.'); return; }
      var ort = p.nahe ? 'Ihrem Standort' : (p.name || text);
      var hinweis = setTimeout(function () { var b0 = $('#nvliste'); if (b0 && meins === lauf && !s.es) b0.innerHTML = X.laedt('E-Ladesäulen werden gesucht … (in großen Städten dauert das etwas länger)'); }, 10000);
      esHolen(p).then(function (l) {
        clearTimeout(hinweis); if (meins !== lauf) return;
        s.es = { ort: ort, mitte: { lat: p.lat, lon: p.lon }, liste: l, zeigen: ES_SEITE, nurSchnell: false };
        esZeigen(s.es);
      }).catch(function (e) { clearTimeout(hinweis); if (meins === lauf) esFehler('Die Kartendaten (OpenStreetMap) antworten gerade nicht.', e && e.gruende); });
    });
  }
  function esFehler(t, gruende) {
    var b = $('#nvliste'); if (b) b.innerHTML = '<div class="fehler">' + h(t) + (gruende && gruende.length ? FV.V.grundHtml({ gruende: gruende }) : '') + '</div><button class="rand knopf breit" style="margin-top:10px" data-tun="nv-suchen">' + sym('neu') + 'Nochmal versuchen</button>';
  }
  /** Ganze Stadt/Gemeinde, wenn die Suche eine Grenze (Relation) geliefert hat – sonst Rechteck um den Ort */
  function esHolen(p) {
    var filter = '["amenity"="charging_station"]', q;
    if (!p.nahe && p.osmTyp === 'relation' && p.osmId && p.box && (p.box.n - p.box.s) < 2.5) {
      q = '[out:json][timeout:40];area(id:' + (3600000000 + +p.osmId) + ')->.a;nwr' + filter + '(area.a);out center tags;';
    } else {
      var r = p.nahe ? 5000 : 3000, dl = r / 111000, dn = dl / Math.max(0.2, Math.cos(p.lat * Math.PI / 180)), b = { s: p.lat - dl, n: p.lat + dl, w: p.lon - dn, o: p.lon + dn };
      if (!p.nahe && p.box && (p.box.n - p.box.s) < 0.6 && (p.box.o - p.box.w) < 0.9) b = { s: Math.min(b.s, p.box.s), n: Math.max(b.n, p.box.n), w: Math.min(b.w, p.box.w), o: Math.max(b.o, p.box.o) };
      q = '[out:json][timeout:40];nwr' + filter + '(' + [b.s, b.w, b.n, b.o].map(function (x) { return x.toFixed(4); }).join(',') + ');out center tags;';
    }
    return FV.V.osmSchnell(q, 86400, 45000).then(function (j) {
      var l = (j.elements || []).map(function (e) { return esEintrag(e, p); }).filter(Boolean);
      l.sort(function (a, b) { return a.abOrt - b.abOrt; });
      return l;
    });
  }
  function kw(t) { var m = /([\d.,]+)\s*(kw|w)?/i.exec(String(t || '')); if (!m) return 0; var v = parseFloat(m[1].replace(',', '.')); if (/^w$/i.test(m[2] || '') || v > 2000) v = v / 1000; return v > 0 && v < 2000 ? v : 0; }
  function esEintrag(e, p) {
    var t = e.tags || {}, c = e.center || (e.lat != null ? { lat: e.lat, lon: e.lon } : null); if (!c) return null;
    if (/^(private|no)$/.test(t.access || '')) return null;
    if (t.motorcar === 'no' || t.motor_vehicle === 'no') return null;
    var stecker = [], maxKw = kw(t['charging_station:output'] || t.output || ''), autoStecker = false;
    STECKER.forEach(function (st) {
      var v = t['socket:' + st[0]]; if (!v || v === 'no') return;
      var n = parseInt(v, 10), k = kw(t['socket:' + st[0] + ':output']);
      if (k > maxKw) maxKw = k;
      if (st[0] !== 'schuko') autoStecker = true;
      stecker.push({ name: st[1], anzahl: n > 0 ? n : 0, kw: k });
    });
    // Ladestationen nur für Fahrräder (E-Bike) weglassen
    if (/^(yes|designated|only)$/.test(t.bicycle || '') && !autoStecker && !/^(yes|designated)$/.test(t.motorcar || '')) return null;
    var adresse = [[t['addr:street'] || '', t['addr:housenumber'] || ''].join(' ').trim(), [t['addr:postcode'] || '', t['addr:city'] || ''].join(' ').trim()].filter(Boolean).join(', ');
    var name = t.name || t.brand || t.operator || t.network || 'E-Ladesäule';
    return { name: name, lat: c.lat, lon: c.lon, betreiber: t.operator || t.network || t.brand || '', adresse: adresse, plaetze: parseInt(t.capacity, 10) || 0, stecker: stecker, kw: maxKw, schnell: maxKw >= 50,
      kosten: t.fee === 'no' ? 'kostenlos' : t.fee === 'yes' ? 'kostenpflichtig' : '', preis: t.charge || '', parken: t['parking:fee'] === 'no' ? 'Parken kostenlos' : t['parking:fee'] === 'yes' ? 'Parken kostet extra' : '',
      zeiten: t.opening_hours === '24/7' ? 'rund um die Uhr' : (t.opening_hours || ''), kunden: t.access === 'customers', bezahlen: esBezahlen(t), web: t.website || t['contact:website'] || '',
      abOrt: Math.round(G.abstand(p, c)), weit: weitVonMir(c) };
  }
  function esBezahlen(t) {
    var a = [], W = { app: 'App', nfc: 'Karte (NFC)', membership_card: 'Ladekarte', short_message: 'SMS', phone_call: 'Anruf', none: 'ohne Anmeldung' }, Z = { debit_cards: 'EC-Karte', credit_cards: 'Kreditkarte', contactless: 'kontaktlos', cash: 'bar' };
    Object.keys(W).forEach(function (k) { if (t['authentication:' + k] === 'yes') a.push(W[k]); });
    Object.keys(Z).forEach(function (k) { if (t['payment:' + k] === 'yes' && a.indexOf(Z[k]) < 0) a.push(Z[k]); });
    return a.join(', ');
  }
  function esSichtbar(d) { return d.nurSchnell ? d.liste.filter(function (x) { return x.schnell; }) : d.liste; }
  function esUnter(x) {
    var st = x.stecker.map(function (s) { return s.name; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).slice(0, 3).join(', ');
    return [x.kw ? String(Math.round(x.kw)) + ' kW' : '', st, x.plaetze ? x.plaetze + ' Ladepunkt' + (x.plaetze === 1 ? '' : 'e') : '', x.kunden ? 'nur für Kunden' : '', x.abOrt > 300 ? G.km(x.abOrt) + ' vom Ort' : 'im Ort'].filter(Boolean).join(' · ');
  }
  function esZeigen(d, wieder) {
    var box = $('#nvliste'); if (!box) return;
    if (!d.liste.length) { box.innerHTML = '<div class="fehler">' + (d.ort === 'Ihrem Standort' ? 'In der Nähe' : 'In ' + h(d.ort)) + ' ist keine E-Ladesäule in OpenStreetMap eingetragen.</div>'; K.esaeulen(null); return; }
    var l = esSichtbar(d), schnell = d.liste.filter(function (x) { return x.schnell; }).length;
    box.innerHTML = '<h3 class="ueber">' + sym('laden') + d.liste.length + ' E-Ladesäule' + (d.liste.length === 1 ? '' : 'n') + (d.ort === 'Ihrem Standort' ? ' in der Nähe' : ' in ' + h(d.ort)) + '</h3>' +
      '<div class="kartenfeld oevkarte" id="kfeld"><div class="quelle">© OpenStreetMap</div>' +
        '<div class="zoom"><button data-tun="zoom" data-n="1" aria-label="Größer">' + sym('plus') + '</button><button data-tun="zoom" data-n="-1" aria-label="Kleiner">' + sym('minus') + '</button></div></div>' +
      '<div class="modi" style="padding:10px 0 4px"><button data-tun="es-filter" data-s="0"' + (d.nurSchnell ? '' : ' class="akt"') + '><span>Alle (' + d.liste.length + ')</span></button>' +
        '<button data-tun="es-filter" data-s="1"' + (d.nurSchnell ? ' class="akt"' : '') + '><span>Schnelllader ab 50 kW (' + schnell + ')</span></button></div>' +
      '<div id="esliste">' + esListe(d) + '</div>';
    K.setzen($('#kfeld')).then(function () {
      if (zustand().es !== d || zustand().art !== 'esaeule') return;
      K.leeren();
      K.esaeulen(l, function (i) { esBlatt(l[i]); });
      var pts = l.map(function (x) { return [x.lon, x.lat]; });
      if (pts.length > 1) K.rahmen(pts, 30); else K.mitte(l[0] || d.mitte, 15);
    }).catch(function () {});
  }
  function esListe(d) {
    var l = esSichtbar(d);
    if (!l.length) return '<div class="gut">Keine Schnelllader ab 50 kW eingetragen.</div>';
    return l.slice(0, d.zeigen).map(function (x) {
      return '<div class="eintrag tippbar" data-tun="es-oeffnen" data-i="' + d.liste.indexOf(x) + '">' + sym('laden') +
        '<div class="txt"><b>' + h(x.name) + '</b><span>' + h(esUnter(x)) + '</span></div><div class="ende">' + sym('rechts') + '</div></div>';
    }).join('') + (l.length > d.zeigen ? '<button class="rand knopf breit" style="margin-top:8px" data-tun="es-mehr">' + sym('ab') + 'Weitere ' + Math.min(ES_SEITE, l.length - d.zeigen) + ' von ' + (l.length - d.zeigen) + ' anzeigen</button>' : '') +
      '<p class="klein2" style="text-align:center">E-Ladesäulen: © OpenStreetMap-Mitwirkende, ohne Gewähr. Ob eine Säule gerade frei ist, steht nicht in den Kartendaten.</p>';
  }
  Tun['es-filter'] = function (el) {
    var d = zustand().es; if (!d) return;
    d.nurSchnell = el.getAttribute('data-s') === '1'; d.zeigen = ES_SEITE;
    [].forEach.call(document.querySelectorAll('[data-tun=es-filter]'), function (b) { b.classList.toggle('akt', b === el); });
    var b = $('#esliste'); if (b) b.innerHTML = esListe(d);
    var l = esSichtbar(d); K.esaeulen(l, function (i) { esBlatt(l[i]); });
  };
  Tun['es-mehr'] = function () { var d = zustand().es; if (!d) return; d.zeigen += ES_SEITE; var b = $('#esliste'); if (b) b.innerHTML = esListe(d); };
  Tun['es-oeffnen'] = function (el) { var d = zustand().es, x = d && d.liste[+el.getAttribute('data-i')]; if (x) esBlatt(x); };
  function esBlatt(x) {
    if (!x) return;
    A().z.esWahl = x;
    function zeile(symb, k, t) { return t ? '<div class="detailzeile">' + sym(symb) + '<div><small>' + k + '</small>' + t + '</div></div>' : ''; }
    var st = x.stecker.map(function (s) { return h((s.anzahl ? s.anzahl + ' × ' : '') + s.name + (s.kw ? ' · ' + String(Math.round(s.kw * 10) / 10).replace('.', ',') + ' kW' : '')); }).join('<br>');
    A().blatt('<h2>' + sym('laden') + '<span>' + h(x.name) + '<br><small style="font-weight:400;font-size:13px">' + h([x.schnell ? 'Schnelllader' : 'E-Ladesäule', x.weit != null ? G.km(x.weit) + ' von hier' : ''].filter(Boolean).join(' · ')) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      zeile('ort', 'Adresse', h(x.adresse)) +
      zeile('info', 'Betreiber', x.betreiber && x.betreiber !== x.name ? h(x.betreiber) : '') +
      zeile('laden', 'Stecker', st || (x.kw ? 'bis ' + Math.round(x.kw) + ' kW' : 'nicht eingetragen')) +
      zeile('info', 'Ladepunkte', x.plaetze ? String(x.plaetze) : '') +
      zeile('uhr', 'Geöffnet', h(x.zeiten)) +
      zeile('info', 'Kosten', h([x.kosten, x.preis, x.parken].filter(Boolean).join(' · '))) +
      zeile('info', 'Bezahlen / Freischalten', h(x.bezahlen)) +
      zeile('warnung', 'Zugang', x.kunden ? 'nur für Kunden (z. B. Hotel, Supermarkt)' : '') +
      '<p class="klein2" style="margin:8px 2px">Ob die Säule gerade frei oder in Betrieb ist, zeigt meist die App oder Ladekarte des Betreibers.</p>' +
      '<button class="gold knopf breit" data-tun="es-hin">' + sym('auto') + 'Hinfahren</button>');
  }
  Tun['es-hin'] = function () {
    var x = A().z.esWahl; if (!x) return; A().blattZu();
    A().zeige('vorschau', { ziel: { name: x.name, adresse: x.adresse || 'E-Ladesäule', lat: x.lat, lon: x.lon, art: 'frei' }, modus: 'auto' });
  };
  /* ---------- Hafen-Tafel: alle Schiffe per AIS (Schiffsfunk) – im Hafen, läuft ein, läuft aus ----------
   * Nutzt dieselbe AIS-Verbindung wie „Schiffe live“ auf der Karte (Android-Teil + aisstream-Schlüssel). */
  var HAFEN_INNEN = 9000, HAFEN_AUSSEN = 45000;   // Meter: Hafen selbst / Zufahrt
  var LOCODE = { hamburg: 'DEHAM', bremerhaven: 'DEBRV', bremen: 'DEBRE', emden: 'DEEME', wilhelmshaven: 'DEWVN', cuxhaven: 'DECUX', kiel: 'DEKEL', luebeck: 'DELBC', travemuende: 'DETRV',
    rostock: 'DERSK', warnemuende: 'DEWAR', leer: 'DELEE', papenburg: 'DEPAP', brake: 'DEBKE', nordenham: 'DENHA', brunsbuettel: 'DEBRB', stade: 'DESTA', wismar: 'DEWIS', sassnitz: 'DESAS',
    puttgarden: 'DEPUT', norddeich: 'DENOD', rotterdam: 'NLRTM', amsterdam: 'NLAMS', eemshaven: 'NLEEM', delfzijl: 'NLDZL', antwerpen: 'BEANR', antwerp: 'BEANR', kopenhagen: 'DKCPH', goeteborg: 'SEGOT',
    oslo: 'NOOSL', danzig: 'PLGDN', gdansk: 'PLGDN', gdynia: 'PLGDY', stettin: 'PLSZZ', klaipeda: 'LTKLJ', riga: 'LVRIX', tallinn: 'EETLL', helsinki: 'FIHEL', le_havre: 'FRLEH', dover: 'GBDVR', southampton: 'GBSOU' };
  function hafenEintrag(text, p) { return { typ: 'hafen', name: (p.name && String(p.name).length < 40 ? p.name : text), suche: text, lat: p.lat, lon: p.lon }; }
  function richtung(a, b) {
    var y = Math.sin((b.lon - a.lon) * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180), x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180) - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos((b.lon - a.lon) * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function winkel(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function zielPasst(ziel, hf) {
    var z = FV.norm(ziel).replace(/\s+/g, ''); if (!z) return false;
    var n = FV.norm(hf.suche || hf.name).split(' ')[0], code = LOCODE[n] || '';
    return (n.length >= 4 && z.indexOf(n.slice(0, Math.min(n.length, 6))) >= 0) || (code && z.indexOf(code.toLowerCase()) >= 0) || (code && z.indexOf(code.slice(2).toLowerCase()) === 0 && z.length <= 6);
  }
  /* Kreuzfahrt- und Fährreedereien am Namen erkennen (AIS sagt nur „Passagierschiff“) */
  var KREUZ = /\b(AIDA[A-Z]*|MEIN SCHIFF|COSTA|MSC [A-Z]+|QUEEN|QUEEN MARY|NORWEGIAN|CELEBRITY|PRINCESS|EUROPA 2?|HANSEATIC|VIKING [A-Z]+|ARTANIA|AMADEA|VASCO DA GAMA|ICON|WONDER|SYMPHONY|HARMONY|ALLURE|OASIS|ODYSSEY|ANTHEM|QUANTUM|IONA|ARVIA|ARCADIA|AURORA|BRITANNIA|SEVEN SEAS|SILVER|SEABOURN|REGAL|AZAMARA|NATIONAL GEOGRAPHIC|HAMBURG|SPIRIT OF|BOREALIS|BALMORAL|SIRENA|MARINA|RIVIERA|VISTA|KONINGSDAM|ROTTERDAM|NIEUW|EURODAM|ZUIDERDAM|IDUNA|RENAISSANCE)\b/;
  var FAEHRE = /\b(STENA|FINN[A-Z]*|COLOR|PETER PAN|NILS HOLGERSSON|ROBIN HOOD|HUCKLEBERRY|TOM SAWYER|SCANDLINES|BERLIN|COPENHAGEN|PRINS|PRINSESSE|KRONPRINS|DEUTSCHLAND|SCHLESWIG|HOLSTEIN|DFDS|TALLINK|VIKING (GRACE|GLORY|XPRS|CINDERELLA|LINE)|GALAXY|BALTIC (QUEEN|PRINCESS)|SILJA|MEGASTAR|STAR|SUPERFAST|CONNECTA|SKANE|TRELLEBORG|URD|NORDLINK|FINNMAID|FINNLADY|SPIRIT|FRISIA|OSTFRIESLAND|HELGOLAND|HALUNDER|MUENSTERLAND|WESTFALEN|WAPPEN|SYLT|NORDERNEY|BORKUM)\b/;
  /** AIS-Ankunftszeit „10-23 06:30“ (Monat-Tag) → „23.10. 06:30“ */
  function etaText(e) { var m = /^(\d{1,2})-(\d{1,2})\s+(\d{1,2}:\d{2})/.exec(String(e || '')); return m ? ('0' + m[2]).slice(-2) + '.' + ('0' + m[1]).slice(-2) + '. ' + m[3] : String(e || ''); }
  function artText(s) {
    var a = FV.LIVE && FV.LIVE.hilfe ? FV.LIVE.hilfe.art(s.typ) : ['Schiff', '#9fb3c8'];
    if (s.typ >= 60 && s.typ <= 69) {
      var n = String(s.name || '').toUpperCase();
      if (KREUZ.test(n) || (s.laenge >= 260 && !FAEHRE.test(n))) return ['Kreuzfahrtschiff', a[1]];
      if (FAEHRE.test(n) || s.laenge >= 60) return ['Fähre / Passagierschiff', a[1]];
    }
    if (s.typ >= 70 && s.typ <= 79 && s.laenge >= 200) return ['Containerschiff / Frachter', a[1]];
    return a;
  }
  var hafenTimer = null;
  function hafenBlatt(hf, reiter) {
    var z = A().z; z.hafen = hf; z.hafenReiter = reiter || z.hafenReiter || 'liegt';
    var R = [['liegt', 'Im Hafen'], ['ein', 'Läuft ein'], ['aus', 'Läuft aus']];
    A().blatt('<h2>' + sym('schiff') + '<span>Hafen ' + h(hf.name) + '<br><small style="font-weight:400;font-size:13px">Alle Schiffe live (AIS)</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="modi" style="padding:0 0 8px">' + R.map(function (r) { return '<button data-tun="hafen-reiter" data-r="' + r[0] + '"' + (r[0] === z.hafenReiter ? ' class="akt"' : '') + '><span id="hz_' + r[0] + '">' + r[1] + '</span></button>'; }).join('') + '</div>' +
      '<div id="hafen">' + X.laedt('Schiffe werden empfangen …') + '</div>' +
      '<p class="klein2" style="text-align:center">Schiffsfunk (AIS) über aisstream.io, ohne Gewähr. Ankunftszeit und Ziel gibt das Schiff selbst an. Kleine Boote senden oft kein AIS.</p>');
    if (!B.hatExtra()) { $('#hafen').innerHTML = '<div class="fehler">Die Hafen-Tafel gibt es nur in der App auf dem Handy.</div>'; return; }
    var k = FV.LIVE && FV.LIVE.aisSchluessel ? FV.LIVE.aisSchluessel() : '';
    if (!k) { $('#hafen').innerHTML = '<div class="fehler">Für die Schiffe fehlt der kostenlose aisstream-Schlüssel. Bitte unter Einstellungen → Züge und Schiffe live eintragen.</div>'; return; }
    var dl = HAFEN_AUSSEN / 111000, dn = dl / Math.max(0.2, Math.cos(hf.lat * Math.PI / 180)), box = { s: hf.lat - dl, n: hf.lat + dl, w: hf.lon - dn, o: hf.lon + dn };
    var start = Date.now();
    function holen() {
      if (!$('#hafen') || A().z.hafen !== hf) { clearInterval(hafenTimer); return; }
      B.extra('aisStart', { schluessel: k, s: box.s, w: box.w, n: box.n, o: box.o });
      var st = B.extra('aisStand', '');
      if (!st || !st.ok) { if (Date.now() - start > 20000) $('#hafen').innerHTML = '<div class="fehler">Die Schiffsdaten kommen gerade nicht an' + (st && st.fehler ? ' (' + h(st.fehler) + ')' : '') + '. Es wird weiter versucht.</div>'; return; }
      var listen = einteilen(st.schiffe || [], hf, box);
      z.hafenListen = listen;
      zeichnen(listen, Date.now() - start);
    }
    clearInterval(hafenTimer); hafenTimer = setInterval(holen, 5000); holen();
  }
  function einteilen(roh, hf, box) {
    function ais(t) { return String(t || '').replace(/@+/g, ' ').replace(/\s+/g, ' ').trim(); }
    var aus = { liegt: [], ein: [], aus: [] }, jetzt = Date.now();
    roh.forEach(function (x) {
      var s = { mmsi: x[0], lat: x[1], lon: x[2], sog: x[3], cog: x[4], name: ais(x[6]), typ: x[8] || 0, ziel: ais(x[9]), status: x[10], laenge: x[11] || 0, breite: x[12] || 0, imo: x[13] || '', tiefgang: x[14] || 0, eta: x[15] || '', zeit: x[16] };
      if (s.lat == null || s.lat < box.s || s.lat > box.n || s.lon < box.w || s.lon > box.o) return;
      if (s.zeit > 1000 && jetzt - s.zeit > 30 * 60000) return;   // seit 30 Min. nichts gehört
      s.weit = Math.round(G.abstand(hf, s));
      var steht = s.status === 5 || s.status === 1 || (s.sog != null && s.sog < 0.7);
      if (steht) { if (s.weit <= HAFEN_INNEN || (s.status === 1 && s.weit <= HAFEN_AUSSEN)) { s.wo = s.status === 1 ? 'vor Anker' : 'festgemacht'; aus.liegt.push(s); } return; }
      var zumHafen = s.cog != null ? winkel(s.cog, richtung(s, hf)) : 90;
      if (zielPasst(s.ziel, hf) && s.weit > 1500 && zumHafen < 100) aus.ein.push(s);
      else if (zumHafen <= 60 && s.weit > 1500) aus.ein.push(s);
      else if (zumHafen >= 120) aus.aus.push(s);
      else if (s.weit <= HAFEN_INNEN) { s.wo = 'manövriert im Hafen'; aus.liegt.push(s); }
    });
    aus.liegt.sort(function (a, b) { return (b.laenge || 0) - (a.laenge || 0); });
    aus.ein.sort(function (a, b) { return a.weit - b.weit; });
    aus.aus.sort(function (a, b) { return a.weit - b.weit; });
    return aus;
  }
  function zeichnen(l, seit) {
    var box = $('#hafen'), r = A().z.hafenReiter; if (!box) return;
    ['liegt', 'ein', 'aus'].forEach(function (k) { var e = $('#hz_' + k); if (e) e.textContent = ({ liegt: 'Im Hafen', ein: 'Läuft ein', aus: 'Läuft aus' })[k] + ' (' + l[k].length + ')'; });
    var liste = l[r];
    if (!liste.length) { box.innerHTML = seit < 30000 ? X.laedt('Schiffe werden empfangen … das dauert beim ersten Mal bis zu einer Minute.') : '<div class="gut">' + ({ liegt: 'Gerade liegt hier kein Schiff, das AIS sendet.', ein: 'Gerade läuft kein Schiff ein.', aus: 'Gerade läuft kein Schiff aus.' })[r] + '</div>'; return; }
    box.innerHTML = liste.slice(0, 80).map(function (s) {
      var a = artText(s), unter = [a[0], s.laenge ? s.laenge + ' m' : ''];
      if (r === 'liegt') unter.push(s.wo);
      if (r === 'ein') unter.push(s.eta ? 'Ankunft ' + etaText(s.eta) : G.km(s.weit) + ' entfernt');
      if (r === 'aus') unter.push(s.ziel ? 'nach ' + s.ziel : G.km(s.weit) + ' entfernt');
      return '<div class="eintrag tippbar" data-tun="hafen-schiff" data-m="' + s.mmsi + '"><span class="sym" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + a[1] + ';flex:none;margin:0 6px"></span>' +
        '<div class="txt"><b>' + h(s.name || 'MMSI ' + s.mmsi) + '</b><span>' + h(unter.filter(Boolean).join(' · ')) + '</span></div><div class="ende">' + sym('rechts') + '</div></div>';
    }).join('') + '<p class="klein2" style="text-align:center">Stand ' + G.uhr() + ' · alle 5 s neu' + (seit < 300000 ? ' · Namen und Ziele kommen nach und nach dazu' : '') + '</p>';
  }
  Tun['hafen-reiter'] = function (el) {
    var z = A().z; z.hafenReiter = el.getAttribute('data-r');
    [].forEach.call(document.querySelectorAll('[data-tun=hafen-reiter]'), function (b) { b.classList.toggle('akt', b === el); });
    if (z.hafenListen) zeichnen(z.hafenListen, 60000);
  };
  Tun['hafen-schiff'] = function (el) {
    var z = A().z, m = +el.getAttribute('data-m'), s = null;
    ['liegt', 'ein', 'aus'].forEach(function (k) { (z.hafenListen && z.hafenListen[k] || []).forEach(function (x) { if (x.mmsi === m) s = x; }); });
    if (!s) return;
    clearInterval(hafenTimer);
    var a = artText(s), H = FV.LIVE && FV.LIVE.hilfe, land = H ? H.land[Math.floor(s.mmsi / 1000000)] || '' : '';
    function zeile(k, t) { return t ? '<div class="detailzeile">' + sym('info') + '<div><small>' + k + '</small>' + h(t) + '</div></div>' : ''; }
    A().blatt('<h2>' + sym('schiff') + '<span>' + h(s.name || 'MMSI ' + s.mmsi) + '<br><small style="font-weight:400;font-size:13px">' + h([a[0], land].filter(Boolean).join(' · ')) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' + (FV.SCHIFFFOTO ? FV.SCHIFFFOTO.platz() : '') + '<div class="block">' +
      zeile('Status', s.wo || (H && H.status[s.status]) || (s.sog != null ? 'in Fahrt, ' + String(s.sog).replace('.', ',') + ' kn' : '')) +
      zeile('Ziel', s.ziel ? s.ziel + (s.eta ? ' · Ankunft geplant ' + etaText(s.eta) : '') : '') +
      zeile('Größe', s.laenge ? s.laenge + ' m lang, ' + s.breite + ' m breit' + (s.tiefgang ? ' · Tiefgang ' + String(s.tiefgang).replace('.', ',') + ' m' : '') : '') +
      zeile('Entfernung zum Hafen', G.km(s.weit)) +
      zeile('Kennung', ['MMSI ' + s.mmsi, s.imo ? 'IMO ' + s.imo : ''].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="zweier"><button class="rand knopf" data-tun="hafen-zurueck">' + sym('links') + 'Zur Hafen-Tafel</button><button class="rand knopf" data-tun="oeffnen" data-url="https://www.marinetraffic.com/de/ais/details/ships/mmsi:' + s.mmsi + '">' + sym('extern') + 'Mehr im Netz</button></div>');
    if (FV.SCHIFFFOTO) FV.SCHIFFFOTO.laden(s);
  };
  Tun['hafen-zurueck'] = function () { var z = A().z; if (z.hafen) hafenBlatt(z.hafen); };
  Tun['nv-oeffnen'] = function (el) { var x = (zustand().liste || [])[+el.getAttribute('data-i')]; if (x) oeffnen(x); };
})();
