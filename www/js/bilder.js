/* Fotos im eigenen Fenster für Flugzeuge, Raketen und Satelliten (wie die Schiffsfotos in js/schiffsfoto.js).
 * Alles wird nur in der App gezeigt – es öffnet sich keine fremde Seite.
 * Flugzeug: Commons-Kategorie „D-ABCD (aircraft)“ = genau dieses Flugzeug; sonst ein Beispielfoto vom gleichen Flugzeugtyp.
 * Rakete: Bild aus der Launch Library (The Space Devs), sonst Foto der Rakete aus Wikipedia/Commons.
 * Satellit/Raumstation: Foto aus Wikipedia/Commons. Fremde Fotos immer mit Fotograf und Lizenz. */
(function () {
  'use strict';
  var B = FV.B, Tun = FV.Tun;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function h(t) { return FV.esc(t); }
  var BI = FV.BILD = {}, merker = {}, lauf = 0, liste = [], titel = '';
  var COMMONS = 'https://commons.wikimedia.org/w/api.php?format=json&action=query';
  var INFO = '&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1000&iiextmetadatafilter=Artist%7CLicenseShortName';

  function ohneHtml(t) { var d = document.createElement('div'); d.innerHTML = String(t || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function bilderAus(j, hinweis) {
    var p = j && j.query && j.query.pages; if (!p) return [];
    return Object.keys(p).map(function (k) { return p[k]; }).sort(function (a, b) { return (a.index || 0) - (b.index || 0); }).map(function (x) {
      var i = x.imageinfo && x.imageinfo[0]; if (!i) return null;
      if (!/\.(jpe?g|png|webp)$/i.test(String(i.url || '').split('?')[0])) return null;   // nur Fotos (keine Zeichnungen/Logos)
      var m = i.extmetadata || {};
      return { bild: i.thumburl || i.url, von: ohneHtml(m.Artist && m.Artist.value).slice(0, 60), lizenz: ohneHtml(m.LicenseShortName && m.LicenseShortName.value), quelle: 'Wikimedia Commons', hinweis: hinweis || '' };
    }).filter(Boolean);
  }
  function einmal(schl, fn) { if (!merker[schl]) { merker[schl] = fn().catch(function () { return []; }); merker[schl].then(function (l) { if (!l.length) setTimeout(function () { delete merker[schl]; }, 10 * 60000); }); } return merker[schl]; }
  /** alle Fotos einer Commons-Kategorie */
  BI.kategorie = function (kat, hinweis) {
    return einmal('k|' + kat + '|' + (hinweis || ''), function () {
      return B.json({ url: COMMONS + '&generator=categorymembers&gcmtype=file&gcmlimit=8&gcmtitle=' + encodeURIComponent('Category:' + kat) + INFO, zeit: 15000 }).then(function (j) { return bilderAus(j, hinweis); });
    });
  };
  /** Hauptbild eines Wikipedia-Artikels (nur freie Bilder von Commons) */
  BI.wiki = function (artikel, sprache, hinweis) {
    sprache = sprache || 'en';
    return einmal('w|' + sprache + '|' + artikel + '|' + (hinweis || ''), function () {
      return B.json({ url: 'https://' + sprache + '.wikipedia.org/w/api.php?format=json&action=query&prop=pageimages&piprop=name&redirects=1&titles=' + encodeURIComponent(artikel), zeit: 15000 }).then(function (j) {
        var p = j && j.query && j.query.pages, name = null;
        if (p) Object.keys(p).forEach(function (k) { if (!name && p[k].pageimage) name = p[k].pageimage; });
        if (!name) return [];
        return B.json({ url: COMMONS + '&titles=' + encodeURIComponent('File:' + name) + INFO, zeit: 15000 }).then(function (j2) { return bilderAus(j2, hinweis); });
      });
    });
  };
  /** Wikipedia durchsuchen und vom besten Artikel das Hauptbild nehmen */
  BI.wikiSuche = function (text, sprache, hinweis) {
    sprache = sprache || 'en';
    return einmal('s|' + sprache + '|' + text + '|' + (hinweis || ''), function () {
      return B.json({ url: 'https://' + sprache + '.wikipedia.org/w/api.php?format=json&action=query&list=search&srlimit=1&srsearch=' + encodeURIComponent(text), zeit: 15000 }).then(function (j) {
        var t = j && j.query && j.query.search && j.query.search[0]; return t ? BI.wiki(t.title, sprache, hinweis) : [];
      });
    });
  };
  /** der Reihe nach probieren, bis eine Quelle Fotos hat */
  function reihe(wege) {
    var i = 0;
    function weiter() { if (i >= wege.length) return Promise.resolve([]); var w = wege[i++]; return Promise.resolve().then(w).catch(function () { return []; }).then(function (l) { return l && l.length ? l : weiter(); }); }
    return weiter();
  }
  BI.reihe = reihe;

  /* ---------- Anzeige ---------- */
  BI.platz = function (text) { return '<div id="bildfeld" class="sfoto"><div class="sfoto-laedt"><i class="dreh"></i>' + h(text || 'Foto wird gesucht …') + '</div></div>'; };
  /** Fotos (Promise einer Liste) in den Platz setzen; name = Überschrift im großen Bild */
  BI.zeigen = function (p, name) {
    var meins = ++lauf;
    p.then(function (l) {
      var box = $('#bildfeld'); if (!box || meins !== lauf) return;
      if (!l || !l.length) { box.innerHTML = '<div class="sfoto-keins">Dazu gibt es (noch) kein freies Foto.</div>'; return; }
      liste = l; titel = name || '';
      box.innerHTML = '<div class="sfoto-reihe">' + l.map(function (b, i) {
        return '<figure data-tun="bild-gross" data-i="' + i + '"><img src="' + h(b.bild) + '" alt="' + h(name || '') + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.style.display=\'none\'">' +
          (b.hinweis ? '<span class="sfoto-hinweis">' + h(b.hinweis) + '</span>' : '') + '<figcaption>' + h(nachweis(b)) + '</figcaption></figure>';
      }).join('') + '</div>' + (l.length > 1 ? '<div class="sfoto-zahl">' + l.length + ' Fotos – zur Seite wischen</div>' : '');
    }, function () { var box = $('#bildfeld'); if (box && meins === lauf) box.innerHTML = '<div class="sfoto-keins">Foto gerade nicht erreichbar.</div>'; });
  };
  function nachweis(b) { return [b.von ? 'Foto: ' + b.von : '', b.lizenz, b.quelle].filter(Boolean).join(' · '); }
  Tun['bild-gross'] = function (el) {
    var b = liste[+el.getAttribute('data-i')]; if (!b) return;
    var d = document.createElement('div'); d.className = 'sfoto-voll'; d.setAttribute('data-tun', 'bild-zu');
    d.innerHTML = '<button data-tun="bild-zu" aria-label="Schließen">' + FV.sym('zu') + '</button><img src="' + h(b.bild) + '" alt=""><p>' + h(titel) + (b.hinweis ? '<br><small>' + h(b.hinweis) + '</small>' : '') + '<br><small>' + h(nachweis(b)) + '</small></p>';
    ($('#blatt .innen') || document.body).appendChild(d);
  };
  Tun['bild-zu'] = function () { [].forEach.call(document.querySelectorAll('.sfoto-voll'), function (x) { x.remove(); }); };

  /* ---------- Flugzeuge ---------- */
  /* ICAO-Typcode → Wikipedia-Artikel (englisch) für das Beispielfoto */
  var TYP = {
    A20N: 'Airbus A320neo family', A21N: 'Airbus A320neo family', A19N: 'Airbus A320neo family', A318: 'Airbus A318', A319: 'Airbus A319', A320: 'Airbus A320 family', A321: 'Airbus A321',
    BCS1: 'Airbus A220', BCS3: 'Airbus A220', A332: 'Airbus A330', A333: 'Airbus A330', A338: 'Airbus A330neo', A339: 'Airbus A330neo', A343: 'Airbus A340', A346: 'Airbus A340',
    A359: 'Airbus A350', A35K: 'Airbus A350', A388: 'Airbus A380', A400: 'Airbus A400M Atlas', A306: 'Airbus A300', A310: 'Airbus A310', BLCF: 'Boeing 747 LCF Dreamlifter', A3ST: 'Airbus Beluga', A337: 'Airbus BelugaXL',
    B737: 'Boeing 737 Next Generation', B738: 'Boeing 737 Next Generation', B739: 'Boeing 737 Next Generation', B37M: 'Boeing 737 MAX', B38M: 'Boeing 737 MAX', B39M: 'Boeing 737 MAX', B3XM: 'Boeing 737 MAX',
    B733: 'Boeing 737 Classic', B734: 'Boeing 737 Classic', B744: 'Boeing 747-400', B748: 'Boeing 747-8', B752: 'Boeing 757', B763: 'Boeing 767', B764: 'Boeing 767',
    B772: 'Boeing 777', B773: 'Boeing 777', B77L: 'Boeing 777', B77W: 'Boeing 777', B778: 'Boeing 777X', B779: 'Boeing 777X', B788: 'Boeing 787 Dreamliner', B789: 'Boeing 787 Dreamliner', B78X: 'Boeing 787 Dreamliner',
    E170: 'Embraer E-Jet family', E175: 'Embraer E-Jet family', E75L: 'Embraer E-Jet family', E190: 'Embraer E-Jet family', E195: 'Embraer E-Jet family', E290: 'Embraer E-Jet E2 family', E295: 'Embraer E-Jet E2 family',
    CRJ7: 'Bombardier CRJ700 series', CRJ9: 'Bombardier CRJ700 series', CRJX: 'Bombardier CRJ700 series', CRJ2: 'Bombardier CRJ100/200',
    AT72: 'ATR 72', AT76: 'ATR 72', AT75: 'ATR 72', AT43: 'ATR 42', AT45: 'ATR 42', DH8D: 'De Havilland Canada Dash 8', DH8C: 'De Havilland Canada Dash 8', SB20: 'Saab 2000', SF34: 'Saab 340',
    BN2P: 'Britten-Norman Islander', BN2T: 'Britten-Norman Islander', DO28: 'Dornier Do 28', D228: 'Dornier 228', D328: 'Dornier 328', PC12: 'Pilatus PC-12', PC24: 'Pilatus PC-24', C208: 'Cessna 208 Caravan',
    C172: 'Cessna 172', C152: 'Cessna 152', C182: 'Cessna 182 Skylane', P28A: 'Piper PA-28 Cherokee', DA40: 'Diamond DA40 Diamond Star', DA42: 'Diamond DA42 Twin Star', SR22: 'Cirrus SR22',
    EC35: 'Eurocopter EC135', H135: 'Eurocopter EC135', EC45: 'Eurocopter EC145', H145: 'Airbus Helicopters H145', EC30: 'Eurocopter EC130', A139: 'AgustaWestland AW139', S92: 'Sikorsky S-92', NH90: 'NHIndustries NH90',
    EUFI: 'Eurofighter Typhoon', TOR: 'Panavia Tornado', F35: 'Lockheed Martin F-35 Lightning II', C130: 'Lockheed C-130 Hercules', C30J: 'Lockheed Martin C-130J Super Hercules', C17: 'Boeing C-17 Globemaster III', A310_MRTT: 'Airbus A310 MRTT', A332_MRTT: 'Airbus A330 MRTT',
    GLF6: 'Gulfstream G650', GLEX: 'Bombardier Global Express', CL60: 'Bombardier Challenger 600 series', C56X: 'Cessna Citation Excel', C68A: 'Cessna Citation Latitude', E55P: 'Embraer Phenom 300', PC21: 'Pilatus PC-21'
  };
  /** Foto zum Flugzeug: genau dieses Kennzeichen, sonst Beispielfoto vom Typ */
  BI.flugzeug = function (kennz, typ, beschr) {
    var k = String(kennz || '').trim().toUpperCase(), t = String(typ || '').trim().toUpperCase(), art = TYP[t];
    var hinweis = 'Beispielfoto: gleicher Flugzeugtyp' + (beschr || typ ? ' (' + String(beschr || typ).trim() + ')' : '');
    return reihe([
      function () { return k && /^[A-Z0-9]{1,3}-?[A-Z0-9]{2,6}$/.test(k) ? BI.kategorie(k + ' (aircraft)') : []; },
      function () { return art ? BI.wiki(art, 'en', hinweis) : []; },
      function () { var s = String(beschr || '').trim(); return s.length > 3 ? BI.wikiSuche(s + ' aircraft', 'en', hinweis) : t.length >= 3 ? BI.wikiSuche(t + ' aircraft type', 'en', hinweis) : []; }
    ]);
  };

  /* ---------- Raketen ---------- */
  /** bild: { url, credit, lizenz } aus der Launch Library; sonst Foto der Rakete aus Wikipedia */
  BI.rakete = function (bild, rakete) {
    return reihe([
      function () { return bild && /^https?:/.test(bild.url || '') ? [{ bild: bild.url, von: bild.credit || '', lizenz: bild.lizenz && !/unknown/i.test(bild.lizenz) ? bild.lizenz : '', quelle: 'The Space Devs' }] : []; },
      function () { var r = String(rakete || '').replace(/\s+Block\s+\d+.*$/i, '').trim(); return r ? BI.wikiSuche(r + ' rocket', 'en', 'Foto der Rakete (Beispiel)') : []; }
    ]);
  };

  /* ---------- Züge, S-Bahn, U-Bahn, Straßenbahn ----------
   * Ein Foto genau dieses Zuges gibt es nicht – also ein Beispielfoto der Zuggattung bzw. der U-Bahn/Straßenbahn der Stadt. */
  var ART = { fern: 'fern', national: 'fern', nationalexpress: 'fern', regio: 'regio', regional: 'regio', sbahn: 'sbahn', suburban: 'sbahn', ubahn: 'ubahn', subway: 'ubahn', tram: 'tram', bus: 'bus', faehre: 'faehre', ferry: 'faehre' };
  var FERN = [[/^ICE/, 'Intercity-Express'], [/^ECE/, 'EuroCity-Express'], [/^EC/, 'EuroCity'], [/^IC/, 'Intercity (Deutsche Bahn)'], [/^NJ/, 'Nightjet'], [/^FLX/, 'Flixtrain'], [/^TGV/, 'TGV'], [/^RJ/, 'Railjet'], [/^EST|^EUROSTAR/, 'Eurostar']];
  var REGIO = [[/^IRE/, 'Interregio-Express'], [/^RE/, 'Regional-Express'], [/^RB/, 'Regionalbahn']];
  var GRUND = { fern: 'Intercity-Express', regio: 'Regional-Express', sbahn: 'S-Bahn', ubahn: 'U-Bahn', tram: 'Straßenbahn', bus: 'Linienbus', faehre: 'Fährschiff' };
  var STADT_WORT = { sbahn: 'S-Bahn', ubahn: 'U-Bahn', tram: 'Straßenbahn' };
  function stadt(ort) { return String(ort || '').replace(/\(.*?\)/g, ' ').split(/[\s,\/]+/)[0].replace(/[^A-Za-zÄÖÜäöüß-]/g, ''); }
  /** art: Zugart (fern/regio/sbahn/ubahn/tram oder national/regional/suburban/subway); linie z. B. „ICE 123“; ort: Bahnhof/Haltestelle für die Stadt */
  BI.bahn = function (art, linie, ort, artName) {
    var a = ART[String(art || '').toLowerCase()]; if (!a) return null;
    var l = String(linie || '').replace(/\s+/g, '').toUpperCase(), st = stadt(ort), wege = [], an = String(artName || '');
    var gattung = /Seilbahn/i.test(an) ? 'Luftseilbahn' : /Bergbahn/i.test(an) ? 'Standseilbahn' : a === 'bus' && (/Fernbus/i.test(an) || /^FLX/.test(l)) ? 'Flixbus' : null;
    if (a === 'bus' && !gattung && st.length >= 3) { var bt = 'Busverkehr in ' + st; wege.push(function () { return BI.wiki(bt, 'de', 'Beispielfoto: Bus in ' + st); }); }
    (a === 'fern' ? FERN : a === 'regio' ? REGIO : []).forEach(function (r) { if (!gattung && r[0].test(l)) gattung = r[1]; });
    if (gattung) wege.push(function () { return BI.wiki(gattung, 'de', 'Beispielfoto: ' + gattung); });
    if (STADT_WORT[a] && st.length >= 3) {
      var t = STADT_WORT[a] + ' ' + st;
      wege.push(function () { return BI.wiki(t, 'de', 'Beispielfoto: ' + t); });
      wege.push(function () { return BI.wikiSuche(t, 'de', 'Beispielfoto: ' + t); });
    }
    wege.push(function () { return BI.wiki(GRUND[a], 'de', 'Beispielfoto: ' + GRUND[a]); });
    return reihe(wege);
  };

  /* ---------- Satelliten und Raumstationen ---------- */
  var SAT = { GPS: 'GPS Block III', GLONASS: 'GLONASS-K', Galileo: 'Galileo (satellite navigation)', BeiDou: 'BeiDou', QZSS: 'Quasi-Zenith Satellite System', SBAS: 'European Geostationary Navigation Overlay Service', NavIC: 'Indian Regional Navigation Satellite System',
    ISS: 'International Space Station', Tiangong: 'Tiangong space station' };
  var SAT_KAT = { GPS: 'GPS Block III satellites', Galileo: 'Galileo satellites', GLONASS: 'GLONASS-K satellites', BeiDou: 'BeiDou satellites' };
  BI.satellit = function (sys) {
    var beispiel = sys === 'ISS' || sys === 'Tiangong' ? '' : 'Beispielfoto: ' + sys + '-Satellit';
    return reihe([
      function () { return SAT[sys] ? BI.wiki(SAT[sys], 'en', beispiel) : []; },
      function () { return SAT_KAT[sys] ? BI.kategorie(SAT_KAT[sys], beispiel) : []; },
      function () { return BI.wikiSuche(sys + ' satellite', 'en', beispiel); }
    ]);
  };
})();
