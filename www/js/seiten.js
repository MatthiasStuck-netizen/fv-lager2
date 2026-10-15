/* Fehnverleih Navi – alle Seiten der App (Aufbau nach den Entwürfen) */
(function () {
  'use strict';
  var B = FV.B, S = FV.S, G = FV.G, K = FV.K, F = FV.F;
  var sym = FV.sym, Se = FV.Seiten = {}, Tun = FV.Tun = {};
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function h(t) { return FV.esc(t); }
  function seite(html) { $('#seite').innerHTML = html; }
  function A() { return FV.app; }
  var TAGE = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  function datum(iso) { var d = new Date(iso + 'T12:00:00'); return TAGE[d.getDay()] + ' ' + ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function datumKurz(iso) { return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.'; }
  function plusTage(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return G.iso(d); }
  function adr2(a) { var t = String(a || '').replace(/\s*\n\s*/g, ', '), i = t.indexOf(','); return i < 0 ? '<i class="az">' + h(t) + '</i>' : '<i class="az">' + h(t.slice(0, i)) + '</i><i class="az">' + h(t.slice(i + 1).trim()) + '</i>'; }
  function adr1(a) { return String(a || '').replace(/\s*\n\s*/g, ', '); }
  var ART = { lieferung: ['Lieferung', 'lkw', ''], abholung: ['Abholung', 'lkw', 'abholung'], auftrag: ['Auftrag', 'lager', 'auftrag'], rueckgabe: ['Rückgabe', 'abholung', 'auftrag'] };
  function marke(a) { var x = ART[a.art] || ART.auftrag; return '<span class="marke ' + x[2] + '">' + sym(x[1]) + x[0] + '</span>' + (a.spaet ? ' <span class="marke spaet">überfällig seit ' + datumKurz(a.termin) + '</span>' : ''); }
  function kopf(titel, rechts, zurueck) { return '<div class="zeile">' + (zurueck === false ? '' : '<button class="pfeil" data-tun="zurueck" aria-label="Zurück">' + sym('links') + '</button>') + '<h1>' + h(titel) + '</h1>' + (rechts || '') + '</div>'; }
  function laedt(t) { return '<div class="laedt"><i class="dreh"></i>' + h(t || 'Lädt …') + '</div>'; }
  function finde(id) { return A().z.auftraege.filter(function (a) { return a.id === id; })[0]; }
  Tun.zurueck = function () { A().zurueck(); };
  Tun.reiter = function (e) {
    var r = e.getAttribute('data-r');
    if (r === 'karte') { A().zurKarte(); return; }
    // Eine laufende Zielführung bleibt beim Seitenwechsel bestehen (Ansagen inklusive). Zurück geht es über den Knopf „Karte“.
    A().zeige(r, {}, 'reiter'); if (r === 'auftraege') A().ladeAuftraege();
  };
  Tun.anrufen = function (e) { B.anrufen(e.getAttribute('data-tel')); };
  Tun['blatt-zu'] = function () { A().blattZu(); };

  /* ====================== Anmeldung / Sperre ====================== */
  Se.anmeldung = function () {
    var z = A().z, adm = z.anmArt === 'admin';
    seite('<div class="anmeldung"><h1>Anmeldung</h1><p>' + (adm ? 'Mit dem App-Admin-Passwort anmelden.' : 'Einmal mit dem Mitarbeiter-Ausweis anmelden. Die App funktioniert, solange du eingestempelt bist.') + '</p>' +
      (z.meldung ? '<div class="fehler">' + h(z.meldung) + '</div>' : '') +
      '<div class="wahl"><button data-tun="anm-art" data-a="ma"' + (adm ? '' : ' class="akt"') + '>Mitarbeiter</button><button data-tun="anm-art" data-a="admin"' + (adm ? ' class="akt"' : '') + '>Admin</button></div>' +
      '<form data-form="anmelden" class="block goldr" style="margin-top:12px">' +
      (adm ? '<label class="feld">Admin-Passwort<input class="eingabe" type="password" name="pw" autocomplete="current-password"></label>'
        : '<button type="button" class="gold knopf breit gross" data-tun="ausweis">' + sym('qr') + 'Ausweis scannen</button>' +
          '<label class="feld" style="margin-top:12px">Ausweis-Code<input class="eingabe" name="code" placeholder="FVZ-…" autocapitalize="off" autocomplete="off" spellcheck="false" value="' + h(z.ausweis || '') + '"></label>' +
          '<label class="feld">Lager-Passwort<input class="eingabe" type="password" name="pw" autocomplete="current-password"></label>') +
      '<button class="gold knopf breit gross" id="anm-los">Anmelden</button></form>' +
      '<button class="rand knopf breit" data-tun="demo">' + sym('karte') + 'Demo ansehen (ohne Anmeldung)</button>' +
      '<p class="klein2" style="text-align:center">Fehnverleih Navi ' + h(B.info().version || '') + '</p></div>');
  };
  Tun.demo = function () { A().demoStart(); A().toast('Demo mit Beispieldaten – es wird nichts gespeichert.', 4500); };
  Tun['anm-art'] = function (e) { A().z.anmArt = e.getAttribute('data-a'); A().z.meldung = ''; A().neu(); };
  Tun.ausweis = function () { B.scan().then(function (c) { if (!c) return; A().z.ausweis = c; var i = $('input[name=code]'); if (i) i.value = c; var p = $('input[name=pw]'); if (p) p.focus(); }).catch(function (e) { A().toast(e.message || 'Scannen nicht möglich'); }); };
  Tun.anmelden = function (f) {
    var z = A().z, adm = z.anmArt === 'admin', pw = f.pw.value, code = adm ? '' : f.code.value.trim();
    if (!pw || (!adm && !code)) { A().toast(adm ? 'Bitte das Passwort eingeben.' : 'Bitte Ausweis und Passwort eingeben.'); return; }
    var k = $('#anm-los'); k.disabled = true; k.textContent = 'Anmeldung …';
    S.anmelden(adm, pw, code).then(function () { z.meldung = ''; z.ausweis = ''; A().los(); })
      .catch(function (e) { z.meldung = e.message || 'Anmeldung fehlgeschlagen.'; z.ausweis = code; A().neu(); });
  };
  Se.sperre = function () {
    seite('<div class="anmeldung sperre">' + sym('schloss') + '<h1>App gesperrt</h1><p>' + h(A().z.meldung || 'Du bist nicht eingestempelt.') + '</p>' +
      '<p class="klein2">Bitte am Stempel-Terminal oder in der Stempel-App einstempeln. Danach „Jetzt prüfen“ antippen.</p>' +
      '<button class="gold knopf breit gross" data-tun="sperre-pruefen">' + sym('neu') + 'Jetzt prüfen</button><div style="height:10px"></div>' +
      '<button class="rand knopf breit" data-tun="abmelden">Abmelden / anderes Konto</button></div>');
  };
  Tun['sperre-pruefen'] = function () { S.ruf('status').then(function () { A().los(); }).catch(function (e) { if (!e.stop) A().toast(e.message); else A().toast('Noch nicht eingestempelt.'); }); };
  Tun.abmelden = function () {
    if (S.demo) { A().demoEnde(); return; }
    A().frage('Dieses Handy abmelden?', 'Abmelden').then(function (ja) {
      if (!ja) return;
      var wer = S.wer();
      F.stopp(); A().vollbild(false);
      A().fahrtEnde('ohne Ziel', wer);   // laufende Fahrt abschließen – sie gehört noch diesem Nutzer
      A().toast('Abmeldung …', 12000);
      // Fahrten und Belege möglichst noch senden, bevor das Handy an den Nächsten geht
      Promise.race([S.nachsenden(), new Promise(function (ok) { setTimeout(ok, 12000); })]).catch(function () {}).then(function () {
        var n = S.wartend(), t = $('#toast'); if (t) t.hidden = true;
        if (!n) return true;
        return A().frage((n === 1 ? '1 Eintrag wurde' : n + ' Einträge wurden') + ' noch nicht gesendet.\nFahrten und Belege bleiben auf diesem Handy und werden gesendet, sobald du dich hier wieder anmeldest. Trotzdem abmelden?', 'Abmelden');
      }).then(function (ok) {
        if (!ok) { A().toast('Nicht abgemeldet.'); A().neu(); return; }
        return S.abmelden().then(function () { A().abgemeldet('', wer); A().toast('Abgemeldet.', 1500); });
      });
    });
  };

  /* ====================== Aufträge ====================== */
  Se.auftraege = function () {
    var z = A().z, heute = A().heute(), liste = A().tagesliste(z.tag), naechster = -1;
    if (z.tag === heute) { for (var i = 0; i < liste.length; i++) if (!liste[i].ist_ankunft) { naechster = i; break; } if (naechster < 0 && liste.length) naechster = 0; }
    var karten = liste.map(function (a, i) {
      return '<div class="auftrag' + (i === naechster ? ' naechster' : '') + '">' +
        '<div class="zeit"><b>' + h(a.zeit || '–:–') + '</b>' + (a.bisZeit ? '<span>bis ' + h(a.bisZeit) + '</span>' : '') + '</div>' +
        '<div class="wer" data-tun="auftrag" data-id="' + h(a.id) + '">' + marke(a) + '<b>' + h(a.kunde || 'Kunde') + '</b><div class="adr">' + sym('pin') + '<span>' + adr2(a.adresse) + '</span></div></div>' +
        '<div class="tun">' + (a.telefon ? '<button class="rund tel" data-tun="anrufen" data-tel="' + h(a.telefon) + '" aria-label="Anrufen">' + sym('telefon') + '</button>' : '') +
        '<button class="gold knopf los" data-tun="navi" data-id="' + h(a.id) + '">' + sym('navi') + '<span>Navigation starten</span></button></div>' +
        '<button class="mehr" data-tun="auftrag" data-id="' + h(a.id) + '" aria-label="Einzelheiten">' + sym('rechts') + '</button></div>';
    }).join('');
    if (!karten) karten = z.laedt && !z.auftraege.length ? laedt('Lade Aufträge …') : '<div class="leer"><b>Keine Aufträge an diesem Tag</b>' + (z.tag === heute ? 'Neue Aufträge erscheinen hier von selbst.' : 'Mit den Pfeilen zu einem anderen Tag blättern.') + '</div>';
    var lh = z.ziele.lagerhalle && z.ziele.lagerhalle.adresse || '';
    seite('<div class="zeile"><button class="rand kasten" data-tun="tag-wahl" aria-label="Datum wählen">' + sym('kalender') + '</button>' +
      '<div class="datum"><button class="pfeil" data-tun="tag" data-n="-1" aria-label="Tag zurück">' + sym('links') + '</button><b>' + datum(z.tag) + '</b><button class="pfeil" data-tun="tag" data-n="1" aria-label="Tag vor">' + sym('rechts') + '</button></div>' +
      '<button class="gold knopf klein" data-tun="tag" data-n="0">Heute</button><button class="rand kasten" data-tun="neuauftrag" aria-label="Neuer Auftrag">' + sym('plus') + '</button></div>' +
      '<div class="rollen" id="liste">' + (z.fehler ? '<div class="fehler">' + h(z.fehler) + '</div>' : '') + karten +
      (z.stand ? '<div class="hinweis">Stand ' + h(z.stand) + (S.wartend() ? ' · ' + S.wartend() + ' Einträge warten auf Übertragung' : '') + '</div>' : '') + '</div>' +
      '<div class="kacheln"><button class="rand kachel" data-tun="neueroute">' + sym('route') + '<div><b>Route starten</b><span>Neues Ziel eingeben</span></div></button>' +
      '<button class="rand kachel" data-tun="uebersicht">' + sym('karte') + '<div><b>Karte anzeigen</b><span>Alle Aufträge auf der Karte</span></div></button></div>');
  };
  Tun.tag = function (e) { var z = A().z, n = +e.getAttribute('data-n'); z.tag = n === 0 ? A().heute() : plusTage(z.tag, n); A().neu(); };
  Tun['tag-wahl'] = function () {
    A().blatt('<h2>' + sym('kalender') + 'Datum wählen<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><input class="eingabe" type="date" id="tagfeld" value="' + A().z.tag + '">' +
      '<div style="height:12px"></div><button class="gold knopf breit" data-tun="tag-setzen">Anzeigen</button>');
  };
  Tun['tag-setzen'] = function () { var v = $('#tagfeld').value; if (/^\d{4}-\d\d-\d\d$/.test(v)) A().z.tag = v; A().blattZu(); A().neu(); };
  function zielAus(a) { return { name: a.kunde || 'Kunde', adresse: a.adresse, tel: a.telefon || '', auftrag: a.id, phase: 'ankunft', art: a.art }; }
  Tun.navi = function (e) { var a = finde(e.getAttribute('data-id')); if (a) A().zeige('vorschau', { ziel: zielAus(a) }); };
  Tun['ziel-fest'] = function (e) {
    var k = e.getAttribute('data-z'), x = A().z.ziele[k]; if (!x || !x.adresse) { A().toast('Adresse ist auf dem Server nicht hinterlegt.'); return; }
    A().blattZu();
    var fo = (B.lesen('festorte', {}) || {})[k] || {};
    A().zeige('vorschau', { ziel: { name: x.name || (k === 'lagerhalle' ? 'Lagerhalle' : 'Verwaltung'), adresse: x.adresse, lat: fo.lat, lon: fo.lon, auftrag: e.getAttribute('data-id') || A().z.letzterAuftrag || '', phase: 'abfahrt', fest: k, art: 'halle' } });
  };

  /* Einzelheiten zu einem Auftrag */
  Tun.auftrag = function (e) {
    var a = finde(e.getAttribute('data-id')); if (!a) return;
    function z(s, klein, text) { return text ? '<div class="detailzeile">' + sym(s) + '<div><small>' + klein + '</small>' + text + '</div></div>' : ''; }
    A().blatt('<h2>' + sym('info') + h(a.nr || 'Auftrag') + ' · ' + h(a.kunde) + '<button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="block">' + z('pin', 'Adresse', adr2(a.adresse)) + z('uhr', 'Geplant', h(datum(a.termin)) + (a.zeit ? ' · ' + h(a.zeit) + (a.bisZeit ? ' bis ' + h(a.bisZeit) : '') : '')) +
      z('lkw', 'Art', h((ART[a.art] || ART.auftrag)[0]) + ' · ' + h(a.status_text || '')) + z('telefon', 'Telefon', h(a.telefon)) + z('notiz', 'Notiz', h(a.notiz).replace(/\n/g, '<br>')) +
      z('haken', 'Hinfahrt gestartet', h(a.ist_ankunft)) + z('haken', 'Rückfahrt gestartet', h(a.ist_abfahrt)) + '</div>' +
      '<button class="gold knopf breit gross" data-tun="navi-blatt" data-id="' + h(a.id) + '">' + sym('navi') + 'Navigation starten</button><div style="height:8px"></div>' +
      '<div class="zweier"><button class="rand knopf" data-tun="ziel-fest" data-z="lagerhalle" data-id="' + h(a.id) + '">Zur Lagerhalle</button><button class="rand knopf" data-tun="ziel-fest" data-z="verwaltung" data-id="' + h(a.id) + '">Zur Verwaltung</button></div>' +
      (a.telefon ? '<div style="height:8px"></div><button class="rand knopf breit" data-tun="anrufen" data-tel="' + h(a.telefon) + '">' + sym('telefon') + h(a.telefon) + '</button>' : ''));
  };
  Tun['navi-blatt'] = function (e) { A().blattZu(); Tun.navi(e); };

  /* ---------- Neuer Auftrag (annehmen und anlegen, mit Extra-Wünschen) ---------- */
  Tun.neuauftrag = function () { A().zeige('neuauftrag'); };
  Se.neuauftrag = function () {
    var z = A().z; z.neu = z.neu || { art: 'lieferung', pos: {}, datum: z.tag < A().heute() ? A().heute() : z.tag };
    var n = z.neu;
    seite(kopf('Neuer Auftrag') + '<form class="rollen" data-form="auftrag-speichern" id="nform">' +
      '<div class="block goldr"><h2>' + sym('person') + 'Kunde</h2>' +
      '<label class="feld">Name *<input class="eingabe" name="name" value="' + h(n.name) + '" maxlength="100"></label>' +
      '<label class="feld">Adresse * (Straße, PLZ Ort)<input class="eingabe" name="adresse" value="' + h(n.adresse) + '" maxlength="300"></label>' +
      '<div class="zweier"><label class="feld">Telefon<input class="eingabe" name="tel" type="tel" value="' + h(n.tel) + '" maxlength="50"></label><label class="feld">E-Mail<input class="eingabe" name="email" type="email" value="' + h(n.email) + '" maxlength="150"></label></div></div>' +
      '<div class="block"><h2>' + sym('kalender') + 'Termin</h2><div class="zweier"><label class="feld">Datum<input class="eingabe" type="date" name="datum" value="' + h(n.datum) + '"></label><label class="feld">Uhrzeit<input class="eingabe" type="time" name="uhrzeit" value="' + h(n.uhrzeit) + '"></label></div>' +
      '<div class="wahl"><button type="button" data-tun="neu-art" data-a="lieferung"' + (n.art === 'lieferung' ? ' class="akt"' : '') + '>Wir liefern</button><button type="button" data-tun="neu-art" data-a="abholung"' + (n.art === 'abholung' ? ' class="akt"' : '') + '>Kunde holt ab</button></div></div>' +
      '<div class="block"><h2>' + sym('lager') + 'Artikel</h2><div class="positionen" id="npos">' + posHtml() + '</div>' +
      '<div style="height:8px"></div><button type="button" class="rand knopf breit" data-tun="neu-artikel">' + sym('plus') + 'Artikel hinzufügen</button></div>' +
      '<div class="block"><h2>' + sym('stern') + 'Extra-Wünsche</h2><label class="feld">Was der Kunde zusätzlich möchte (eine Zeile je Wunsch)<textarea class="eingabe" name="sonder" maxlength="3000" placeholder="z. B. Lichterkette für das Zelt">' + h(n.sonder) + '</textarea></label>' +
      '<label class="feld">Notiz für das Büro<textarea class="eingabe" name="notiz" maxlength="3000">' + h(n.notiz) + '</textarea></label></div>' +
      '<button class="gold knopf breit gross" id="nspeichern">' + sym('haken') + 'Auftrag speichern</button>' +
      '<p class="klein2" style="text-align:center">Der Auftrag geht als Anfrage in die Verwaltung und wird dort bestätigt.</p></form>');
  };
  function posHtml() {
    var n = A().z.neu, ids = Object.keys(n.pos);
    if (!ids.length) return '<p class="klein2" style="margin:2px 0">Noch keine Artikel gewählt.</p>';
    return ids.map(function (id) { var p = n.pos[id]; return '<div class="pos"><span>' + h(p.name) + '</span><button type="button" data-tun="neu-menge" data-id="' + h(id) + '" data-n="-1">' + sym('minus') + '</button><b>' + p.menge + '</b><button type="button" data-tun="neu-menge" data-id="' + h(id) + '" data-n="1">' + sym('plus') + '</button></div>'; }).join('');
  }
  function formMerken() { var f = $('#nform'), n = A().z.neu; if (!f || !n) return; ['name', 'adresse', 'tel', 'email', 'datum', 'uhrzeit', 'sonder', 'notiz'].forEach(function (k) { if (f[k]) n[k] = f[k].value; }); }
  Tun['neu-art'] = function (e) { formMerken(); A().z.neu.art = e.getAttribute('data-a'); A().neu(); };
  Tun['neu-menge'] = function (e) { var n = A().z.neu, id = e.getAttribute('data-id'), p = n.pos[id]; if (!p) return; p.menge += +e.getAttribute('data-n'); if (p.menge <= 0) delete n.pos[id]; $('#npos').innerHTML = posHtml(); };
  Tun['neu-artikel'] = function () {
    formMerken();
    A().blatt('<h2>' + sym('lager') + 'Artikel wählen<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><div class="suchfeld">' + sym('suche') + '<input id="asuche" placeholder="Artikel suchen …" autocomplete="off"></div><div id="aliste" style="margin-top:10px">' + laedt('Lade Artikel …') + '</div>');
    var z = A().z;
    function zeigen() {
      var q = FV.norm($('#asuche') ? $('#asuche').value : ''), w = q ? q.split(' ') : [];
      var l = (z.artikel || []).filter(function (a) { var t = FV.norm(a.name + ' ' + a.kat); return w.every(function (x) { return t.indexOf(x) >= 0; }); }).slice(0, 40);
      var box = $('#aliste'); if (!box) return;
      box.innerHTML = l.length ? l.map(function (a) { return '<button class="eintrag" data-tun="neu-artikel-plus" data-id="' + h(a.id) + '">' + sym('plus') + '<div class="txt"><b>' + h(a.name) + '</b><span>' + h(a.kat) + ' · im Haus ' + a.imhaus + '</span></div></button>'; }).join('') : '<p class="klein2">Nichts gefunden.</p>';
    }
    var p = z.artikel ? Promise.resolve() : S.ruf('artikel').then(function (r) { z.artikel = r.artikel || []; });
    p.then(function () { zeigen(); var i = $('#asuche'); if (i) i.oninput = zeigen; }).catch(function (e) { var b = $('#aliste'); if (b) b.innerHTML = '<div class="fehler">' + h(e.message) + '</div>'; });
  };
  FV.norm = function (t) { return String(t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim(); };
  Tun['neu-artikel-plus'] = function (e) {
    var z = A().z, id = e.getAttribute('data-id'), a = (z.artikel || []).filter(function (x) { return x.id === id; })[0]; if (!a) return;
    if (z.neu.pos[id]) z.neu.pos[id].menge++; else z.neu.pos[id] = { name: a.name, menge: 1 };
    A().toast(a.name + ' hinzugefügt (' + z.neu.pos[id].menge + ')', 1400);
    var box = $('#npos'); if (box) box.innerHTML = posHtml();
  };
  Tun['auftrag-speichern'] = function (f) {
    formMerken(); var n = A().z.neu;
    if (!String(n.name || '').trim() || !String(n.adresse || '').trim()) { A().toast('Bitte Name und Adresse des Kunden eintragen.'); return; }
    var k = $('#nspeichern'); k.disabled = true;
    S.ruf('auftrag_neu_app', { name: n.name, adresse: n.adresse, tel: n.tel || '', email: n.email || '', datum: n.datum || A().heute(), uhrzeit: n.uhrzeit || '', lieferart: n.art,
      notiz: n.notiz || '', sonderwunsch: n.sonder || '', positionen: Object.keys(n.pos).map(function (id) { return { aid: id, menge: n.pos[id].menge }; }) })
      .then(function (r) { A().z.neu = null; A().zurueck(); A().toast('Auftrag ' + (r.nr || '') + ' gespeichert. Er wartet in der Verwaltung auf Bestätigung.', 5000); })
      .catch(function (e) { k.disabled = false; if (!e.stop) A().toast(e.message, 5000); });
  };

  /* ====================== Routen-Vorschau ====================== */
  var lauf = 0;
  function kartenfeld(extra) { return '<div class="kartenfeld" id="kfeld"><div class="quelle">© OpenStreetMap</div>' + (extra || '') + '</div>'; }
  function zielkarte(z) {
    return '<div class="ziel">' + sym(z.art === 'halle' ? 'halle' : z.art === 'frei' ? 'pin' : 'lkw') + '<div class="txt"><b>' + h(z.name) + '</b><div class="adr">' + sym('pin') + '<span>' + adr2(z.adresse) + '</span></div></div>' +
      (z.tel ? '<button class="rund" data-tun="anrufen" data-tel="' + h(z.tel) + '" aria-label="Anrufen">' + sym('telefon') + '</button>' : '') + '</div>';
  }
  function startpunkt() {
    var o = B.ort();
    if (o && Date.now() - (o.zeit || 0) < 180000) return Promise.resolve({ lat: o.lat, lon: o.lon, kurs: o.kurs, tempo: o.tempo, name: 'Ihr Standort' });
    return new Promise(function (ok, fehl) {
      B.ortStart();
      var ab = B.beiOrt(function (p) { clearTimeout(t); ab(); ok({ lat: p.lat, lon: p.lon, kurs: p.kurs, tempo: p.tempo, name: 'Ihr Standort' }); });
      var t = setTimeout(function () {
        ab(); var lh = A().z.ziele.lagerhalle;
        if (!lh || !lh.adresse) return fehl(new Error('Der Standort wurde noch nicht gefunden. Bitte Standort am Handy einschalten.'));
        G.finde(lh.adresse).then(function (c) { ok({ lat: c.lat, lon: c.lon, name: 'Lagerhalle', ersatz: true }); }).catch(function () { fehl(new Error('Der Standort wurde noch nicht gefunden. Bitte Standort am Handy einschalten.')); });
      }, 7000);
    });
  }
  /* Punkte entlang der Strecke: Symbol und Überschrift je Art (Schalter in der Auswahl auf der Karte und in den Einstellungen) */
  var POI = { wc: ['wc', 'Parkplatz mit WC'], laden: ['laden', 'Ladesäule'], essen: ['kaffee', 'Bäcker / Café'], tanken: ['tanken', 'Tankstelle'] };
  function poisZeigen(r) {
    var e = A().e;
    K.pois((r.pois || []).filter(function (p) { return e[p.art] !== false; }), function (p) {
      var x = POI[p.art] || POI.wc;
      A().blatt('<h2>' + sym(x[0]) + h(x[1]) + '<button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
        '<div class="block"><div class="detailzeile">' + sym('pin') + '<div><small>Name</small>' + h(p.name) + '</div></div>' + (p.info ? '<div class="detailzeile">' + sym('info') + '<div><small>Angaben</small>' + h(p.info) + '</div></div>' : '') +
        '<div class="detailzeile">' + sym('route') + '<div><small>Auf der Strecke nach</small>' + G.km(p.weg) + (p.abseits > 60 ? ' · ' + p.abseits + ' m abseits' : '') + '</div></div></div>' +
        '<p class="klein2">Angaben aus OpenStreetMap, ohne Gewähr.</p>');
    });
  }
  /* Auswahl Auto · Fahrrad · Zug · zu Fuß */
  function modusLeiste(m) {
    return '<div class="modi" role="tablist">' + ['auto', 'rad', 'zug', 'fuss'].map(function (k) {
      var x = G.MODI[k]; return '<button role="tab" data-tun="modus" data-m="' + k + '"' + (k === m ? ' class="akt" aria-selected="true"' : '') + '>' + sym(x.sym) + '<span>' + x.name + '</span></button>';
    }).join('') + '</div>';
  }
  Tun.modus = function (el) {
    var m = el.getAttribute('data-m'), z = A().z, ziel = z.nav && z.nav.ziel; if (!ziel) return;
    A().e.modus = m; A().speichern();
    z.nav = null; A().zeige('vorschau', { ziel: ziel }, 'ersetzen');
  };
  /** Verkehrslage unter der Karte: keine Meldungen / Stau / Umleitung */
  function verkehrLeiste(r, warten) {
    var b = $('#vleiste'); if (!b) return;
    if (!r || r.modus !== 'auto' || A().e.verkehr === false) { b.hidden = true; return; }
    b.hidden = false;
    if (warten) { b.className = 'vleiste'; b.innerHTML = '<i class="dreh"></i><span>Verkehrslage wird geprüft …</span>'; return; }
    var l = r.verkehr || [], u = r.umleitung, vz = 0; l.forEach(function (m) { vz += m.verzoegerung || 0; });
    var V = FV.V;
    if (u) { b.className = 'vleiste umleitung'; b.innerHTML = sym('umleitung') + '<span><b>Umleitung</b> wegen ' + h(V.titel(u.grund)) + (u.grund.strasse ? ' ' + h(u.grund.strasse.split(',')[0]) : '') + (l.length ? ' · ' + l.length + ' weitere Meldung' + (l.length > 1 ? 'en' : '') : '') + '</span>' + sym('rechts'); return; }
    if (!l.length) { b.className = 'vleiste frei'; b.innerHTML = sym('ampel') + '<span>' + (V.fehler ? h(V.fehler) : '<b>Freie Fahrt</b> – keine Meldungen auf der Strecke') + '</span>' + (V.fehler ? '' : sym('rechts')); return; }
    var m0 = l[0];
    b.className = 'vleiste ' + V.klasse(m0);
    b.innerHTML = sym('warnung') + '<span><b>' + h(V.titel(m0)) + '</b> ' + h(V.ort(m0).split(' · ')[0]) + ' · in ' + G.km(m0.ab) + (vz >= 60 ? ' · ' + h(V.verzText(vz)) : '') + (l.length > 1 ? ' · +' + (l.length - 1) + ' weitere' : '') + '</span>' + sym('rechts');
  }
  /** Verkehrsmeldungen auf die Karte */
  function verkehrKarte(r) { if (K.verkehr) K.verkehr(r && r.modus === 'auto' ? (r.verkehr || []) : [], function (m) { verkehrBlatt(r, m); }); }
  function verkehrBlatt(r, nur) {
    var V = FV.V, l = nur ? [nur] : (r && r.verkehr || []), u = !nur && r && r.umleitung, ab = F.aktiv && F.route === r && F.stand ? (r.laenge - F.stand.restM) : 0;
    var html = '<h2>' + sym('ampel') + 'Verkehr auf der Strecke<button data-tun="blatt-zu">' + sym('zu') + '</button></h2>';
    if (u) html += '<div class="block umleitungblock">' + sym('umleitung') + '<div><b>Umleitung aktiv</b><span>Wegen ' + h(V.sprache(u.grund)) + '. ' + (u.spart === Infinity || u.grund.gesperrt ? 'Die alte Strecke ist gesperrt.' : 'Spart etwa ' + h(G.minuten(u.spart))) + '</span></div></div>';
    if (!l.length) html += '<div class="gut">' + (V.fehler ? h(V.fehler) + '.' : u ? 'Auf der neuen Strecke gibt es keine weiteren Meldungen.' : 'Keine Staus, Unfälle oder Sperrungen auf der Strecke.') + '</div>';
    l.forEach(function (m) {
      var weit = m.ab - ab;
      html += '<div class="vmeldung ' + V.klasse(m) + '">' + sym(m.art === 'baustelle' || m.art === 'spur' ? 'baustelle' : 'warnung') + '<div><b>' + h(V.titel(m)) + (m.verzoegerung >= 60 ? ' <em>' + h(V.verzText(m.verzoegerung)) + '</em>' : '') + '</b>' +
        '<span>' + h(V.ort(m)) + '</span>' + (m.richtung ? '<span>' + h(m.richtung) + '</span>' : '') + (m.text ? '<small>' + h(m.text) + '</small>' : '') +
        '<small>' + (weit > 0 ? 'in ' + G.km(weit) : 'hier') + (m.bis - m.ab > 300 ? ' · ' + G.km(m.bis - m.ab) + ' lang' : '') + ' · ' + (m.quelle === 'tomtom' ? 'TomTom' : 'Autobahn GmbH') + '</small></div></div>';
    });
    html += '<p class="klein2">Quellen: ' + h(V.quellen()) + (V.schluessel() ? '' : ' – nur Autobahnen. Für Landstraßen und Orte in der Verwaltung den TomTom-Schlüssel eintragen.') + (V.stand ? ' · Stand ' + G.uhr(new Date(V.stand)) : '') + '</p>';
    if (F.aktiv && !nur) html += '<button class="rand knopf breit" data-tun="verkehr-neu">' + sym('ampel') + 'Jetzt neu prüfen</button>';
    A().blatt(html);
  }
  Tun['verkehr-liste'] = function () { var z = A().z, r = (F.aktiv && F.route) || (z.nav && z.nav.route); if (r) verkehrBlatt(r); };
  Tun['verkehr-neu'] = function () { A().blattZu(); A().toast('Verkehrslage wird geprüft …', 2500); F.verkehrJetzt(); };

  /* ====================== Bahnhöfe: in der Nähe, am Ziel, Live-Abfahrtstafel ====================== */
  function bfArt(b) { return [b.fern ? 'ICE/IC' : '', b.regio ? 'RE/RB' : '', b.sbahn ? 'S-Bahn' : ''].filter(Boolean).join(' · '); }
  /** Bahnhöfe auf die Karte: um den Start/Standort und um das Ziel */
  var bfAuf = { liste: [], um: null };
  function bahnhoefeKarte(punkte) {
    if (A().e.bahnhof === false) { if (K.bahnhoefe) K.bahnhoefe([]); return; }
    var alle = [], gesehen = {};
    Promise.all(punkte.filter(Boolean).map(function (p) { return FV.V.bahnhoefe(p, 30000).catch(function () { return []; }); })).then(function (t) {
      t.forEach(function (l) { l.slice(0, 30).forEach(function (b) { if (!gesehen[b.id]) { gesehen[b.id] = 1; alle.push(b); } }); });
      bfAuf.liste = alle;
      K.wenn(function () { K.bahnhoefe(alle, function (b) { tafelBlatt(b, false); }); });
    });
  }
  /** Apotheken auf die Karte; Notdienst-Apotheken grün (Abgleich mit aponet.de über Name/Straße) */
  function apothekenKarte(punkte) {
    if (A().e.apotheke === false) { K.apotheken([]); return; }
    var pk = punkte.filter(Boolean), alle = [], gesehen = {};
    Promise.all(pk.map(function (p) { return FV.V.apotheken(p, 4000).catch(function () { return []; }); })).then(function (t) {
      t.forEach(function (l) { l.slice(0, 12).forEach(function (a) { var k = a.lat.toFixed(4) + a.lon.toFixed(4); if (!gesehen[k]) { gesehen[k] = 1; alle.push(Object.assign({}, a)); } }); });
      function zeigen() { if (A().e.apotheke === false) return; K.wenn(function () { K.apotheken(alle, function (a) { apoBlatt(a.notdienst || a, !!a.notdienst); }); }); }
      zeigen();
      if (!pk[0] || S.demo && false) return;
      // Notdienst dazu (still – ohne Meldung, wenn es nicht klappt)
      FV.V.plz(pk[0]).then(function (pz) { return FV.V.notdienst(pz.plz); }).then(function (nd) {
        var jetzt = new Date(), n0 = function (t) { return FV.norm(t).replace(/\bapotheke\b/g, '').trim(); };
        nd.filter(function (d) { return (!d.von || d.von <= jetzt) && (!d.bis || d.bis > jetzt); }).forEach(function (d) {
          var m = alle.filter(function (a) { return (n0(a.name) && n0(a.name) === n0(d.name)) || (d.strasse && a.strasse && FV.norm(a.strasse) === FV.norm(d.strasse)); })[0];
          if (m) m.notdienst = Object.assign({ lat: m.lat, lon: m.lon }, d);
          else if (d.lat && d.lon) alle.push({ name: d.name, strasse: d.strasse, ort: d.ort, lat: d.lat, lon: d.lon, notdienst: d });
        });
        zeigen();
      }).catch(function () {});
    });
  }
  function aerzteKarte(punkte) {
    if (A().e.arzt === false) { K.aerzte([]); return; }
    var alle = [], gesehen = {};
    Promise.all(punkte.filter(Boolean).map(function (p) { return FV.V.aerzte(p).catch(function () { return { aerzte: [], notdienst: [] }; }); })).then(function (t) {
      t.forEach(function (x) { x.notdienst.slice(0, 4).concat(x.aerzte.slice(0, 12)).forEach(function (a) { var k = a.lat.toFixed(4) + a.lon.toFixed(4); if (!gesehen[k]) { gesehen[k] = 1; alle.push(a); } }); });
      if (A().e.arzt === false) return;
      K.wenn(function () { K.aerzte(alle, arztBlatt); });
    });
  }
  function flughafenKarte(punkte) {
    if (A().e.flughafen === false) { K.flughaefen([]); return; }
    var alle = [], gesehen = {};
    Promise.all(punkte.filter(Boolean).map(function (p) { return FV.V.flughaefen(p).catch(function () { return []; }); })).then(function (t) {
      t.forEach(function (l) { l.slice(0, 6).forEach(function (f) { if (!gesehen[f.iata]) { gesehen[f.iata] = 1; alle.push(f); } }); });
      if (A().e.flughafen === false) return;
      K.wenn(function () { K.flughaefen(alle, function (f) { flugBlatt(f, false); }); });
    });
  }
  var umgebungPunkte = [];
  function umgebungKarte(punkte) { umgebungPunkte = punkte; bahnhoefeKarte(punkte); apothekenKarte(punkte); aerzteKarte(punkte); flughafenKarte(punkte); }
  var EBENEN = [['bahnhof', 'zug', 'Bahnhöfe'], ['apotheke', 'apotheke', 'Apotheken'], ['arzt', 'arzt', 'Ärzte'], ['flughafen', 'flug', 'Flughäfen']];
  function ebeneNeu(k) {
    var e = A().e, pk = umgebungPunkte.length ? umgebungPunkte : [B.ort(), F.ziel], an = e[k] !== false;
    if (k === 'bahnhof') { if (!an) K.bahnhoefe([]); else bahnhoefeKarte(pk); }
    if (k === 'apotheke') { if (!an) K.apotheken([]); else apothekenKarte(pk); }
    if (k === 'arzt') { if (!an) K.aerzte([]); else aerzteKarte(pk); }
    if (k === 'flughafen') { if (!an) K.flughaefen([]); else flughafenKarte(pk); }
  }
  function ebenenFeld() {
    var e = A().e;
    return EBENEN.map(function (x) { return '<button data-tun="ebene-schalter" data-k="' + x[0] + '" class="' + (e[x[0]] !== false ? 'an' : '') + '">' + sym(x[1]) + x[2] + '<i></i></button>'; }).join('');
  }
  function ebenenKnopf() { return '<button class="kartenknopf dunkel rund ebenenknopf" data-tun="ebenen" aria-label="Was auf der Karte steht">' + sym('ebenen') + '</button><div class="auswahlfeld ebenenfeld" id="ebfeld" hidden></div>'; }
  Tun.ebenen = function () { var f = $('#ebfeld'); if (!f) return; f.innerHTML = ebenenFeld(); f.hidden = !f.hidden; };
  Tun['ebene-schalter'] = function (el) {
    var k = el.getAttribute('data-k'), e = A().e; e[k] = e[k] === false; A().speichern();
    var f = $('#ebfeld'); if (f) f.innerHTML = ebenenFeld();
    auswahlZeichnen(); ebeneNeu(k);
    A().toast(EBENEN.filter(function (x) { return x[0] === k; })[0][2] + (e[k] === false ? ' ausgeblendet' : ' eingeblendet'), 1500);
  };
  Tun.bahnhoefe = function (el) { A().blattZu(); A().zeige('bahnhoefe', { wo: el && el.getAttribute('data-wo') || '' }); };
  Se.bahnhoefe = function (p) {
    var z = A().z, n = (F.aktiv && z.lauf) || z.nav, ziel = n && n.nach && n.nach.lat != null ? n.nach : null, wo = p.wo === 'ziel' && ziel ? 'ziel' : 'hier';
    seite(kopf('Bahnhöfe') + '<div class="modi">' +
      '<button data-tun="bahnhoefe-wo" data-wo="hier"' + (wo === 'hier' ? ' class="akt"' : '') + '>' + sym('ort') + '<span>In der Nähe</span></button>' +
      '<button data-tun="bahnhoefe-wo" data-wo="ziel"' + (wo === 'ziel' ? ' class="akt"' : '') + (ziel ? '' : ' disabled style="opacity:.45"') + '>' + sym('a_ziel') + '<span>Am Ziel' + (ziel && ziel.name ? '' : '') + '</span></button></div>' +
      '<div class="rollen" id="bliste">' + laedt('Bahnhöfe werden gesucht …') + '</div>');
    var meins = ++lauf;
    var wp = wo === 'ziel' ? Promise.resolve(ziel) : startpunkt();
    wp.then(function (pt) { return FV.V.bahnhoefe(pt, 30000).then(function (l) { return [pt, l]; }); }).then(function (x) {
      if (meins !== lauf) return;
      var l = x[1], box = $('#bliste'); if (!box) return;
      z.bahnhoefe = l;
      if (!l.length) { box.innerHTML = '<div class="fehler">Im Umkreis von 30 km wurde kein Bahnhof gefunden.</div>'; return; }
      box.innerHTML = '<h3 class="ueber">' + sym('zug') + (wo === 'ziel' ? 'Bahnhöfe am Ziel' + (ziel.name ? ' (' + h(ziel.name) + ')' : '') : 'Bahnhöfe in der Nähe') + '</h3>' +
        l.map(function (b, i) { var zb = wo === 'ziel' && i === 0 && b.weit <= 700; return '<button class="eintrag' + (zb ? ' zielbf' : '') + '" data-tun="bahnhof" data-i="' + i + '">' + sym('zug') + '<div class="txt"><b>' + h(b.name) + (zb ? ' <i class="zbmarke">Zielbahnhof</i>' : '') + '</b><span>' + (zb ? 'Ihr Ziel' : G.km(b.weit) + ' entfernt') + (bfArt(b) ? ' · ' + h(bfArt(b)) : '') + '</span></div><div class="ende"><span class="wert" style="font-size:13px">Abfahrten</span>' + sym('rechts') + '</div></button>'; }).join('') +
        '<p class="klein2" style="text-align:center">Live-Daten der Deutschen Bahn (bahn.de): Gleis, Verspätung, Ausfälle. Ohne Gewähr.</p>';
    }).catch(function () { var b = $('#bliste'); if (b && meins === lauf) b.innerHTML = '<div class="fehler">Die Bahnhof-Auskunft antwortet gerade nicht. Bitte gleich noch einmal versuchen.</div><button class="rand knopf breit" style="margin-top:10px" data-tun="bahnhoefe-wo" data-wo="' + wo + '">' + sym('neu') + 'Nochmal versuchen</button>'; });
  };
  Tun['bahnhoefe-wo'] = function (el) { if (el.disabled) return; A().zeige('bahnhoefe', { wo: el.getAttribute('data-wo') }, 'ersetzen'); };
  Tun.bahnhof = function (el) { var b = (A().z.bahnhoefe || [])[+el.getAttribute('data-i')]; if (b) tafelBlatt(b, false); };
  var tafelTimer = null;
  function tafelBlatt(b, ankunft) {
    A().z.tafel = b;
    var kopfH = '<h2>' + sym('zug') + '<span>' + h(b.name) + '<br><small style="font-weight:400;font-size:13px">' + G.km(b.weit || 0) + ' entfernt' + (bfArt(b) ? ' · ' + h(bfArt(b)) : '') + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="modi" style="padding:0 0 8px"><button data-tun="tafel-art" data-a="ab"' + (!ankunft ? ' class="akt"' : '') + '>' + sym('zug') + '<span>Abfahrten</span></button><button data-tun="tafel-art" data-a="an"' + (ankunft ? ' class="akt"' : '') + '>' + sym('a_ziel') + '<span>Ankünfte</span></button></div>';
    A().blatt(kopfH + '<div id="tafel" data-id="' + h(b.name) + '">' + laedt('Live-Daten werden geladen …') + '</div>' +
      '<div class="zweier"><button class="gold knopf" data-tun="bahnhof-hin" data-m="auto">' + sym('auto') + 'Hinfahren</button><button class="rand knopf" data-tun="bahnhof-hin" data-m="fuss">' + sym('fuss') + 'Zu Fuß hin</button></div>');
    function laden() {
      var t = $('#tafel'); if (!t || t.getAttribute('data-id') !== String(b.name)) { clearInterval(tafelTimer); return; }
      FV.V.tafel(b, ankunft).then(function (l) {
        var t2 = $('#tafel'); if (!t2 || t2.getAttribute('data-id') !== String(b.name)) return;
        if (!l.length) { t2.innerHTML = '<div class="gut">In den nächsten 90 Minuten ' + (ankunft ? 'kommt' : 'fährt') + ' hier kein Zug.</div>'; return; }
        var pk = 0, sp = 0, au = 0; l.forEach(function (x) { if (x.faellt) au++; else if (x.verz >= 6) sp++; else if (x.verz != null) pk++; });
        t2.innerHTML = '<div class="tafelsumme"><span class="pk">' + pk + ' pünktlich</span>' + (sp ? '<span class="sp">' + sp + ' verspätet</span>' : '') + (au ? '<span class="au">' + au + ' fällt aus</span>' : '') + '<small>Stand ' + G.uhr() + ' · alle 60 s neu</small></div>' +
          l.map(function (x) {
            var gw = x.gleisPlan && x.gleis && x.gleis !== x.gleisPlan;
            var st = x.faellt ? '<em class="spaet">fällt aus</em>' : x.verz == null ? '<em class="grau2">ohne Live-Daten</em>' : x.verz >= 1 ? '<em class="spaet">+' + x.verz + ' · ' + G.uhr(x.echt) + '</em>' : '<em class="puenktlich">pünktlich</em>';
            return '<div class="tz' + (x.faellt ? ' faellt' : '') + '"><div class="tzeit"><b>' + G.uhr(x.plan) + '</b>' + st + '</div>' +
              '<div class="tinfo"><b><i class="lin ' + h(x.produkt) + '">' + h(x.linie) + '</i> ' + (ankunft ? 'von ' : '→ ') + h(x.richtung) + '</b>' + x.hinweise.map(function (y) { return '<small class="spaet">' + h(y) + '</small>'; }).join('') + '</div>' +
              '<div class="tgleis' + (gw ? ' wechsel' : '') + '"><small>Gleis</small><b>' + h(x.gleis || '–') + '</b>' + (gw ? '<s>' + h(x.gleisPlan) + '</s>' : '') + '</div></div>';
          }).join('');
      }).catch(function (e) { var t3 = $('#tafel'); if (t3) t3.innerHTML = '<div class="fehler">Die Live-Daten konnten gerade nicht geladen werden. Es wird gleich noch einmal versucht.' + FV.V.grundHtml(e) + '</div>'; });
    }
    clearInterval(tafelTimer); tafelTimer = setInterval(laden, 60000); laden();
  }
  /* ---------- Zielbahnhof: liegt das Ziel an einem Bahnhof, zeigt das Navi dessen Lage (Verspätungen, Ausfälle) gleich mit ---------- */
  var zbStand = { key: '', b: null, l: null, t: 0 }, zbTimer = null;
  function zbText(b, l) {
    if (!l) return '<b>' + h(b.name) + '</b> · Abfahrten werden geladen …';
    var s = FV.V.tafelSumme(l), t = [];
    if (s.sp) t.push('<em class="spaet">' + s.sp + ' verspätet</em>');
    if (s.au) t.push('<em class="spaet">' + s.au + ' fällt aus</em>');
    if (!t.length) t.push(l.length ? '<em class="puenktlich">alles pünktlich</em>' : 'kein Zug in 90 Min.');
    return '<b>' + h(b.name) + '</b> · ' + t.join(' · ');
  }
  /** Füllt Knopf #id mit dem Zustand des Zielbahnhofs (nach = Zielpunkt); wird alle 2 Minuten aufgefrischt */
  function zielBahnhofZeigen(id, nach) {
    var key = nach.lat.toFixed(4) + ',' + nach.lon.toFixed(4);
    function malen() {
      var k = $('#' + id); if (!k) return false;
      if (zbStand.key !== key || !zbStand.b) { k.hidden = true; return true; }
      k.hidden = false; k.innerHTML = sym('zug') + '<span>' + zbText(zbStand.b, zbStand.l) + '</span>' + sym('rechts'); return true;
    }
    function tafelHolen() {
      if (zbStand.key !== key || !zbStand.b) return;
      FV.V.tafel(zbStand.b, false).then(function (l) { if (zbStand.key === key) { zbStand.l = l; zbStand.t = Date.now(); } malen(); }).catch(function () { malen(); });
    }
    clearInterval(zbTimer);
    zbTimer = setInterval(function () { if (!$('#' + id)) { clearInterval(zbTimer); return; } tafelHolen(); }, 120000);
    if (zbStand.key === key) { malen(); if (zbStand.b && Date.now() - zbStand.t > 110000) tafelHolen(); return; }
    zbStand = { key: key, b: null, l: null, t: 0 }; malen();
    FV.V.zielBahnhof(nach).then(function (b) { if (zbStand.key !== key) return; zbStand.b = b; malen(); tafelHolen(); });
  }
  Tun['ziel-tafel'] = function () { if (zbStand.b) tafelBlatt(zbStand.b, false); };
  Tun['tafel-art'] = function (el) { var b = A().z.tafel; if (b) tafelBlatt(b, el.getAttribute('data-a') === 'an'); };
  Tun['bahnhof-hin'] = function (el) {
    var b = A().z.tafel; if (!b) return; A().blattZu();
    A().zeige('vorschau', { ziel: { name: b.name, adresse: 'Bahnhof', lat: b.lat, lon: b.lon, art: 'frei' }, modus: el.getAttribute('data-m') });
  };

  /* ====================== Apotheken: in der Nähe und Notdienst ====================== */
  var WT = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  function wann(d) { var heute = new Date(); heute.setHours(0, 0, 0, 0); var t = new Date(d); t.setHours(0, 0, 0, 0); var diff = Math.round((t - heute) / 86400000);
    return (diff === 0 ? 'heute' : diff === 1 ? 'morgen' : diff === -1 ? 'gestern' : WT[d.getDay()]) + ' ' + G.uhr(d); }
  Tun.apotheken = function (el) { A().blattZu(); A().zeige('apotheken', { wo: el && el.getAttribute('data-wo') || '' }); };
  Tun['apotheken-wo'] = function (el) { if (el.disabled) return; A().zeige('apotheken', { wo: el.getAttribute('data-wo') }, 'ersetzen'); };
  Se.apotheken = function (p) {
    var z = A().z, n = (F.aktiv && z.lauf) || z.nav, ziel = n && n.nach && n.nach.lat != null ? n.nach : null, wo = p.wo === 'ziel' && ziel ? 'ziel' : 'hier', meins = ++lauf;
    seite(kopf('Apotheken') + '<div class="modi">' +
      '<button data-tun="apotheken-wo" data-wo="hier"' + (wo === 'hier' ? ' class="akt"' : '') + '>' + sym('ort') + '<span>In der Nähe</span></button>' +
      '<button data-tun="apotheken-wo" data-wo="ziel"' + (wo === 'ziel' ? ' class="akt"' : '') + (ziel ? '' : ' disabled style="opacity:.45"') + '>' + sym('a_ziel') + '<span>Am Ziel</span></button></div>' +
      '<div class="rollen"><div id="anot">' + laedt('Notdienst wird gesucht …') + '</div><div id="aliste2">' + laedt('Apotheken werden gesucht …') + '</div>' +
      '<p class="klein2" style="text-align:center">Notdienst: aponet.de (Apothekerkammern) · Apotheken und Öffnungszeiten: OpenStreetMap. Ohne Gewähr – im Zweifel vorher anrufen.</p>' +
      '<button class="rand knopf breit" data-tun="aponet">' + sym('apotheke') + 'Notdienst auf aponet.de ansehen</button><div style="height:10px"></div></div>');
    (wo === 'ziel' ? Promise.resolve(ziel) : startpunkt()).then(function (pt) {
      if (meins !== lauf) return;
      z.apoPunkt = pt;
      // Notdienst
      FV.V.plz(pt).then(function (pz) { z.apoPlz = pz.plz; return FV.V.notdienst(pz.plz).then(function (l) { return [pz, l]; }); }).then(function (x) {
        if (meins !== lauf) return;
        var jetzt = new Date(), l = x[1].filter(function (a) { return !a.bis || a.bis > jetzt; });
        l.sort(function (a, b) { return ((a.von && a.von > jetzt) - (b.von && b.von > jetzt)) || (a.km - b.km); });
        z.notdienst = l;
        var box = $('#anot'); if (!box) return;
        if (!l.length) { box.innerHTML = '<div class="block">' + '<h2>' + sym('apotheke') + 'Notdienst</h2><p class="klein2" style="margin:0">Für ' + h(x[0].plz + ' ' + x[0].ort) + ' wurde heute kein Notdienst gefunden. Bitte auf aponet.de nachsehen.</p></div>'; return; }
        box.innerHTML = '<h3 class="ueber">' + sym('apotheke') + 'Notdienst rund um ' + h(x[0].ort || x[0].plz) + '</h3>' + l.map(function (a, i) {
          var jetztDa = (!a.von || a.von <= jetzt) && (!a.bis || a.bis > jetzt);
          return '<button class="eintrag apo notd' + (jetztDa ? ' jetzt' : '') + '" data-tun="apo-wahl" data-n="1" data-i="' + i + '">' + sym('apotheke') + '<div class="txt"><b>' + h(a.name) + '</b><span>' + h([a.strasse, [a.plz, a.ort].join(' ').trim()].filter(Boolean).join(', ')) + '</span>' +
            '<span class="' + (jetztDa ? 'offen' : 'spaeter') + '">' + (jetztDa ? '● Notdienst jetzt' + (a.bis ? ' bis ' + wann(a.bis) : '') : '◷ Notdienst ab ' + wann(a.von) + (a.bis ? ' bis ' + wann(a.bis) : '')) + '</span></div>' +
            '<div class="ende">' + (a.km ? '<span class="wert" style="font-size:14px">' + String(a.km).replace('.', ',') + ' km</span>' : '') + sym('rechts') + '</div></button>';
        }).join('');
      }).catch(function (e) {
        var box = $('#anot'); if (!box || meins !== lauf) return;
        box.innerHTML = '<div class="fehler">' + (e.unbekannt ? 'Für den Notdienst braucht die Verwaltung die neue warenwirtschaft.php.' : 'Der Notdienst konnte gerade nicht geladen werden.') + ' Unten gibt es den Link zu aponet.de.</div>';
      });
      // alle Apotheken in der Nähe
      FV.V.apotheken(pt, 6000).then(function (l) {
        if (meins !== lauf) return;
        z.apoListe = l;
        var box = $('#aliste2'); if (!box) return;
        if (!l.length) { box.innerHTML = '<p class="klein2">Im Umkreis von 6 km wurde keine Apotheke gefunden.</p>'; return; }
        box.innerHTML = '<h3 class="ueber">' + sym('ort') + 'Alle Apotheken ' + (wo === 'ziel' ? 'am Ziel' : 'in der Nähe') + '</h3>' + l.slice(0, 25).map(function (a, i) {
          var o = FV.V.offen(a.zeiten);
          return '<button class="eintrag apo" data-tun="apo-wahl" data-i="' + i + '">' + sym('apotheke') + '<div class="txt"><b>' + h(a.name) + '</b><span>' + h([a.strasse, a.ort].filter(Boolean).join(', ') || 'Adresse unbekannt') + '</span>' +
            '<span class="' + (o ? (o.offen ? 'offen' : 'zu') : 'grau2') + '">' + (o ? (o.offen ? '● geöffnet bis ' + h(o.bis) : '● geschlossen' + (o.ab ? ' · öffnet ' + h(o.ab) : '')) : 'Öffnungszeiten unbekannt') + '</span></div>' +
            '<div class="ende"><span class="wert" style="font-size:14px">' + G.km(a.weit) + '</span>' + sym('rechts') + '</div></button>';
        }).join('');
      }).catch(function (e) { var box = $('#aliste2'); if (box && meins === lauf) box.innerHTML = '<div class="fehler">Die Kartendienste (OpenStreetMap) antworten gerade nicht. Bitte gleich noch einmal versuchen.' + FV.V.grundHtml(e) + '</div><button class="rand knopf breit" style="margin-top:10px" data-tun="apotheken-wo" data-wo="' + wo + '">' + sym('neu') + 'Nochmal versuchen</button>'; });
    }).catch(function (e) { var b = $('#anot'); if (b) b.innerHTML = '<div class="fehler">' + h(e.message) + '</div>'; var c = $('#aliste2'); if (c) c.innerHTML = ''; });
  };
  Tun['apo-wahl'] = function (el) {
    var z = A().z, not = el.getAttribute('data-n') === '1', a = (not ? z.notdienst : z.apoListe || [])[+el.getAttribute('data-i')]; if (a) apoBlatt(a, not);
  };
  function apoBlatt(a, not) {
    var z = A().z;
    z.apoWahl = a;
    var o = !not && FV.V.offen(a.zeiten), jetzt = new Date();
    var html = '<h2>' + sym('apotheke') + h(a.name) + '<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><div class="block">' +
      '<div class="detailzeile">' + sym('pin') + '<div><small>Adresse</small>' + h([a.strasse, (a.plz ? a.plz + ' ' : '') + (a.ort || '')].filter(function (x) { return String(x).trim(); }).join(', ') || 'unbekannt') + '</div></div>' +
      (not ? '<div class="detailzeile">' + sym('uhr') + '<div><small>Notdienst</small>' + (a.von ? wann(a.von) : '') + (a.bis ? ' bis ' + wann(a.bis) : '') + ((!a.von || a.von <= jetzt) && (!a.bis || a.bis > jetzt) ? ' · <b class="offen">jetzt geöffnet</b>' : '') + '</div></div>'
           : '<div class="detailzeile">' + sym('uhr') + '<div><small>Öffnungszeiten</small>' + h(a.zeiten || 'unbekannt') + (o ? ' · <b class="' + (o.offen ? 'offen' : 'zu') + '">' + (o.offen ? 'jetzt geöffnet' : 'jetzt geschlossen') + '</b>' : '') + '</div></div>') +
      (a.telefon ? '<div class="detailzeile">' + sym('telefon') + '<div><small>Telefon</small>' + h(a.telefon) + '</div></div>' : '') + '</div>' +
      (not ? '<p class="klein2">Im Notdienst wird oft über eine Klappe oder ein Fenster bedient. Für den Notdienst fällt eine kleine Gebühr an.</p>' : '') +
      '<div class="zweier">' + (a.telefon ? '<button class="rand knopf" data-tun="anrufen" data-tel="' + h(a.telefon) + '">' + sym('telefon') + 'Anrufen</button>' : '') +
      '<button class="gold knopf" data-tun="apo-hin" data-m="auto">' + sym('auto') + 'Hinfahren</button></div><div style="height:8px"></div>' +
      '<button class="rand knopf breit" data-tun="apo-hin" data-m="fuss">' + sym('fuss') + 'Zu Fuß hin</button>';
    A().blatt(html);
  }
  Tun['apo-hin'] = function (el) {
    var a = A().z.apoWahl; if (!a) return; A().blattZu();
    var adr = [a.strasse, [a.plz, a.ort].join(' ').trim()].filter(Boolean).join(', ');
    A().zeige('vorschau', { ziel: { name: a.name, adresse: adr || a.name, lat: a.lat, lon: a.lon, art: 'frei' }, modus: el.getAttribute('data-m') });
  };
  Tun.aponet = function () { var z = A().z; B.oeffnen('https://www.aponet.de/notdienstsuche' + (z.apoPlz ? '?plz=' + z.apoPlz : '')); };

  /* ====================== In der Nähe: Auswahl ====================== */
  Tun.umgebung = function () {
    A().blatt('<h2>' + sym('umgebung') + 'In der Nähe<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><div class="umgebung">' +
      '<button class="rand knopf" data-tun="bahnhoefe">' + sym('zug') + '<span>Bahnhöfe<small>Abfahrten live</small></span></button>' +
      '<button class="rand knopf" data-tun="apotheken">' + sym('apotheke') + '<span>Apotheken<small>mit Notdienst</small></span></button>' +
      '<button class="rand knopf" data-tun="aerzte">' + sym('arzt') + '<span>Ärzte<small>mit Notdienst</small></span></button>' +
      '<button class="rand knopf" data-tun="flughaefen">' + sym('flug') + '<span>Flughäfen<small>Flüge live</small></span></button></div>');
  };
  function wechselKnopf(tun, wo, ziel) {
    return '<div class="modi"><button data-tun="' + tun + '-wo" data-wo="hier"' + (wo === 'hier' ? ' class="akt"' : '') + '>' + sym('ort') + '<span>In der Nähe</span></button>' +
      '<button data-tun="' + tun + '-wo" data-wo="ziel"' + (wo === 'ziel' ? ' class="akt"' : '') + (ziel ? '' : ' disabled style="opacity:.45"') + '>' + sym('a_ziel') + '<span>Am Ziel</span></button></div>';
  }
  function zielPunkt() { var z = A().z, n = (F.aktiv && z.lauf) || z.nav; return n && n.nach && n.nach.lat != null ? n.nach : null; }

  /* ====================== Ärzte und ärztlicher Notdienst ====================== */
  Tun.aerzte = function (el) { A().blattZu(); A().zeige('aerzte', { wo: el && el.getAttribute && el.getAttribute('data-wo') || '' }); };
  Tun['aerzte-wo'] = function (el) { if (el.disabled) return; A().zeige('aerzte', { wo: el.getAttribute('data-wo') }, 'ersetzen'); };
  Se.aerzte = function (p) {
    var z = A().z, ziel = zielPunkt(), wo = p.wo === 'ziel' && ziel ? 'ziel' : 'hier', meins = ++lauf;
    seite(kopf('Ärzte') + wechselKnopf('aerzte', wo, ziel) + '<div class="rollen">' +
      '<div class="block notruf"><h2>' + sym('arzt') + 'Ärztlicher Notdienst</h2>' +
      '<div class="zweier"><button class="gold knopf" data-tun="anrufen" data-tel="116117">' + sym('telefon') + '<span>116117<small>Bereitschaftsdienst</small></span></button>' +
      '<button class="rotk knopf" data-tun="anrufen" data-tel="112">' + sym('telefon') + '<span>112<small>Notfall, Rettung</small></span></button></div>' +
      '<p class="klein2" style="margin:8px 0 0">116117 (Tag und Nacht, kostenlos) nennt die nächste geöffnete Bereitschaftspraxis und schickt bei Bedarf einen Arzt nach Hause. Bei Lebensgefahr immer 112.</p></div>' +
      '<div id="dnot">' + laedt('Notaufnahmen werden gesucht …') + '</div><div id="dliste">' + laedt('Ärzte werden gesucht …') + '</div>' +
      '<p class="klein2" style="text-align:center">Praxen, Krankenhäuser und Öffnungszeiten: OpenStreetMap. Ohne Gewähr – im Zweifel vorher anrufen.</p><div style="height:10px"></div></div>');
    // Praxen und Notaufnahmen erscheinen unabhängig voneinander: was im Speicher liegt, steht sofort da
    var pt0 = wo === 'ziel' ? Promise.resolve(ziel) : startpunkt();
    function notZeigen(l, fehler) {
      var nb = $('#dnot'); if (!nb || meins !== lauf) return;
      z.arztNot = l;
      nb.innerHTML = l.length ? '<h3 class="ueber">' + sym('arzt') + 'Notaufnahmen und Bereitschaftspraxen</h3>' + l.slice(0, 10).map(function (a, i) {
        var o = FV.V.offen(a.zeiten);
        return '<button class="eintrag arzt notd" data-tun="arzt-wahl" data-n="1" data-i="' + i + '">' + sym('arzt') + '<div class="txt"><b>' + h(a.name) + '</b><span>' + h(a.art === 'bereitschaft' ? 'Bereitschaftsdienstpraxis' : 'Krankenhaus mit Notaufnahme') + (a.ort ? ' · ' + h(a.ort) : '') + '</span>' +
          '<span class="' + (a.art === 'klinik' ? 'offen' : o ? (o.offen ? 'offen' : 'zu') : 'grau2') + '">' + (a.art === 'klinik' ? '● Notaufnahme rund um die Uhr' : o ? (o.offen ? '● jetzt geöffnet bis ' + h(o.bis) : '● jetzt geschlossen – bitte 116117 anrufen') : 'Zeiten: über 116117 erfragen') + '</span></div>' +
          '<div class="ende"><span class="wert" style="font-size:14px">' + G.km(a.weit) + '</span>' + sym('rechts') + '</div></button>';
      }).join('') : fehler ? '<div class="fehler">Notaufnahmen konnten gerade nicht geladen werden – im Notfall 116117 oder 112.' + FV.V.grundHtml(fehler) + '</div>' : '<p class="klein2">Keine Notaufnahme im Umkreis von 30 km gefunden – bitte 116117 oder 112 anrufen.</p>';
    }
    function praxenZeigen(l, fehler) {
      var lb = $('#dliste'); if (!lb || meins !== lauf) return;
      z.arztListe = l;
      lb.innerHTML = l.length ? '<h3 class="ueber">' + sym('ort') + 'Arztpraxen ' + (wo === 'ziel' ? 'am Ziel' : 'in der Nähe') + '</h3>' + l.slice(0, 40).map(function (a, i) {
        var o = FV.V.offen(a.zeiten);
        return '<button class="eintrag arzt" data-tun="arzt-wahl" data-i="' + i + '">' + sym('arzt') + '<div class="txt"><b>' + h(a.name) + '</b><span>' + h(a.fach || 'Arztpraxis') + (a.strasse ? ' · ' + h(a.strasse) : '') + '</span>' +
          '<span class="' + (o ? (o.offen ? 'offen' : 'zu') : 'grau2') + '">' + (o ? (o.offen ? '● geöffnet bis ' + h(o.bis) : '● geschlossen' + (o.ab ? ' · öffnet ' + h(o.ab) : '')) : 'Sprechzeiten unbekannt') + '</span></div>' +
          '<div class="ende"><span class="wert" style="font-size:14px">' + G.km(a.weit) + '</span>' + sym('rechts') + '</div></button>';
      }).join('') : fehler ? '<div class="fehler">Arztpraxen konnten gerade nicht geladen werden.' + FV.V.grundHtml(fehler) + '</div>' : '<p class="klein2">Im Umkreis von 6 km wurde keine Arztpraxis gefunden.</p>';
    }
    function nochmal() { return '<button class="rand knopf breit" style="margin-top:10px" data-tun="aerzte-wo" data-wo="' + wo + '">' + sym('neu') + 'Nochmal versuchen</button>'; }
    pt0.then(function (pt) {
      FV.V.arztPraxen(pt).then(function (l) { praxenZeigen(l, null); }, function (e) { praxenZeigen([], e); var lb = $('#dliste'); if (lb && meins === lauf) lb.innerHTML += nochmal(); });
      FV.V.arztNot(pt).then(function (l) { notZeigen(l, null); }, function (e) { notZeigen([], e); });
    }).catch(function (e) { var nb = $('#dnot'); if (nb && meins === lauf) nb.innerHTML = '<div class="fehler">Standort nicht verfügbar.</div>' + nochmal(); var lb = $('#dliste'); if (lb) lb.innerHTML = ''; });
  };
  Tun['arzt-wahl'] = function (el) { var z = A().z, a = (el.getAttribute('data-n') === '1' ? z.arztNot : z.arztListe || [])[+el.getAttribute('data-i')]; if (a) arztBlatt(a); };
  function arztBlatt(a) {
    A().z.arztWahl = a;
    var o = FV.V.offen(a.zeiten), nd = a.art !== 'arzt';
    A().blatt('<h2>' + sym('arzt') + h(a.name) + '<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><div class="block">' +
      '<div class="detailzeile">' + sym('info') + '<div><small>Art</small>' + h(a.art === 'bereitschaft' ? 'Bereitschaftsdienstpraxis' : a.art === 'klinik' ? 'Krankenhaus mit Notaufnahme' : (a.fach || 'Arztpraxis')) + '</div></div>' +
      '<div class="detailzeile">' + sym('pin') + '<div><small>Adresse</small>' + h([a.strasse, a.ort].filter(Boolean).join(', ') || 'unbekannt') + ' · ' + G.km(a.weit) + '</div></div>' +
      '<div class="detailzeile">' + sym('uhr') + '<div><small>' + (nd ? 'Geöffnet' : 'Sprechzeiten') + '</small>' + (a.art === 'klinik' ? 'Notaufnahme rund um die Uhr' : h(a.zeiten || 'unbekannt')) + (o && a.art !== 'klinik' ? ' · <b class="' + (o.offen ? 'offen' : 'zu') + '">' + (o.offen ? 'jetzt geöffnet' : 'jetzt geschlossen') + '</b>' : '') + '</div></div>' +
      (a.telefon ? '<div class="detailzeile">' + sym('telefon') + '<div><small>Telefon</small>' + h(a.telefon) + '</div></div>' : '') + '</div>' +
      '<div class="zweier">' + (a.telefon ? '<button class="rand knopf" data-tun="anrufen" data-tel="' + h(a.telefon) + '">' + sym('telefon') + 'Anrufen</button>' : '<button class="rand knopf" data-tun="anrufen" data-tel="116117">' + sym('telefon') + '116117</button>') +
      '<button class="gold knopf" data-tun="arzt-hin" data-m="auto">' + sym('auto') + 'Hinfahren</button></div>');
  }
  Tun['arzt-hin'] = function (el) { var a = A().z.arztWahl; if (!a) return; A().blattZu(); A().zeige('vorschau', { ziel: { name: a.name, adresse: [a.strasse, a.ort].filter(Boolean).join(', ') || a.name, lat: a.lat, lon: a.lon, art: 'frei' }, modus: el.getAttribute('data-m') }); };

  /* ====================== Flughäfen und Live-Flugtafel ====================== */
  Tun.flughaefen = function (el) { A().blattZu(); A().zeige('flughaefen', { wo: el && el.getAttribute && el.getAttribute('data-wo') || '' }); };
  Tun['flughaefen-wo'] = function (el) { if (el.disabled) return; A().zeige('flughaefen', { wo: el.getAttribute('data-wo') }, 'ersetzen'); };
  Se.flughaefen = function (p) {
    var z = A().z, ziel = zielPunkt(), wo = p.wo === 'ziel' && ziel ? 'ziel' : 'hier', meins = ++lauf;
    seite(kopf('Flughäfen') + wechselKnopf('flughaefen', wo, ziel) + '<div class="rollen" id="fliste">' + laedt('Flughäfen werden gesucht …') + '</div>');
    (wo === 'ziel' ? Promise.resolve(ziel) : startpunkt()).then(function (pt) { return FV.V.flughaefen(pt); }).then(function (l) {
      if (meins !== lauf) return;
      z.flughaefen = l; var b = $('#fliste'); if (!b) return;
      b.innerHTML = l.length ? '<h3 class="ueber">' + sym('flug') + 'Flughäfen im Umkreis von 150 km</h3>' + l.map(function (f, i) {
        return '<button class="eintrag flug" data-tun="flughafen" data-i="' + i + '">' + sym('flug') + '<div class="txt"><b>' + h(f.name) + ' <small class="iata">' + h(f.iata) + '</small></b><span>' + G.km(f.weit) + ' entfernt</span></div><div class="ende"><span class="wert" style="font-size:13px">Flüge</span>' + sym('rechts') + '</div></button>';
      }).join('') + '<p class="klein2" style="text-align:center">Flughäfen: OpenStreetMap · Flugtafel: AeroDataBox (über die Verwaltung). Ohne Gewähr.</p>'
        : '<p class="klein2">Im Umkreis von 150 km wurde kein Flughafen gefunden.</p>';
    }).catch(function (e) { var b = $('#fliste'); if (b && meins === lauf) b.innerHTML = '<div class="fehler">Die Kartendienste (OpenStreetMap) antworten gerade nicht. Bitte gleich noch einmal versuchen.' + FV.V.grundHtml(e) + '</div><button class="rand knopf breit" style="margin-top:10px" data-tun="flughaefen-wo" data-wo="' + wo + '">' + sym('neu') + 'Nochmal versuchen</button>'; });
  };
  Tun.flughafen = function (el) { var f = (A().z.flughaefen || [])[+el.getAttribute('data-i')]; if (f) flugBlatt(f, false); };
  var STATUS = { Departed: ['gestartet', 'gut'], EnRoute: ['in der Luft', 'gut'], Arrived: ['gelandet', 'gut'], Approaching: ['im Anflug', 'gut'], Landed: ['gelandet', 'gut'], Boarding: ['Boarding', 'gelb'],
    GateClosed: ['Gate geschlossen', 'gelb'], CheckIn: ['Check-in', 'gelb'], Delayed: ['verspätet', 'rot'], Canceled: ['annulliert', 'rot'], CanceledUncertain: ['annulliert?', 'rot'], Diverted: ['umgeleitet', 'rot'],
    Expected: ['erwartet', ''], Scheduled: ['planmäßig', ''], Unknown: ['', ''] };
  var flugTimer = null;
  function flugBlatt(f, ankunft) {
    A().z.flugWahl = f;
    A().blatt('<h2>' + sym('flug') + '<span>' + h(f.name) + ' <small class="iata">' + h(f.iata) + '</small><br><small style="font-weight:400;font-size:13px">' + G.km(f.weit || 0) + ' entfernt</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<div class="modi" style="padding:0 0 8px"><button data-tun="flug-art" data-a="ab"' + (!ankunft ? ' class="akt"' : '') + '>' + sym('flug') + '<span>Abflüge</span></button><button data-tun="flug-art" data-a="an"' + (ankunft ? ' class="akt"' : '') + '>' + sym('a_ziel') + '<span>Ankünfte</span></button></div>' +
      '<div id="flugtafel" data-iata="' + h(f.iata) + '">' + laedt('Flugtafel wird geladen …') + '</div>' +
      '<div class="zweier"><button class="gold knopf" data-tun="flughafen-hin">' + sym('auto') + 'Hinfahren</button>' + (f.web ? '<button class="rand knopf" data-tun="oeffnen" data-url="' + h(f.web) + '">' + sym('info') + 'Webseite</button>' : '') + '</div>');
    function laden() {
      var t = $('#flugtafel'); if (!t || t.getAttribute('data-iata') !== f.iata) { clearInterval(flugTimer); return; }
      FV.V.flugtafel(f.iata).then(function (d) {
        var t2 = $('#flugtafel'); if (!t2 || t2.getAttribute('data-iata') !== f.iata) return;
        var l = (ankunft ? d.an : d.ab).filter(function (x) { return x.plan && x.plan > Date.now() - 3 * 3600000; }).slice(0, 40);
        if (!l.length) { t2.innerHTML = '<div class="gut">In den nächsten Stunden sind keine ' + (ankunft ? 'Ankünfte' : 'Abflüge') + ' angekündigt.</div>'; return; }
        var pk = 0, sp = 0, au = 0;
        l.forEach(function (x) { if (/Cancel/.test(x.status)) au++; else if (x.verz >= 15) sp++; else pk++; });
        t2.innerHTML = '<div class="tafelsumme"><span class="pk">' + pk + ' pünktlich</span>' + (sp ? '<span class="sp">' + sp + ' verspätet</span>' : '') + (au ? '<span class="au">' + au + ' annulliert</span>' : '') + '<small>Stand ' + h(d.stand || G.uhr()) + ' · alle 5 Min. neu</small></div>' +
          l.map(function (x) {
            var st = STATUS[x.status] || [x.status || '', ''], aus = /Cancel/.test(x.status);
            var zt = aus ? '<em class="spaet">annulliert</em>' : x.verz >= 5 ? '<em class="spaet">+' + x.verz + ' · ' + G.uhr(x.neu) + '</em>' : x.neu ? '<em class="puenktlich">pünktlich</em>' : '<em class="grau2">geplant</em>';
            return '<div class="tz' + (aus ? ' faellt' : '') + '"><div class="tzeit"><b>' + G.uhr(x.plan) + '</b>' + zt + '</div>' +
              '<div class="tinfo"><b><i class="lin">' + h(x.nr) + '</i> ' + (ankunft ? 'von ' : '→ ') + h(x.ort) + '</b><small>' + h([x.airline, st[0] ? '<' + st[1] + '>' : ''].filter(Boolean).join(' · ')).replace(/&lt;(gut|gelb|rot|)&gt;/, function (m0, k) { return '<span class="fstatus ' + k + '">' + h(st[0]) + '</span>'; }) + '</small></div>' +
              '<div class="tgleis"><small>' + (ankunft ? 'Band' : 'Gate') + '</small><b>' + h((ankunft ? x.band : x.gate) || '–') + '</b>' + (x.terminal ? '<s style="text-decoration:none">T' + h(x.terminal) + '</s>' : '') + '</div></div>';
          }).join('');
      }).catch(function (e) {
        var t3 = $('#flugtafel'); if (!t3) return;
        var r = e && e.antwort || {};
        t3.innerHTML = '<div class="fehler">' + (e.unbekannt ? 'Für die Flugtafel braucht die Verwaltung die neue warenwirtschaft.php.' : r.kein_schluessel ? 'Für die Flugtafel trägt das Büro in der Verwaltung (Einstellungen → App) einen kostenlosen AeroDataBox-Schlüssel ein.' : 'Die Flugtafel konnte gerade nicht geladen werden.') + '</div>' +
          (f.web ? '<p class="klein2">Abflüge und Ankünfte stehen auch auf der Webseite des Flughafens.</p>' : '');
        clearInterval(flugTimer);
      });
    }
    clearInterval(flugTimer); flugTimer = setInterval(laden, 300000); laden();
  }
  Tun['flug-art'] = function (el) { var f = A().z.flugWahl; if (f) flugBlatt(f, el.getAttribute('data-a') === 'an'); };
  Tun['flughafen-hin'] = function () { var f = A().z.flugWahl; if (!f) return; A().blattZu(); A().zeige('vorschau', { ziel: { name: 'Flughafen ' + f.name, adresse: f.name, lat: f.lat, lon: f.lon, art: 'frei' }, modus: 'auto' }); };
  Tun.oeffnen = function (el) { B.oeffnen(el.getAttribute('data-url')); };

  /* ====================== Zug: Verbindungen der Deutschen Bahn ====================== */
  function uhrPlan(d, verz) { if (!d) return '–'; return G.uhr(d) + (verz != null && verz >= 1 ? ' <em class="spaet">+' + verz + '</em>' : verz === 0 ? ' <em class="puenktlich">pünktlich</em>' : ''); }
  function zugSeite(p, meins) {
    var z = A().z, ziel = p.ziel;
    z.nav = { ziel: ziel, route: null, von: null, modus: 'zug' };
    seite(kopf('Navigation', '<button class="gold knopf klein" data-tun="neueroute">' + sym('plus') + 'Neue Route</button>') + zielkarte(ziel) + modusLeiste('zug') +
      '<div class="rollen" id="zliste">' + laedt('Zugverbindungen werden gesucht …') + '</div>');
    function fehler(t) {
      var b = $('#zliste'); if (!b || meins !== lauf) return;
      b.innerHTML = '<div class="fehler">' + h(t) + '</div><button class="rand knopf breit" data-tun="db-navigator">' + sym('zug') + 'Im DB Navigator suchen</button>' +
        '<div style="height:8px"></div><button class="rand knopf breit" data-tun="modus" data-m="auto">' + sym('auto') + 'Doch mit dem Auto</button>';
    }
    Promise.all([startpunkt(), ziel.lat != null ? Promise.resolve({ lat: ziel.lat, lon: ziel.lon }) : G.finde(ziel.adresse, B.ort())]).then(function (x) {
      if (meins !== lauf) return;
      z.nav.von = x[0]; z.nav.nach = { lat: x[1].lat, lon: x[1].lon, name: ziel.name };
      return FV.V.zug(x[0], z.nav.nach, ziel.name + (ziel.adresse ? ', ' + adr1(ziel.adresse) : '')).then(function (erg) {
        if (meins !== lauf) return;
        z.zug = erg.liste;
        var b = $('#zliste'); if (!b) return;
        b.innerHTML = '<h3 class="ueber">' + sym('zug') + 'Nächste Verbindungen</h3>' + erg.liste.map(function (f, i) {
          var zuege = f.legs.filter(function (l) { return !l.fuss; }), er = f.erster;
          return '<button class="eintrag zugfahrt' + (f.faellt ? ' faellt' : '') + '" data-tun="zug-wahl" data-i="' + i + '">' + sym('zug') + '<div class="txt">' +
            '<b>' + G.uhr(f.ab) + ' → ' + G.uhr(f.an) + ' <small>' + h(G.minutenKurz(f.dauer)) + ' · ' + (f.umstiege ? f.umstiege + ' Umstieg' + (f.umstiege > 1 ? 'e' : '') : 'direkt') + '</small></b>' +
            '<span class="linien">' + zuege.map(function (l) { return '<i>' + h(l.linie) + '</i>'; }).join(' ') + (f.faellt ? ' <em class="spaet">fällt aus</em>' : f.verz >= 1 ? ' <em class="spaet">+' + f.verz + ' Min.</em>' : '') + '</span>' +
            '<span>ab ' + h(er.von) + (er.gleis ? ' · Gleis ' + h(er.gleis) : '') + ' · ' + G.uhr(er.ab) + '</span></div><div class="ende">' + sym('rechts') + '</div></button>';
        }).join('') + '<p class="klein2" style="text-align:center">Angaben der Deutschen Bahn, mit Verspätungen. Ohne Gewähr.</p>' +
          '<button class="rand knopf breit" data-tun="db-navigator">' + sym('zug') + 'Im DB Navigator öffnen (Ticket)</button>' +
          '<div style="height:8px"></div><div class="zweier"><button class="rand knopf" data-tun="bahnhoefe" data-wo="hier">' + sym('zug') + 'Bahnhöfe hier</button><button class="rand knopf" data-tun="bahnhoefe" data-wo="ziel">' + sym('zug') + 'Bahnhöfe am Ziel</button></div>';
      });
    }).catch(function (e) { fehler(/Keine Zug/.test(e.message || '') ? 'Für diese Strecke wurde keine Zugverbindung gefunden.' : 'Die Zugverbindungen konnten gerade nicht geladen werden. Bitte Internet prüfen oder im DB Navigator suchen.'); });
  }
  Tun['zug-wahl'] = function (el) {
    var z = A().z, f = (z.zug || [])[+el.getAttribute('data-i')]; if (!f) return;
    var html = '<h2>' + sym('zug') + G.uhr(f.ab) + ' → ' + G.uhr(f.an) + '<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><div class="zugweg">';
    f.legs.forEach(function (l) {
      if (l.fuss) { html += '<div class="zl fuss">' + sym('fuss') + '<div><b>Zu Fuß' + (l.meter ? ' · ' + G.meter(l.meter).replace('Jetzt', 'wenige m') : '') + '</b><span>' + (l.ab && l.an ? 'ca. ' + G.minuten((l.an - l.ab) / 1000) + ' · ' : '') + 'bis ' + h(l.nach) + '</span></div></div>'; return; }
      html += '<div class="zl zug' + (l.faellt ? ' faellt' : '') + '">' + sym('zug') + '<div><b>' + h(l.linie) + (l.richtung ? ' <small>Richtung ' + h(l.richtung) + '</small>' : '') + (l.faellt ? ' <em class="spaet">fällt aus</em>' : '') + '</b>' +
        '<span>' + uhrPlan(l.ab, l.abVerz) + ' ab <b>' + h(l.von) + '</b>' + (l.gleis ? ' · Gleis ' + h(l.gleis) : '') + '</span>' +
        '<span>' + uhrPlan(l.an, l.anVerz) + ' an <b>' + h(l.nach) + '</b>' + (l.gleisAn ? ' · Gleis ' + h(l.gleisAn) : '') + '</span>' +
        l.hinweise.map(function (x) { return '<small class="spaet">' + h(x) + '</small>'; }).join('') + '</div></div>';
    });
    html += '</div>';
    var er = f.erster, o = B.ort();
    if (er.vonOrt) {
      var weit = o ? G.abstand(o, er.vonOrt) : 0;
      z.zugStart = { name: er.von, adresse: 'Bahnhof · Abfahrt ' + G.uhr(er.ab) + (er.gleis ? ', Gleis ' + er.gleis : ''), lat: er.vonOrt.lat, lon: er.vonOrt.lon, art: 'frei' };
      var nah = weit <= 3000, km = weit ? '<small>' + G.km(weit) + '</small>' : '';
      html += '<div class="zweier"><button class="gold knopf" data-tun="zum-bahnhof" data-m="' + (nah ? 'fuss' : 'auto') + '">' + sym(nah ? 'fuss' : 'auto') + '<span>' + (nah ? 'Zu Fuß zum Bahnhof' : 'Mit dem Auto zum Bahnhof') + km + '</span></button>' +
        '<button class="rand knopf" data-tun="zum-bahnhof" data-m="rad">' + sym('fahrrad') + '<span>Mit dem Rad' + km + '</span></button></div><div style="height:8px"></div>';
    }
    html += '<button class="rand knopf breit" data-tun="db-navigator">' + sym('zug') + 'Im DB Navigator öffnen (Ticket)</button>';
    A().blatt(html);
  };
  Tun['zum-bahnhof'] = function (el) { var z = A().z; if (!z.zugStart) return; A().blattZu(); A().zeige('vorschau', { ziel: z.zugStart, modus: el.getAttribute('data-m') }); };
  Tun['db-navigator'] = function () {
    var n = A().z.nav, ziel = n && n.ziel || {}, t = ziel.adresse || ziel.name || '';
    var url = 'https://www.bahn.de/buchung/fahrplan/suche#sts=true&zo=' + encodeURIComponent(adr1(t)) + '&kl=2&r=13:16:KLASSENLOS:1&soid=&zoid=&hd=' + encodeURIComponent(new Date().toISOString().slice(0, 16));
    B.appStarten('de.hafas.android.db', url);
  };

  Se.vorschau = function (p) {
    var z = A().z, ziel = p.ziel, meins = ++lauf, modus = p.modus || A().e.modus || 'auto';
    if (!G.MODI[modus]) modus = 'auto';
    if (modus === 'zug') return zugSeite(p, meins);
    var gleich = z.nav && z.nav.route && z.nav.ziel === ziel && z.nav.modus === modus;
    if (!gleich) z.nav = { ziel: ziel, route: null, von: null, modus: modus };
    var msym = G.MODI[modus].sym;
    seite(kopf('Navigation', '<button class="gold knopf klein" data-tun="neueroute">' + sym('plus') + 'Neue Route</button>') + zielkarte(ziel) + modusLeiste(modus) +
      kartenfeld('<div class="kartenmeldung" id="kmeld"><i class="dreh"></i><span>Route wird berechnet …</span></div>' +
        '<div class="zoom"><button data-tun="zoom" data-n="1" aria-label="Größer">' + sym('plus') + '</button><button data-tun="zoom" data-n="-1" aria-label="Kleiner">' + sym('minus') + '</button></div>' +
        '<button class="kartenknopf rund ortung" data-tun="rahmen" aria-label="Ganze Route zeigen">' + sym('ort') + '</button>' + ebenenKnopf()) +
      '<button class="vleiste" id="vleiste" data-tun="verkehr-liste" hidden></button>' +
      '<button class="vleiste zbleiste" id="zbleiste" data-tun="ziel-tafel" hidden></button>' +
      '<div class="fuss" id="vfuss">' + sym(msym) + '<div class="txt"><b>…</b><span>&nbsp;</span></div><button class="gold knopf" data-tun="route-start" disabled>' + sym('navi') + '<span>Route starten</span></button></div>');
    function meldung(t, fehler) { var m = $('#kmeld'); if (!m) return; if (!t) { m.hidden = true; return; } m.hidden = false; m.innerHTML = (fehler ? sym('warnung') : '<i class="dreh"></i>') + '<span>' + h(t) + '</span>'; }
    function fuss(r) {
      var f = $('#vfuss'); if (!f) return;
      var vz = 0; (r.verkehr || []).forEach(function (m) { vz += m.verzoegerung || 0; });
      var an = new Date(Date.now() + (r.dauer + vz) * 1000);
      f.innerHTML = sym(msym) + '<div class="txt"><b>ca. ' + G.minuten(r.dauer + vz) + ' <small>(' + G.km(r.laenge) + ')</small></b><span>' + h(vz >= 60 ? 'davon ' + G.minuten(vz) + ' Stau · ' + (r.ueber || '') : (r.ueber || '')) + '</span></div>' +
        '<button class="gold knopf" data-tun="route-start">' + sym('navi') + '<span>Route starten<small>Ankunft ca. ' + G.uhr(an) + '</small></span></button>';
    }
    function zeichne(r, von, nach) {
      K.route(r); K.auto(null);
      var zielLinks = nach.lon > von.lon;   // Ziel liegt östlich: Schild links vom Ziel, Start-Schild rechts – so ragt nichts aus dem Bild
      K.ziel(nach, '<b>' + h(adr1(ziel.adresse).split(',')[0]) + '</b>' + h((adr1(ziel.adresse).split(',').slice(1).join(',') || '').trim()), zielLinks);
      K.start(von, '<b>' + h(von.name || 'Ihr Standort') + '</b>' + (von.ersatz ? 'Standort nicht gefunden' : ''), !zielLinks);
      K.rahmen(r.punkte, { top: 70, bottom: 50, left: 50, right: 70 });
      var hinw = von.ersatz ? 'Standort noch nicht gefunden – Route ab Lagerhalle.' : nach.ungefaehr ? 'Die Hausnummer wurde nicht gefunden – das Ziel liegt nur ungefähr richtig.' : '';
      fuss(r); meldung(hinw, true); if (hinw) setTimeout(function () { meldung(''); }, 7000);
      verkehrLeiste(r, r.modus === 'auto' && !r.verkehrStand); verkehrKarte(r);
      umgebungKarte([von, nach]);
      if (A().e.bahnhof !== false) zielBahnhofZeigen('zbleiste', nach);
    }
    K.setzen($('#kfeld')).catch(function () { meldung('Die Karte konnte nicht geladen werden.', true); });
    function offlineFuss() { var f = $('#vfuss'); if (f) f.innerHTML = sym('karte') + '<div class="txt"><b>Kein Internet?</b><span>Mit der Offline-Karte weiterfahren</span></div><button class="gold knopf" data-tun="offline-fahren">' + sym('navi') + '<span>Offline-Navi</span></button>'; }
    if (!gleich && navigator.onLine === false) { offlineFuss(); meldung('Kein Internet – mit „Offline-Navi“ geht es ohne Internet weiter.', true); }
    if (gleich) { zeichne(z.nav.route, z.nav.von, z.nav.nach); poisZeigen(z.nav.route); return; }
    K.leeren();
    Promise.all([startpunkt(), ziel.lat != null ? Promise.resolve({ lat: ziel.lat, lon: ziel.lon }) : G.finde(ziel.adresse, B.ort())]).then(function (x) {
      if (meins !== lauf) return;
      var von = x[0], nach = { lat: x[1].lat, lon: x[1].lon, name: ziel.name, ungefaehr: !!x[1].ungefaehr };
      return G.route(von, nach, { modus: modus }).then(function (r) {
        if (meins !== lauf) return;
        z.nav.route = r; z.nav.von = von; z.nav.nach = nach;
        zeichne(r, von, nach);
        G.limits(r); G.pois(r).then(function () { if (meins === lauf || (F.route === r && A().oben() === 'fahrt')) poisZeigen(r); });
        K.wenn(function () { K.vorladen(r); });
        if (modus !== 'auto' || A().e.verkehr === false) return;
        // Verkehrslage prüfen – bei Sperrung, Unfall oder Stau gleich die bessere Route zeigen
        var pr = A().e.umleiten === false ? FV.V.laden(r, 0).then(function (l) { return { meldungen: l, neu: null }; }) : FV.V.pruefen(r, von, nach, 0);
        pr.then(function (erg) {
          if (meins !== lauf || z.nav.route !== r) return;
          if (erg.neu) {
            var nr = erg.neu; nr.umleitung = { grund: erg.grund, spart: erg.spart, mehr: erg.mehr, um: Date.now() };
            z.nav.route = nr; zeichne(nr, von, nach);
            G.limits(nr); G.pois(nr).then(function () { if (meins === lauf) poisZeigen(nr); });
            meldung(FV.V.titel(erg.grund) + (erg.grund.strasse ? ' auf der ' + erg.grund.strasse.split(',')[0] : '') + ' – die Route führt drumherum' + (erg.grund.gesperrt ? '.' : ' und spart etwa ' + FV.V.minSprache(erg.spart) + '.'), true);
            setTimeout(function () { if (meins === lauf) meldung(''); }, 9000);
          } else { r.verkehrStand = r.verkehrStand || Date.now(); fuss(r); verkehrLeiste(r); verkehrKarte(r); }
        }).catch(function () { r.verkehrStand = Date.now(); verkehrLeiste(r); });
      });
    }).catch(function (e) {
      if (meins !== lauf) return;
      meldung(e.message || 'Die Route konnte nicht berechnet werden.', true);
      offlineFuss();
    });
  };
  Se.vorschau_weg = function (nach) { lauf++; if (nach !== 'fahrt') { K.leeren(); } };
  Tun.zoom = function (e) { K.zoom(+e.getAttribute('data-n')); };
  Tun.rahmen = function () { var n = A().z.nav; if (n && n.route) K.rahmen(n.route.punkte, { top: 70, bottom: 50, left: 50, right: 70 }); else { var o = B.ort(); if (o) K.mitte(o); } };
  Tun['route-start'] = function () {
    var z = A().z, n = z.nav; if (!n || !n.route) return;
    var ziel = n.ziel, mitAuto = (n.route.modus || 'auto') === 'auto';
    if (!mitAuto) {   // zu Fuß / Fahrrad: zählt nicht als Autofahrt. Eine Autofahrt bis hierher wird vorher abgeschlossen.
      if (!F.aktiv && (B.zaehler().meter || 0) >= 1000) A().fahrtEnde('ohne Ziel'); else if (!F.aktiv) A().fahrtNeu();
    } else if (ziel.auftrag) {
      if (ziel.phase === 'ankunft') z.letzterAuftrag = ziel.auftrag;
      S.ruf('navi_zeit', { id: ziel.auftrag, phase: ziel.phase || 'ankunft', ziel: ziel.fest || '' }).catch(function () {});
    }
    if (mitAuto) A().fahrtZiel(ziel.name + (ziel.adresse ? ', ' + adr1(ziel.adresse) : ''), ziel.phase === 'ankunft' ? ziel.auftrag : '');
    if (ziel.art === 'frei') zielMerken(ziel, n.nach);
    if (F.aktiv) F.stopp(true);   // eine neue Route löst die laufende ab
    z.lauf = n; z.reiter = 'karte';
    A().zeige('fahrt', {}, 'ersetzen'); A().stapel = A().stapel.slice(-1);
    if (S.demo) { F.probefahrt(70); A().toast('Probefahrt: Die Demo fährt die Strecke von selbst ab.', 5000); }
  };

  /* ====================== Zielführung ====================== */
  var uhrTimer = null;
  Se.fahrt = function () {
    var z = A().z, n = z.lauf, e = A().e; if (!n || !n.route) { A().stapel = []; A().zeige('auftraege', {}, 'reiter'); return; }
    // Kein Zurück-Pfeil: Aus der Zielführung führt nur das X (mit Rückfrage). Andere Seiten bleiben über die Leiste unten erreichbar.
    seite('<div class="zeile"><button class="xknopf" data-tun="fahrt-ende" aria-label="Navigation beenden">' + sym('zu') + '</button><h1>Route</h1><button class="rand knopf klein" data-tun="fahrt-ueber">' + sym('karte') + 'Übersicht</button></div>' +
      kartenfeld('<div class="abbiegen" id="abb">' + sym('a_gerade') + '<div class="txt"><b>…</b><span>Position wird gesucht</span></div></div>' +
        '<button class="fahrknopf xknopf xvoll" data-tun="fahrt-ende" aria-label="Navigation beenden">' + sym('zu') + '</button>' +
        '<button class="vchip" id="vchip" data-tun="verkehr-liste" hidden></button>' +
        '<button class="vchip zbchip" id="zbchip" data-tun="ziel-tafel" hidden></button>' +
        '<button class="fahrknopf kartenknopf dunkel rund auswahl" data-tun="fahrt-auswahl" id="auswknopf">' + sym('ebenen') + '<span id="wcweit"></span></button>' +
        '<div class="auswahlfeld" id="auswfeld" hidden></div>' +
        '<button class="fahrknopf kartenknopf dunkel rund info" data-tun="fahrt-info" aria-label="Uhrzeit und Ankunft">' + sym('auto') + '</button>' +
        '<div class="fahrinfo" id="finfo" hidden><div class="werte"><div><b id="fuhr">–</b><span>Uhrzeit</span></div><div><b id="fan">–</b><span>Ankunft</span></div><div><b id="fkm">–</b><span>Rest</span></div><div><b id="fmin">–</b><span>Dauer</span></div></div>' +
        '<button class="rotk knopf" data-tun="fahrt-ende">' + sym('zu') + 'Navigation beenden</button></div>' +
        '<div class="schild" id="schild" hidden><div class="limit" id="limit"></div><div class="tempo"><b id="tempo">0</b><span>km/h</span></div></div>' +
        '<button class="fahrknopf kartenknopf dunkel rund vollb" data-tun="fahrt-voll" id="vollknopf" aria-label="Vollbild">' + sym(document.body.classList.contains('vollbild') ? 'vollzu' : 'voll') + '</button>' +
        '<button class="fahrknopf kartenknopf dunkel rund mitte" data-tun="fahrt-mitte" id="mitteknopf" aria-label="Auf das Auto zentrieren" hidden>' + sym('ort') + '</button>'));
    auswahlZeichnen();
    F.sicht(true);
    K.setzen($('#kfeld')).then(function () {
      if (A().oben() !== 'fahrt') return;
      K.start(null); K.route(F.route || n.route); if (!K.hat('ziel')) K.ziel(n.nach); poisZeigen(F.route || n.route); verkehrKarte(F.route || n.route);
      var o0 = B.ort(); bfAuf.um = o0; umgebungKarte([o0, n.nach]);
      if (A().e.bahnhof !== false && n.nach) zielBahnhofZeigen('zbchip', n.nach);
      F.sicht(true);   // nach der Rückkehr von einer anderen Seite: Auto und Kartenausschnitt sofort wieder richtig
    });
    function stand(s) {
      var a = $('#abb'); if (!a) return;
      a.innerHTML = sym(s.schritt.art) + '<div class="txt"><b>' + (s.rechnet ? '…' : G.meter(s.bis)) + '</b><span>' + h(s.rechnet ? 'Route wird neu berechnet' : s.aufRoute ? s.schritt.text : 'Zurück zur Route') + '</span></div>';
      var sch = $('#schild'); sch.hidden = false;
      $('#limit').textContent = s.limit || ''; $('#limit').style.visibility = s.limit ? 'visible' : 'hidden';
      $('#tempo').textContent = s.kmh; sch.classList.toggle('zuschnell', !!s.limit && s.kmh > s.limit + 5);
      $('#fan').textContent = G.uhr(s.ankunft); $('#fkm').textContent = G.km(s.restM); $('#fmin').textContent = G.minutenKurz(s.restS); $('#fuhr').textContent = G.uhr();
      $('#wcweit').textContent = (e.wc !== false && s.wcIn >= 0) ? 'WC ' + G.km(s.wcIn) : '';
      var oj = B.ort(); if (oj && (!bfAuf.um || G.abstand(bfAuf.um, oj) > 8000)) { bfAuf.um = oj; umgebungKarte([oj, n.nach]); }
      var vc = $('#vchip'), V = FV.V;
      if (vc) {
        var v = s.verkehr, u = F.route && F.route.umleitung, frisch = u && Date.now() - u.um < 180000;
        if (frisch) { vc.className = 'vchip umleitung'; vc.innerHTML = sym('umleitung') + '<span>Umleitung · ' + h(V.titel(u.grund)) + '</span>'; vc.hidden = false; }
        else if (v && v.in < 30000) { vc.className = 'vchip ' + V.klasse(v.m); vc.innerHTML = sym(v.m.art === 'baustelle' || v.m.art === 'spur' ? 'baustelle' : 'warnung') + '<span>' + h(V.titel(v.m)) + ' ' + (v.in > 30 ? 'in ' + G.km(v.in) : 'hier') + (v.m.verzoegerung >= 60 ? ' · ' + h(V.verzText(v.m.verzoegerung)) : '') + '</span>'; vc.hidden = false; }
        else vc.hidden = true;
      }
    }
    if (!F.aktiv) {
      F.start(n.route, n.nach, { beiStand: stand, beiPois: function () { if (A().oben() === 'fahrt') poisZeigen(F.route); }, beiNeu: function (r) { n.route = r; if (A().oben() === 'fahrt') verkehrKarte(r); },
        beiVerkehr: function () { if (A().oben() === 'fahrt') verkehrKarte(F.route); },
        beiUmleitung: function (u) { A().toast('Umleitung: ' + FV.V.sprache(u.grund) + (u.grund.gesperrt ? ' (gesperrt)' : ' · spart ' + G.minuten(u.spart)), 6000); },
        beiFolgen: function (an) { var k = $('#mitteknopf'); if (k) k.hidden = an; }, beiZiel: angekommen });
    }
    clearInterval(uhrTimer); uhrTimer = setInterval(function () { var u = $('#fuhr'); if (u) u.textContent = G.uhr(); else clearInterval(uhrTimer); }, 15000);
    if (F.stand) stand(F.stand);
  };
  function auswahlZeichnen() {
    var e = A().e, f = $('#auswfeld'); if (!f) return;
    f.innerHTML = '<button data-tun="fahrt-schalter" data-k="wc" class="' + (e.wc !== false ? 'an' : '') + '">' + sym('wc') + 'Parkplätze mit WC<i></i></button>' +
      '<button data-tun="fahrt-schalter" data-k="laden" class="' + (e.laden !== false ? 'an' : '') + '">' + sym('laden') + 'E-Ladesäulen<i></i></button>' +
      '<button data-tun="fahrt-schalter" data-k="essen" class="' + (e.essen !== false ? 'an' : '') + '">' + sym('kaffee') + 'Bäcker und Café<i></i></button>' +
      '<button data-tun="fahrt-schalter" data-k="tanken" class="' + (e.tanken !== false ? 'an' : '') + '">' + sym('tanken') + 'Tankstellen (Diesel)<i></i></button>' +
      '<button data-tun="fahrt-schalter" data-k="bahnhof" class="' + (e.bahnhof !== false ? 'an' : '') + '">' + sym('zug') + 'Bahnhöfe<i></i></button>' +
      '<button data-tun="fahrt-schalter" data-k="apotheke" class="' + (e.apotheke !== false ? 'an' : '') + '">' + sym('apotheke') + 'Apotheken<i></i></button>' +
      '<button data-tun="fahrt-schalter" data-k="arzt" class="' + (e.arzt !== false ? 'an' : '') + '">' + sym('arzt') + 'Ärzte<i></i></button>' +
      '<button data-tun="fahrt-schalter" data-k="flughafen" class="' + (e.flughafen !== false ? 'an' : '') + '">' + sym('flug') + 'Flughäfen<i></i></button>' +
      '<button data-tun="fahrt-schalter" data-k="ansage" class="' + (e.ansage !== false ? 'an' : '') + '">' + sym('ton') + 'Sprachansage<i></i></button>';
  }
  Tun['fahrt-auswahl'] = function () { var f = $('#auswfeld'); f.hidden = !f.hidden; };
  Tun['fahrt-schalter'] = function (el) { var k = el.getAttribute('data-k'), e = A().e; e[k] = e[k] === false; A().speichern(); auswahlZeichnen(); if (k === 'ansage' && e.ansage === false) B.still(); if (F.route) poisZeigen(F.route); if (k === 'bahnhof' || k === 'apotheke' || k === 'arzt' || k === 'flughafen') ebeneNeu(k); if (F.stand && $('#wcweit')) $('#wcweit').textContent = (e.wc !== false && F.stand.wcIn >= 0) ? 'WC ' + G.km(F.stand.wcIn) : ''; };
  Tun['fahrt-info'] = function () { var f = $('#finfo'); f.hidden = !f.hidden; if (!f.hidden) $('#fuhr').textContent = G.uhr(); };
  Tun['fahrt-voll'] = function () { A().vollbild(!document.body.classList.contains('vollbild')); };
  Tun['fahrt-mitte'] = function () { F.zentrieren(); };
  Tun['fahrt-ueber'] = function () { F.uebersicht(); };
  Tun['fahrt-ende'] = function () { A().frage('Navigation beenden?', 'Ja', 'Nein').then(function (ja) { if (ja) fahrtBeenden(); }); };
  function fahrtBeenden() {
    var z = A().z;
    if (z.lauf && z.lauf.route && z.lauf.route.modus && z.lauf.route.modus !== 'auto') A().fahrtNeu();   // Fußweg/Radfahrt zählt nicht als Autofahrt
    F.stopp(); clearInterval(uhrTimer); A().vollbild(false); K.leeren(); if (z.nav === z.lauf) z.nav = null; z.lauf = null;
    A().naviAus();
    A().stapel = []; A().zeige('auftraege', {}, 'reiter'); A().ladeAuftraege();
  }
  /* Die Fahrt-Seite wird verlassen (Lager, Aufträge, Einstellungen …): Die Zielführung läuft weiter, nur die Karte ruht. */
  Se.fahrt_weg = function () { F.sicht(false); clearInterval(uhrTimer); };
  function angekommen() {
    var z = A().z, ziel = z.lauf && z.lauf.ziel || {}, mitAuto = !(z.lauf && z.lauf.route && z.lauf.route.modus && z.lauf.route.modus !== 'auto');
    var km = mitAuto ? A().fahrtEnde(ziel.name) : (A().fahrtNeu(), 0);
    clearInterval(uhrTimer); if (z.nav === z.lauf) z.nav = null; z.lauf = null; A().naviAus();
    if (A().oben() === 'fahrt') { A().vollbild(false); K.leeren(); A().stapel = []; A().zeige('auftraege', {}, 'reiter'); A().ladeAuftraege(); }
    // Ist der Fahrer gerade auf einer anderen Seite, bleibt er dort und sieht nur die Meldung.
    A().blatt('<h2>' + sym('a_ziel') + 'Ziel erreicht<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><div class="block creme"><b style="font-size:19px">' + h(ziel.name || 'Ziel') + '</b><div>' + adr2(ziel.adresse) + '</div></div>' +
      (km ? '<div class="gut">Fahrt ins Fahrtenbuch geschrieben: ' + String(km).replace('.', ',') + ' km.</div>' : '') +
      (ziel.auftrag && ziel.phase === 'ankunft' ? '<div class="zweier"><button class="rand knopf" data-tun="ziel-fest" data-z="lagerhalle" data-id="' + h(ziel.auftrag) + '">Zur Lagerhalle</button><button class="rand knopf" data-tun="ziel-fest" data-z="verwaltung" data-id="' + h(ziel.auftrag) + '">Zur Verwaltung</button></div><div style="height:8px"></div>' : '') +
      '<button class="gold knopf breit" data-tun="blatt-zu">Fertig</button>');
  }

  /* ====================== Neue Route (freies Ziel) ====================== */
  function zielMerken(ziel, ort) {
    var l = B.lesen('letzte', []) || [];
    l = l.filter(function (x) { return x.adresse !== ziel.adresse || x.name !== ziel.name; });
    l.unshift({ name: ziel.name, adresse: ziel.adresse, lat: ort.lat, lon: ort.lon }); B.schreiben('letzte', l.slice(0, 12));
  }
  Tun.neueroute = function () { A().zeige('neueroute'); };
  Se.neueroute = function () {
    var z = A().z, e = A().e, letzte = B.lesen('letzte', []) || [], lh = z.ziele.lagerhalle || {};
    seite(kopf('Neue Route') + '<div class="rollen"><div class="block creme"><h2>' + sym('pin') + '<span>Zieladresse eingeben<br><small style="font-weight:400;font-size:13px">Straße, Ort, Firma oder Ortsteil</small></span></h2>' +
      '<form data-form="ziel-suchen"><div class="suchfeld">' + sym('suche') + '<input id="zsuche" placeholder="z. B. Hauptstraße 12, 26842 Ostrhauderfehn" autocomplete="off" enterkeyhint="search"><button type="button" data-tun="zsuche-leer" aria-label="Leeren">' + sym('zu') + '</button></div>' +
      '<div class="chips"><button type="button" class="chip" data-tun="ziel-zuhause">' + sym('haus') + 'Zuhause</button><button type="button" class="chip" data-tun="ziel-fest" data-z="lagerhalle">' + sym('firma') + '<span>Lagerhalle<small>' + h(adr1(lh.adresse || '').split(',')[0]) + '</small></span></button>' +
      '<button type="button" class="chip" data-tun="ziel-fest" data-z="verwaltung">' + sym('firma') + '<span>Verwaltung</span></button></div>' +
      '<div class="chips"><button type="button" class="chip" data-tun="bahnhoefe">' + sym('zug') + '<span>Bahnhöfe<small>Abfahrten live</small></span></button>' +
      '<button type="button" class="chip" data-tun="apotheken">' + sym('apotheke') + '<span>Apotheken<small>mit Notdienst</small></span></button></div>' +
      '<div class="chips"><button type="button" class="chip" data-tun="aerzte">' + sym('arzt') + '<span>Ärzte<small>mit Notdienst</small></span></button>' +
      '<button type="button" class="chip" data-tun="flughaefen">' + sym('flug') + '<span>Flughäfen<small>Flüge live</small></span></button></div>' +
      '<button class="gold knopf breit gross">' + sym((G.MODI[e.modus] || G.MODI.auto).sym) + 'Route berechnen</button></form></div>' +
      '<div id="ztreffer"></div><h3 class="ueber">' + sym('uhr') + 'Letzte Ziele</h3>' +
      (letzte.length ? letzte.map(function (x, i) { return '<button class="eintrag" data-tun="ziel-letztes" data-i="' + i + '">' + sym('pin') + '<div class="txt"><b>' + h(x.name) + '</b><span>' + h(x.adresse) + '</span></div><div class="ende">' + sym('rechts') + '</div></button>'; }).join('') : '<p class="klein2" style="padding:0 4px">Noch keine Ziele gefahren.</p>') + '</div>');
  };
  Tun['zsuche-leer'] = function () { var i = $('#zsuche'); i.value = ''; i.focus(); $('#ztreffer').innerHTML = ''; };
  Tun['ziel-suchen'] = function () {
    var t = $('#zsuche').value.trim(), box = $('#ztreffer'); if (!t) { A().toast('Bitte ein Ziel eintippen.'); return; }
    box.innerHTML = laedt('Suche …');
    G.suche(t, B.ort()).then(function (l) {
      A().z.treffer = l;
      if (!l.length) { box.innerHTML = '<div class="fehler">Dazu wurde nichts gefunden. Bitte genauer eintippen, zum Beispiel mit Ort.</div>'; return; }
      if (l.length === 1) { freiesZiel(l[0]); return; }
      box.innerHTML = '<h3 class="ueber">' + sym('suche') + 'Gefunden</h3>' + l.map(function (x, i) { return '<button class="eintrag" data-tun="ziel-treffer" data-i="' + i + '">' + sym('pin') + '<div class="txt"><b>' + h(x.name) + '</b><span>' + h(x.adresse) + '</span></div><div class="ende">' + sym('rechts') + '</div></button>'; }).join('');
    }).catch(function () { box.innerHTML = '<div class="fehler">Die Suche hat nicht geklappt. Bitte Internet prüfen.</div>'; });
  };
  function freiesZiel(x) { A().zeige('vorschau', { ziel: { name: x.name, adresse: x.adresse || x.name, lat: x.lat, lon: x.lon, art: 'frei' } }, 'ersetzen'); }
  Tun['ziel-treffer'] = function (e) { var x = (A().z.treffer || [])[+e.getAttribute('data-i')]; if (x) freiesZiel(x); };
  Tun['ziel-letztes'] = function (e) { var x = (B.lesen('letzte', []) || [])[+e.getAttribute('data-i')]; if (x) freiesZiel(x); };
  Tun['ziel-zuhause'] = function () {
    var a = A().e.zuhause; if (!a) { A().toast('Die Adresse „Zuhause“ zuerst in den Einstellungen eintragen.', 4500); return; }
    A().zeige('vorschau', { ziel: { name: 'Zuhause', adresse: a, art: 'frei' } }, 'ersetzen');
  };

  /* ====================== Alle Aufträge des Tages auf der Karte ====================== */
  Tun.uebersicht = function () { A().zeige('uebersicht'); };
  Se.uebersicht = function (p) {
    var z = A().z, tag = p && p.tag || z.tag, liste = A().tagesliste(tag), meins = ++lauf;
    seite(kopf('Aufträge ' + datumKurz(tag), '<button class="rand knopf klein" data-tun="umgebung">' + sym('umgebung') + 'In der Nähe</button>') + kartenfeld('<div class="kartenmeldung" id="kmeld"><i class="dreh"></i><span>Adressen werden gesucht …</span></div>' +
      '<div class="zoom"><button data-tun="zoom" data-n="1">' + sym('plus') + '</button><button data-tun="zoom" data-n="-1">' + sym('minus') + '</button></div>' + ebenenKnopf()));
    K.setzen($('#kfeld')).then(function () { K.leeren(); var o = B.ort(); if (o) umgebungKarte([o]); });
    if (!liste.length) {
      $('#kmeld').innerHTML = sym('info') + '<span>An diesem Tag gibt es keine Aufträge.</span>';
      K.wenn(function () { var o = B.ort(); if (meins === lauf && o) { K.start(o); K.mitte(o, 13); } });
      return;
    }
    var punkte = [], kette = Promise.resolve();
    function zeigen() {   // jede gefundene Adresse erscheint sofort, die Karte zieht den Ausschnitt nach
      if (meins !== lauf) return;
      K.wenn(function () {
        if (meins !== lauf) return;
        K.nummern(punkte, function (p) { Tun.auftrag({ getAttribute: function () { return p.id; } }); });
        var pts = punkte.map(function (p) { return [p.lon, p.lat]; }), o = B.ort(); if (o) { pts.push([o.lon, o.lat]); K.start(o); }
        K.rahmen(pts, { top: 70, bottom: 60, left: 50, right: 60 });
      });
    }
    liste.forEach(function (a, i) {
      kette = kette.then(function () {
        if (meins !== lauf) return;
        var m = $('#kmeld'); if (m) m.innerHTML = '<i class="dreh"></i><span>Adresse ' + (i + 1) + ' von ' + liste.length + ' wird gesucht …</span>';
        return G.finde(a.adresse, B.ort()).then(function (c) { punkte.push({ nr: i + 1, lat: c.lat, lon: c.lon, id: a.id }); zeigen(); }).catch(function () {});
      });
    });
    kette.then(function () {
      if (meins !== lauf) return;
      var m = $('#kmeld'); if (m) { if (punkte.length === liste.length) m.hidden = true; else m.innerHTML = sym('warnung') + '<span>' + (punkte.length ? (liste.length - punkte.length) + ' Adresse(n) wurden nicht gefunden.' : 'Die Adressen wurden nicht gefunden.') + '</span>'; }
    });
  };
  Se.uebersicht_weg = function () { lauf++; K.leeren(); };

  /* ====================== Lager: wer ist eingestempelt ====================== */
  Se.lager = function () {
    var meins = ++lauf;
    seite(kopf('Lager', '<button class="gold knopf klein" data-tun="lagerapp">' + sym('extern') + 'Lager-App</button>', false) + '<div class="rollen" id="lgr">' + laedt('Lade …') + '</div>');
    S.ruf('navi_anwesend').catch(function (e) { if (e.unbekannt) return S.ruf('halle'); throw e; }).then(function (r) {
      if (meins !== lauf || A().z.reiter !== 'lager') return;
      var l = r.anwesend || [];
      $('#lgr').innerHTML = '<h3 class="ueber">' + sym('leute') + 'Jetzt eingestempelt (' + l.length + ')</h3>' +
        (l.length ? l.map(function (x) {
          return '<div class="eintrag"><i class="punkt"></i><div class="txt"><b>' + h(x.name) + (x.gast ? ' (Gast)' : '') + '</b><span>seit ' + h(x.seit) + (x.dauer ? ' · ' + h(x.dauer) + ' Std.' : '') + '</span>' +
            (x.adresse ? '<span>' + h(adr1(x.adresse)) + '</span>' : '') + (x.tel ? '<span>' + h(x.tel) + '</span>' : '') + '</div>' +
            (x.tel ? '<div class="ende"><button class="rund tel" data-tun="anrufen" data-tel="' + h(x.tel) + '" aria-label="Anrufen">' + sym('telefon') + '</button></div>' : '') + '</div>';
        }).join('') : '<div class="leer"><b>Niemand eingestempelt</b>Im Lager ist gerade niemand angemeldet.</div>') +
        '<div class="hinweis">Adresse und Telefon trägt die Verwaltung unter „Zeiten → Mitarbeiter“ ein.</div>';
    }).catch(function (e) { if (meins === lauf && !e.stop && $('#lgr')) $('#lgr').innerHTML = '<div class="fehler">' + h(e.message) + '</div>'; });
  };
  Tun.lagerapp = function () { B.appStarten('de.fehnverleih.lager', S.url.replace(/\?.*$/, '') + 'lager-app/'); };

  /* ====================== Wetter ====================== */
  var wMerker = {};
  function wetterFuer(lat, lon) {
    var k = lat.toFixed(1) + ',' + lon.toFixed(1), m = wMerker[k];
    if (m && Date.now() - m.t < 20 * 60000) return Promise.resolve(m.w);
    return G.wetter(lat, lon).then(function (w) { wMerker[k] = { t: Date.now(), w: w }; return w; });
  }
  function boeText(b) { return b >= 60 ? '<span class="wind-warn">Böen ' + Math.round(b) + ' km/h – Zelte sichern!</span>' : b >= 45 ? '<span class="wind-warn">Böen ' + Math.round(b) + ' km/h</span>' : 'Böen ' + Math.round(b || 0) + ' km/h'; }
  function grad(t) { return Math.round(t) + '°'; }
  Se.wetter = function () {
    var meins = ++lauf, z = A().z;
    seite(kopf('Wetter', '<button class="rand kasten" data-tun="reiter" data-r="wetter" aria-label="Neu laden">' + sym('neu') + '</button>', false) + '<div class="rollen" id="wtr">' + laedt('Lade Wetter …') + '</div>');
    var o = B.ort(), lh = z.ziele.lagerhalle;
    var wo = o ? Promise.resolve({ lat: o.lat, lon: o.lon, name: 'Ihr Standort' }) : (lh && lh.adresse ? G.finde(lh.adresse).then(function (c) { return { lat: c.lat, lon: c.lon, name: 'Lagerhalle' }; }) : Promise.resolve({ lat: 53.22, lon: 7.75, name: 'Augustfehn' }));
    wo.then(function (ort) {
      return wetterFuer(ort.lat, ort.lon).then(function (w) {
        if (meins !== lauf || !$('#wtr')) return;
        var j = w.jetzt || {}, jetzt = Date.now();
        var st = w.stunden.filter(function (s) { return s.zeit.getTime() >= jetzt - 1800000; }).slice(0, 14);
        var maxBoe = Math.max.apply(null, st.map(function (s) { return s.boe || 0; }).concat([0]));
        var html = '<div class="block goldr"><h2>' + sym('pin') + h(ort.name) + '</h2><div class="wetter-jetzt">' + sym(G.wetterSym(j.bild)) + '<div><b>' + (j.temp != null ? grad(j.temp) : '–') + '</b><span>' + h(G.wetterText(j.bild)) + '</span></div></div>' +
          '<div class="wetter-werte"><div>' + sym('wind') + '<b>' + Math.round(j.wind || 0) + '</b><span>Wind km/h</span></div><div>' + sym('blitz') + '<b>' + Math.round(j.boe || 0) + '</b><span>Böen km/h</span></div><div>' + sym('tropfen') + '<b>' + String(Math.round((j.regen || 0) * 10) / 10).replace('.', ',') + '</b><span>Regen mm/h</span></div></div>' +
          (maxBoe >= 45 ? '<div class="fehler" style="margin:10px 0 0">' + sym('warnung') + ' In den nächsten Stunden Böen bis ' + Math.round(maxBoe) + ' km/h.' + (maxBoe >= 60 ? ' Zelte und Pavillons sichern oder abbauen.' : ' Beim Aufbau auf die Abspannung achten.') + '</div>' : '') + '</div>' +
          '<div class="block"><h2>' + sym('uhr') + 'Nächste Stunden</h2><div class="stunden">' + st.map(function (s) {
            return '<div><span>' + ('0' + s.zeit.getHours()).slice(-2) + ' Uhr</span>' + sym(G.wetterSym(s.bild)) + '<b>' + grad(s.temp) + '</b><span class="' + (s.regen >= 0.1 ? 'nass' : '') + '">' + (s.regen >= 0.1 ? String(Math.round(s.regen * 10) / 10).replace('.', ',') + ' mm' : (s.wahrsch != null ? s.wahrsch + ' %' : '–')) + '</span><span' + ((s.boe || 0) >= 45 ? ' class="wind-warn"' : '') + '>' + Math.round(s.boe || s.wind || 0) + '</span></div>';
          }).join('') + '</div><p class="klein2" style="margin:8px 0 0">Untere Zahl: Böen in km/h.</p></div>' +
          '<div class="block"><h2>' + sym('kalender') + 'Nächste Tage</h2>' + w.tage.slice(0, 6).map(function (t, i) {
            var d = new Date(t.datum + 'T12:00:00');
            return '<div class="tagzeile"><b>' + (i === 0 ? 'Heute' : TAGE[d.getDay()]) + '</b>' + sym(G.wetterSym(t.bild)) + '<span class="t">' + h(G.wetterText(t.bild)) + ' · ' + boeText(t.boe) + (t.regen >= 0.3 ? ' · ' + String(Math.round(t.regen * 10) / 10).replace('.', ',') + ' mm' : '') + '</span><span class="temp">' + grad(t.max) + ' <small>' + grad(t.min) + '</small></span></div>';
          }).join('') + '</div><div id="wauftr"></div><div class="hinweis">Daten: Deutscher Wetterdienst (über Bright Sky)</div>';
        $('#wtr').innerHTML = html;
        auftragsWetter(meins);
      });
    }).catch(function () { if (meins === lauf && $('#wtr')) $('#wtr').innerHTML = '<div class="fehler">Das Wetter konnte nicht geladen werden. Bitte Internet prüfen.</div>'; });
  };
  function auftragsWetter(meins) {
    var liste = A().tagesliste(A().heute()).slice(0, 5), zeilen = [], kette = Promise.resolve();
    if (!liste.length) return;
    liste.forEach(function (a) {
      kette = kette.then(function () {
        return G.finde(a.adresse, B.ort()).then(function (c) { return wetterFuer(c.lat, c.lon); }).then(function (w) {
          var ziel = new Date(); if (a.zeit) { ziel.setHours(+a.zeit.slice(0, 2), +a.zeit.slice(3, 5), 0, 0); }
          var s = w.stunden.slice().sort(function (x, y) { return Math.abs(x.zeit - ziel) - Math.abs(y.zeit - ziel); })[0]; if (!s) return;
          zeilen.push('<div class="tagzeile"><b>' + h(a.zeit || '–:–') + '</b>' + sym(G.wetterSym(s.bild)) + '<span class="t"><span style="color:#fff">' + h(a.kunde) + '</span> · ' + boeText(s.boe) + (s.regen >= 0.1 ? ' · Regen' : '') + '</span><span class="temp">' + grad(s.temp) + '</span></div>');
        }).catch(function () {});
      });
    });
    kette.then(function () { var b = $('#wauftr'); if (meins === lauf && b && zeilen.length) b.innerHTML = '<div class="block"><h2>' + sym('lkw') + 'Bei den Aufträgen heute</h2>' + zeilen.join('') + '</div>'; });
  }

  /* ====================== Fahrzeuge: Fahrtenbuch und Tanken ====================== */
  Se.fahrzeuge = function () {
    var meins = ++lauf, e = A().e, f = B.lesen('fahrt', null) || {}, m = B.zaehler().meter || 0;
    seite(kopf('Fahrzeuge', '', false) + '<div class="rollen"><div class="block goldr"><h2>' + sym('auto') + 'Mein Fahrzeug</h2><div id="fzwahl">' + laedt('Lade …') + '</div></div>' +
      '<div class="block"><h2>' + sym('tempo') + 'Laufende Fahrt</h2><div class="eintrag" style="margin:0"><div class="txt"><b>' + (f.ziel ? h(f.ziel.split(',')[0]) : 'Noch ohne Ziel') + '</b><span>gestartet ' + (f.start ? G.uhr(new Date(f.start)) + ' Uhr' : '–') + '</span></div><div class="wert" id="fzkm">' + G.km(m) + '</div></div>' +
      '<div style="height:8px"></div><button class="rand knopf breit" data-tun="fahrt-abschliessen">' + sym('haken') + 'Fahrt jetzt abschließen</button>' +
      '<p class="klein2" style="margin:8px 0 0">Die Kilometer zählen ab dem Start der App und werden bei „Ziel erreicht“ von selbst ins Fahrtenbuch geschrieben.</p></div>' +
      '<button class="gold knopf breit gross" data-tun="tanken">' + sym('tanken') + 'Tanken: Quittung fotografieren</button>' +
      (S.wartend() ? '<div class="hinweis">' + S.wartend() + ' Einträge warten auf Übertragung.</div>' : '') +
      '<h3 class="ueber">' + sym('buch') + 'Fahrtenbuch</h3><div id="fbuch">' + laedt('Lade Fahrtenbuch …') + '</div></div>');
    S.ruf('fahrzeuge').then(function (r) { return r.fahrzeuge || []; }).catch(function (x) { if (x.stop) throw x; return null; }).then(function (l) {
      var box = $('#fzwahl'); if (meins !== lauf || !box) return;
      if (l === null) { box.innerHTML = '<label class="feld">Fahrzeug (Name oder Kennzeichen)<input class="eingabe" id="fzname" value="' + h(e.fahrzeugName) + '" placeholder="z. B. Dacia Spring"></label><button class="rand knopf breit" data-tun="fz-name">Speichern</button>'; return; }
      A().z.fahrzeuge = l;
      if (l.length === 1 && !e.fahrzeug) { e.fahrzeug = l[0].id; e.fahrzeugName = l[0].name; A().speichern(); }
      box.innerHTML = l.length ? l.map(function (x) { return '<button class="schalter' + (x.id === e.fahrzeug ? ' an' : '') + '" data-tun="fz-wahl" data-id="' + h(x.id) + '">' + sym('auto') + '<span>' + h(x.name) + (x.kennzeichen ? '<small>' + h(x.kennzeichen) + '</small>' : '') + '</span><i></i></button>'; }).join('')
        : '<p class="klein2" style="margin:0">In der Verwaltung sind noch keine Fahrzeuge angelegt (Menü „Fahrzeuge“).</p>';
    }).catch(function () {});
    S.ruf('fahrtenbuch_liste').then(function (r) {
      var box = $('#fbuch'); if (meins !== lauf || !box) return;
      var l = (r.fahrten || []).slice(0, 40);
      box.innerHTML = l.length ? l.map(function (x) {
        return '<div class="eintrag">' + sym(x.getankt ? 'tanken' : 'route') + '<div class="txt"><b>' + h(x.ziel || 'Fahrt') + '</b><span>' + h(x.start) + (x.ende ? ' – ' + h(String(x.ende).slice(-5)) : ' · läuft') + ' · ' + h(x.fahrer) + (x.fahrzeug ? ' · ' + h(x.fahrzeug) : '') + '</span></div><div class="wert">' + h(x.km_text || '') + '</div></div>';
      }).join('') : '<div class="leer"><b>Noch keine Fahrten</b>Die erste Fahrt erscheint hier nach „Ziel erreicht“.</div>';
    }).catch(function (x) { var box = $('#fbuch'); if (meins === lauf && box && !x.stop) box.innerHTML = '<div class="fehler">' + h(x.message) + '</div>'; });
  };
  Tun['fz-wahl'] = function (el) { var e = A().e, id = el.getAttribute('data-id'), x = (A().z.fahrzeuge || []).filter(function (v) { return v.id === id; })[0]; if (!x) return; e.fahrzeug = x.id; e.fahrzeugName = x.name; A().speichern(); A().neu(); };
  Tun['fz-name'] = function () { var e = A().e; e.fahrzeugName = $('#fzname').value.trim(); e.fahrzeug = ''; A().speichern(); A().toast('Gespeichert.'); };
  Tun['fahrt-abschliessen'] = function () {
    var m = B.zaehler().meter || 0; if (m < 200) { A().toast('Es wurden noch keine Kilometer gefahren.'); return; }
    A().frage('Die laufende Fahrt mit ' + G.km(m) + ' jetzt ins Fahrtenbuch schreiben?', 'Speichern').then(function (ja) { if (!ja) return; A().fahrtEnde('ohne Ziel'); A().toast('Fahrt gespeichert.'); setTimeout(function () { A().neu(); }, 800); });
  };
  Tun.tanken = function () {
    B.foto().then(function (bild) {
      if (!bild) return;
      A().z.tank = { bild: bild };
      A().blatt('<h2>' + sym('tanken') + 'Tankquittung<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><img class="belegbild" src="data:image/jpeg;base64,' + bild + '" alt="Quittung">' +
        '<form data-form="tank-senden"><div class="zweier"><label class="feld">Betrag in € *<input class="eingabe" name="betrag" inputmode="decimal" placeholder="z. B. 48,90"></label><label class="feld">Liter / kWh<input class="eingabe" name="liter" inputmode="decimal" placeholder="z. B. 31,5"></label></div>' +
        '<label class="feld">Kilometerstand (freiwillig)<input class="eingabe" name="km" inputmode="numeric"></label>' +
        '<div class="wahl" id="tzahl"><button type="button" data-tun="tank-zahl" data-a="karte" class="akt">Karte</button><button type="button" data-tun="tank-zahl" data-a="bar">Bar</button></div><div style="height:12px"></div>' +
        '<button class="gold knopf breit gross">' + sym('senden') + 'An die Verwaltung senden</button></form>');
    }).catch(function (e) { if (e && e.message && !/abgebrochen/i.test(e.message)) A().toast(e.message); });
  };
  Tun['tank-zahl'] = function (el) { Array.prototype.forEach.call($('#tzahl').children, function (b) { b.classList.toggle('akt', b === el); }); };
  Tun['tank-senden'] = function (f) {
    var betrag = f.betrag.value.trim(); if (!/\d/.test(betrag)) { A().toast('Bitte den Betrag eintragen.'); return; }
    var e = A().e, zahl = $('#tzahl .akt').getAttribute('data-a');
    S.spaeter('tank_beleg', { bild: A().z.tank.bild, betrag: betrag, liter: f.liter.value.trim(), km_stand: f.km.value.trim(), zahlart: zahl, datum: A().heute(), fahrzeug: e.fahrzeug || '', fahrzeug_name: e.fahrzeugName || '' });
    A().z.tank = null; A().blattZu(); A().toast('Quittung wird an die Verwaltung gesendet.', 4000);
  };

  /* ====================== Einstellungen ====================== */
  Se.einstellungen = function () {
    var e = A().e, i = B.info(), fest = B.lesen('festorte', {}) || {};
    function sch(k, s, titel, klein) { return '<button class="schalter' + (e[k] !== false ? ' an' : '') + '" data-tun="schalter" data-k="' + k + '">' + sym(s) + '<span>' + titel + (klein ? '<small>' + klein + '</small>' : '') + '</span><i></i></button>'; }
    seite(kopf('Einstellungen', '', false) + '<div class="rollen"><div class="block"><h2>' + sym('ton') + 'Ansagen</h2>' + sch('ansage', 'ton', 'Sprachansage beim Fahren') + sch('wcAnsage', 'wc', 'Parkplatz mit WC ansagen', '3 Kilometer vorher') + sch('pieper', 'warnung', 'Warnpieper bei zu schnellem Fahren', 'kurzer Piepton ab 6 km/h über dem Tempolimit') + sch('vorlesen', 'chat', 'Nachrichten vom Lager vorlesen') + '<button class="schalter" data-tun="stimmen">' + sym('stimme') + '<span>Stimme auswählen<small>' + h(stimmeName(e.stimme)) + '</small></span>' + sym('rechts') + '</button></div>' +
      '<div class="block"><h2>' + sym('ampel') + 'Verkehr</h2>' + sch('verkehr', 'warnung', 'Verkehrsmeldungen', 'Stau, Unfall, Sperrung, Baustelle – mit Ansage') + sch('umleiten', 'umleitung', 'Automatisch umleiten', 'bei Sperrung, Unfall oder Stau die schnellste Umleitung') +
        '<p class="klein2" style="margin:6px 2px 0">Quellen: ' + h(FV.V.quellen()) + (FV.V.schluessel() ? ' – alle Straßen.' : ' – nur Autobahnen. Für Landstraßen und Orte trägt das Büro in der Verwaltung (Einstellungen → App) einen kostenlosen TomTom-Schlüssel ein.') + '</p></div>' +
      '<div class="block"><h2>' + sym('ebenen') + 'Auf der Karte anzeigen</h2>' + sch('wc', 'wc', 'Parkplätze mit WC') + sch('laden', 'laden', 'E-Ladesäulen') + sch('essen', 'kaffee', 'Bäcker und Café') + sch('tanken', 'tanken', 'Tankstellen (Diesel)') + sch('bahnhof', 'zug', 'Bahnhöfe', 'antippen: Live-Abfahrten mit Gleis und Verspätung') + sch('apotheke', 'apotheke', 'Apotheken', 'grün = hat gerade Notdienst') + sch('arzt', 'arzt', 'Ärzte', 'rot = Notaufnahme / Bereitschaftspraxis') + sch('flughafen', 'flug', 'Flughäfen', 'antippen: Starts und Landungen live') +
        '<button class="schalter" data-tun="bahnhoefe">' + sym('zug') + '<span>Bahnhöfe in der Nähe<small>Abfahrtstafeln öffnen</small></span>' + sym('rechts') + '</button>' +
        '<button class="schalter" data-tun="apotheken">' + sym('apotheke') + '<span>Apotheken in der Nähe<small>mit Notdienst</small></span>' + sym('rechts') + '</button>' +
        '<button class="schalter" data-tun="aerzte">' + sym('arzt') + '<span>Ärzte in der Nähe<small>mit Notdienst, 116117 und 112</small></span>' + sym('rechts') + '</button>' +
        '<button class="schalter" data-tun="flughaefen">' + sym('flug') + '<span>Flughäfen<small>Starts, Landungen, Verspätungen</small></span>' + sym('rechts') + '</button></div>' + offlineBlock() +
      '<div class="block"><h2>' + sym('haus') + 'Zuhause</h2><label class="feld">Adresse für das Schnellziel „Zuhause“<input class="eingabe" id="zuhause" value="' + h(e.zuhause) + '" placeholder="Straße, PLZ Ort"></label><button class="rand knopf breit" data-tun="zuhause">Speichern</button></div>' +
      '<div class="block"><h2>' + sym('halle') + 'Lagerhalle und Verwaltung</h2><p class="klein2" style="margin:0 0 8px">Findet die Karte die Hausnummer nicht genau? Einmal vor Ort antippen, dann führt die App künftig genau dorthin.</p>' +
      '<div class="zweier"><button class="rand knopf" data-tun="festort" data-z="lagerhalle">Hier ist die Lagerhalle' + (fest.lagerhalle ? ' ✓' : '') + '</button><button class="rand knopf" data-tun="festort" data-z="verwaltung">Hier ist die Verwaltung' + (fest.verwaltung ? ' ✓' : '') + '</button></div></div>' +
      '<div class="block"><h2>' + sym('person') + 'Anmeldung</h2><div class="detailzeile">' + sym('ausweis') + '<div><small>Angemeldet als</small>' + (S.demo ? 'Demo (Beispieldaten)' : h(S.an.name || '') + (S.admin() ? ' (Admin)' : '')) + '</div></div>' +
      '<div class="detailzeile">' + sym('auto') + '<div><small>Fahrzeug</small>' + h(e.fahrzeugName || 'noch nicht gewählt – siehe „Fahrzeuge“') + '</div></div><div style="height:8px"></div><button class="rand knopf breit" data-tun="abmelden">' + sym('abmelden') + (S.demo ? 'Demo beenden' : 'Abmelden') + '</button></div>' +
      '<div class="hinweis">Fehnverleih Navi ' + h(i.version || '') + '<br>Karte und Route: © OpenStreetMap-Mitwirkende (OpenFreeMap, Valhalla/FOSSGIS)<br>Wetter: Deutscher Wetterdienst<br>Verkehr: Autobahn GmbH des Bundes' + (FV.V.schluessel() ? ', TomTom' : '') + ' · Zugverbindungen: Deutsche Bahn (transport.rest)</div></div>');
  };
  /* ---------- Stimmenauswahl ---------- */
  var PROBE = 'In 300 Metern rechts abbiegen. Danach sind Sie am Ziel.';
  var LAND = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', BE: 'Belgien', LU: 'Luxemburg' };
  var stimmenNr = {};
  function stimmeName(n) { if (n && !stimmenNr[n]) { try { stimmenLaden(); } catch (x) {} } return !n ? 'Standardstimme des Handys' : (stimmenNr[n] || 'Gewählte Stimme'); }
  function stimmenLaden() {
    var d = B.stimmen() || {}, l = (d.stimmen || []).slice();
    // Deutschland, natürliche Online-Stimmen und beste Qualität zuerst, dann nach Name
    l.sort(function (a, b) { return ((b.land === 'DE') - (a.land === 'DE')) || ((!!b.netz) - (!!a.netz)) || ((b.qualitaet || 0) - (a.qualitaet || 0)) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
    stimmenNr = {}; l.forEach(function (v, i) { stimmenNr[v.name] = 'Stimme ' + (i + 1); });
    return { liste: l, aktuell: d.aktuell || '' };
  }
  function stimmenBlatt() {
    var e = A().e, d = stimmenLaden(), w = e.stimme || '';
    function zeile(name, titel, info) {
      return '<div class="stzeile' + (name === w ? ' akt' : '') + '"><button class="stwahl" data-tun="stimme-wahl" data-n="' + h(name) + '"><b></b><span>' + h(titel) + (info ? '<small>' + h(info) + '</small>' : '') + '</span></button>' +
        '<button class="stprobe" data-tun="stimme-probe" data-n="' + h(name) + '" aria-label="Probehören">' + sym('abspielen') + '</button></div>';
    }
    var html = '<h2>' + sym('stimme') + 'Stimme auswählen<button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<p class="klein2" style="margin:0 0 8px">Mit ▶ probehören, dann die Stimme antippen. Sie gilt sofort für alle Ansagen.</p><div class="stliste">' +
      zeile('', 'Standardstimme', 'Wie im Handy eingestellt');
    if (!d.liste.length) html += '<div class="klein2" style="padding:12px 2px">Keine weiteren deutschen Stimmen gefunden. Die Sprachausgabe startet vielleicht noch – bitte gleich noch einmal öffnen, oder unten weitere Stimmen laden.</div>';
    d.liste.forEach(function (v) {
      var info = [LAND[v.land] || v.land || '', v.netz ? 'Online · besonders natürlich' : 'Offline · funktioniert ohne Internet', (v.qualitaet || 0) >= 400 ? 'hohe Qualität' : ''].filter(Boolean).join(' · ');
      html += zeile(v.name, stimmenNr[v.name], info);
    });
    html += '</div><label class="feld">Sprechtempo <output id="sttw">' + Math.round((e.tempo || 1) * 100) + ' %</output><input type="range" id="sttempo" min="0.6" max="1.6" step="0.05" value="' + (e.tempo || 1) + '"></label>' +
      '<label class="feld">Tonhöhe <output id="sthw">' + Math.round((e.hoehe || 1) * 100) + ' %</output><input type="range" id="sthoehe" min="0.6" max="1.5" step="0.05" value="' + (e.hoehe || 1) + '"></label>' +
      '<div class="zweier"><button class="rand knopf" data-tun="stimme-zurueck">Zurücksetzen</button><button class="rand knopf" data-tun="stimme-mehr">' + sym('extern') + 'Weitere Stimmen</button></div>' +
      '<p class="klein2" style="margin:10px 0 0">„Weitere Stimmen“ öffnet die Sprachausgabe des Handys. Dort unter „Sprachdaten installieren“ → Deutsch weitere Stimmen herunterladen; danach erscheinen sie hier.</p>';
    A().blatt(html);
    var t = $('#sttempo'), hh = $('#sthoehe');
    function werte() { e.tempo = +t.value; e.hoehe = +hh.value; $('#sttw').textContent = Math.round(e.tempo * 100) + ' %'; $('#sthw').textContent = Math.round(e.hoehe * 100) + ' %'; }
    t.oninput = hh.oninput = werte;
    t.onchange = hh.onchange = function () { werte(); A().speichern(); B.stimmeWaehlen(e.stimme, e.tempo, e.hoehe); B.still(); B.sprich(PROBE); };
  }
  Tun.stimmen = function () { stimmenBlatt(); };
  Tun['stimme-probe'] = function (el) { var e = A().e; B.still(); B.stimmeWaehlen(el.getAttribute('data-n'), e.tempo, e.hoehe); B.sprich(PROBE); setTimeout(function () { B.stimmeWaehlen(e.stimme, e.tempo, e.hoehe); }, 150); };
  Tun['stimme-wahl'] = function (el) {
    var e = A().e; e.stimme = el.getAttribute('data-n') || ''; A().speichern(); B.stimmeWaehlen(e.stimme, e.tempo, e.hoehe);
    Array.prototype.forEach.call(document.querySelectorAll('.stzeile'), function (z) { z.classList.toggle('akt', z.contains(el)); });
    B.still(); B.sprich('Diese Stimme ist jetzt eingestellt.');
    if (A().oben() === 'einstellungen') { var k = document.querySelector('[data-tun=stimmen] small'); if (k) k.textContent = stimmeName(e.stimme); }
  };
  Tun['stimme-zurueck'] = function () { var e = A().e; e.stimme = ''; e.tempo = 1; e.hoehe = 1; A().speichern(); B.stimmeWaehlen('', 1, 1); stimmenBlatt(); A().toast('Standardstimme eingestellt.'); };
  Tun['stimme-mehr'] = function () { if (B.nativ) B.sprachEinstellungen(); else A().toast('Nur in der App auf dem Handy möglich.'); };
  /* ---------- Offline-Karten ---------- */
  function offlineBlock() {
    var e = A().e, p = e.offlineApp || 'app.organicmaps', da = B.appDa(p), name = B.OFFLINE_APPS[p] || p;
    return '<div class="block" id="offblock"><h2>' + sym('karte') + 'Offline-Karten</h2>' + karteTeil() +
      '<div class="offzwischen">' + sym('navi') + 'Offline-Navigation mit Route</div>' +
      '<p class="klein2" style="margin:0 0 8px">Für Route und Abbiege-Ansagen ohne Internet gibt es zusätzlich eine Offline-Navi-App. Das ist freiwillig – jeder entscheidet auf seinem Handy selbst.</p>' +
      '<div class="wahl" id="offwahl">' + Object.keys(B.OFFLINE_APPS).map(function (k) { return '<button data-tun="offline-app" data-p="' + k + '"' + (k === p ? ' class="akt"' : '') + '>' + h(B.OFFLINE_APPS[k]) + '</button>'; }).join('') + '</div>' +
      '<div class="detailzeile" style="margin-top:10px">' + sym(da ? 'haken' : 'info') + '<div><small>Offline-Navi</small>' + h(name) + (da ? ' ist installiert' : ' ist noch nicht installiert') + '</div></div>' +
      '<ol class="offschritte"><li' + (da ? ' class="fertig"' : '') + '>' + h(name) + ' installieren (kostenlos)</li><li>Dort die Karten herunterladen: Deutschland bzw. alle Bundesländer. Das sind mehrere Gigabyte – am besten im WLAN. Die Karten liegen dann in einem eigenen Ordner dieser App und lassen sich dort auch wieder löschen.</li><li>Fertig: Fehlt unterwegs das Internet, erscheint bei der Route der Knopf „Offline-Navi“. Die Fahrt geht dann mit Karte, Route und deutscher Sprachansage ohne Internet weiter.</li></ol>' +
      (da ? '<div class="zweier"><button class="gold knopf" data-tun="offline-oeffnen">' + sym('extern') + 'Karten verwalten</button><button class="rand knopf" data-tun="offline-test">' + sym('navi') + 'Testen</button></div>'
          : '<button class="gold knopf breit" data-tun="offline-laden">' + sym('extern') + h(name) + ' installieren</button>') + '</div>';
  }
  function offlineNeu() { var b = $('#offblock'); if (b) b.outerHTML = offlineBlock(); }
  /* Karte vom Fehnverleih-Server (Ordner „karten“ auf www.fehnverleih.de) aufs Handy laden */
  function karteTeil() {
    var O = FV.O, s = O.stand() || {}, laeuft = O.laeuft(), ges = (s.plan && s.plan.gesamt) || 0, pos = Math.min(s.pos || 0, ges || 0), proz = ges ? Math.floor(pos * 100 / ges) : 0;
    var text = s.fertig ? 'Geladen · ' + O.gb(ges) + (s.datum ? ' · Stand ' + new Date(s.datum).toLocaleDateString('de-DE') : '')
      : laeuft ? (ges ? proz + ' % · ' + O.gb(pos) + ' von ' + O.gb(ges) : 'Verbinde mit www.fehnverleih.de …')
      : pos > 0 ? 'Angehalten bei ' + proz + ' % (' + O.gb(pos) + ' von ' + O.gb(ges) + ')' : 'Noch nicht auf diesem Handy';
    var html = '<div class="detailzeile">' + sym(s.fertig ? 'haken' : 'info') + '<div><small>Offline-Karte im Navi</small><span id="offtext">' + h(text) + '</span></div></div>';
    if (laeuft || (pos > 0 && !s.fertig)) html += '<div class="offbalken"><i id="offbalken" style="width:' + proz + '%"></i></div>';
    if (O.letzterFehler && !laeuft) html += '<div class="fehler" style="margin-top:8px">' + h(O.letzterFehler) + '</div>';
    html += '<p class="klein2" style="margin:8px 0">' + (s.fertig
      ? 'Die Deutschland-Karte liegt auf diesem Handy. Das Navi zeigt Straßen, Orte, Wasser und Wald jetzt auch ohne Internet. Ortsnamen und Route brauchen weiter Internet – oder die Offline-Navi unten.'
      : 'Lädt die Deutschland-Karte aus dem Ordner „karten“ auf www.fehnverleih.de auf dieses Handy' + (ges ? ' (' + O.gb(ges) + ')' : ' (mehrere GB)') + '. Am besten im WLAN, mit Ladekabel und bei offener App. Nach einer Unterbrechung geht es an derselben Stelle weiter.') + '</p>';
    if (laeuft) html += '<button class="rand knopf breit" data-tun="karte-halt">' + sym('zu') + 'Anhalten</button>';
    else if (s.fertig) html += '<div class="zweier"><button class="rand knopf" data-tun="karte-laden">' + sym('neu') + 'Neue Karte?</button><button class="rand knopf" data-tun="karte-loeschen">' + sym('muell') + 'Löschen</button></div>';
    else if (pos > 0) html += '<div class="zweier"><button class="gold knopf" data-tun="karte-laden">' + sym('ab') + 'Weiter laden</button><button class="rand knopf" data-tun="karte-loeschen">' + sym('muell') + 'Löschen</button></div>';
    else html += '<button class="gold knopf breit" data-tun="karte-laden">' + sym('ab') + 'Offline-Karte laden</button>';
    return html;
  }
  function karteFortschritt(pos, ges, text) {
    var t = $('#offtext'), b = $('#offbalken'), p = ges ? Math.floor(pos * 100 / ges) : 0;
    if (t) t.textContent = text || (ges ? p + ' % · ' + FV.O.gb(pos) + ' von ' + FV.O.gb(ges) : 'Verbinde mit www.fehnverleih.de …');
    if (b) b.style.width = p + '%';
  }
  Tun['karte-laden'] = function () {
    var O = FV.O; if (O.laeuft()) return;
    var lauf = O.laden(karteFortschritt);
    offlineNeu();
    lauf.then(function (r) {
      offlineNeu();
      if (r === 'aktuell') A().toast('Die Offline-Karte ist schon auf dem neuesten Stand.', 4000);
      else if (r === 'halt') A().toast('Angehalten. „Weiter laden“ macht später an derselben Stelle weiter.', 4500);
      else if (r === 'fertig') A().frage('Die Offline-Karte ist geladen.\nDamit die Karte sie benutzt, startet das Navi einmal kurz neu.', 'Jetzt neu starten', 'Später').then(function (ja) { if (ja) location.reload(); });
    }).catch(function () { offlineNeu(); });
  };
  Tun['karte-halt'] = function () { FV.O.halt(); A().toast('Wird angehalten …'); };
  Tun['karte-loeschen'] = function () {
    var s = FV.O.stand() || {}, g = s.plan ? FV.O.gb(Math.min(s.pos || 0, s.plan.gesamt)) : '';
    A().frage('Offline-Karte von diesem Handy löschen?' + (g ? '\nDas macht ' + g + ' Speicher frei. Laden lässt sie sich jederzeit wieder.' : ''), 'Löschen').then(function (ja) {
      if (!ja) return;
      var warAktiv = s.fertig;
      FV.O.letzterFehler = '';
      FV.O.loeschen().then(function () { offlineNeu(); A().toast('Offline-Karte gelöscht.'); if (warAktiv) setTimeout(function () { location.reload(); }, 900); });
    });
  };
  Tun['offline-app'] = function (el) { A().e.offlineApp = el.getAttribute('data-p'); A().speichern(); offlineNeu(); };
  Tun['offline-laden'] = function () { B.appLaden(A().e.offlineApp || 'app.organicmaps'); A().toast('Nach der Installation hierher zurückkommen.', 4000); };
  Tun['offline-oeffnen'] = function () { B.appStarten(A().e.offlineApp || 'app.organicmaps', ''); };
  Tun['offline-test'] = function () { var f = B.lesen('festorte', {}) || {}, l = f.lagerhalle; B.offlineNavi(A().e.offlineApp || 'app.organicmaps', l ? { lat: l.lat, lon: l.lon, name: 'Lagerhalle' } : { adresse: 'Rathaus', name: 'Rathaus' }); };
  Tun['offline-fahren'] = function () {
    var n = A().z.nav, z = n && n.ziel; if (!z) return;
    var p = A().e.offlineApp || 'app.organicmaps', ziel = { name: z.name, adresse: z.adresse ? adr1(z.adresse) : '' };
    if (n.nach) { ziel.lat = n.nach.lat; ziel.lon = n.nach.lon; } else if (z.lat != null) { ziel.lat = z.lat; ziel.lon = z.lon; }
    if (B.offlineNavi(p, ziel)) return;
    A().frage((B.OFFLINE_APPS[p] || 'Die Offline-Navi') + ' ist auf diesem Handy noch nicht installiert. Jetzt installieren? Danach in den Einstellungen unter „Offline-Karten“ die Deutschland-Karte laden.', 'Installieren').then(function (ja) { if (ja) B.appLaden(p); });
  };
  Tun.schalter = function (el) { var k = el.getAttribute('data-k'), e = A().e; e[k] = e[k] === false; A().speichern(); el.classList.toggle('an', e[k] !== false); };
  Tun.festort = function (el) {
    var o = B.ort(), k = el.getAttribute('data-z');
    if (!o || o.genau > 40 || Date.now() - (o.zeit || 0) > 60000) { A().toast('Der Standort ist gerade nicht genau genug. Bitte kurz im Freien warten und noch einmal antippen.', 5000); return; }
    A().frage('Den jetzigen Standort als „' + (k === 'lagerhalle' ? 'Lagerhalle' : 'Verwaltung') + '“ speichern?', 'Speichern').then(function (ja) {
      if (!ja) return; var f = B.lesen('festorte', {}) || {}; f[k] = { lat: o.lat, lon: o.lon }; B.schreiben('festorte', f); A().toast('Gespeichert.'); A().neu();
    });
  };
  Tun.zuhause = function () { A().e.zuhause = $('#zuhause').value.trim(); A().speichern(); A().toast('Gespeichert.'); };
})();
