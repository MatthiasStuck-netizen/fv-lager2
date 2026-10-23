/* Offline-Karten vom Fehnverleih-Server.
 * Lädt die Kartendateien (z. B. deutschland.pmtiles oder ihre Teile teil-00, teil-01, …) aus dem Ordner "karten"
 * auf www.fehnverleih.de in den Speicher dieser App und liest daraus die Kartenkacheln. Dann zeigt die Karte
 * auch ohne Internet alles an. Mehrere Karten sind möglich (Deutschland, Spanien + Portugal, Frankreich, Österreich, Schweiz, Italien, Weltkarte), jede einzeln.
 * Format: PMTiles Version 3, Vektorkacheln im OpenMapTiles-Schema (dasselbe wie die Online-Karte). */
window.FV = window.FV || {};
(function () {
  'use strict';
  var O = FV.O = {};
  /* id: Kurzname · datei: Name auf dem Handy und auf dem Server · teil: Anfang der Teile auf dem Server · merker: Speicherplatz für den Stand */
  var KARTEN = [
    { id: 'de', name: 'Deutschland', datei: 'deutschland.pmtiles', teil: 'teil-', merker: 'offkarte' },
    { id: 'es', name: 'Spanien + Portugal', datei: 'spanien-portugal.pmtiles', teil: 'spanien-portugal-teil-', merker: 'offkarte-es' },
    { id: 'fr', name: 'Frankreich', datei: 'frankreich.pmtiles', teil: 'frankreich-teil-', merker: 'offkarte-fr' },
    { id: 'at', name: 'Österreich', datei: 'oesterreich.pmtiles', teil: 'oesterreich-teil-', merker: 'offkarte-at' },
    { id: 'ch', name: 'Schweiz', datei: 'schweiz.pmtiles', teil: 'schweiz-teil-', merker: 'offkarte-ch' },
    { id: 'it', name: 'Italien', datei: 'italien.pmtiles', teil: 'italien-teil-', merker: 'offkarte-it' },
    { id: 'welt', name: 'Weltkarte', datei: 'welt.pmtiles', teil: 'welt-teil-', merker: 'offkarte-welt', uebersicht: true }
  ];
  var QUELLEN = ['https://www.fehnverleih.de/karten/', 'https://www.fehnverleih.de/fehnverleih/karten/'];
  O.QUELLEN = QUELLEN;
  O.KARTEN = KARTEN;
  O.DATEI = KARTEN[0].datei;
  function karte(id) { for (var i = 0; i < KARTEN.length; i++) if (KARTEN[i].id === id) return KARTEN[i]; return KARTEN[0]; }
  O.karte = karte;

  function B() { return FV.B; }
  function stand(id) { var s = B() && B().lesen(karte(id).merker, null); return s && typeof s === 'object' ? s : null; }
  function standSetzen(id, s) { B().schreiben(karte(id).merker, s); }
  O.stand = stand;
  function kannSpeichern() { return !!(window.navigator && navigator.storage && navigator.storage.getDirectory); }
  /** true, wenn diese Karte vollständig und geprüft auf dem Handy liegt */
  O.fertig = function (id) { var s = stand(id); return !!(s && s.fertig && kannSpeichern()); };
  /** Alle fertigen Karten (Kurznamen) */
  O.fertige = function () { return KARTEN.filter(function (k) { return O.fertig(k.id); }).map(function (k) { return k.id; }); };
  /** true, wenn mindestens eine Offline-Karte auf dem Handy liegt */
  O.aktiv = function () { return O.fertige().length > 0; };
  O.gb = function (b) { return b >= 1e9 ? (b / 1e9).toFixed(1).replace('.', ',') + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB'; };

  /* =================== PMTiles lesen =================== */
  /** Kachel-Nummer nach PMTiles: alle Kacheln der kleineren Zoomstufen + Hilbert-Kurve */
  function zxyId(z, x, y) {
    var acc = (Math.pow(4, z) - 1) / 3, s = Math.pow(2, z) / 2, d = 0, xy = [x, y], rx, ry, t;
    while (s >= 1) {
      rx = (xy[0] & s) ? 1 : 0; ry = (xy[1] & s) ? 1 : 0;
      d += s * s * ((3 * rx) ^ ry);
      if (ry === 0) { if (rx === 1) { xy[0] = s - 1 - xy[0]; xy[1] = s - 1 - xy[1]; } t = xy[0]; xy[0] = xy[1]; xy[1] = t; }
      s = s / 2;
    }
    return acc + d;
  }
  O._zxyId = zxyId;
  function u64(dv, p) { return dv.getUint32(p, true) + dv.getUint32(p + 4, true) * 4294967296; }
  function kopfLesen(ab) {
    var dv = new DataView(ab), magie = '';
    for (var i = 0; i < 7; i++) magie += String.fromCharCode(dv.getUint8(i));
    if (magie !== 'PMTiles') throw new Error('Die Datei ist keine Kartendatei (PMTiles).');
    if (dv.getUint8(7) !== 3) throw new Error('Kartendatei hat die falsche Version (' + dv.getUint8(7) + ').');
    return {
      wurzelOff: u64(dv, 8), wurzelLen: u64(dv, 16), metaOff: u64(dv, 24), metaLen: u64(dv, 32),
      blattOff: u64(dv, 40), blattLen: u64(dv, 48), datenOff: u64(dv, 56), datenLen: u64(dv, 64),
      innen: dv.getUint8(97), kachelKomp: dv.getUint8(98), art: dv.getUint8(99), minZ: dv.getUint8(100), maxZ: dv.getUint8(101),
      west: dv.getInt32(102, true) / 1e7, sued: dv.getInt32(106, true) / 1e7, ost: dv.getInt32(110, true) / 1e7, nord: dv.getInt32(114, true) / 1e7
    };
  }
  O._kopfLesen = kopfLesen;
  function entpacken(ab, art) {
    if (art === 0 || art === 1) return Promise.resolve(new Uint8Array(ab));
    if (art !== 2) return Promise.reject(new Error('Kartendatei: Kompressionsart ' + art + ' wird nicht unterstützt.'));
    return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(function (x) { return new Uint8Array(x); });
  }
  function verzLesen(buf) {
    var p = 0;
    function v() { var r = 0, m = 1, b; do { b = buf[p++]; r += (b & 0x7f) * m; m *= 128; } while (b & 0x80); return r; }
    var n = v(), e = new Array(n), i, id = 0;
    for (i = 0; i < n; i++) { id += v(); e[i] = { id: id, lauf: 1, len: 0, off: 0 }; }
    for (i = 0; i < n; i++) e[i].lauf = v();
    for (i = 0; i < n; i++) e[i].len = v();
    for (i = 0; i < n; i++) { var o = v(); e[i].off = (o === 0 && i > 0) ? e[i - 1].off + e[i - 1].len : o - 1; }
    return e;
  }
  function finden(e, id) {
    var m = 0, n = e.length - 1, k, c;
    while (m <= n) { k = (n + m) >> 1; c = id - e[k].id; if (c > 0) m = k + 1; else if (c < 0) n = k - 1; else return e[k]; }
    if (n >= 0) { if (e[n].lauf === 0) return e[n]; if (id - e[n].id < e[n].lauf) return e[n]; }
    return null;
  }
  /** Leser für eine PMTiles-Datei (File oder Blob) */
  function Leser(datei) { this.f = datei; this.kopf = null; this.verz = new Map(); this._s = null; }
  Leser.prototype.stueck = function (off, len) { return this.f.slice(off, off + len).arrayBuffer(); };
  Leser.prototype.start = function () {
    var me = this;
    if (!me._s) me._s = me.stueck(0, 127).then(function (ab) { me.kopf = kopfLesen(ab); return me.kopf; });
    return me._s;
  };
  Leser.prototype.verzeichnis = function (off, len) {
    var me = this, k = off + ':' + len, c = me.verz.get(k);
    if (c) { me.verz.delete(k); me.verz.set(k, c); return c; }
    c = me.stueck(off, len).then(function (ab) { return entpacken(ab, me.kopf.innen); }).then(verzLesen);
    me.verz.set(k, c); if (me.verz.size > 80) me.verz.delete(me.verz.keys().next().value);
    c.catch(function () { me.verz.delete(k); });
    return c;
  };
  /** Liefert die (entpackte) Kachel als Uint8Array oder null, wenn es sie nicht gibt */
  Leser.prototype.kachel = function (z, x, y) {
    var me = this;
    return me.start().then(function (k) {
      if (z < k.minZ || z > k.maxZ) return null;
      var id = zxyId(z, x, y), tiefe = 0;
      function such(dir) {
        var e = finden(dir, id);
        if (!e) return null;
        if (e.lauf > 0) return me.stueck(k.datenOff + e.off, e.len).then(function (ab) { return entpacken(ab, k.kachelKomp); });
        if (++tiefe > 4) return null;
        return me.verzeichnis(k.blattOff + e.off, e.len).then(such);
      }
      return me.verzeichnis(k.wurzelOff, k.wurzelLen).then(such);
    });
  };
  /** Prüft, ob die Datei vollständig ist und zur Karte passt. Liefert den Kopf. */
  Leser.prototype.pruefen = function () {
    var me = this, groesse = me.f.size;
    return me.start().then(function (k) {
      [['wurzelOff', 'wurzelLen'], ['metaOff', 'metaLen'], ['blattOff', 'blattLen'], ['datenOff', 'datenLen']].forEach(function (p) {
        if (k[p[0]] + k[p[1]] > groesse) throw new Error('Die Kartendatei ist unvollständig (' + O.gb(groesse) + ').');
      });
      if (k.art !== 1) throw new Error('Die Kartendatei enthält keine Vektorkarte (Art ' + k.art + ').');
      return me.verzeichnis(k.wurzelOff, k.wurzelLen).then(function (w) {
        if (!w.length) throw new Error('Die Kartendatei ist leer.');
        return me.kachel(k.minZ, 0, 0).then(function () { return k; });
      });
    });
  };
  O.Leser = Leser;

  /* =================== Datei im App-Speicher =================== */
  function ordner() { return navigator.storage.getDirectory(); }
  var leserP = {};
  O.leser = function (id) {
    id = karte(id).id;
    if (!leserP[id]) {
      leserP[id] = ordner().then(function (d) { return d.getFileHandle(karte(id).datei); }).then(function (h) { return h.getFile(); }).then(function (f) { return new Leser(f); });
      leserP[id].catch(function () { leserP[id] = null; });
    }
    return leserP[id];
  };
  O.loeschen = function (id) {
    id = karte(id).id;
    leserP[id] = null;
    standSetzen(id, null);
    if (!kannSpeichern()) return Promise.resolve();
    return ordner().then(function (d) { return d.removeEntry(karte(id).datei); }).catch(function () {});
  };

  /* =================== Karte: Kacheln aus der Datei =================== */
  O.protokoll = function () {
    if (O._proto || !window.maplibregl) return;
    O._proto = true;
    maplibregl.addProtocol('fvkarte', function (p) {
      var m = /^fvkarte:\/\/([^/]*)\/(\d+)\/(\d+)\/(\d+)/.exec(p.url);
      if (!m) return Promise.reject(new Error('Falsche Kachel-Adresse'));
      return O.leser(m[1]).then(function (l) { return l.kachel(+m[2], +m[3], +m[4]); }).then(function (d) {
        return { data: d ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : new ArrayBuffer(0) };
      });
    });
  };
  function quelle(id) {
    var s = stand(id) || {};
    return { type: 'vector', tiles: ['fvkarte://' + id + '/{z}/{x}/{y}'], minzoom: 0, maxzoom: s.maxZ || 14, attribution: '© OpenStreetMap-Mitwirkende' };
  }
  /** Jede weitere Karte (anderes Land) bekommt eine eigene Quelle; ihre Ebenen werden direkt hinter die der ersten Karte gelegt. */
  function laenderDazu(st, haupt) {
    // Die Weltkarte (nur bis mittlere Zoomstufe) liegt ganz unten, die genauen Länderkarten darüber
    var ids = O.fertige().sort(function (a, b) { return (karte(b).uebersicht ? 1 : 0) - (karte(a).uebersicht ? 1 : 0); });
    if (!ids.length) ids = [KARTEN[0].id];
    st.sources[haupt] = quelle(ids[0]);
    if (ids.length < 2) return st;
    var neu = [];
    ids.slice(1).forEach(function (id) { st.sources[haupt + '_' + id] = quelle(id); });
    (st.layers || []).forEach(function (l) {
      neu.push(l);
      if (l.source !== haupt) return;
      ids.slice(1).forEach(function (id) {
        var k = JSON.parse(JSON.stringify(l));
        k.id = l.id + '~' + id; k.source = haupt + '_' + id;
        neu.push(k);
      });
    });
    st.layers = neu;
    return st;
  }
  O._laenderDazu = laenderDazu;   // für Tests
  /** Online-Stil auf die Dateien umstellen: die Vektorquellen kommen vom Handy, andere Online-Quellen fallen weg */
  O.stil = function (st) {
    st = JSON.parse(JSON.stringify(st));
    var haupt = null, weg = {};
    Object.keys(st.sources || {}).forEach(function (n) {
      var q = st.sources[n];
      if (q.type === 'vector' && !haupt) haupt = n;
      else if (q.type !== 'geojson') weg[n] = 1;
    });
    if (!haupt) return O.grundstil();
    Object.keys(weg).forEach(function (n) { delete st.sources[n]; });
    st.layers = (st.layers || []).filter(function (l) { return !l.source || !weg[l.source]; });
    return laenderDazu(st, haupt);
  };
  /** Einfacher Kartenstil, falls noch nie ein Online-Stil geladen wurde (erster Start ohne Internet). Ohne Ortsnamen. */
  O.grundstil = function () {
    var Q = 'openmaptiles', KACHELN = 'fvkarte://' + KARTEN[0].id + '/{z}/{x}/{y}', s = {};
    function f(id, sl, filter, extra) { var l = { id: id, type: 'fill', source: Q, 'source-layer': sl, paint: {} }; if (filter) l.filter = filter; return Object.assign(l, extra || {}); }
    function li(id, sl, filter, breite, extra) {
      var l = { id: id, type: 'line', source: Q, 'source-layer': sl, layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 6, breite * 0.25, 12, breite, 18, breite * 6] } };
      if (filter) l.filter = filter; return Object.assign(l, extra || {});
    }
    function kl(werte) { return ['match', ['get', 'class'], werte, true, false]; }
    return laenderDazu({
      version: 8, sources: { openmaptiles: { type: 'vector', tiles: [KACHELN], minzoom: 0, maxzoom: s.maxZ || 14, attribution: '© OpenStreetMap-Mitwirkende' } },
      layers: [
        { id: 'background', type: 'background', paint: {} },
        f('landcover-wood', 'landcover', kl(['wood', 'forest'])),
        f('landcover-grass', 'landcover', kl(['grass', 'farmland', 'wetland'])),
        f('landuse-residential', 'landuse', kl(['residential', 'suburb', 'neighbourhood'])),
        f('landuse-industrial', 'landuse', kl(['industrial', 'commercial', 'retail'])),
        f('park', 'park'),
        f('water', 'water'),
        li('waterway', 'waterway', null, 1.2),
        f('building', 'building', null, { minzoom: 14 }),
        li('boundary', 'boundary', ['<=', ['get', 'admin_level'], 4], 1),
        li('road-path', 'transportation', kl(['path', 'track']), 0.8, { minzoom: 13 }),
        li('road-minor', 'transportation', kl(['minor', 'service']), 1.6, { minzoom: 12 }),
        li('road-secondary-tertiary', 'transportation', kl(['secondary', 'tertiary']), 2.4),
        li('road-trunk-primary', 'transportation', kl(['trunk', 'primary']), 3),
        li('road-motorway', 'transportation', kl(['motorway']), 3.4),
        li('rail', 'transportation', kl(['rail']), 1, { minzoom: 10 })
      ]
    }, Q);
  };

  /* =================== Herunterladen =================== */
  /** Läuft in einem eigenen Hintergrund-Thread und schreibt direkt in die Datei (geht nach Abbruch an derselben Stelle weiter). */
  function hintergrund() {
    var h = null, halt = false;
    self.onmessage = function (ev) {
      var m = ev.data;
      if (m.cmd === 'halt') { halt = true; return; }
      if (m.cmd === 'los') los(m.plan).catch(function (e) { zu(); self.postMessage({ typ: 'fehler', text: String(e && e.message || e) }); });
    };
    function zu() { try { if (h) { h.flush(); h.close(); } } catch (e) {} h = null; }
    function warten(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
    async function los(plan) {
      var d = await navigator.storage.getDirectory();
      var fh = await d.getFileHandle(plan.datei, { create: true });
      h = await fh.createSyncAccessHandle();
      if (h.getSize() > plan.gesamt) h.truncate(0);
      var fehlversuche = 0;
      while (true) {
        try { if (await durchlauf(plan)) break; fehlversuche = 0; }
        catch (e) {
          if (halt) return gestoppt();
          if (e && e.endgueltig) throw e;
          if (++fehlversuche > 6) throw new Error('Die Verbindung zum Server ist mehrmals abgebrochen. Später mit „Weiter laden“ fortsetzen.');
          self.postMessage({ typ: 'info', text: 'Verbindung unterbrochen – neuer Versuch …' });
          await warten(4000 * fehlversuche);
        }
        if (halt) return gestoppt();
      }
      h.flush();
      var groesse = h.getSize();
      zu();
      self.postMessage({ typ: 'fertig', pos: groesse });
    }
    function gestoppt() { var p = h ? h.getSize() : 0; zu(); self.postMessage({ typ: 'halt', pos: p }); }
    /* liefert true, wenn alles da ist */
    async function durchlauf(plan) {
      var pos = h.getSize(), start = 0;
      for (var i = 0; i < plan.teile.length; i++) {
        var t = plan.teile[i], ende = start + t.groesse;
        if (pos >= ende) { start = ende; continue; }
        var innen = pos - start;
        h.truncate(pos);
        var r = await fetch(plan.basis + t.name, { headers: innen > 0 ? { Range: 'bytes=' + innen + '-' } : {}, cache: 'no-store' });
        if (r.status !== 200 && r.status !== 206) { var f = new Error('Der Server meldet Fehler ' + r.status + ' bei „' + t.name + '“.'); f.endgueltig = r.status >= 400 && r.status < 500; throw f; }
        var ueber = r.status === 200 ? innen : 0, seitFlush = 0, gemeldet = 0, lies = r.body.getReader();
        try {
          while (pos < ende) {
            if (halt) return false;
            var x = await lies.read();
            if (x.done) break;
            var c = x.value;
            if (ueber > 0) { if (c.length <= ueber) { ueber -= c.length; continue; } c = c.subarray(ueber); ueber = 0; }
            if (pos + c.length > ende) c = c.subarray(0, ende - pos);
            var n = 0;
            while (n < c.length) n += h.write(c.subarray(n), { at: pos + n });
            pos += c.length; seitFlush += c.length;
            if (seitFlush >= 32 * 1048576) { h.flush(); seitFlush = 0; }
            var jetzt = Date.now();
            if (jetzt - gemeldet > 500) { gemeldet = jetzt; self.postMessage({ typ: 'stand', pos: pos }); }
          }
        } finally { try { lies.cancel().catch(function () {}); } catch (e) {} }
        h.flush();
        self.postMessage({ typ: 'stand', pos: pos });
        if (pos < ende) throw new Error('Verbindung abgebrochen');
        start = ende;
      }
      return true;
    }
  }

  O._hintergrund = hintergrund;   // für Tests
  /** Größe einer Datei auf dem Server: >0 Größe, 0 = gibt es nicht, -1 = Größe unbekannt, null = keine Antwort.
   *  Achtung: Antwortet der Server mit "nicht gefunden" ohne Freigabe-Kopfzeile (so macht es Strato),
   *  meldet der Browser das wie "keine Verbindung" – darum bedeutet null nicht immer ein Netzproblem. */
  function groesseHolen(url) {
    return fetch(url, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      if (r.status === 404 || r.status === 410) return 0;
      if (!r.ok) { var e = new Error('Der Server meldet Fehler ' + r.status + ' für ' + url); e.status = r.status; throw e; }
      var g = +r.headers.get('content-length');
      return g > 0 ? g : -1;
    }, function () { return null; });
  }
  /** Was liegt auf dem Server? Erst die ganze Datei, sonst die Teile (z. B. teil-00, teil-01, …) */
  O.planen = async function (id) {
    var K = karte(id), DATEI = K.datei, TEIL = K.teil;
    var fehler = null, keineAntwort = 0;
    for (var q = 0; q < QUELLEN.length; q++) {
      var basis = QUELLEN[q];
      try {
        var g = await groesseHolen(basis + DATEI);
        if (g === -1) throw new Error('Der Server nennt die Größe der Kartendatei nicht.');
        if (g > 0) return { basis: basis, teile: [{ name: DATEI, groesse: g }], gesamt: g };
        var s0 = await groesseHolen(basis + TEIL + '00');
        if (s0 === null) { if (g === null) keineAntwort++; continue; }
        if (s0 === -1) throw new Error('Der Server nennt die Größe von „' + TEIL + '00“ nicht.');
        if (s0 === 0) continue;
        var teile = [{ name: TEIL + '00', groesse: s0 }], gesamt = s0;
        for (var i = 1; i < 100; i++) {
          var name = TEIL + (i < 10 ? '0' : '') + i, s = await groesseHolen(basis + name);
          if (s === -1) throw new Error('Der Server nennt die Größe von „' + name + '“ nicht.');
          if (!s) break;   // 0 oder keine Antwort: hier enden die Teile
          teile.push({ name: name, groesse: s }); gesamt += s;
        }
        return { basis: basis, teile: teile, gesamt: gesamt };
      } catch (e) { fehler = e; }
    }
    if (fehler) throw fehler;
    if (keineAntwort) throw new Error('Keine Verbindung zum Kartenordner auf www.fehnverleih.de. Internet prüfen. Auf dem Server muss im Ordner „karten“ die Datei „.htaccess“ liegen.');
    throw new Error('Im Ordner „karten“ auf www.fehnverleih.de wurde die Karte ' + K.name + ' nicht gefunden (' + DATEI + ' oder ' + TEIL + '00, ' + TEIL + '01 …).');
  };

  var arbeit = null, planung = false, dran = null;
  /** Lädt gerade eine Karte? Mit Kurzname: genau diese? (Es lädt immer nur eine Karte gleichzeitig.) */
  O.laeuft = function (id) { var l = !!arbeit || planung; return id ? l && dran === karte(id).id : l; };
  O.dran = function () { return O.laeuft() ? dran : null; };
  O.letzterFehler = '';
  O.fehlerBei = null;
  /** Karte laden bzw. fortsetzen. melde(pos, gesamt, text). Ergebnis: 'fertig', 'halt' oder 'aktuell'. */
  O.laden = async function (id, melde) {
    if (typeof id === 'function') { melde = id; id = null; }
    id = karte(id).id;
    if (O.laeuft()) return 'laeuft';
    melde = melde || function () {};
    O.letzterFehler = ''; O.fehlerBei = id;
    planung = true; dran = id;
    var DATEI = karte(id).datei;
    var s, plan;
    try {
      if (!window.Worker || !navigator.storage || !navigator.storage.getDirectory || !window.DecompressionStream)
        throw new Error('Dieses Handy kann noch keine Offline-Karte speichern. Bitte im Play Store „Android System WebView“ aktualisieren.');
      melde(0, 0, 'Verbinde mit www.fehnverleih.de …');
      plan = await O.planen(id);
      s = stand(id) || {};
      var gleich = s.plan && s.plan.basis === plan.basis && JSON.stringify(s.plan.teile) === JSON.stringify(plan.teile);
      if (gleich && s.fertig) { planung = false; return 'aktuell'; }
      if (!gleich) { await O.loeschen(id); s = {}; }
      var schon = Math.min(s.pos || 0, plan.gesamt);
      try {
        var est = await navigator.storage.estimate(), frei = (est.quota || 0) - (est.usage || 0), noetig = plan.gesamt - schon + 300e6;
        if (est.quota && frei < noetig) throw new Error('Zu wenig Speicherplatz auf dem Handy: Es fehlen etwa ' + O.gb(noetig - frei) + '.');
      } catch (e) { if (/Speicherplatz/.test(e.message)) throw e; }
      try { if (navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
      s.plan = plan; s.fertig = false; s.pos = schon; standSetzen(id, s);
    } catch (e) { planung = false; O.letzterFehler = e.message; throw e; }

    return new Promise(function (ok, fehl) {
      var url = URL.createObjectURL(new Blob(['(' + hintergrund.toString() + ')()'], { type: 'text/javascript' }));
      var w = arbeit = new Worker(url), gespeichert = 0, vorbei = false;
      planung = false;
      try { B().wach(true); } catch (e) {}
      function ende() {
        if (vorbei) return false; vorbei = true;
        clearTimeout(O._haltT); arbeit = null;
        try { w.terminate(); } catch (e) {}
        URL.revokeObjectURL(url);
        try { B().wach(false); } catch (e) {}
        standSetzen(id, s);
        return true;
      }
      O._halt = function () { if (!ende()) return; ok('halt'); };
      w.onmessage = function (ev) {
        var m = ev.data;
        if (m.typ === 'stand') {
          s.pos = m.pos; melde(m.pos, plan.gesamt);
          if (Date.now() - gespeichert > 4000) { gespeichert = Date.now(); standSetzen(id, s); }
        } else if (m.typ === 'info') melde(s.pos, plan.gesamt, m.text);
        else if (m.typ === 'halt') { s.pos = m.pos; if (ende()) ok('halt'); }
        else if (m.typ === 'fehler') { O.letzterFehler = m.text; if (ende()) fehl(new Error(m.text)); }
        else if (m.typ === 'fertig') {
          s.pos = m.pos; ende();
          melde(m.pos, plan.gesamt, 'Karte wird geprüft …');
          leserP[id] = null;
          O.leser(id).then(function (l) {
            if (l.f.size !== plan.gesamt) throw new Error('Die Kartendatei hat die falsche Größe.');
            return l.pruefen();
          }).then(function (k) {
            s.fertig = true; s.maxZ = k.maxZ; s.datum = Date.now(); standSetzen(id, s); ok('fertig');
          }).catch(function (e) {
            O.letzterFehler = e.message + ' Die Datei wurde gelöscht – bitte die Teile auf dem Server prüfen.';
            O.loeschen(id).then(function () { fehl(new Error(O.letzterFehler)); });
          });
        }
      };
      w.onerror = function (e) { O.letzterFehler = 'Fehler beim Herunterladen: ' + (e && e.message || 'unbekannt'); if (ende()) fehl(new Error(O.letzterFehler)); };
      w.postMessage({ cmd: 'los', plan: { datei: DATEI, basis: plan.basis, teile: plan.teile, gesamt: plan.gesamt } });
    });
  };
  /** Herunterladen anhalten (geht später an derselben Stelle weiter) */
  O.halt = function () {
    if (!arbeit) return;
    try { arbeit.postMessage({ cmd: 'halt' }); } catch (e) {}
    clearTimeout(O._haltT);
    O._haltT = setTimeout(function () { if (O._halt) O._halt(); }, 4000);
  };
})();
