/* Foto vom Schiff im eigenen Fenster (Schiff auf der Karte oder auf der Hafen-Tafel antippen).
 * Die Fotos sind freie Bilder von Wikimedia Commons; sie werden nur in der App gezeigt, es öffnet sich keine fremde Seite.
 * Gesucht wird genau über die Schiffsnummer: Commons-Kategorie „IMO 1234567“, dann Wikidata (IMO oder MMSI → Bild),
 * bei Passagierschiffen ohne IMO-Nummer zuletzt über den Namen. Gibt es kein freies Foto, steht das kurz da. */
(function () {
  'use strict';
  var B = FV.B, Tun = FV.Tun;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function h(t) { return FV.esc(t); }
  var F = FV.SCHIFFFOTO = {}, merker = {}, aktuell = null;
  var COMMONS = 'https://commons.wikimedia.org/w/api.php?format=json&action=query';

  function ohneHtml(t) { var d = document.createElement('div'); d.innerHTML = String(t || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  /** Commons-Antwort (query.pages mit imageinfo) → [{ bild, gross, von, lizenz }] */
  function bilderAus(j) {
    var p = j && j.query && j.query.pages; if (!p) return [];
    return Object.keys(p).map(function (k) { return p[k]; }).sort(function (a, b) { return (a.index || 0) - (b.index || 0); }).map(function (x) {
      var i = x.imageinfo && x.imageinfo[0]; if (!i) return null;
      var m = i.extmetadata || {}, url = i.thumburl || i.url || '';
      if (!/\.(jpe?g|png|webp)(\?|$)/i.test(i.url || url)) return null;
      return { bild: url, von: ohneHtml(m.Artist && m.Artist.value).slice(0, 60), lizenz: ohneHtml(m.LicenseShortName && m.LicenseShortName.value) };
    }).filter(Boolean);
  }
  var INFO = '&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1000&iiextmetadatafilter=Artist%7CLicenseShortName';
  function kategorie(titel) {
    return B.json({ url: COMMONS + '&generator=categorymembers&gcmtype=file&gcmlimit=8&gcmtitle=' + encodeURIComponent(titel) + INFO, zeit: 15000 }).then(bilderAus);
  }
  function datei(titel) {
    return B.json({ url: COMMONS + '&titles=' + encodeURIComponent(titel) + INFO, zeit: 15000 }).then(bilderAus);
  }
  /** Wikidata: Schiff mit dieser IMO- oder MMSI-Nummer → Bilddatei (P18) und Commons-Kategorie (P373) */
  function wikidata(imo, mmsi) {
    var w = [];
    if (imo) w.push('{ ?s wdt:P458 "' + imo + '" }');
    if (mmsi) w.push('{ ?s wdt:P587 "' + mmsi + '" }');
    if (!w.length) return Promise.resolve([]);
    var q = 'SELECT ?bild ?kat WHERE { ' + w.join(' UNION ') + ' OPTIONAL { ?s wdt:P18 ?bild } OPTIONAL { ?s wdt:P373 ?kat } } LIMIT 3';
    return B.json({ url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), kopf: { Accept: 'application/sparql-results+json' }, zeit: 15000 }).then(function (j) {
      var r = (j && j.results && j.results.bindings) || [], kat = null, bild = null;
      r.forEach(function (x) { if (!kat && x.kat) kat = x.kat.value; if (!bild && x.bild) bild = decodeURIComponent(String(x.bild.value).split('/').pop()); });
      if (kat) return kategorie('Category:' + kat).then(function (l) { return l.length || !bild ? l : datei('File:' + bild); });
      return bild ? datei('File:' + bild) : [];
    });
  }
  /** Passagierschiff ohne IMO: Commons-Kategorie „Name (ship, Jahr)“ – nur wenn der Name genau passt */
  function nachName(name) {
    var n = String(name || '').trim(); if (n.length < 4) return Promise.resolve([]);
    return B.json({ url: COMMONS + '&list=search&srnamespace=14&srlimit=5&srsearch=' + encodeURIComponent('intitle:"' + n + '" ship'), zeit: 15000 }).then(function (j) {
      var l = (j && j.query && j.query.search) || [], gut = FV.norm(n);
      var k = l.filter(function (x) { var t = String(x.title).replace(/^Category:/, ''); return /\((ship|ferry)[^)]*\)/i.test(t) && FV.norm(t.replace(/\s*\(.*$/, '')) === gut; })[0];
      return k ? kategorie(k.title) : [];
    });
  }
  /** Fotos zu einem Schiff suchen (gemerkt je MMSI) */
  F.suchen = function (s) {
    var schl = s.mmsi + '|' + (s.imo || '');
    if (merker[schl]) return merker[schl];
    var imo = /^\d{7}$/.test(String(s.imo || '')) && +s.imo > 1000000 ? String(s.imo) : '';
    var passagier = s.typ >= 60 && s.typ <= 69;
    var p = (imo ? kategorie('Category:IMO ' + imo) : Promise.resolve([]))
      .catch(function () { return []; })
      .then(function (l) { return l.length ? l : wikidata(imo, s.mmsi ? String(s.mmsi) : '').catch(function () { return []; }); })
      .then(function (l) { return l.length || imo || !passagier ? l : nachName(s.name).catch(function () { return []; }); });
    merker[schl] = p;
    p.then(function (l) { if (!l.length) setTimeout(function () { delete merker[schl]; }, 10 * 60000); });   // später neu probieren (vielleicht kommt die IMO-Nummer noch)
    return p;
  };

  /** Platz für das Foto oben im Schiffs-Fenster */
  F.platz = function () { return '<div id="schifffoto" class="sfoto"><div class="sfoto-laedt"><i class="dreh"></i>Foto vom Schiff wird gesucht …</div></div>'; };
  /** Fotos in den Platz laden */
  F.laden = function (s) {
    aktuell = s.mmsi;
    F.suchen(s).then(function (l) {
      var box = $('#schifffoto'); if (!box || aktuell !== s.mmsi) return;
      if (!l.length) { box.innerHTML = '<div class="sfoto-keins">Für dieses Schiff gibt es (noch) kein freies Foto.</div>'; return; }
      box.innerHTML = '<div class="sfoto-reihe">' + l.map(function (b, i) {
        return '<figure data-tun="schifffoto-gross" data-i="' + i + '"><img src="' + h(b.bild) + '" alt="' + h(s.name || 'Schiff') + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.style.display=\'none\'">' +
          '<figcaption>' + h(['Foto: ' + (b.von || 'unbekannt'), b.lizenz, 'Wikimedia Commons'].filter(Boolean).join(' · ')) + '</figcaption></figure>';
      }).join('') + '</div>' + (l.length > 1 ? '<div class="sfoto-zahl">' + l.length + ' Fotos – zur Seite wischen</div>' : '');
      F.liste = l; F.name = s.name || '';
    }, function () { var box = $('#schifffoto'); if (box) box.innerHTML = '<div class="sfoto-keins">Foto gerade nicht erreichbar.</div>'; });
  };
  /* Antippen: Foto groß im eigenen Fenster (über allem), Antippen oder ✕ schließt */
  Tun['schifffoto-gross'] = function (el) {
    var b = F.liste && F.liste[+el.getAttribute('data-i')]; if (!b) return;
    var d = document.createElement('div'); d.className = 'sfoto-voll'; d.setAttribute('data-tun', 'schifffoto-zu');
    d.innerHTML = '<button data-tun="schifffoto-zu" aria-label="Schließen">' + FV.sym('zu') + '</button><img src="' + h(b.bild) + '" alt=""><p>' + h(F.name) + '<br><small>' + h(['Foto: ' + (b.von || 'unbekannt'), b.lizenz, 'Wikimedia Commons'].filter(Boolean).join(' · ')) + '</small></p>';
    ($('#blatt .innen') || document.body).appendChild(d);
  };
  Tun['schifffoto-zu'] = function () { [].forEach.call(document.querySelectorAll('.sfoto-voll'), function (x) { x.remove(); }); };
})();
