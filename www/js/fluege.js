/* Flüge: Flughäfen weltweit (eingebaute Liste), echte Flugstrecken aus der Flugtafel und Flugzeuge live (ADS-B). */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, K = FV.K, sym = FV.sym, Se = FV.Seiten, Tun = FV.Tun, X = FV.SX, h = X.h;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }
  var FL = FV.FL = {}, nachIata = {};
  (FV.FLUGHAEFEN || []).forEach(function (a) { nachIata[a[0]] = a; });

  /* ---------- Flughäfen ---------- */
  function obj(a, p) {
    var f = { iata: a[0], name: a[1], ort: a[2], land: a[3], lat: a[4], lon: a[5], groesse: a[6], gross: a[6] === 2, icao: a[7] || '', web: '' };
    if (p) f.weit = Math.round(G.abstand(p, f));
    return f;
  }
  FL.iata = function (code) { var a = nachIata[String(code || '').toUpperCase()]; return a ? obj(a) : null; };
  var landNamen = null;
  FL.land = function (cc) {
    if (!cc) return '';
    try { if (!landNamen) landNamen = new Intl.DisplayNames(['de'], { type: 'region' }); return landNamen.of(cc) || cc; } catch (e) { return cc; }
  };
  FL.ortText = function (f) { return [f.ort, FL.land(f.land)].filter(Boolean).join(', '); };
  /** Flughäfen zu einem Suchtext: Kürzel (PMI), Ort (Palma), Name (Mallorca) oder Land (Spanien) */
  FL.suchen = function (text) {
    var q = FV.norm(text); if (!q) return [];
    var gross = String(text).trim().toUpperCase(), aus = [];
    (FV.FLUGHAEFEN || []).forEach(function (a) {
      var w = 0, ort = FV.norm(a[2]), name = FV.norm(a[1]);
      if (a[0] === gross || a[7] === gross) w = 1000;
      else if (ort === q) w = 300;
      else if (ort.indexOf(q) === 0) w = 200;
      else if ((' ' + name + ' ').indexOf(' ' + q) >= 0) w = 150;
      else if (q.length >= 4 && (ort.indexOf(q) >= 0 || name.indexOf(q) >= 0)) w = 80;
      else if (q.length >= 4 && FV.norm(FL.land(a[3])) === q) w = 20;
      if (w) aus.push([w + a[6] * 30, a]);
    });
    aus.sort(function (x, y) { return y[0] - x[0]; });
    return aus.slice(0, 25).map(function (x) { return obj(x[1]); });
  };
  /** Flughäfen im Umkreis (Meter), nächste zuerst – große bevorzugt, wenn nur wenig weiter weg */
  FL.nahe = function (p, meter) {
    var l = [];
    (FV.FLUGHAEFEN || []).forEach(function (a) {
      if (Math.abs(a[4] - p.lat) > meter / 90000 || Math.abs(a[5] - p.lon) > meter / (90000 * Math.max(0.15, Math.cos(p.lat * Math.PI / 180)))) return;
      var f = obj(a, p); if (f.weit <= meter) l.push(f);
    });
    return l.sort(function (a, b) { return (a.weit - a.groesse * 15000) - (b.weit - b.groesse * 15000); }).slice(0, 20);
  };

  /* ---------- Echte Flugstrecken aus der Flugtafel (AeroDataBox über die Verwaltung) ---------- */
  function iataAus(t) { var m = /\(([A-Z]{3})\)\s*$/.exec(String(t || '')); return m ? m[1] : ''; }
  /** Flüge je Gegenflughafen: [{ f (Flughafen), fluege: [...] }], meiste zuerst */
  FL.gruppen = function (d, ankunft, eigen) {
    var g = {}, l = [];
    ((ankunft ? d.an : d.ab) || []).forEach(function (x) {
      var c = iataAus(x.ort), f = c && c !== eigen && FL.iata(c); if (!f) return;
      if (!g[c]) { g[c] = { f: f, fluege: [] }; l.push(g[c]); }
      g[c].fluege.push(x);
    });
    return l.sort(function (a, b) { return b.fluege.length - a.fluege.length || a.f.name.localeCompare(b.f.name); });
  };
  function kartenSichtbar() { return !!(K.map && K.map.getContainer && K.map.getContainer().isConnected); }
  /** Wird eine Flugtafel geladen und ist eine Karte zu sehen, kommen die Strecken dieses Flughafens drauf */
  FL.streckenAusTafel = function (f, d, ankunft) {
    if (A().e.flugrouten === false || !kartenSichtbar() || A().oben() === 'flugkarte') return;
    var start = FL.iata(f.iata) || f;
    K.flugstrecken(FL.gruppen(d, ankunft, f.iata).map(function (g) { return { von: start, nach: g.f, n: g.fluege.length }; }));
  };

  /* ---------- Seite „Flugstrecken“ eines Flughafens ---------- */
  Se.flugkarte = function (p) {
    var f = p.f, z = A().z, meins = X.neuerLauf(), ankunft = !!p.an;
    z.fk = { f: f, d: null, an: ankunft, wahl: -1, gr: [] };
    X.seite(X.kopf('Flugstrecken ' + f.iata) +
      '<div class="modi"><button data-tun="fk-art" data-a="ab"' + (!ankunft ? ' class="akt"' : '') + '>' + sym('abflug') + '<span>Abflüge</span></button><button data-tun="fk-art" data-a="an"' + (ankunft ? ' class="akt"' : '') + '>' + sym('ankunft') + '<span>Ankünfte</span></button></div>' +
      X.kartenfeld('<div class="kartenmeldung" id="kmeld"><i class="dreh"></i><span>Flugtafel wird geladen …</span></div>' +
        '<div class="zoom"><button data-tun="zoom" data-n="1">' + sym('plus') + '</button><button data-tun="zoom" data-n="-1">' + sym('minus') + '</button></div>' + X.ebenenKnopf()) +
      '<div class="rollen" id="fkliste" style="flex:none;max-height:38vh">' + X.laedt('Strecken werden gesucht …') + '</div>');
    var start = FL.iata(f.iata) || f;
    var kp = K.setzen($('#kfeld')).then(function () { if (meins !== X.lauf()) return; K.leeren(); K.flughaefen([start], function () { X.flugBlatt(f, ankunft); }); K.mitte(start, 5); }).catch(function () {});
    Promise.all([FV.V.flugtafel(f.iata), kp]).then(function (x) {
      if (meins !== X.lauf()) return;
      z.fk.d = x[0]; fkZeigen(true);
    }).catch(function (e) {
      if (meins !== X.lauf()) return;
      var m = $('#kmeld'); if (m) m.remove();
      var r = e && e.antwort || {}, b = $('#fkliste'); if (!b) return;
      b.innerHTML = '<div class="fehler">' + (e.unbekannt ? 'Für die Flugtafel braucht die Verwaltung die neue warenwirtschaft.php.' : r.kein_schluessel ? 'Für die Flugtafel trägt das Büro in der Verwaltung (Einstellungen → App) einen kostenlosen AeroDataBox-Schlüssel ein.' : 'Die Flugtafel konnte gerade nicht geladen werden.') + '</div>';
    });
  };
  Se.flugkarte_weg = function () { X.neuerLauf(); K.leeren(); };
  function fkZeigen(rahmen) {
    var fk = A().z.fk; if (!fk || !fk.d) return;
    var start = FL.iata(fk.f.iata) || fk.f, gr = fk.gr = FL.gruppen(fk.d, fk.an, fk.f.iata), m = $('#kmeld'); if (m) m.remove();
    K.flugstrecken(gr.map(function (g, i) { return { von: start, nach: g.f, n: g.fluege.length, akt: i === fk.wahl }; }));
    K.flughaefen([start].concat(gr.map(function (g) { return g.f; })), function (x) { if (x.iata === start.iata) X.flugBlatt(fk.f, fk.an); else { var i = gr.map(function (g) { return g.f.iata; }).indexOf(x.iata); if (i >= 0) fkWahl(i); } });
    if (rahmen) { var pk = [[start.lon, start.lat]]; gr.forEach(function (g) { var l = K.grosskreis(start, g.f, 2); pk.push(l[l.length - 1]); }); K.rahmen(pk, { top: 40, bottom: 30, left: 30, right: 60 }); }
    var b = $('#fkliste'); if (!b) return;
    var alle = (fk.an ? fk.d.an : fk.d.ab) || [];
    if (!gr.length) { b.innerHTML = '<div class="gut">In den nächsten Stunden sind keine ' + (fk.an ? 'Ankünfte' : 'Abflüge') + ' mit bekanntem Flughafen angekündigt.</div>'; return; }
    b.innerHTML = '<p class="klein2" style="margin:0 2px 8px">' + gr.length + ' Strecken · ' + alle.length + ' Flüge ' + (fk.an ? 'nach ' : 'ab ') + h(fk.f.name) + ' (2 Std. zurück bis 10 Std. voraus). Strecke antippen: Flüge ansehen.</p>' + gr.map(function (g, i) {
      var n = g.fluege.filter(function (x) { return x.plan && x.plan > Date.now() - 600000; })[0] || g.fluege[0];
      return '<div class="eintrag tippbar flug' + (i === fk.wahl ? ' zielbf' : '') + '" data-tun="fk-wahl" data-i="' + i + '">' + sym('flug') + '<div class="txt"><b>' + h(g.f.ort || g.f.name) + ' <small class="iata">' + h(g.f.iata) + '</small></b><span>' + h([FL.land(g.f.land), Math.round(G.abstand(start, g.f) / 1000) + ' km', 'nächster ' + (n.plan ? G.uhr(n.plan) : '–') + ' ' + n.nr].join(' · ')) + '</span></div>' +
        '<div class="ende"><span class="wert" style="font-size:14px">' + g.fluege.length + '×</span>' + sym('rechts') + '</div></div>';
    }).join('') + '<p class="klein2" style="text-align:center">Flugtafel: AeroDataBox · Strecken als Großkreis (kürzester Weg), ohne Gewähr.</p>';
  }
  Tun['fk-art'] = function (el) { var fk = A().z.fk; if (!fk) return; fk.an = el.getAttribute('data-a') === 'an'; fk.wahl = -1; [].forEach.call(document.querySelectorAll('.modi [data-tun=fk-art]'), function (b) { b.classList.toggle('akt', b === el); }); fkZeigen(true); };
  Tun['fk-wahl'] = function (el) { fkWahl(+el.getAttribute('data-i')); };
  function fkWahl(i) {
    var fk = A().z.fk, g = fk && fk.gr[i]; if (!g) return;
    var start = FL.iata(fk.f.iata) || fk.f;
    if (fk.wahl === i) { fluegeBlatt(g, fk); return; }
    fk.wahl = i; fkZeigen(false);
    K.rahmen(K.grosskreis(start, g.f, 8), { top: 50, bottom: 40, left: 40, right: 70 });
    fluegeBlatt(g, fk);
  }
  var ST = { Departed: 'gestartet', EnRoute: 'in der Luft', Arrived: 'gelandet', Approaching: 'im Anflug', Landed: 'gelandet', Boarding: 'Boarding', GateClosed: 'Gate zu', CheckIn: 'Check-in', Delayed: 'verspätet', Canceled: 'annulliert', Diverted: 'umgeleitet', Expected: 'erwartet', Scheduled: 'planmäßig' };
  function fluegeBlatt(g, fk) {
    A().blatt('<h2>' + sym('flug') + '<span>' + h(fk.an ? g.f.iata + ' → ' + fk.f.iata : fk.f.iata + ' → ' + g.f.iata) + '<br><small style="font-weight:400;font-size:13px">' + h(g.f.name + ', ' + FL.land(g.f.land)) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      g.fluege.map(function (x) {
        var aus = /Cancel/.test(x.status), zt = aus ? '<em class="spaet">annulliert</em>' : x.verz >= 5 ? '<em class="spaet">+' + x.verz + ' · ' + G.uhr(x.neu) + '</em>' : x.neu ? '<em class="puenktlich">pünktlich</em>' : '<em class="grau2">geplant</em>';
        return '<div class="tz tippbar' + (aus ? ' faellt' : '') + '" data-tun="fk-flug" data-c="' + h(g.f.iata) + '" data-i="' + g.fluege.indexOf(x) + '"><div class="tzeit"><b>' + G.uhr(x.plan) + '</b>' + zt + '</div><div class="tinfo"><b><i class="lin">' + h(x.nr) + '</i> ' + h(x.airline || '') + '</b><small>' + h(ST[x.status] || '') + '</small></div>' +
          '<div class="tgleis"><small>' + (fk.an ? 'Band' : 'Gate') + '</small><b>' + h((fk.an ? x.band : x.gate) || '–') + '</b>' + (x.terminal ? '<s style="text-decoration:none">T' + h(x.terminal) + '</s>' : '') + '</div></div>';
      }).join('') + '<div style="height:10px"></div><button class="rand knopf breit" data-tun="fk-gegen" data-c="' + h(g.f.iata) + '">' + sym('flug') + 'Flugtafel ' + h(g.f.iata) + '</button>');
  }
  Tun['fk-flug'] = function (el) {
    var fk = A().z.fk; if (!fk) return;
    var g = fk.gr.filter(function (y) { return y.f.iata === el.getAttribute('data-c'); })[0], x = g && g.fluege[+el.getAttribute('data-i')];
    if (x) FL.flugDetail(x, fk.f, fk.an);
  };
  Tun['fk-gegen'] = function (el) { var f = FL.iata(el.getAttribute('data-c')); if (!f) return; var o = B.ort(); if (o) f.weit = Math.round(G.abstand(o, f)); X.flugBlatt(f, false); };

  /* ---------- Flugzeuge live (ADS-B: adsb.lol, sonst OpenSky Network) ---------- */
  var liste = [], wahl = null, letzt = 0, laeuft = false, karteGehoert = null, bewegT = null;
  function an() { var e = A() && A().e; return !!(e && e.flugzeuge && kartenSichtbar() && !document.hidden); }
  FL.live = function () { if (!an()) { liste = []; K.flugzeuge([]); return; } holen(true); };
  function zahl(x) { return typeof x === 'number' && isFinite(x) ? x : null; }
  function adsbLol(lat, lon, nm) {
    return B.json({ url: 'https://api.adsb.lol/v2/lat/' + lat.toFixed(3) + '/lon/' + lon.toFixed(3) + '/dist/' + nm, kopf: { Accept: 'application/json' }, zeit: 15000 }).then(function (j) {
      if (!j || !Array.isArray(j.ac)) throw new Error('unverständliche Antwort');
      return j.ac.map(function (a) {
        var la = zahl(a.lat), lo = zahl(a.lon); if (la == null || lo == null) return null;
        var hoehe = a.alt_baro === 'ground' ? 0 : zahl(a.alt_baro) != null ? a.alt_baro : zahl(a.alt_geom);
        return { id: String(a.hex || '').toLowerCase(), name: String(a.flight || '').trim(), kennz: a.r || '', typ: a.t || '', beschr: a.desc || '', lat: la, lon: lo, kurs: zahl(a.track) != null ? a.track : zahl(a.true_heading) || 0,
          hoeheFt: hoehe, kmh: zahl(a.gs) != null ? Math.round(a.gs * 1.852) : null, boden: a.alt_baro === 'ground', squawk: a.squawk || '', quelle: 'adsb.lol' };
      }).filter(Boolean);
    });
  }
  function openSky(g) {
    var u = 'https://opensky-network.org/api/states/all?lamin=' + g.s.toFixed(3) + '&lomin=' + g.w.toFixed(3) + '&lamax=' + g.n.toFixed(3) + '&lomax=' + g.o.toFixed(3);
    return B.json({ url: u, zeit: 15000 }).then(function (j) {
      return (j && j.states || []).map(function (s) {
        if (s[6] == null || s[5] == null) return null;
        return { id: String(s[0]), name: String(s[1] || '').trim(), kennz: '', typ: '', lat: s[6], lon: s[5], kurs: s[10] || 0, hoeheFt: s[7] != null ? Math.round(s[7] / 0.3048) : null,
          kmh: s[9] != null ? Math.round(s[9] * 3.6) : null, boden: !!s[8], squawk: s[14] || '', land: s[2] || '', quelle: 'OpenSky' };
      }).filter(Boolean);
    });
  }
  function holen(sofort) {
    if (laeuft || !an()) return;
    if (!sofort && Date.now() - letzt < 15000) return;
    var map = K.map, c = map.getCenter(), b = map.getBounds(), ecke = { lat: b.getNorth(), lon: b.getEast() };
    var nm = Math.max(20, Math.min(250, Math.round(G.abstand({ lat: c.lat, lon: c.lng }, ecke) / 1852)));
    var g = { s: Math.max(-85, b.getSouth()), n: Math.min(85, b.getNorth()), w: Math.max(-180, b.getWest()), o: Math.min(180, b.getEast()) };
    laeuft = true; letzt = Date.now();
    adsbLol(c.lat, c.lng, nm).catch(function () { return openSky(g); }).then(function (l) {
      laeuft = false; if (!an()) return;
      var mitte = { lat: c.lat, lon: c.lng };
      l.forEach(function (f) { f.ab = G.abstand(mitte, f); });
      l.sort(function (x, y) { return x.ab - y.ab; });
      liste = l.slice(0, 150);
      if (wahl) { var neu = liste.filter(function (f) { return f.id === wahl.id; })[0]; if (neu) { neu.akt = true; wahl = Object.assign(wahl, neu); } }
      K.flugzeuge(liste, flugzeugBlatt);
      hoeren();
    }).catch(function () { laeuft = false; });
  }
  function hoeren() {
    if (!K.map || karteGehoert === K.map) return;
    karteGehoert = K.map;
    K.map.on('moveend', function () { clearTimeout(bewegT); bewegT = setTimeout(function () { if (an() && Date.now() - letzt > 8000) holen(true); }, 1200); });
  }
  setInterval(function () { if (an()) holen(false); else if (liste.length) { liste = []; K.flugzeuge([]); } }, 20000);

  function hoeheText(ft) { if (ft == null) return 'unbekannt'; if (ft <= 0) return 'am Boden'; return (Math.round(ft * 0.3048 / 10) * 10).toLocaleString('de-DE') + ' m (' + Math.round(ft).toLocaleString('de-DE') + ' ft)'; }
  function zeile(s, k, t) { return t ? '<div class="detailzeile">' + sym(s) + '<div><small>' + k + '</small>' + t + '</div></div>' : ''; }
  function flugzeugBlatt(f) {
    if (!f) return;
    wahl = f; liste.forEach(function (x) { x.akt = x.id === f.id; }); K.flugzeuge(liste, flugzeugBlatt);
    A().blatt('<h2>' + sym('flug') + '<span>' + h(f.name || f.kennz || f.id.toUpperCase()) + '<br><small style="font-weight:400;font-size:13px">' + h([f.typ, f.beschr, f.kennz].filter(Boolean).join(' · ') || 'Flugzeug') + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' + (FV.BILD ? FV.BILD.platz('Foto vom Flugzeug wird gesucht …') : '') +
      '<div id="fzroute">' + (f.name ? X.laedt('Strecke wird gesucht …') : '') + '</div>' +
      '<div class="block">' + zeile('auf', 'Höhe', h(hoeheText(f.hoeheFt))) + zeile('tempo', 'Geschwindigkeit', f.kmh != null ? f.kmh + ' km/h über Grund' : '') + zeile('navi', 'Kurs', Math.round(f.kurs || 0) + '°') +
      zeile('info', 'Kennung', h(['ICAO ' + f.id.toUpperCase(), f.squawk ? 'Squawk ' + f.squawk : '', f.land || ''].filter(Boolean).join(' · '))) + '</div>' +
      '<div id="fzzeiten"></div>' +
      '<p class="klein2">Live-Position: ' + h(f.quelle) + ' (ADS-B, ohne Gewähr) · wird alle 20 Sekunden neu geholt.</p>');
    if (FV.BILD) FV.BILD.zeigen(FV.BILD.flugzeug(f.kennz, f.typ, f.beschr), f.name || f.kennz || 'Flugzeug');
    if (!f.name) { zeitenZeigen(f, null); return; }
    strecke(f).then(function (r) {
      if (wahl === f) zeitenZeigen(f, r);
      var box = $('#fzroute'); if (!box || wahl !== f) return;
      if (!r) { box.innerHTML = '<p class="klein2" style="margin:0 2px 8px">Für ' + h(f.name) + ' ist keine Strecke bekannt (z. B. Privat- oder Frachtflug).</p>'; return; }
      var gesamt = G.abstand(r.von, r.nach), bisher = G.abstand(r.von, f), anteil = gesamt ? Math.max(0, Math.min(100, Math.round(bisher * 100 / gesamt))) : 0;
      box.innerHTML = '<div class="block creme fzstrecke"><div class="fzorte"><div><b>' + h(r.von.iata || r.von.icao || '') + '</b><span>' + h(r.von.ort || r.von.name || '') + '</span></div>' + sym('flug') +
        '<div><b>' + h(r.nach.iata || r.nach.icao || '') + '</b><span>' + h(r.nach.ort || r.nach.name || '') + '</span></div></div>' +
        '<div class="offbalken"><i style="width:' + anteil + '%"></i></div><small>' + h((r.airline ? r.airline + ' · ' : '') + Math.round(gesamt / 1000).toLocaleString('de-DE') + ' km · etwa ' + anteil + ' % geflogen') + '</small></div>' +
        '<div class="zweier" style="margin-bottom:10px">' + (FL.iata(r.von.iata) ? '<button class="rand knopf" data-tun="fk-gegen" data-c="' + h(r.von.iata) + '">' + sym('abflug') + h(r.von.iata) + '</button>' : '') +
        (FL.iata(r.nach.iata) ? '<button class="rand knopf" data-tun="fk-gegen" data-c="' + h(r.nach.iata) + '">' + sym('ankunft') + h(r.nach.iata) + '</button>' : '') + '</div>';
      if (A().e.flugrouten !== false) K.flugstrecken([{ von: r.von, nach: r.nach, akt: true }]);
    });
  }
  /* ---------- Uhrzeit, Abflug und Ankunft eines Flugs ----------
   * Erst die Flugdaten über die Verwaltung (AeroDataBox, vom Server eine Stunde gemerkt), sonst aus Strecke, Höhe und Tempo geschätzt. */
  var flugMerker = {};
  function flugDaten(f) {
    var k = (f.id || '') + '|' + (f.name || '');
    if (flugMerker[k] && Date.now() - flugMerker[k].t < 600000) return Promise.resolve(flugMerker[k].d);
    if (!FV.S || !(FV.S.angemeldet() || FV.S.demo)) return Promise.resolve(null);
    return FV.S.ruf('flug', { hex: f.id || '', cs: f.name || '', nr: f.nr || '' }, 25000).then(function (r) { var d = r && r.flug || null; flugMerker[k] = { t: Date.now(), d: d }; return d; }).catch(function () { flugMerker[k] = { t: Date.now(), d: null }; return null; });
  }
  FL.flugDaten = flugDaten;
  function t(x) { return x ? new Date(x) : null; }
  function zeitZeile(s, k, plan, neu, ca) {
    if (!plan && !neu) return '';
    var v = plan && neu ? Math.round((neu - plan) / 60000) : null;
    return zeile(s, k, (ca ? 'ca. ' : '') + G.uhr(plan || neu) + (v != null && v >= 5 ? ' <em class="spaet">+' + v + ' · ' + G.uhr(neu) + '</em>' : v != null && Math.abs(v) < 5 ? ' <em class="puenktlich">pünktlich</em>' : v != null && v <= -5 ? ' <em class="puenktlich">früher · ' + G.uhr(neu) + '</em>' : ''));
  }
  function zeitenZeigen(f, r) {
    var box = $('#fzzeiten'); if (!box) return;
    // Schätzung ohne Flugdaten: Rest-Strecke durch Tempo (+ 15 Min. Anflug), Start aus geflogener Strecke
    var schatz = null;
    if (r && f.kmh > 150) {
      var rest = G.abstand(f, r.nach) / 1000, weg = G.abstand(r.von, f) / 1000, v = Math.max(300, f.kmh);
      schatz = { an: new Date(Date.now() + (rest / v * 60 + (rest > 60 ? 12 : 4)) * 60000), ab: new Date(Date.now() - (weg / Math.min(v, 780) * 60 + (weg > 80 ? 18 : 8)) * 60000) };
    }
    function zeigen(d) {
      var b = $('#fzzeiten'); if (!b || wahl !== f) return;
      var ab = d && (t(d.ab_ist) || t(d.ab_neu)), an = d && (t(d.an_ist) || t(d.an_neu));
      b.innerHTML = '<div class="block fzzeiten">' + zeile('uhr', 'Uhrzeit jetzt', G.uhr(new Date())) +
        (d ? zeitZeile('abflug', 'Abflug' + (d.von ? ' ' + h(d.von) : ''), t(d.ab_plan), ab) + zeitZeile('ankunft', 'Ankunft' + (d.nach ? ' ' + h(d.nach) : ''), t(d.an_plan), an) + (d.nr ? zeile('info', 'Flug', h(d.nr + (d.airline ? ' · ' + d.airline : ''))) : '')
          : schatz ? zeitZeile('abflug', 'Abflug (geschätzt)', schatz.ab, null, true) + zeitZeile('ankunft', 'Ankunft (geschätzt)', schatz.an, null, true) : zeile('info', 'Abflug / Ankunft', 'für diesen Flug nicht bekannt')) + '</div>';
    }
    zeigen(null);
    flugDaten(f).then(function (d) { if (d) zeigen(d); });
  }

  /* ---------- Flug aus der Flugtafel antippen: Zeiten, Flugzeug und – wenn es in der Luft ist – die Live-Daten ---------- */
  var detail = null, detailT = null;
  function liveSuchen(x) {
    var wege = [];
    if (x.hex) wege.push('https://api.adsb.lol/v2/hex/' + encodeURIComponent(String(x.hex).toLowerCase()));
    if (x.cs) wege.push('https://api.adsb.lol/v2/callsign/' + encodeURIComponent(String(x.cs).replace(/\s+/g, '').toUpperCase()));
    if (x.reg) wege.push('https://api.adsb.lol/v2/reg/' + encodeURIComponent(String(x.reg).toUpperCase()));
    var i = 0;
    function frag() {
      if (i >= wege.length) return Promise.resolve(null);
      return B.json({ url: wege[i++], kopf: { Accept: 'application/json' }, zeit: 12000 }).then(function (j) {
        var a = j && Array.isArray(j.ac) && j.ac.filter(function (y) { return zahl(y.lat) != null; })[0];
        if (!a) return frag();
        var hoehe = a.alt_baro === 'ground' ? 0 : zahl(a.alt_baro) != null ? a.alt_baro : zahl(a.alt_geom);
        return { id: String(a.hex || '').toLowerCase(), name: String(a.flight || '').trim(), kennz: a.r || '', typ: a.t || '', beschr: a.desc || '', lat: a.lat, lon: a.lon, kurs: zahl(a.track) != null ? a.track : 0,
          hoeheFt: hoehe, kmh: zahl(a.gs) != null ? Math.round(a.gs * 1.852) : null, boden: a.alt_baro === 'ground', squawk: a.squawk || '', quelle: 'adsb.lol' };
      }).catch(function () { return frag(); });
    }
    return frag();
  }
  FL.flugDetail = function (x, flughafen, ankunft) {
    detail = { x: x, f: flughafen, an: ankunft, live: null };
    var gegen = /\(([A-Z]{3})\)\s*$/.exec(x.ort || ''), gIata = gegen ? gegen[1] : '', g = FL.iata(gIata);
    var von = ankunft ? (g || { iata: gIata, ort: x.ort }) : (FL.iata(flughafen.iata) || flughafen), nach = ankunft ? (FL.iata(flughafen.iata) || flughafen) : (g || { iata: gIata, ort: x.ort });
    detail.von = von; detail.nach = nach;
    var aus = /Cancel/.test(x.status);
    function zeitenHtml() {
      var abP = t(x.ab_plan) || (!ankunft ? x.plan : null), abN = t(x.ab_neu) || (!ankunft ? x.neu : null), anP = t(x.an_plan) || (ankunft ? x.plan : null), anN = t(x.an_neu) || (ankunft ? x.neu : null);
      return zeile('uhr', 'Uhrzeit jetzt', G.uhr(new Date())) + zeitZeile('abflug', 'Abflug ' + h(von.iata || ''), abP, abN) + zeitZeile('ankunft', 'Ankunft ' + h(nach.iata || ''), anP, anN);
    }
    A().blatt('<h2>' + sym('flug') + '<span>' + h(x.nr) + (x.cs ? ' <small class="iata">' + h(x.cs) + '</small>' : '') + '<br><small style="font-weight:400;font-size:13px">' + h([x.airline, x.typ, x.reg].filter(Boolean).join(' · ') || 'Flug') + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' + (FV.BILD ? FV.BILD.platz('Foto vom Flugzeug wird gesucht …') : '') +
      '<div class="block creme fzstrecke"><div class="fzorte"><div><b>' + h(von.iata || '') + '</b><span>' + h(von.ort || von.name || '') + '</span></div>' + sym('flug') +
        '<div><b>' + h(nach.iata || '') + '</b><span>' + h(nach.ort || nach.name || '') + '</span></div></div><div class="offbalken"><i id="fdanteil" style="width:0%"></i></div><small id="fdstand">' + h(aus ? 'annulliert' : (ST[x.status] || 'geplant')) + '</small></div>' +
      '<div class="block" id="fdzeiten">' + zeitenHtml() + zeile('pin', ankunft ? 'Gepäckband' : 'Gate', h([(ankunft ? x.band : x.gate) || '', x.terminal ? 'Terminal ' + x.terminal : ''].filter(Boolean).join(' · '))) + '</div>' +
      '<div id="fdlive">' + (aus ? '' : X.laedt('Live-Position wird gesucht …')) + '</div>' +
      '<p class="klein2">Flugtafel: AeroDataBox · Live-Position: adsb.lol (ADS-B, ohne Gewähr) · wird alle 20 Sekunden neu geholt.</p>');
    if (FV.BILD) FV.BILD.zeigen(FV.BILD.flugzeug(x.reg, '', x.typ), x.nr || 'Flugzeug');
    function live() {
      if (!detail || detail.x !== x || !$('#fdlive')) { clearInterval(detailT); return; }
      liveSuchen(x).then(function (a) {
        var b = $('#fdlive'); if (!b || !detail || detail.x !== x) return;
        if (!a) { b.innerHTML = '<p class="klein2" style="margin:0 2px 8px">' + (x.status === 'EnRoute' || x.status === 'Departed' ? 'Das Flugzeug ist gerade nicht im Empfang (z. B. über dem Meer).' : 'Das Flugzeug ist gerade nicht in der Luft – Live-Daten gibt es ab dem Start.') + '</p>'; return; }
        detail.live = a;
        var ges = von.lat != null && nach.lat != null ? G.abstand(von, nach) : 0, bis = ges ? G.abstand(von, a) : 0, anteil = ges ? Math.max(0, Math.min(100, Math.round(bis * 100 / ges))) : 0;
        var bi = $('#fdanteil'); if (bi) bi.style.width = (a.boden ? 0 : anteil) + '%';
        var st = $('#fdstand'); if (st) st.textContent = (a.boden ? 'am Boden' : 'in der Luft') + (ges ? ' · ' + Math.round(ges / 1000).toLocaleString('de-DE') + ' km · etwa ' + anteil + ' % geflogen' : '');
        b.innerHTML = '<div class="block">' + zeile('auf', 'Höhe', h(hoeheText(a.hoeheFt))) + zeile('tempo', 'Geschwindigkeit', a.kmh != null ? a.kmh + ' km/h über Grund' : '') + zeile('navi', 'Kurs', Math.round(a.kurs || 0) + '°') +
          zeile('info', 'Kennung', h(['ICAO ' + a.id.toUpperCase(), a.squawk ? 'Squawk ' + a.squawk : '', a.kennz || ''].filter(Boolean).join(' · '))) + '</div>' +
          '<button class="gold knopf breit" data-tun="fd-karte" style="margin-bottom:8px">' + sym('karte') + 'Flugzeug auf der Karte zeigen</button>';
        var z = $('#fdzeiten'); if (z) z.innerHTML = zeitenHtml() + zeile('pin', ankunft ? 'Gepäckband' : 'Gate', h([(ankunft ? x.band : x.gate) || '', x.terminal ? 'Terminal ' + x.terminal : ''].filter(Boolean).join(' · ')));
      });
    }
    clearInterval(detailT);
    if (!aus) { live(); detailT = setInterval(live, 20000); }
  };
  Tun['fd-karte'] = function () {
    var d = detail; if (!d || !d.live) return;
    var e = A().e; if (!e.flugzeuge) { e.flugzeuge = true; A().speichern(); }
    A().blattZu(); A().zeige('uebersicht', { tag: A().heute() });
    var a = d.live;
    K.wenn(function () { K.mitte(a, 8); setTimeout(function () { FL.live(); if (d.von.lat != null && d.nach.lat != null) K.flugstrecken([{ von: d.von, nach: d.nach, akt: true }]); }, 900); });
  };

  var streckenMerker = {};
  /** Strecke zu einem Rufzeichen: adsb.lol (routeset), sonst adsbdb.com. Ergebnis { von, nach, airline } oder null */
  function strecke(f) {
    var cs = f.name.toUpperCase();
    if (streckenMerker[cs] !== undefined) return Promise.resolve(streckenMerker[cs]);
    function flughafen(a) {
      if (!a) return null;
      var c = String(a.iata || a.iata_code || '').toUpperCase(), d = FL.iata(c), la = +(a.lat != null ? a.lat : a.latitude), lo = +(a.lon != null ? a.lon : a.longitude);
      if (d) return Object.assign(d, { ort: d.ort || a.location || a.municipality });
      if (!isFinite(la) || !isFinite(lo)) return null;
      return { iata: c, icao: a.icao || a.icao_code || '', name: a.name || '', ort: a.location || a.municipality || '', lat: la, lon: lo };
    }
    var lol = B.json({ methode: 'POST', url: 'https://api.adsb.lol/api/0/routeset', kopf: { 'Content-Type': 'application/json', Accept: 'application/json' }, daten: JSON.stringify({ planes: [{ callsign: cs, lat: f.lat, lng: f.lon }] }), zeit: 12000 }).then(function (j) {
      var r = Array.isArray(j) ? j[0] : null, ap = r && r._airports;
      if (!ap || ap.length < 2) throw new Error('keine Strecke');
      var von = flughafen(ap[0]), nach = flughafen(ap[ap.length - 1]); if (!von || !nach) throw new Error('keine Strecke');
      return { von: von, nach: nach, airline: '' };
    });
    return lol.catch(function () {
      return B.json({ url: 'https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(cs), zeit: 12000 }).then(function (j) {
        var fr = j && j.response && j.response.flightroute; if (!fr) return null;
        var von = flughafen(fr.origin), nach = flughafen(fr.destination); if (!von || !nach) return null;
        return { von: von, nach: nach, airline: fr.airline && fr.airline.name || '' };
      });
    }).catch(function () { return null; }).then(function (r) { streckenMerker[cs] = r; return r; });
  }
})();
