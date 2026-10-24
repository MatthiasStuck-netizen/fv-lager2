/* Suche (eigener Knopf in der Leiste unten): Ziel suchen, Veranstaltungskalender (Theater, Musical, Konzerte …),
 * Favoriten und letzte Ziele. */
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
  FAV.html = function () { return favHtml(); };
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
  /* ====================== Veranstaltungen ======================
   * Theater, Musical, Konzerte, Comedy, Familie, Feste & Märkte, Ausstellungen an einem beliebigen Ort.
   * Quelle: Google-Veranstaltungssuche über SerpApi (derselbe Schlüssel wie für die Flugsuche, kommt aus der Verwaltung). */
  /* Google zeigt Veranstaltungen nur bei englischen Suchen (SerpApi: immer hl=en, gl=us) – deshalb englische Suchwörter, Anzeige auf Deutsch */
  var VARTEN = [['alles', 'kalender', 'Alles', 'Events'], ['theater', 'maske', 'Theater', 'Theater'], ['musical', 'stern', 'Musical', 'Musicals'], ['konzert', 'musik', 'Konzerte', 'Concerts'],
    ['comedy', 'mikro', 'Comedy', 'Comedy shows'], ['familie', 'leute', 'Familie', 'Family events'], ['feste', 'event', 'Feste', 'Festivals and markets'], ['ausstellung', 'museum', 'Museen', 'Exhibitions']];
  var ZEITEN = [['', 'Alle'], ['date:today', 'Heute'], ['date:weekend', 'Wochenende'], ['date:week', 'Woche'], ['date:month', 'Monat']];
  function zustand() { var z = A().z; return z.suche || (z.suche = { vart: 'alles', vzeit: '', ort: '', ergebnis: null, titel: '', ziel: '', treffer: null }); }
  Se.suche = function () {
    var s = zustand(); if (!s.vart) s.vart = 'alles'; if (s.vzeit == null) s.vzeit = '';
    X.seite(X.kopf('Suche', '', false) + '<div class="rollen" id="srollen">' +
      '<div class="block creme"><h2>' + sym('route') + '<span>Wohin?<br><small style="font-weight:400;font-size:13px">Adresse, Ort, Firma – auch im Ausland</small></span></h2>' +
        '<form data-form="such-ziel"><div class="suchfeld">' + sym('suche') + '<input id="szsuche" placeholder="z. B. Hauptstraße 12, Leer" autocomplete="off" enterkeyhint="search" value="' + h(s.ziel) + '"><button type="button" data-tun="such-leer" data-f="szsuche" aria-label="Leeren">' + sym('zu') + '</button></div>' +
        '<button class="gold knopf breit" style="margin-top:10px">' + sym('suche') + 'Ziel suchen</button></form><div id="sztreffer" style="margin-top:8px"></div></div>' +
      '<h3 class="ueber">' + sym('kalender') + 'Veranstaltungskalender</h3>' +
      '<div class="block"><p class="klein2" style="margin:0 2px 8px">Theater, Musical, Konzerte und alles, was in der Freizeit läuft – an einem beliebigen Ort.</p>' +
        '<div class="modi acht varten" style="padding:0 0 8px">' + VARTEN.map(function (a) { return '<button data-tun="ver-art" data-a="' + a[0] + '"' + (a[0] === s.vart ? ' class="akt"' : '') + '>' + sym(a[1]) + '<span>' + a[2] + '</span></button>'; }).join('') + '</div>' +
        '<div class="wahl vzeiten" style="margin:0 0 10px">' + ZEITEN.map(function (z) { return '<button data-tun="ver-zeit" data-z="' + z[0] + '" style="font-size:13.5px;padding:8px 2px"' + (z[0] === s.vzeit ? ' class="akt"' : '') + '>' + z[1] + '</button>'; }).join('') + '</div>' +
        '<form data-form="ver-suchen"><div class="suchfeld">' + sym('ort') + '<input id="vort" placeholder="Ort, z. B. Leer, Oldenburg, Hamburg" autocomplete="off" enterkeyhint="search" value="' + h(s.ort) + '"><button type="button" data-tun="such-leer" data-f="vort" aria-label="Leeren">' + sym('zu') + '</button></div>' +
        '<div class="zweier" style="margin-top:10px"><button type="button" class="rand knopf" data-tun="ver-nah">' + sym('ort') + 'In der Nähe</button><button class="gold knopf">' + sym('suche') + 'Suchen</button></div></form>' +
        '<div id="sver" style="margin-top:6px"></div></div>' +
      '<h3 class="ueber">' + sym('stern') + 'Favoriten</h3><div id="sfav">' + favHtml() + '</div>' +
      '<h3 class="ueber">' + sym('verlauf') + 'Letzte Ziele</h3><div id="sletzte">' + letzteHtml() + '</div><div style="height:10px"></div></div>');
    if (s.ergebnis) verZeigen();
    if (s.treffer) zielTrefferZeigen(s.treffer);
  };
  Tun['such-leer'] = function (el) { var i = $('#' + el.getAttribute('data-f')); if (!i) return; i.value = ''; i.focus(); var s = zustand(); if (i.id === 'vort') { s.ort = ''; } else { s.ziel = ''; s.treffer = null; var b = $('#sztreffer'); if (b) b.innerHTML = ''; } };
  Tun['ver-art'] = function (el) {
    var s = zustand(); s.vart = el.getAttribute('data-a');
    [].forEach.call(document.querySelectorAll('.varten button'), function (b) { b.classList.toggle('akt', b === el); });
    nochmal();
  };
  Tun['ver-zeit'] = function (el) {
    var s = zustand(); s.vzeit = el.getAttribute('data-z');
    [].forEach.call(document.querySelectorAll('.vzeiten button'), function (b) { b.classList.toggle('akt', b === el); });
    nochmal();
  };
  /** Nach Wechsel von Art oder Zeitraum gleich neu suchen, wenn schon ein Ort da ist */
  function nochmal() {
    var s = zustand(), t = (($('#vort') || {}).value || '').trim();
    if (t) { verSuchen(t, false); return; }
    if (s.ergebnis && s.nah) { verSuchen('', true); return; }
    s.ergebnis = null; var b = $('#sver'); if (b) b.innerHTML = '';
  }

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

  /* ---------- Veranstaltungen suchen ---------- */
  var suchLauf = 0, VER_FRISCH = 6 * 3600000;
  function serpSchluessel() { var v = A().z.verkehr; return String(A().e.serpSchluessel || (v && v.serpapi) || '').trim(); }
  function ortFinden(text) {
    return G.suche(text, B.ort(), true).then(function (l) {
      if (!l.length) throw new Error('Der Ort „' + text + '“ wurde nicht gefunden.');
      return { lat: l[0].lat, lon: l[0].lon, name: l[0].name };
    }, function () { throw new Error('Der Ort „' + text + '“ wurde nicht gefunden (oder kein Internet).'); });
  }
  Tun['ver-nah'] = function () { verSuchen('', true); };
  Tun['ver-suchen'] = function () { var t = (($('#vort') || {}).value || '').trim(); if (!t) { verSuchen('', true); return; } verSuchen(t, false); };
  /** Eine Seite (10 Stück) Veranstaltungen von Google, 6 Stunden gemerkt */
  function seiteHolen(ortName, art, zeit, start) {
    var q = art[3] + ' in ' + ortName, key = [new Date().toDateString(), q, zeit, start].join('|');
    return FV.V.merk('events', key, { frisch: VER_FRISCH, alt: 0, notfall: 24 * 3600000, max: 40 }, function () {
      var p = { engine: 'google_events', q: q, api_key: serpSchluessel() };
      if (zeit) p.htichips = zeit;
      if (start) p.start = String(start);
      return B.json({ url: 'https://serpapi.com/search.json?' + Object.keys(p).map(function (k) { return k + '=' + encodeURIComponent(p[k]); }).join('&'), zeit: 30000, auchFehler: true }).then(function (j) {
        if (j && j.error) { if (/hasn't returned any results|no results/i.test(j.error)) return []; var e = new Error(j.error); e.serp = true; throw e; }
        return ((j && j.events_results) || []).map(function (x) {
          var d = x.date || {}, adr = Array.isArray(x.address) ? x.address : x.address ? [x.address] : [];
          var tickets = (x.ticket_info || []).filter(function (t) { return t && t.link; }).slice(0, 6).map(function (t) { return { quelle: String(t.source || 'Webseite').slice(0, 60), link: t.link, art: t.link_type || '' }; });
          return { titel: String(x.title || '').slice(0, 200), tag: deutsch(String(d.start_date || '').slice(0, 40)), wann: deutsch(String(d.when || '').slice(0, 120)), adresse: adr.map(String).slice(0, 3),
            ort: x.venue && x.venue.name ? String(x.venue.name).slice(0, 120) : adr[0] ? String(adr[0]).slice(0, 120) : '', text: String(x.description || '').slice(0, 600),
            link: x.link || '', tickets: tickets, bild: x.thumbnail || x.image || '' };
        }).filter(function (x) { return x.titel; });
      });
    });
  }
  /** Liegt der Punkt in Deutschland (grob)? Dann „, Germany“ an den Ort – sonst findet Google z. B. bei „Leer“ nichts Passendes */
  function inDE(p) { return p && p.lat > 47.2 && p.lat < 55.1 && p.lon > 5.8 && p.lon < 15.1; }
  /** Englische Datumsangaben von Google auf Deutsch: „Sat, Oct 25, 8 – 10:30 PM“ → „Sa., 25. Okt., 20:00 – 22:30“ */
  var MON = { Jan: 'Jan.', Feb: 'Feb.', Mar: 'März', Apr: 'Apr.', May: 'Mai', Jun: 'Juni', Jul: 'Juli', Aug: 'Aug.', Sep: 'Sept.', Sept: 'Sept.', Oct: 'Okt.', Nov: 'Nov.', Dec: 'Dez.' };
  var WT = { Mon: 'Mo.', Tue: 'Di.', Wed: 'Mi.', Thu: 'Do.', Fri: 'Fr.', Sat: 'Sa.', Sun: 'So.' };
  function uhr(hh, mm, ap) { var x = +hh % 12 + (/pm/i.test(ap) ? 12 : 0); return (x < 10 ? '0' : '') + x + ':' + (mm || '00'); }
  function deutsch(t) {
    if (!t) return t;
    t = t.replace(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*([–-])\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi, function (m, h1, m1, a1, st, h2, m2, a2) { return uhr(h1, m1, a1 || a2) + ' – ' + uhr(h2, m2, a2); });
    t = t.replace(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi, function (m, hh, mm, ap) { return uhr(hh, mm, ap); });
    t = t.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/g, function (m, mo, d) { return d + '. ' + MON[mo]; });
    t = t.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b\.?/g, function (m, w) { return WT[w]; });
    return t.replace(/\bToday\b/g, 'Heute').replace(/\bTomorrow\b/g, 'Morgen');
  }
  function verSuchen(text, nah) {
    var s = zustand(), box = $('#sver'), meins = ++suchLauf; if (!box) return;
    s.ort = text; s.nah = nah; s.ergebnis = null; s.mehr = false;
    if (!serpSchluessel()) {
      box.innerHTML = '<div class="fehler">Für den Veranstaltungskalender fehlt der SerpApi-Schlüssel (derselbe wie für die Flugsuche). Bitte in der Verwaltung (warenwirtschaft.php) eintragen.</div>'; return;
    }
    box.innerHTML = X.laedt('Veranstaltungen werden gesucht …');
    var wo = nah ? X.startpunkt().then(function (p) { return FV.V.plz(p).then(function (r) { if (!r.ort) throw 0; return { name: r.ort, nah: true }; }); })
      .then(function (o) { o.de = true; return o; })
      .catch(function () { throw new Error('Der Ort, an dem Sie gerade sind, wurde nicht erkannt. Bitte einen Ort eintippen.'); })
      : ortFinden(text).then(function (p) { return { name: text, de: inDE(p) }; });
    var art = VARTEN.filter(function (a) { return a[0] === s.vart; })[0] || VARTEN[0];
    wo.then(function (o) {
      if (meins !== suchLauf) return;
      s.ortName = o.name; s.ortSuche = o.de ? o.name + ', Germany' : o.name;
      return seiteHolen(s.ortSuche, art, s.vzeit, 0).then(function (l) {
        if (meins !== suchLauf) return;
        s.titel = art[2] === 'Alles' ? 'Veranstaltungen in ' + o.name : art[2] + ' in ' + o.name;
        s.ergebnis = l; s.mehr = l.length >= 10; s.seite = 0;
        verZeigen();
      });
    }).catch(function (e) {
      if (meins !== suchLauf || !$('#sver')) return;
      $('#sver').innerHTML = '<div class="fehler">' + h(fehlerText(e)) + '</div>';
    });
  }
  function fehlerText(e) {
    var m = e && e.message || '';
    if (e && e.serp) return /api key|api_key/i.test(m) ? 'Der SerpApi-Schlüssel wird nicht angenommen. Bitte in der Verwaltung prüfen.' : /run out|limit|credits|searches/i.test(m) ? 'Die Suchen bei SerpApi sind für diesen Monat aufgebraucht.' : 'SerpApi: ' + m;
    return m && !/^(leer|Keine Verbindung|Zeitüberschreitung)$/.test(m) ? m : 'Die Suche hat gerade nicht geklappt. Bitte Internet prüfen.';
  }
  Tun['ver-mehr'] = function (el) {
    var s = zustand(), art = VARTEN.filter(function (a) { return a[0] === s.vart; })[0] || VARTEN[0], meins = suchLauf; if (!s.ergebnis || !s.ortName) return;
    el.disabled = true; el.innerHTML = '<i class="dreh"></i>Wird geladen …';
    seiteHolen(s.ortSuche || s.ortName, art, s.vzeit, ((s.seite || 0) + 1) * 10).then(function (l) {
      if (meins !== suchLauf) return;
      var schon = {}; s.ergebnis.forEach(function (x) { schon[x.titel + '|' + x.wann] = 1; });
      l = l.filter(function (x) { return !schon[x.titel + '|' + x.wann]; });
      s.ergebnis = s.ergebnis.concat(l); s.seite = (s.seite || 0) + 1; s.mehr = l.length >= 5 && s.seite < 9;
      verZeigen();
    }).catch(function (e) { if (meins !== suchLauf) return; el.disabled = false; el.innerHTML = sym('plus') + 'Mehr laden'; A().toast(fehlerText(e)); });
  };
  function verZeigen() {
    var box = $('#sver'), s = zustand(), l = s.ergebnis || []; if (!box) return;
    var art = VARTEN.filter(function (a) { return a[0] === s.vart; })[0] || VARTEN[0];
    if (!l.length) { box.innerHTML = '<div class="fehler">Für ' + h(s.ortName || s.ort) + ' wurde ' + (s.vzeit ? 'in diesem Zeitraum ' : '') + 'nichts gefunden. Vielleicht eine größere Stadt in der Nähe versuchen.</div>'; return; }
    var letzterTag = '';
    box.innerHTML = '<h3 class="ueber" style="margin-top:6px">' + sym(art[1]) + h(s.titel) + '</h3>' + l.map(function (x, i) {
      var kopf = '';
      if (x.tag && x.tag !== letzterTag) { letzterTag = x.tag; kopf = '<div class="klein2" style="margin:10px 4px 4px;font-weight:700;color:var(--gold)">' + h(x.tag) + '</div>'; }
      return kopf + '<div class="eintrag tippbar" data-tun="ver-oeffnen" data-i="' + i + '">' +
        (x.bild ? '<img src="' + h(x.bild) + '" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:46px;height:46px;border-radius:8px;object-fit:cover;flex:none" onerror="this.style.display=\'none\'">' : sym(art[1])) +
        '<div class="txt"><b>' + h(x.titel) + '</b><span>' + h([x.wann, x.ort].filter(Boolean).join(' · ')) + '</span></div><div class="ende">' + sym('rechts') + '</div></div>';
    }).join('') + (s.mehr ? '<div style="height:6px"></div><button class="rand knopf breit" data-tun="ver-mehr">' + sym('plus') + 'Mehr laden</button>' : '') +
      '<p class="klein2" style="text-align:center">Veranstaltungen: Google-Veranstaltungssuche (über SerpApi). Termine und Preise ohne Gewähr – bitte beim Veranstalter prüfen.</p>';
  }
  Tun['ver-oeffnen'] = function (el) {
    var s = zustand(), x = (s.ergebnis || [])[+el.getAttribute('data-i')]; if (!x) return;
    A().z.verWahl = x;
    var tk = x.tickets.filter(function (t) { return t.art === 'tickets'; }), info = x.tickets.filter(function (t) { return t.art !== 'tickets'; });
    var such = 'https://www.google.com/search?q=' + encodeURIComponent(x.titel + ' ' + (x.ort || '') + ' ' + (x.tag || ''));
    A().blatt('<h2>' + sym('kalender') + '<span>' + h(x.titel) + '<br><small style="font-weight:400;font-size:13px">' + h(x.wann || x.tag) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      (x.bild ? '<img src="' + h(x.bild) + '" alt="" referrerpolicy="no-referrer" style="display:block;max-width:100%;max-height:200px;margin:0 auto 10px;border-radius:10px" onerror="this.style.display=\'none\'">' : '') +
      (x.wann ? '<div class="detailzeile">' + sym('uhr') + '<div><small>Wann</small>' + h(x.wann) + '</div></div>' : '') +
      (x.adresse.length || x.ort ? '<div class="detailzeile">' + sym('pin') + '<div><small>Wo</small>' + (x.adresse.length ? x.adresse.map(h).join('<br>') : h(x.ort)) + '</div></div>' : '') +
      (x.text ? '<p class="klein2" style="margin:8px 2px">' + h(x.text) + '</p>' : '') +
      tk.map(function (t, i) { return '<button class="' + (i ? 'rand' : 'gold') + ' knopf breit" data-tun="oeffnen" data-url="' + h(t.link) + '">' + sym('euro') + 'Tickets bei ' + h(t.quelle) + '</button><div style="height:8px"></div>'; }).join('') +
      info.slice(0, 2).map(function (t) { return '<button class="rand knopf breit" data-tun="oeffnen" data-url="' + h(t.link) + '">' + sym('extern') + 'Infos bei ' + h(t.quelle) + '</button><div style="height:8px"></div>'; }).join('') +
      (!x.tickets.length ? '<button class="rand knopf breit" data-tun="oeffnen" data-url="' + h(x.link || such) + '">' + sym('extern') + 'Mehr Infos im Internet</button><div style="height:8px"></div>' : '') +
      ((x.adresse.length || x.ort) ? '<button class="rand knopf breit" data-tun="ver-hin">' + sym('auto') + 'Hinfahren</button>' : ''));
  };
  Tun['ver-hin'] = function (el) {
    var x = A().z.verWahl; if (!x) return;
    var t = x.adresse.length ? x.adresse.join(', ') : x.ort;
    el.disabled = true; el.innerHTML = '<i class="dreh"></i>Adresse wird gesucht …';
    var versuch = function (q) { return G.suche(q, B.ort(), true).then(function (l) { if (!l.length) throw new Error('leer'); return l[0]; }); };
    versuch(t).catch(function () { return x.adresse.length > 1 ? versuch(x.adresse.slice(1).join(', ')) : Promise.reject(new Error('leer')); }).then(function (p) {
      A().blattZu();
      A().zeige('vorschau', { ziel: { name: x.ort || x.titel, adresse: t, lat: p.lat, lon: p.lon, art: 'frei' }, modus: 'auto' });
    }).catch(function () { el.disabled = false; el.innerHTML = sym('auto') + 'Hinfahren'; A().toast('Die Adresse wurde nicht gefunden. Bitte oben unter „Wohin?“ eintippen.'); });
  };
})();
