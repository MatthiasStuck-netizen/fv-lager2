/* Kachel „Aktuelles“ auf der Startseite: regionale Nachrichten aus Ostfriesland.
 * Quellen (gleichzeitig gefragt, nach Zeit sortiert): NDR Oldenburg/Ostfriesland, NDR Niedersachsen, Google News „Ostfriesland“.
 * Antippen zeigt den Anreißer, „Ganzen Artikel lesen“ öffnet die Seite des Anbieters. */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, sym = FV.sym, Se = FV.Seiten, Tun = FV.Tun, X = FV.SX, h = X.h;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }

  var QUELLEN = [
    { name: 'NDR Oldenburg/Ostfriesland', url: 'https://www.ndr.de/nachrichten/niedersachsen/oldenburg_ostfriesland/index-rss.xml' },
    { name: 'NDR Niedersachsen', url: 'https://www.ndr.de/nachrichten/niedersachsen/index-rss.xml' },
    { name: 'Google News', url: 'https://news.google.com/rss/search?q=Ostfriesland&hl=de&gl=DE&ceid=DE:de' }
  ];
  var stand = { liste: null, zeit: 0, laeuft: false }, lauf = 0;

  function text(el, name) { var x = el.getElementsByTagName(name)[0]; return x ? (x.textContent || '').trim() : ''; }
  function ohneHtml(t) { var d = document.createElement('div'); d.innerHTML = String(t || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function lesen(q, xml) {
    var doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('unverständliche Antwort');
    return [].slice.call(doc.getElementsByTagName('item')).map(function (it) {
      var titel = ohneHtml(text(it, 'title')), link = text(it, 'link'), d = new Date(text(it, 'pubDate'));
      var quelle = text(it, 'source') || q.name;
      // Google News hängt die Quelle an den Titel („… - NWZonline“)
      if (q.name === 'Google News' && quelle && titel.slice(-quelle.length - 3) === ' - ' + quelle) titel = titel.slice(0, -quelle.length - 3);
      var anriss = q.name === 'Google News' ? '' : ohneHtml(text(it, 'description'));
      return titel && link ? { titel: titel, link: link, zeit: isNaN(d) ? null : d, quelle: quelle, anriss: anriss } : null;
    }).filter(Boolean);
  }
  function holen(q) {
    return new Promise(function (ok) {
      var t = setTimeout(function () { ok([]); }, 15000);
      B.http({ url: q.url, kopf: { Accept: 'application/rss+xml, application/xml, text/xml' }, zeit: 15000 }).then(function (r) {
        clearTimeout(t);
        try { ok(r.status < 400 ? lesen(q, r.text) : []); } catch (e) { ok([]); }
      }, function () { clearTimeout(t); ok([]); });
    });
  }
  function alleHolen() {
    return Promise.all(QUELLEN.map(holen)).then(function (t) {
      var gesehen = {}, l = [];
      t.forEach(function (x) { x.forEach(function (m) {
        var k = FV.norm(m.titel).slice(0, 60); if (gesehen[k]) return; gesehen[k] = 1; l.push(m);
      }); });
      var grenze = Date.now() - 4 * 86400000;   // nur die letzten Tage
      return l.filter(function (m) { return !m.zeit || m.zeit.getTime() >= grenze; })
        .sort(function (a, b) { return (b.zeit ? b.zeit.getTime() : 0) - (a.zeit ? a.zeit.getTime() : 0); }).slice(0, 60);
    });
  }
  function wann(d) {
    if (!d) return '';
    var heute = new Date(); heute.setHours(0, 0, 0, 0);
    var tag = new Date(d); tag.setHours(0, 0, 0, 0);
    var diff = Math.round((heute - tag) / 86400000);
    return (diff === 0 ? 'heute' : diff === 1 ? 'gestern' : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })) + ' ' + G.uhr(d);
  }

  Tun.aktuelles = function () { A().blattZu(); A().zeige('aktuelles'); };
  Se.aktuelles = function () {
    X.seite(X.kopf('Aktuelles', '<button class="rand kasten" data-tun="aktuelles-neu" aria-label="Neu laden">' + sym('neu') + '</button>') +
      '<div class="rollen" id="akliste">' + X.laedt('Nachrichten aus Ostfriesland werden geladen …') + '</div>');
    if (stand.liste && Date.now() - stand.zeit < 10 * 60000) { zeigen(); return; }
    laden();
  };
  Tun['aktuelles-neu'] = function () { var b = $('#akliste'); if (b) b.innerHTML = X.laedt('Nachrichten werden neu geladen …'); laden(); };
  function laden() {
    var meins = ++lauf;
    alleHolen().then(function (l) {
      if (meins !== lauf) return;
      if (l.length) { stand.liste = l; stand.zeit = Date.now(); }
      zeigen();
    });
  }
  function zeigen() {
    var box = $('#akliste'); if (!box) return;
    var l = stand.liste;
    if (!l || !l.length) {
      box.innerHTML = '<div class="fehler">Die Nachrichten konnten gerade nicht geladen werden. Bitte Internet prüfen und oben rechts neu laden.</div>';
      return;
    }
    box.innerHTML = '<h3 class="ueber">' + sym('zeitung') + 'Nachrichten aus Ostfriesland und der Region</h3>' + l.map(function (m, i) {
      return '<div class="eintrag tippbar" data-tun="aktuelles-eintrag" data-i="' + i + '">' + sym('zeitung') +
        '<div class="txt"><b style="white-space:normal">' + h(m.titel) + '</b><span>' + h([wann(m.zeit), m.quelle].filter(Boolean).join(' · ')) + '</span></div><div class="ende">' + sym('rechts') + '</div></div>';
    }).join('') + '<p class="klein2" style="text-align:center">Stand ' + G.uhr(new Date(stand.zeit)) + ' · Quellen: NDR, Google News. Die Artikel gehören den jeweiligen Anbietern.</p>';
  }
  Tun['aktuelles-eintrag'] = function (el) {
    var m = stand.liste && stand.liste[+el.getAttribute('data-i')]; if (!m) return;
    A().blatt('<h2>' + sym('zeitung') + '<span style="white-space:normal">' + h(m.titel) + '<br><small style="font-weight:400;font-size:13px">' + h([wann(m.zeit), m.quelle].filter(Boolean).join(' · ')) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      (m.anriss ? '<p style="margin:4px 2px 12px;line-height:1.45">' + h(m.anriss) + '</p>' : '') +
      '<button class="gold knopf breit" data-tun="oeffnen" data-url="' + h(m.link) + '">' + sym('extern') + 'Ganzen Artikel lesen</button>');
  };
})();
