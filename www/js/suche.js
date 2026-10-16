/* Suche (eigener Knopf in der Leiste unten): Ziel suchen, Favoriten, letzte Ziele und
 * Abfahrten/Ankünfte von Flughafen, Bahnhof, Bushaltestelle oder Schiffsanleger an jedem beliebigen Ort. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, S = FV.S, sym = FV.sym, Se = FV.Seiten, Tun = FV.Tun, X = FV.SX, h = X.h;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }

  /* ====================== Favoriten ======================
   * { typ: 'ziel' | 'flug' | 'zug' | 'bus' | 'stadt' | 'schiff', name, adresse, lat, lon, iata, id, web, betreiber, t } */
  var FAV = FV.FAV = {}, reg = {};
  var FSYM = { ziel: 'pin', flug: 'flug', zug: 'zug', bus: 'bus', stadt: 'tram', schiff: 'schiff' };
  var FART = { ziel: 'Ziel', flug: 'Flughafen', zug: 'Bahnhof', bus: 'Haltestelle', stadt: 'U-/S-Bahn', schiff: 'Schiffsanleger' };
  function zahl(x) { return x == null || x === '' || isNaN(+x) ? null : +x; }
  FAV.schluessel = function (x) {
    var lat = zahl(x.lat), lon = zahl(x.lon);
    return x.typ + '|' + (x.iata || (x.typ !== 'ziel' && x.id) || (lat != null ? lat.toFixed(3) + ',' + lon.toFixed(3) : FV.norm(x.name + ' ' + (x.adresse || ''))));
  };
  FAV.alle = function () { var l = B.lesen('favoriten', []); return Array.isArray(l) ? l : []; };
  FAV.hat = function (x) { var k = FAV.schluessel(x); return FAV.alle().some(function (y) { return FAV.schluessel(y) === k; }); };
  function sauber(x) {
    var o = { typ: x.typ || 'ziel', name: String(x.name || x.adresse || 'Ziel').slice(0, 120), t: Date.now() };
    ['adresse', 'iata', 'id', 'web', 'betreiber'].forEach(function (k) { if (x[k]) o[k] = String(x[k]).slice(0, 300); });
    if (zahl(x.lat) != null && zahl(x.lon) != null) { o.lat = +(+x.lat).toFixed(6); o.lon = +(+x.lon).toFixed(6); }
    return o;
  }
  /** an/aus; liefert true, wenn es jetzt ein Favorit ist */
  FAV.umschalten = function (x) {
    var k = FAV.schluessel(x), l = FAV.alle(), war = l.some(function (y) { return FAV.schluessel(y) === k; });
    l = l.filter(function (y) { return FAV.schluessel(y) !== k; });
    if (!war) l.unshift(sauber(x));
    B.schreiben('favoriten', l.slice(0, 60));
    return !war;
  };
  /** Stern-Knopf (gefüllt = Favorit) */
  FAV.knopf = function (x, klasse) {
    var k = FAV.schluessel(x); reg[k] = x;
    var an = FAV.hat(x);
    return '<button type="button" class="favknopf ' + (klasse || '') + (an ? ' an' : '') + '" data-tun="fav" data-fk="' + h(k) + '" aria-label="' + (an ? 'Aus den Favoriten nehmen' : 'Als Favorit speichern') + '">' + sym(an ? 'stern' : 'stern_leer') + '</button>';
  };
  Tun.fav = function (el) {
    var k = el.getAttribute('data-fk'), x = reg[k]; if (!x) return;
    var an = FAV.umschalten(x);
    [].forEach.call(document.querySelectorAll('[data-tun=fav]'), function (b) { if (b.getAttribute('data-fk') !== k) return; b.classList.toggle('an', an); b.innerHTML = sym(an ? 'stern' : 'stern_leer'); });
    A().toast(an ? '„' + (x.name || 'Ziel') + '“ ist jetzt ein Favorit.' : 'Aus den Favoriten genommen.', 2200);
    var f = $('#sfav'); if (f) f.innerHTML = favHtml();
  };
  function weitVonMir(p) { var o = B.ort(); return o && p && p.lat != null ? Math.round(G.abstand(o, p)) : null; }
  /** Favorit oder Treffer öffnen: Ziel → Route, Flughafen → Flugtafel, Bahnhof/Haltestelle/Anleger → Abfahrtstafel */
  FAV.oeffnen = function (x) {
    if (!x) return;
    if (x.typ === 'flug') {
      var f = (FV.FL && FV.FL.iata(x.iata)) || {};
      X.flugBlatt(Object.assign({}, f, { iata: x.iata, name: x.name || f.name, lat: zahl(x.lat) != null ? +x.lat : f.lat, lon: zahl(x.lon) != null ? +x.lon : f.lon, web: x.web || '', weit: weitVonMir(x.lat != null ? x : f) }), false);
      return;
    }
    if (x.typ === 'zug' || x.typ === 'bus' || x.typ === 'stadt' || x.typ === 'schiff') {
      X.tafelBlatt({ id: x.id || '', name: x.name, lat: +x.lat, lon: +x.lon, web: x.web || '', betreiber: x.betreiber || '', weit: weitVonMir(x), schiff: x.typ === 'schiff' }, false, x.typ);
      return;
    }
    A().blattZu();
    A().zeige('vorschau', { ziel: { name: x.name, adresse: x.adresse || x.name, lat: zahl(x.lat), lon: zahl(x.lon), art: 'frei' } });
  };
  function favHtml() {
    var l = FAV.alle();
    if (!l.length) return '<p class="klein2" style="padding:0 4px">Noch keine Favoriten. Den Stern ' + sym('stern_leer', 'inline') + ' bei einem Ziel, Flughafen, Bahnhof oder Anleger antippen – dann steht er hier.</p>';
    return l.map(function (x, i) {
      var unter = [FART[x.typ] || 'Ziel', x.iata || '', x.adresse || '', x.lat != null && B.ort() ? G.km(G.abstand(B.ort(), x)) : ''].filter(Boolean).join(' · ');
      return '<div class="eintrag tippbar fav" data-tun="fav-oeffnen" data-i="' + i + '">' + sym(FSYM[x.typ] || 'pin') + '<div class="txt"><b>' + h(x.name) + '</b><span>' + h(unter) + '</span></div>' +
        '<div class="ende"><button class="favknopf klein" data-tun="fav-bearbeiten" data-i="' + i + '" aria-label="Bearbeiten">' + sym('stift') + '</button>' + sym('rechts') + '</div></div>';
    }).join('');
  }
  Tun['fav-oeffnen'] = function (el) { FAV.oeffnen(FAV.alle()[+el.getAttribute('data-i')]); };
  Tun['fav-bearbeiten'] = function (el) {
    var i = +el.getAttribute('data-i'), x = FAV.alle()[i]; if (!x) return;
    A().blatt('<h2>' + sym('stern') + 'Favorit bearbeiten<button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<label class="feld">Name<input class="eingabe" id="favname" maxlength="120" value="' + h(x.name) + '"></label>' +
      '<p class="klein2" style="margin:-4px 2px 12px">' + h([FART[x.typ], x.iata, x.adresse].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="zweier"><button class="rand knopf" data-tun="fav-hoch" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + '>' + sym('auf') + 'Nach oben</button><button class="gold knopf" data-tun="fav-speichern" data-i="' + i + '">' + sym('haken') + 'Speichern</button></div><div style="height:8px"></div>' +
      '<button class="rand knopf breit" data-tun="fav-loeschen" data-i="' + i + '">' + sym('muell') + 'Favorit löschen</button>');
  };
  function favSetzen(l) { B.schreiben('favoriten', l); var f = $('#sfav'); if (f) f.innerHTML = favHtml(); }
  Tun['fav-speichern'] = function (el) {
    var l = FAV.alle(), x = l[+el.getAttribute('data-i')], n = ($('#favname') || {}).value; if (!x) return;
    if (n && n.trim()) x.name = n.trim().slice(0, 120);
    favSetzen(l); A().blattZu(); A().toast('Gespeichert.');
  };
  Tun['fav-hoch'] = function (el) { var l = FAV.alle(), i = +el.getAttribute('data-i'); if (i <= 0 || !l[i]) return; l.unshift(l.splice(i, 1)[0]); favSetzen(l); A().blattZu(); };
  Tun['fav-loeschen'] = function (el) {
    var l = FAV.alle(), i = +el.getAttribute('data-i'), x = l[i]; if (!x) return;
    A().blattZu();
    A().frage('„' + x.name + '“ aus den Favoriten löschen?', 'Löschen').then(function (ja) { if (!ja) return; l.splice(i, 1); favSetzen(l); A().toast('Gelöscht.'); });
  };

  /* ====================== Letzte Ziele ====================== */
  function letzte() { var l = B.lesen('letzte', []); return Array.isArray(l) ? l : []; }
  function letzteHtml() {
    var l = letzte();
    if (!l.length) return '<p class="klein2" style="padding:0 4px">Noch keine Ziele. Jede berechnete Route landet hier.</p>';
    return l.map(function (x, i) {
      var wann = x.t ? new Date(x.t) : null, w = wann ? (wann.toDateString() === new Date().toDateString() ? 'heute ' + G.uhr(wann) : wann.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })) : '';
      return '<div class="eintrag tippbar" data-tun="such-letztes" data-i="' + i + '">' + sym('verlauf') + '<div class="txt"><b>' + h(x.name) + '</b><span>' + h([x.adresse && x.adresse !== x.name ? x.adresse : '', w].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="ende">' + FAV.knopf({ typ: 'ziel', name: x.name, adresse: x.adresse, lat: x.lat, lon: x.lon }, 'klein') +
        '<button class="favknopf klein" data-tun="letzte-weg" data-i="' + i + '" aria-label="Aus der Liste nehmen">' + sym('zu') + '</button></div></div>';
    }).join('') + '<button class="rand knopf breit" data-tun="letzte-leeren" style="margin-top:2px">' + sym('muell') + 'Liste leeren</button>';
  }
  Tun['such-letztes'] = function (el) { var x = letzte()[+el.getAttribute('data-i')]; if (x) FAV.oeffnen({ typ: 'ziel', name: x.name, adresse: x.adresse, lat: x.lat, lon: x.lon }); };
  Tun['letzte-weg'] = function (el) { var l = letzte(); l.splice(+el.getAttribute('data-i'), 1); B.schreiben('letzte', l); var b = $('#sletzte'); if (b) b.innerHTML = letzteHtml(); };
  Tun['letzte-leeren'] = function () { A().frage('Alle letzten Ziele löschen?', 'Löschen').then(function (ja) { if (!ja) return; B.schreiben('letzte', []); var b = $('#sletzte'); if (b) b.innerHTML = letzteHtml(); }); };

  /* ====================== Seite „Suche“ ====================== */
  var ARTEN = [['flug', 'flug', 'Flughafen'], ['zug', 'zug', 'Bahnhof'], ['bus', 'bus', 'Bus'], ['schiff', 'schiff', 'Schiff']];
  function zustand() { var z = A().z; return z.suche || (z.suche = { art: 'flug', ort: '', ergebnis: null, titel: '', ziel: '', treffer: null }); }
  Se.suche = function () {
    var s = zustand();
    X.seite(X.kopf('Suche', '', false) + '<div class="rollen" id="srollen">' +
      '<div class="block creme"><h2>' + sym('route') + '<span>Wohin?<br><small style="font-weight:400;font-size:13px">Adresse, Ort, Firma – auch im Ausland</small></span></h2>' +
        '<form data-form="such-ziel"><div class="suchfeld">' + sym('suche') + '<input id="szsuche" placeholder="z. B. Hauptstraße 12, Leer" autocomplete="off" enterkeyhint="search" value="' + h(s.ziel) + '"><button type="button" data-tun="such-leer" data-f="szsuche" aria-label="Leeren">' + sym('zu') + '</button></div>' +
        '<button class="gold knopf breit" style="margin-top:10px">' + sym('suche') + 'Ziel suchen</button></form><div id="sztreffer" style="margin-top:8px"></div></div>' +
      '<h3 class="ueber">' + sym('uhr') + 'Abfahrten und Ankünfte</h3>' +
      '<div class="block"><p class="klein2" style="margin:0 2px 8px">Flughafen, Bahnhof, Bushaltestelle oder Schiffsanleger an einem beliebigen Ort – mit Abfahrts- und Ankunftszeiten.</p>' +
        '<div class="modi sarten" style="padding:0 0 10px">' + ARTEN.map(function (a) { return '<button data-tun="such-art" data-a="' + a[0] + '"' + (a[0] === s.art ? ' class="akt"' : '') + '>' + sym(a[1]) + '<span>' + a[2] + '</span></button>'; }).join('') + '</div>' +
        '<form data-form="such-verkehr"><div class="suchfeld">' + sym('ort') + '<input id="sort" placeholder="' + h(platzhalter(s.art)) + '" autocomplete="off" enterkeyhint="search" value="' + h(s.ort) + '"><button type="button" data-tun="such-leer" data-f="sort" aria-label="Leeren">' + sym('zu') + '</button></div>' +
        '<div class="zweier" style="margin-top:10px"><button type="button" class="rand knopf" data-tun="such-nah">' + sym('ort') + 'In der Nähe</button><button class="gold knopf">' + sym('suche') + 'Suchen</button></div></form>' +
        '<div id="sverkehr" style="margin-top:6px"></div></div>' +
      '<h3 class="ueber">' + sym('stern') + 'Favoriten</h3><div id="sfav">' + favHtml() + '</div>' +
      '<h3 class="ueber">' + sym('verlauf') + 'Letzte Ziele</h3><div id="sletzte">' + letzteHtml() + '</div><div style="height:10px"></div></div>');
    if (s.ergebnis) verkehrZeigen(s.titel, s.ergebnis);
    if (s.treffer) zielTrefferZeigen(s.treffer);
  };
  function platzhalter(art) { return art === 'flug' ? 'Ort oder Kürzel, z. B. Mallorca, Bremen, PMI' : art === 'schiff' ? 'Ort, z. B. Norddeich, Emden, Cuxhaven' : art === 'bus' ? 'Ort oder Straße, z. B. Leer Bahnhof' : 'Ort, z. B. Hamburg, Oldenburg'; }
  Tun['such-leer'] = function (el) { var i = $('#' + el.getAttribute('data-f')); if (!i) return; i.value = ''; i.focus(); var s = zustand(); if (i.id === 'sort') { s.ort = ''; } else { s.ziel = ''; s.treffer = null; var b = $('#sztreffer'); if (b) b.innerHTML = ''; } };
  Tun['such-art'] = function (el) {
    var s = zustand(); s.art = el.getAttribute('data-a'); s.ergebnis = null;
    [].forEach.call(document.querySelectorAll('.sarten button'), function (b) { b.classList.toggle('akt', b === el); });
    var i = $('#sort'); if (i) { i.placeholder = platzhalter(s.art); if (i.value.trim()) { Tun['such-verkehr'](); return; } }
    var b = $('#sverkehr'); if (b) b.innerHTML = '';
  };

  /* ---------- Ziel suchen (weltweit) ---------- */
  Tun['such-ziel'] = function () {
    var t = ($('#szsuche') || {}).value || '', box = $('#sztreffer'), s = zustand(); t = t.trim();
    if (!t) { A().toast('Bitte ein Ziel eintippen.'); return; }
    s.ziel = t; box.innerHTML = X.laedt('Suche …');
    G.suche(t, B.ort(), true).then(function (l) {
      s.treffer = l;
      if (!l.length) { box.innerHTML = '<div class="fehler">Dazu wurde nichts gefunden. Bitte genauer eintippen, zum Beispiel mit Ort.</div>'; return; }
      zielTrefferZeigen(l);
    }).catch(function () { box.innerHTML = '<div class="fehler">Die Suche hat nicht geklappt. Bitte Internet prüfen.</div>'; });
  };
  function zielTrefferZeigen(l) {
    var box = $('#sztreffer'); if (!box) return;
    box.innerHTML = l.map(function (x, i) {
      var w = B.ort() ? G.km(G.abstand(B.ort(), x)) : '';
      return '<div class="eintrag tippbar hellbg" data-tun="such-treffer" data-i="' + i + '">' + sym('pin') + '<div class="txt"><b>' + h(x.name) + '</b><span>' + h([x.adresse, w].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="ende">' + FAV.knopf({ typ: 'ziel', name: x.name, adresse: x.adresse, lat: x.lat, lon: x.lon }, 'klein') + sym('rechts') + '</div></div>';
    }).join('');
  }
  Tun['such-treffer'] = function (el) { var x = (zustand().treffer || [])[+el.getAttribute('data-i')]; if (x) FAV.oeffnen({ typ: 'ziel', name: x.name, adresse: x.adresse, lat: x.lat, lon: x.lon }); };

  /* ---------- Flughafen / Bahnhof / Bus / Schiff an einem Ort ---------- */
  var suchLauf = 0;
  function ortFinden(text) {
    return G.suche(text, B.ort(), true).then(function (l) {
      if (!l.length) throw new Error('Der Ort „' + text + '“ wurde nicht gefunden.');
      return { lat: l[0].lat, lon: l[0].lon, name: l[0].name };
    }, function () { throw new Error('Der Ort „' + text + '“ wurde nicht gefunden (oder kein Internet).'); });
  }
  Tun['such-nah'] = function () { verkehrSuchen('', true); };
  Tun['such-verkehr'] = function () { var t = (($('#sort') || {}).value || '').trim(); if (!t) { verkehrSuchen('', true); return; } verkehrSuchen(t, false); };
  function verkehrSuchen(text, nah) {
    var s = zustand(), art = s.art, box = $('#sverkehr'), meins = ++suchLauf; if (!box) return;
    s.ort = text; s.ergebnis = null;
    var name = ARTEN.filter(function (a) { return a[0] === art; })[0][2];
    box.innerHTML = X.laedt((art === 'flug' ? 'Flughäfen' : art === 'zug' ? 'Bahnhöfe' : art === 'bus' ? 'Haltestellen' : 'Schiffsanleger') + ' werden gesucht …');
    // Flughäfen: erst direkt in der eingebauten Liste (Ort, Name, Kürzel) – das geht weltweit und ohne Internet
    if (art === 'flug' && !nah) {
      var direkt = FV.FL.suchen(text);
      if (direkt.length) { fertig('Flughäfen zu „' + text + '“', direkt.map(function (f) { return Object.assign(f, { typ: 'flug', weit: weitVonMir(f) }); })); return; }
    }
    var punkt = nah ? X.startpunkt().then(function (p) { p.name = 'Ihr Standort'; return p; }) : ortFinden(text);
    punkt.then(function (p) {
      if (meins !== suchLauf) return;
      var um = nah ? 'in der Nähe' : 'bei ' + (p.name || text);
      if (art === 'flug') return fertig('Flughäfen ' + um, FV.FL.nahe(p, 200000).map(function (f) { return Object.assign(f, { typ: 'flug', abOrt: f.weit, weit: weitVonMir(f) }); }), p);
      if (art === 'zug') return FV.V.bahnhoefe(p, 30000).then(function (l) { fertig('Bahnhöfe ' + um, l.slice(0, 25).map(function (b) { return Object.assign({}, b, { typ: 'zug', abOrt: b.weit, weit: weitVonMir(b) }); }), p); });
      if (art === 'bus') return FV.V.haltestellen(p, 1500, 'bus').then(function (l) { fertig('Haltestellen ' + um, l.slice(0, 30).map(function (b) { return Object.assign({}, b, { typ: 'bus', abOrt: b.weit, weit: weitVonMir(b) }); }), p); });
      return Promise.all([FV.V.haltestellen(p, 10000, 'schiff').catch(function () { return []; }), FV.V.faehren(p).catch(function () { return []; })]).then(function (t) {
        var l = t[0].map(function (b) { return Object.assign({}, b, { typ: 'schiff' }); });
        t[1].forEach(function (a) {   // Anleger aus OpenStreetMap, die die Bahn nicht kennt (oft mit Webseite der Reederei)
          var gleich = l.filter(function (b) { return G.abstand(a, b) < 500; })[0];
          if (gleich) { if (!gleich.web && a.web) gleich.web = a.web; if (!gleich.betreiber && a.betreiber) gleich.betreiber = a.betreiber; return; }
          l.push(Object.assign({}, a, { typ: 'schiff', osm: true }));
        });
        l.forEach(function (b) { b.abOrt = Math.round(G.abstand(p, b)); b.weit = weitVonMir(b); });
        l.sort(function (a, b) { return a.abOrt - b.abOrt; });
        fertig('Schiffsanleger ' + um, l.slice(0, 30), p);
      });
    }).catch(function (e) {
      if (meins !== suchLauf || !$('#sverkehr')) return;
      $('#sverkehr').innerHTML = '<div class="fehler">' + h(e && e.message && !/^(leer|Keine Verbindung)$/.test(e.message) ? e.message : 'Die Suche hat gerade nicht geklappt. Bitte Internet prüfen.') + '</div>';
    });
    function fertig(titel, liste) {
      if (meins !== suchLauf) return;
      s.titel = titel; s.ergebnis = liste;
      verkehrZeigen(titel, liste);
    }
  }
  function verkehrZeigen(titel, l) {
    var box = $('#sverkehr'), s = zustand(); if (!box) return;
    if (!l.length) { box.innerHTML = '<div class="fehler">Dort wurde ' + (s.art === 'flug' ? 'kein Flughafen (Umkreis 200 km)' : s.art === 'zug' ? 'kein Bahnhof (Umkreis 30 km)' : s.art === 'bus' ? 'keine Bushaltestelle (Umkreis 1,5 km)' : 'kein Schiffsanleger (Umkreis 40 km)') + ' gefunden.</div>'; return; }
    box.innerHTML = '<h3 class="ueber" style="margin-top:6px">' + sym(s.art === 'stadt' ? 'tram' : s.art) + h(titel) + '</h3>' + l.map(function (x, i) {
      var unter = [], fav;
      if (x.typ === 'flug') { unter.push(FV.FL.ortText(x)); fav = { typ: 'flug', name: x.name, iata: x.iata, lat: x.lat, lon: x.lon }; }
      else { var a = x.typ === 'zug' ? X.bfArt(x) : x.typ === 'schiff' ? (x.betreiber || (x.osm ? 'Fähranleger' : 'Fähre / Schiff')) : ''; if (a) unter.push(a); fav = { typ: x.typ, name: x.name, lat: x.lat, lon: x.lon, id: x.id || '', web: x.web || '', betreiber: x.betreiber || '' }; }
      if (x.abOrt != null && x.abOrt > 300) unter.push(G.km(x.abOrt) + ' vom Ort');
      if (x.weit != null) unter.push(G.km(x.weit) + ' von hier');
      return '<div class="eintrag tippbar' + (x.typ === 'flug' ? ' flug' : '') + '" data-tun="such-oeffnen" data-i="' + i + '">' + sym(x.typ === 'stadt' ? 'tram' : x.typ) +
        '<div class="txt"><b>' + h(x.name) + (x.iata ? ' <small class="iata">' + h(x.iata) + '</small>' : '') + (x.typ === 'bus' ? X.haltZeichen(x) : '') + '</b><span>' + h(unter.join(' · ')) + '</span></div>' +
        '<div class="ende">' + FAV.knopf(fav, 'klein') + '<span class="wert" style="font-size:13px">' + (x.typ === 'flug' ? 'Flüge' : 'Abfahrten') + '</span>' + sym('rechts') + '</div></div>';
    }).join('') + '<p class="klein2" style="text-align:center">' + (s.art === 'flug' ? 'Flughäfen: OurAirports · Flugtafel: AeroDataBox (über die Verwaltung).' : s.art === 'schiff' ? 'Anleger: Bahn und OpenStreetMap · Fahrplan: Bahn, sonst bei der Reederei.' : 'Abfahrten und Ankünfte live von der Deutschen Bahn.') + ' Ohne Gewähr.</p>';
  }
  Tun['such-oeffnen'] = function (el) {
    var x = (zustand().ergebnis || [])[+el.getAttribute('data-i')]; if (!x) return;
    if (x.typ === 'flug') { X.flugBlatt(x, false); return; }
    X.tafelBlatt(x, false, x.typ);
  };
})();
