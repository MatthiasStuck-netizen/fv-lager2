/* Fehnverleih Navi – Nachrichten vom Lager (Fahrer-Chat)
 * Das Lager schreibt in der Lager-App unter „💬 Fahrer“. Die Navi-App holt neue Nachrichten alle 15 Sekunden ab,
 * zeigt sie oben als Fenster (Blase) und liest sie vor (Einstellung „Nachrichten vom Lager vorlesen“).
 * Antippen der Blase oder „Nachrichten“ auf der Seite „Lager“ öffnet das Gespräch mit Schnellantworten.
 * Server: warenwirtschaft.php, Aktionen navi_nachrichten und navi_antwort. */
(function () {
  'use strict';
  var B = FV.B, S = FV.S, Tun = FV.Tun, sym = FV.sym;
  function A() { return FV.app; }
  function h(t) { return FV.esc(t); }
  var $ = function (s) { return document.querySelector(s); };
  var ABFRAGE_MS = 15000;
  var SCHNELL = ['👍 Alles klar', 'Bin unterwegs', 'Komme gleich ins Lager', 'Rufe gleich an', 'Kann gerade nicht – fahre'];
  var aus = false, laeuft = false, verlauf = [], ungelesen = 0;
  function istOffen() { var b = $('#blatt'); return !!$('#chatverlauf') && b && !b.hidden; }

  /* Der Chat läuft je Fahrzeug: mitgeschickt wird das unter „Fahrzeuge“ gewählte Auto (ohne Wahl: Chat je Person) */
  var letztesFz = null;
  function fz() {
    var e = A() ? A().e : {}, id = (e && e.fahrzeug) || '';
    if (letztesFz !== null && id !== letztesFz) { verlauf = []; ungelesen = 0; merker(); }   // anderes Auto gewählt: anderes Gespräch
    letztesFz = id;
    return { fahrzeug: id };
  }
  function fzName() { var e = A() ? A().e : {}; return (e && e.fahrzeug && e.fahrzeugName) ? e.fahrzeugName : ''; }

  function gesperrt() { var o = A() ? A().oben() : ''; return o === 'sperre' || o === 'anmeldung'; }

  /** Neue Nachrichten abholen. mitVerlauf: zusätzlich die letzten Nachrichten (für das geöffnete Gespräch) */
  function holen(mitVerlauf) {
    if (aus || laeuft || S.demo || !S.angemeldet() || gesperrt()) return Promise.resolve();
    laeuft = true;
    return S.ruf('navi_nachrichten', Object.assign(fz(), mitVerlauf ? { verlauf: '1' } : {}), 15000).then(function (r) {
      laeuft = false;
      var neu = r.neu || [];
      if (r.verlauf && r.verlauf.length) verlauf = r.verlauf;
      else neu.forEach(function (n) { if (!verlauf.some(function (v) { return v.id === n.id; })) verlauf.push(n); });
      if (neu.length) {
        var n = neu[neu.length - 1];
        if (!istOffen()) { ungelesen += neu.length; A().blase(n.name || 'Lager', n.text); var b = $('#blase'); if (b) b.setAttribute('data-tun', 'chat'); }
        try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) {}
        if (istOffen()) { zeichnen(); if (A().e.vorlesen !== false) B.sprich('Nachricht von ' + (n.name || 'Lager') + ': ' + n.text); }
        merker();
      }
    }, function (e) {
      laeuft = false;
      if (e.unbekannt) aus = true;   // alte warenwirtschaft.php ohne Fahrer-Chat: still bleiben
    });
  }

  /** Hinweis auf der Seite „Lager“ */
  function merker() {
    var k = $('#chatknopf'); if (!k) return;
    k.innerHTML = sym('chat') + 'Nachrichten' + (ungelesen ? ' <b class="chatzahl">' + ungelesen + '</b>' : '');
  }

  function zeichnen() {
    var l = $('#chatverlauf'); if (!l) return;
    l.innerHTML = verlauf.length ? verlauf.map(function (n) {
      var ich = n.von === 'fahrer';
      return '<div class="cnachr' + (ich ? ' ich' : '') + '"><span>' + h(n.text) + '</span><small>' + (ich ? 'Du' : h(n.name || 'Lager')) + ' · ' + h(n.zeit || '') + '</small></div>';
    }).join('') : '<div class="hinweis">Noch keine Nachrichten vom Lager.</div>';
    l.scrollTop = l.scrollHeight;
  }

  /** Gespräch öffnen */
  Tun.chat = function () {
    var b = $('#blase'); if (b) b.hidden = true;
    ungelesen = 0; merker();
    A().blatt('<h2>' + sym('chat') + 'Nachrichten vom Lager' + (fzName() ? ' · ' + h(fzName()) : '') + '<button data-tun="chat-zu">' + sym('zu') + '</button></h2>' +
      '<div id="chatverlauf" class="chatverlauf"><div class="hinweis">Lädt …</div></div>' +
      '<div class="chatschnell">' + SCHNELL.map(function (t, i) { return '<button class="rand knopf" data-tun="chat-schnell" data-i="' + i + '">' + h(t) + '</button>'; }).join('') + '</div>' +
      '<form data-form="chat-senden" class="chatform"><input class="eingabe" name="text" maxlength="600" placeholder="Antwort ans Lager …" autocomplete="off">' +
      '<button class="gold knopf" type="submit" aria-label="Senden">' + sym('senden') + '</button></form>' +
      '<div class="hinweis">' + (fzName() ? 'Gespräch für das Fahrzeug ' + h(fzName()) + '. ' : 'Kein Fahrzeug gewählt – unter „Fahrzeuge“ das Auto wählen, dann kommen die Nachrichten für dieses Auto. ') + 'Beim Fahren bitte nur die Schnellantworten nutzen.</div>');
    zeichnen();
    holen(true).then(zeichnen);
  };
  Tun['chat-zu'] = function () { A().blattZu(); };
  function senden(text, knopf) {
    text = String(text || '').trim(); if (!text) return;
    if (knopf) knopf.disabled = true;
    S.ruf('navi_antwort', Object.assign(fz(), { text: text }), 20000).then(function (r) {
      if (r.verlauf) verlauf = r.verlauf;
      zeichnen(); A().toast('Gesendet.');
      var f = document.querySelector('.chatform .eingabe'); if (f) f.value = '';
    }).catch(function (e) {
      A().toast(e.unbekannt ? 'Der Chat ist auf der Webseite noch nicht eingerichtet.' : (e.message || 'Nicht gesendet – kein Netz?'), 4500);
    }).then(function () { if (knopf) knopf.disabled = false; });
  }
  Tun['chat-schnell'] = function (e) { senden(SCHNELL[+e.getAttribute('data-i')], e); };
  Tun['chat-senden'] = function (form) { senden(form.elements.text.value, form.querySelector('button')); };

  /* Blase antippen öffnet das Gespräch */
  var bl = $('#blase'); if (bl) bl.setAttribute('data-tun', 'chat');

  /* Knopf „Nachrichten“ auf der Seite „Lager“ */
  var altLager = FV.Seiten.lager;
  FV.Seiten.lager = function () {
    altLager.apply(this, arguments);
    var z = document.querySelector('#seite .zeile');
    if (z && !aus) { z.insertAdjacentHTML('beforeend', '<button id="chatknopf" class="rand knopf klein" data-tun="chat"></button>'); merker(); }
  };

  /* regelmäßig abholen – auch während der Zielführung; beim Zurückkehren in die App sofort */
  setInterval(function () { if (!document.hidden) holen(istOffen()); }, ABFRAGE_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) holen(istOffen()); });
  var altSichtbar = A().sichtbar;
  A().sichtbar = function (an) { altSichtbar(an); if (an) setTimeout(function () { holen(istOffen()); }, 800); };
  setTimeout(function () { holen(false); }, 2500);
})();
