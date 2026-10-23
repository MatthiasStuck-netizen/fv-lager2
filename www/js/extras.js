/* Zusätze 4.4: Telefon (Kontakte, letzte Anrufe), Nachrichten (WhatsApp & Co. über die Benachrichtigungen, E-Mail per IMAP)
 * mit Einblendung auf der Karte, Musik (Spotify), Verkehrsfunk (Radio live + Meldungen rund um den Standort), Favoriten-Blatt,
 * Kartenknöpfe (Online/Offline, Gelände) und die Einstellungen dazu. Alles, was das Handy selbst braucht, läuft über B.extra(). */
(function () {
  'use strict';
  var B = FV.B, G = FV.G, K = FV.K, S = FV.S, sym = FV.sym, Se = FV.Seiten, Tun = FV.Tun, X = FV.SX, h = X.h;
  var $ = function (s, w) { return (w || document).querySelector(s); };
  function A() { return FV.app; }
  var EX = FV.EX = {};
  function nurApp() { A().toast('Das geht nur in der App auf dem Handy (ab Version 4.4).', 3500); }
  function uhrzeit(ms) { var d = new Date(ms), heute = new Date(); heute.setHours(0, 0, 0, 0); return d >= heute ? G.uhr(d) : ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '. ' + G.uhr(d); }

  /* ====================== Kartenknöpfe: Online/Offline, Gelände, Musik, Nachrichten ====================== */
  EX.kartenKnoepfe = function () {
    var q = K.quelle(), e = A().e, n = ungelesen();
    return '<div class="kartenwahl">' +
      '<button class="kartenknopf dunkel kwknopf' + (q === 'offline' ? ' offline' : '') + '" data-tun="karte-quelle" aria-label="Karte online oder offline">' + sym(q === 'offline' ? 'offline' : 'online') + '<small>' + (q === 'offline' ? 'Offline' : 'Online') + '</small></button>' +
      '<button class="kartenknopf dunkel kwknopf' + (e.gelaende ? ' an' : '') + '" data-tun="gelaende" aria-label="Geländeansicht">' + sym('berg') + '<small>Gelände</small></button>' +
      '<button class="kartenknopf dunkel kwknopf" data-tun="musik" aria-label="Musik / Spotify">' + sym('musik') + '<small>Musik</small></button>' +
      '<button class="kartenknopf dunkel kwknopf" data-tun="nachrichten" aria-label="Nachrichten">' + sym('chat') + '<small>Nachr.</small>' + (n ? '<i class="zahl">' + (n > 9 ? '9+' : n) + '</i>' : '') + '</button></div>';
  };
  function knoepfeNeu() { var k = $('.kartenwahl'); if (k) k.outerHTML = EX.kartenKnoepfe(); }
  Tun['karte-quelle'] = function (el) {
    var e = A().e, jetzt = K.quelle(), ziel = el && el.getAttribute('data-q') || (jetzt === 'offline' ? 'online' : 'offline');
    if (ziel === 'offline' && !K.offlineDa()) {
      A().frage('Auf diesem Handy ist noch keine Offline-Karte geladen.\nUnter Einstellungen → Offline-Kartenmaterial lässt sie sich laden (Deutschland, Spanien + Portugal, Frankreich, Österreich, Schweiz, Italien, Niederlande, Belgien, Luxemburg, Dänemark, Polen, Tschechien, Großbritannien, Irland, Weltkarte).', 'Zu den Einstellungen', 'Abbrechen').then(function (ja) { if (ja) A().zeige('einstellungen', {}, 'reiter'); });
      return;
    }
    e.kartenQuelle = ziel; A().speichern();
    A().toast(ziel === 'offline' ? 'Offline-Karte vom Handy – geht ohne Internet.' : 'Online-Karte – braucht Internet.', 2500);
    knoepfeNeu();
    K.stilNeu().catch(function () { A().toast('Die Karte konnte nicht umgeschaltet werden.'); });
  };
  Tun.gelaende = function () {
    var e = A().e; e.gelaende = !e.gelaende; A().speichern();
    K.gelaende(true); knoepfeNeu();
    A().toast(e.gelaende ? 'Geländeansicht an: Höhen als Relief, die Karte ist leicht schräg. Braucht Internet.' : 'Geländeansicht aus.', 3000);
  };

  /* ====================== Startseite: Favoriten, Telefon, Spotify, Nachrichten, Verkehrsfunk ====================== */
  EX.startKnoepfe = function () {
    var n = ungelesen();
    function k(tun, s, t) { return '<button class="rand minikachel" data-tun="' + tun + '">' + sym(s) + '<span>' + t + '</span>' + (tun === 'nachrichten' && n ? '<i class="zahl">' + (n > 9 ? '9+' : n) + '</i>' : '') + '</button>'; }
    return '<div class="minikacheln">' + k('favoriten-blatt', 'stern', 'Favoriten') + k('telefon', 'telefon', 'Telefon') + k('musik', 'musik', 'Spotify') + k('aktuelles', 'zeitung', 'Aktuelles') + k('nachrichten', 'chat', 'Nachrichten') + k('verkehrsfunk', 'radio', 'Verkehrsfunk') + '</div>';
  };
  Tun['favoriten-blatt'] = function () {
    var F = FV.FAV, l = F ? F.alle() : [];
    A().blatt('<h2>' + sym('stern') + 'Favoriten<button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      (l.length ? F.html() : '<p class="klein2">Noch keine Favoriten. Den Stern ' + sym('stern_leer', 'inline') + ' bei einem Ziel, Flughafen, Bahnhof oder Anleger antippen – dann steht er hier.</p>') +
      '<div style="height:8px"></div><button class="rand knopf breit" data-tun="reiter" data-r="suche">' + sym('suche') + 'Suche und letzte Ziele</button>');
  };

  /* ====================== Telefon ====================== */
  var RECHTE_TEL = ['READ_CONTACTS', 'READ_CALL_LOG', 'CALL_PHONE'];
  function telZustand() { var z = A().z; return z.tel || (z.tel = { tab: 'anrufe', suche: '' }); }
  Tun.telefon = function () { A().blattZu(); A().zeige('telefon'); };
  Se.telefon = function () {
    var t = telZustand();
    X.seite(X.kopf('Telefon') +
      '<div class="modi">' + [['anrufe', 'verlauf', 'Letzte Anrufe'], ['kontakte', 'leute', 'Kontakte'], ['kunden', 'lkw', 'Kunden heute'], ['waehlen', 'telefon', 'Wählen']].map(function (x) {
        return '<button data-tun="tel-tab" data-t="' + x[0] + '"' + (x[0] === t.tab ? ' class="akt"' : '') + '>' + sym(x[1]) + '<span>' + x[2] + '</span></button>'; }).join('') + '</div>' +
      '<div class="rollen" id="telliste">' + X.laedt() + '</div>');
    telZeigen();
  };
  Tun['tel-tab'] = function (el) { telZustand().tab = el.getAttribute('data-t'); [].forEach.call(document.querySelectorAll('[data-tun=tel-tab]'), function (b) { b.classList.toggle('akt', b === el); }); telZeigen(); };
  function rechteFehlen(r) { return RECHTE_TEL.filter(function (k) { return r && r[k] === false; }); }
  function telZeigen() {
    var t = telZustand(), box = $('#telliste'); if (!box) return;
    if (t.tab === 'kunden') { box.innerHTML = kundenHtml(); return; }
    if (t.tab === 'waehlen') { box.innerHTML = waehlHtml(); return; }
    if (!B.hatExtra()) { box.innerHTML = '<div class="leer"><b>Nur in der App</b>Kontakte und Anrufliste kommen direkt vom Handy – im Browser geht das nicht.</div>'; return; }
    var r = B.extra('rechteStand', { liste: RECHTE_TEL }), fehlt = rechteFehlen(r);
    var noetig = t.tab === 'anrufe' ? 'READ_CALL_LOG' : 'READ_CONTACTS';
    if (r && r[noetig] === false) {
      box.innerHTML = '<div class="block creme"><h2>' + sym('schloss') + 'Zugriff erlauben</h2><p style="margin:0 0 10px">Damit das Navi ' + (t.tab === 'anrufe' ? 'die letzten Anrufe' : 'deine Kontakte') + ' zeigen und direkt anrufen kann, braucht es einmal deine Erlaubnis. Die Daten bleiben auf dem Handy.</p>' +
        '<button class="gold knopf breit" data-tun="tel-rechte">' + sym('haken') + 'Jetzt erlauben</button><div style="height:8px"></div><button class="rand knopf breit" data-tun="app-einstellungen">' + sym('zahnrad') + 'In den Android-Einstellungen erlauben</button>' +
        '<p class="klein2" style="margin:8px 0 0">Kommt keine Abfrage, wurde sie früher abgelehnt – dann unter „Berechtigungen“ Kontakte und Telefon erlauben.</p></div>';
      return;
    }
    var d = B.extra(t.tab === 'anrufe' ? 'anrufliste' : 'kontakte', '');
    if (!d || !d.ok) { box.innerHTML = '<div class="fehler">' + h(d && d.fehler || 'Die Daten konnten nicht gelesen werden.') + '</div>'; return; }
    t.daten = d.liste || [];
    if (t.tab === 'anrufe') {
      box.innerHTML = (fehlt.indexOf('CALL_PHONE') >= 0 ? '<button class="vleiste" data-tun="tel-rechte">' + sym('info') + '<span>Direkt anrufen erlauben (sonst öffnet sich erst die Wähltastatur)</span></button>' : '') +
        (t.daten.length ? t.daten.map(function (x, i) {
          var ic = x.art === 'verpasst' || x.art === 'abgelehnt' ? 'verpasst' : x.art === 'aus' ? 'ausgehend' : 'eingehend';
          return '<div class="eintrag tippbar telz ' + x.art + '" data-tun="tel-ruf" data-i="' + i + '">' + sym(ic) + '<div class="txt"><b>' + h(x.n || x.t) + '</b><span>' + h([x.n ? x.t : '', ARTTEXT[x.art] || '', uhrzeit(x.zeit), x.dauer ? dauer(x.dauer) : ''].filter(Boolean).join(' · ')) + '</span></div><div class="ende">' + sym('telefon') + '</div></div>';
        }).join('') : '<div class="leer"><b>Keine Anrufe</b>Die Anrufliste ist leer.</div>');
      return;
    }
    box.innerHTML = '<div class="suchfeld" style="margin-bottom:8px">' + sym('suche') + '<input id="telsuche" placeholder="Name oder Nummer" autocomplete="off" value="' + h(t.suche) + '"><button type="button" data-tun="tel-suche-leer" aria-label="Leeren">' + sym('zu') + '</button></div><div id="kliste"></div>';
    var i = $('#telsuche'); i.oninput = function () { t.suche = i.value; kontakteZeigen(); };
    kontakteZeigen();
  }
  var ARTTEXT = { ein: 'angenommen', aus: 'angerufen', verpasst: 'verpasst', abgelehnt: 'abgelehnt', blockiert: 'blockiert' };
  function dauer(s) { return s >= 60 ? Math.floor(s / 60) + ' Min. ' + (s % 60 ? s % 60 + ' s' : '') : s + ' s'; }
  function kontakteZeigen() {
    var t = telZustand(), q = FV.norm(t.suche || ''), qz = (t.suche || '').replace(/[^0-9]/g, ''), b = $('#kliste'); if (!b) return;
    var l = (t.daten || []).map(function (x, i) { return [x, i]; }).filter(function (y) { var x = y[0]; return !q || FV.norm(x.n).indexOf(q) >= 0 || (qz.length >= 3 && x.t.replace(/[^0-9]/g, '').indexOf(qz) >= 0); });
    var fav = l.filter(function (y) { return y[0].s; });
    function zeile(y) { var x = y[0]; return '<div class="eintrag tippbar" data-tun="tel-ruf" data-i="' + y[1] + '">' + sym(x.s ? 'stern' : 'person') + '<div class="txt"><b>' + h(x.n) + '</b><span>' + h(x.t + ' · ' + x.art) + '</span></div><div class="ende">' + sym('telefon') + '</div></div>'; }
    b.innerHTML = (fav.length && !q ? '<h3 class="ueber">' + sym('stern') + 'Favoriten</h3>' + fav.map(zeile).join('') + '<h3 class="ueber">' + sym('leute') + 'Alle Kontakte</h3>' : '') +
      (l.length ? l.slice(0, 400).map(zeile).join('') + (l.length > 400 ? '<p class="klein2">… und ' + (l.length - 400) + ' weitere – bitte oben suchen.</p>' : '') : '<div class="leer"><b>Nichts gefunden</b>' + (q ? 'Anderen Namen versuchen.' : 'Im Handy sind keine Kontakte mit Telefonnummer.') + '</div>');
  }
  Tun['tel-suche-leer'] = function () { var t = telZustand(); t.suche = ''; var i = $('#telsuche'); if (i) { i.value = ''; i.focus(); } kontakteZeigen(); };
  Tun['tel-rechte'] = function () {
    if (!B.hatExtra()) return nurApp();
    B.extra('rechte', { liste: RECHTE_TEL });
    var n = 0, t = setInterval(function () { if (++n > 40 || A().oben() !== 'telefon') { clearInterval(t); return; } var r = B.extra('rechteStand', { liste: RECHTE_TEL }); if (!rechteFehlen(r).length) { clearInterval(t); telZeigen(); } }, 700);
    setTimeout(function () { if (A().oben() === 'telefon') telZeigen(); }, 6000);
  };
  Tun['app-einstellungen'] = function () { if (!B.hatExtra()) return nurApp(); B.extra('appEinstellungen', ''); };
  Tun['tel-ruf'] = function (el) {
    var x = (telZustand().daten || [])[+el.getAttribute('data-i')]; if (!x) return;
    A().frage((x.n || x.t) + ' anrufen?\n' + x.t, 'Anrufen', 'Abbrechen').then(function (ja) { if (ja) B.anrufen(x.t); });
  };
  function kundenHtml() {
    var l = A().tagesliste(A().z.tag || A().heute()).filter(function (a) { return a.telefon; });
    if (!l.length) return '<div class="leer"><b>Keine Telefonnummern</b>Bei den Aufträgen dieses Tages ist keine Nummer hinterlegt.</div>';
    return l.map(function (a) { return '<div class="eintrag tippbar" data-tun="anrufen" data-tel="' + h(a.telefon) + '">' + sym('person') + '<div class="txt"><b>' + h(a.kunde || 'Kunde') + '</b><span>' + h([a.telefon, a.zeit, X.adr1(a.adresse)].filter(Boolean).join(' · ')) + '</span></div><div class="ende">' + sym('telefon') + '</div></div>'; }).join('');
  }
  var WAEHL = '';
  function waehlHtml() {
    var tasten = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    return '<div class="waehl"><div class="wnummer" id="wnr">' + h(WAEHL || ' ') + '</div><div class="wtasten">' + tasten.map(function (k) { return '<button data-tun="w-taste" data-k="' + h(k) + '">' + h(k) + '</button>'; }).join('') + '</div>' +
      '<div class="zweier"><button class="rand knopf" data-tun="w-weg">' + sym('zurueck') + 'Löschen</button><button class="gold knopf" data-tun="w-ruf">' + sym('telefon') + 'Anrufen</button></div></div>';
  }
  Tun['w-taste'] = function (el) { if (WAEHL.length < 24) WAEHL += el.getAttribute('data-k'); var n = $('#wnr'); if (n) n.textContent = WAEHL; };
  Tun['w-weg'] = function () { WAEHL = WAEHL.slice(0, -1); var n = $('#wnr'); if (n) n.textContent = WAEHL || ' '; };
  Tun['w-ruf'] = function () { if (WAEHL) B.anrufen(WAEHL); };

  /* ====================== Nachrichten: WhatsApp & Co. ====================== */
  var nachrichten = B.lesen('nachrichten_merk', []) || [], seit = 0, gelesenBis = +(B.lesen('nachrichten_gelesen', 0) || 0);
  function ungelesen() { return nachrichten.filter(function (n) { return n.id > gelesenBis && n.neu; }).length + (mailNeu || 0); }
  function merken() { B.schreiben('nachrichten_merk', nachrichten.slice(-60).map(function (n) { return { id: n.id, zeit: n.zeit, app: n.app, appName: n.appName, titel: n.titel, wer: n.wer, text: n.text, antworten: false, oeffnen: false, alt: true }; })); }
  function zugriff() { var r = B.extra('zugriff', ''); return !!(r && r.mitteilungen); }
  function abholen() {
    if (!B.hatExtra() || !S.angemeldet() || A().e.nachrichtenAn === false) return;
    var r = B.extra('nachrichten', { seit: seit }); if (!r || !r.ok) return;
    if (r.bis < seit) { seit = 0; return; }   // App-Teil neu gestartet: Zählung beginnt von vorn
    var neu = (r.liste || []).filter(function (n) { return n.id > seit; });
    seit = Math.max(seit, r.bis || 0);
    if (!neu.length) return;
    neu.forEach(function (n) { n.neu = true; nachrichten.push(n); });
    if (nachrichten.length > 120) nachrichten = nachrichten.slice(-120);
    merken();
    var letzte = neu[neu.length - 1];
    einblenden({ art: 'chat', app: letzte.appName || 'Nachricht', titel: letzte.wer + (letzte.titel && letzte.titel !== letzte.wer ? ' · ' + letzte.titel : ''), text: letzte.text, mehr: neu.length - 1, id: letzte.id, antworten: letzte.antworten });
    if (A().e.nachrichtenVorlesen !== false && (FV.F && FV.F.aktiv || A().e.nachrichtenVorlesenImmer)) B.sprich((letzte.appName || 'Nachricht') + ' von ' + letzte.wer + ': ' + letzte.text);
    if (A().oben() === 'nachrichten') nachrichtenZeigen();
    knoepfeNeu(); startKachelNeu();
  }
  setInterval(abholen, 3000);
  function startKachelNeu() { var k = $('.minikacheln'); if (k) k.outerHTML = EX.startKnoepfe(); }

  /* Einblendung oben (über Karte und Seiten), verschwindet nach 12 Sekunden */
  var melderT = null, melderDaten = null;
  function einblenden(m) {
    var e = $('#melder'); if (!e) { e = document.createElement('div'); e.id = 'melder'; document.body.appendChild(e); }
    melderDaten = m;
    e.className = 'melder ' + (m.art === 'mail' ? 'mail' : 'chat');
    e.innerHTML = '<div class="mkopf">' + sym(m.art === 'mail' ? 'mail' : 'chat') + '<b>' + h(m.app) + '</b><span>' + h(G.uhr(new Date())) + '</span><button data-tun="melder-zu" aria-label="Schließen">' + sym('zu') + '</button></div>' +
      '<div class="mtext" data-tun="melder-auf"><b>' + h(m.titel) + '</b><span>' + h(m.text) + '</span>' + (m.mehr > 0 ? '<small>+ ' + m.mehr + ' weitere</small>' : '') + '</div>' +
      '<div class="mknoepfe"><button data-tun="melder-vorlesen">' + sym('ton') + 'Vorlesen</button>' + (m.antworten ? '<button data-tun="melder-antworten">' + sym('antworten') + 'Antworten</button>' : '') + '<button data-tun="melder-auf">' + sym('rechts') + 'Öffnen</button></div>';
    e.hidden = false;
    clearTimeout(melderT); melderT = setTimeout(function () { e.hidden = true; }, 12000);
  }
  EX.einblenden = einblenden;
  Tun['melder-zu'] = function () { var e = $('#melder'); if (e) e.hidden = true; };
  Tun['melder-vorlesen'] = function () { var m = melderDaten; if (!m) return; clearTimeout(melderT); B.sprich((m.art === 'mail' ? 'E-Mail von ' : m.app + ' von ') + m.titel + ': ' + m.text); };
  Tun['melder-auf'] = function () { var m = melderDaten, e = $('#melder'); if (e) e.hidden = true; if (!m) return; A().z.nTab = m.art === 'mail' ? 'mail' : 'chat'; if (m.art === 'mail' && m.uid) { mailOeffnen(m.uid); return; } A().zeige('nachrichten'); };
  Tun['melder-antworten'] = function () { var m = melderDaten, e = $('#melder'); if (e) e.hidden = true; if (m) antwortBlatt(m.id); };

  function nZustand() { var z = A().z; if (!z.nTab) z.nTab = 'chat'; return z; }
  Tun.nachrichten = function () { A().blattZu(); A().zeige('nachrichten'); };
  Se.nachrichten = function () {
    var z = nZustand();
    X.seite(X.kopf('Nachrichten') + '<div class="modi">' + [['chat', 'chat', 'WhatsApp & SMS'], ['mail', 'mail', 'E-Mail']].map(function (x) {
      return '<button data-tun="n-tab" data-t="' + x[0] + '"' + (x[0] === z.nTab ? ' class="akt"' : '') + '>' + sym(x[1]) + '<span>' + x[2] + '</span></button>'; }).join('') + '</div><div class="rollen" id="nliste"></div>');
    nachrichtenZeigen();
  };
  Se.nachrichten_weg = function () {
    gelesenBis = nachrichten.reduce(function (m, n) { return Math.max(m, n.id); }, gelesenBis); B.schreiben('nachrichten_gelesen', gelesenBis);
    nachrichten.forEach(function (n) { n.neu = false; }); mailNeu = 0;
  };
  Tun['n-tab'] = function (el) { nZustand().nTab = el.getAttribute('data-t'); [].forEach.call(document.querySelectorAll('[data-tun=n-tab]'), function (b) { b.classList.toggle('akt', b === el); }); nachrichtenZeigen(); };
  function nachrichtenZeigen() {
    var z = nZustand(), box = $('#nliste'); if (!box) return;
    if (z.nTab === 'mail') { mailZeigen(); return; }
    var oben = '';
    if (!B.hatExtra()) oben = '<div class="block creme"><p style="margin:0">WhatsApp-Nachrichten gibt es nur in der App auf dem Handy (ab 4.4).</p></div>';
    else if (!zugriff()) oben = '<div class="block creme"><h2>' + sym('schloss') + 'WhatsApp-Nachrichten einblenden</h2>' +
      '<p style="margin:0 0 8px">Das Navi liest neue Nachrichten von WhatsApp, Telegram, Signal und SMS aus den Benachrichtigungen des Handys und blendet sie auf der Karte ein – auf Wunsch mit Vorlesen und Antworten. Dafür einmal „Zugriff auf Benachrichtigungen“ für <b>Fehnverleih Navi</b> erlauben.</p>' +
      '<button class="gold knopf breit" data-tun="n-zugriff">' + sym('zahnrad') + 'Zugriff erlauben</button>' +
      '<p class="klein2" style="margin:8px 0 0">Die Nachrichten bleiben auf dem Handy, nichts geht an die Verwaltung. WhatsApp selbst lässt keine andere App direkt an die Chats – das ist der einzige erlaubte Weg.</p></div>';
    var l = nachrichten.slice().reverse();
    box.innerHTML = oben + (l.length ? l.map(function (n) {
      return '<div class="eintrag nachricht' + (n.neu ? ' neu' : '') + '"><div class="txt"><b>' + h(n.wer) + (n.titel && n.titel !== n.wer ? ' <small>· ' + h(n.titel) + '</small>' : '') + '</b><span class="ntext">' + h(n.text) + '</span>' +
        '<small class="grau2">' + h((n.appName || '') + ' · ' + uhrzeit(n.zeit)) + '</small></div><div class="nknoepfe">' +
        '<button class="rund klein" data-tun="n-vorlesen" data-id="' + n.id + '" aria-label="Vorlesen">' + sym('ton') + '</button>' +
        (!n.alt && n.antworten ? '<button class="rund klein" data-tun="n-antworten" data-id="' + n.id + '" aria-label="Antworten">' + sym('antworten') + '</button>' : '') +
        (!n.alt ? '<button class="rund klein" data-tun="n-oeffnen" data-id="' + n.id + '" aria-label="In der App öffnen">' + sym('extern') + '</button>' : '') + '</div></div>';
    }).join('') + '<div style="height:6px"></div><button class="rand knopf breit" data-tun="n-leeren">' + sym('muell') + 'Liste leeren</button>'
      : (zugriff() ? '<div class="leer"><b>Noch keine Nachrichten</b>Neue WhatsApp-Nachrichten erscheinen hier und oben auf der Karte.</div>' : ''));
  }
  function finde(id) { id = +id; return nachrichten.filter(function (n) { return n.id === id; })[0]; }
  Tun['n-zugriff'] = function () { if (!B.hatExtra()) return nurApp(); B.extra('zugriffEinstellen', ''); A().toast('In der Liste „Fehnverleih Navi“ einschalten und mit Zurück hierher kommen.', 6000); };
  Tun['n-vorlesen'] = function (el) { var n = finde(el.getAttribute('data-id')); if (n) B.sprich((n.appName || 'Nachricht') + ' von ' + n.wer + ': ' + n.text); };
  Tun['n-oeffnen'] = function (el) { var r = B.extra('nachrichtOeffnen', { id: +el.getAttribute('data-id') }); if (!r || !r.ok) A().toast('Die Nachricht lässt sich nicht mehr öffnen (zu alt).'); };
  Tun['n-antworten'] = function (el) { antwortBlatt(+el.getAttribute('data-id')); };
  Tun['n-leeren'] = function () { A().frage('Alle Nachrichten aus der Liste nehmen?', 'Leeren').then(function (ja) { if (!ja) return; nachrichten = []; merken(); B.extra('nachrichtenLeeren', ''); nachrichtenZeigen(); }); };
  var SCHNELL = ['Bin unterwegs, melde mich gleich.', 'Fahre gerade – rufe zurück.', 'Bin in ca. 15 Minuten da.', 'Ok, danke!'];
  function antwortBlatt(id) {
    var n = finde(id); if (!n) return;
    A().blatt('<h2>' + sym('antworten') + '<span>Antwort an ' + h(n.wer) + '<br><small style="font-weight:400;font-size:13px">' + h(n.appName || '') + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
      '<p class="klein2" style="margin:0 0 8px">' + h(n.text) + '</p><div class="schnellantw">' + SCHNELL.map(function (t, i) { return '<button class="rand knopf" data-tun="n-senden" data-id="' + id + '" data-s="' + i + '">' + h(t) + '</button>'; }).join('') + '</div>' +
      '<textarea class="eingabe" id="ntext" rows="3" placeholder="Eigene Antwort"></textarea><div style="height:8px"></div><button class="gold knopf breit" data-tun="n-senden" data-id="' + id + '">' + sym('senden') + 'Senden</button>' +
      '<p class="klein2" style="margin:8px 0 0">Bitte nur im Stand tippen. Während der Fahrt die fertigen Antworten oben nehmen.</p>');
  }
  Tun['n-senden'] = function (el) {
    var id = +el.getAttribute('data-id'), si = el.getAttribute('data-s'), t = si != null ? SCHNELL[+si] : ($('#ntext') || {}).value || '';
    t = String(t).trim(); if (!t) return;
    var r = B.extra('nachrichtAntworten', { id: id, text: t });
    A().blattZu();
    A().toast(r && r.ok ? 'Antwort gesendet.' : 'Senden ging nicht – bitte in der App selbst antworten.', 3000);
  };

  /* ====================== E-Mail (IMAP, nur lesen) ====================== */
  var ANBIETER = [
    { id: 'gmx', name: 'GMX', server: 'imap.gmx.net', hinweis: 'In GMX unter E-Mail → Einstellungen → POP3/IMAP Abruf einmal „IMAP erlauben“ einschalten.' },
    { id: 'webde', name: 'WEB.DE', server: 'imap.web.de', hinweis: 'In WEB.DE unter E-Mail → Einstellungen → POP3/IMAP Abruf einmal „IMAP erlauben“ einschalten.' },
    { id: 'tonline', name: 'T-Online', server: 'secureimap.t-online.de', hinweis: 'Bei T-Online das eigene „E-Mail-Passwort“ nehmen (nicht das Kundencenter-Passwort).' },
    { id: 'gmail', name: 'Gmail', server: 'imap.gmail.com', hinweis: 'Google braucht ein App-Passwort: Google-Konto → Sicherheit → Bestätigung in zwei Schritten → App-Passwörter.' },
    { id: 'strato', name: 'Strato', server: 'imap.strato.de', hinweis: 'Das Passwort des Postfachs aus dem Strato-Kundenbereich.' },
    { id: 'ionos', name: 'IONOS / 1&1', server: 'imap.ionos.de', hinweis: '' },
    { id: 'outlook', name: 'Outlook / Hotmail', server: 'outlook.office365.com', hinweis: 'Microsoft erlaubt bei privaten Konten oft kein normales Passwort mehr – dann klappt es leider nicht.' },
    { id: 'icloud', name: 'iCloud', server: 'imap.mail.me.com', hinweis: 'Apple braucht ein „app-spezifisches Passwort“ (appleid.apple.com).' },
    { id: 'freenet', name: 'freenet', server: 'mx.freenet.de', hinweis: '' },
    { id: 'anders', name: 'Anderer', server: '', hinweis: 'IMAP-Server des Anbieters eintragen (Verbindung immer verschlüsselt über Port 993).' }
  ];
  function anbieterZu(mail) {
    var d = String(mail || '').split('@')[1] || '';
    if (/^gmx\./.test(d)) return 'gmx'; if (/^web\.de$/.test(d)) return 'webde'; if (/t-online\.de$/.test(d)) return 'tonline'; if (/^(gmail|googlemail)\./.test(d)) return 'gmail';
    if (/^(outlook|hotmail|live|msn)\./.test(d)) return 'outlook'; if (/^(icloud|me|mac)\.com$/.test(d)) return 'icloud'; if (/^freenet\.de$/.test(d)) return 'freenet';
    if (/^(online\.de|1und1\.de|ionos\.de)$/.test(d)) return 'ionos'; if (/fehnverleih\.de$/.test(d)) return 'strato';
    return '';
  }
  function konto() { var k = B.lesen('mailkonto', null); return k && k.adresse ? k : null; }
  var mailNeu = 0, mailListe = null, mailFehler = '', mailWarte = null, mailLetzt = 0, mailBekannt = B.lesen('mail_bekannt', 0) || 0;
  /** Abruf anstoßen; fertig(stand) kommt, wenn der Android-Teil fertig ist */
  function mailAbruf(extra, fertig) {
    var k = konto(); if (!k || !B.hatExtra()) return false;
    var d = Object.assign({ server: k.server, port: 993, benutzer: k.benutzer || k.adresse, passwort: k.passwort, anzahl: 30 }, extra || {});
    var st = B.extra('mailAbruf', d), nr = st && st.auftrag, n = 0;
    clearInterval(mailWarte);
    mailWarte = setInterval(function () {
      var s = B.extra('mailStand', '');
      if (!s || (s.laeuft && ++n < 90)) return;
      clearInterval(mailWarte);
      if (s.laeuft) { fertig({ ok: false, fehler: 'Zeitüberschreitung' }); return; }
      if (nr && s.auftrag && s.auftrag < nr) return;
      fertig(s);
    }, 500);
    return true;
  }
  function mailPruefen(still) {
    if (!konto() || A().e.mailAn === false || !S.angemeldet()) return;
    mailLetzt = Date.now();
    mailAbruf({}, function (s) {
      if (!s.ok) { mailFehler = s.fehler || 'Fehler'; if (A().oben() === 'nachrichten') mailZeigen(); return; }
      mailFehler = ''; mailListe = s.liste || [];
      var max = mailListe.reduce(function (m, x) { return Math.max(m, x.uid); }, 0);
      var neu = mailListe.filter(function (x) { return x.uid > mailBekannt && !x.gelesen; });
      if (mailBekannt && neu.length && !still) {
        mailNeu += neu.length;
        einblenden({ art: 'mail', app: 'E-Mail', titel: neu[0].von, text: neu[0].betreff || '(ohne Betreff)', mehr: neu.length - 1, uid: neu[0].uid });
        if (A().e.nachrichtenVorlesen !== false && FV.F && FV.F.aktiv) B.sprich('Neue E-Mail von ' + nameAus(neu[0].von) + ': ' + (neu[0].betreff || 'ohne Betreff'));
        knoepfeNeu(); startKachelNeu();
      }
      if (max > mailBekannt) { mailBekannt = max; B.schreiben('mail_bekannt', max); }
      if (A().oben() === 'nachrichten') mailZeigen();
    });
  }
  setInterval(function () { if (konto() && Date.now() - mailLetzt > 5 * 60000 && !document.hidden) mailPruefen(false); }, 30000);
  function nameAus(von) { var m = /^\s*"?([^"<]+?)"?\s*</.exec(von || ''); return m ? m[1] : String(von || '').replace(/[<>]/g, ''); }
  function mailZeigen() {
    var box = $('#nliste'), k = konto(); if (!box || nZustand().nTab !== 'mail') return;
    if (!B.hatExtra()) { box.innerHTML = '<div class="leer"><b>Nur in der App</b>E-Mails lesen geht nur in der App auf dem Handy (ab 4.4).</div>'; return; }
    if (!k) { box.innerHTML = mailFormHtml(); mailFormRichten(); return; }
    var kopf = '<div class="mailkopf">' + sym('mail') + '<span>' + h(k.adresse) + '</span><button class="rand knopf klein" data-tun="mail-neu">' + sym('neu') + 'Abrufen</button><button class="rand knopf klein" data-tun="mail-konto">' + sym('zahnrad') + '</button></div>';
    if (mailFehler) { box.innerHTML = kopf + '<div class="fehler">' + h(mailFehlerText(mailFehler)) + '</div>'; return; }
    if (!mailListe) { box.innerHTML = kopf + X.laedt('E-Mails werden abgerufen …'); if (Date.now() - mailLetzt > 15000) mailPruefen(true); return; }
    box.innerHTML = kopf + (mailListe.length ? mailListe.map(function (m) {
      return '<div class="eintrag tippbar mail' + (m.gelesen ? '' : ' neu') + '" data-tun="mail-auf" data-u="' + m.uid + '">' + sym('mail') + '<div class="txt"><b>' + h(nameAus(m.von)) + '</b><span>' + h(m.betreff || '(ohne Betreff)') + '</span><small class="grau2">' + h(datumText(m.datum)) + '</small></div>' + sym('rechts') + '</div>';
    }).join('') : '<div class="leer"><b>Posteingang leer</b></div>') + '<p class="klein2">Nur lesen: Das Navi löscht nichts und markiert nichts als gelesen.</p>';
  }
  function datumText(d) { var t = Date.parse(d); return isNaN(t) ? String(d || '') : uhrzeit(t); }
  function mailFehlerText(f) {
    if (/AUTHENTICATE|LOGIN|credentials|password|Passwort|auth/i.test(f)) return 'Anmeldung abgelehnt – E-Mail-Adresse oder Passwort stimmen nicht, oder IMAP ist beim Anbieter noch nicht erlaubt. (' + f + ')';
    if (/Unable to resolve|UnknownHost|resolve host/i.test(f)) return 'Der Server ist unbekannt – bitte den IMAP-Server prüfen. (' + f + ')';
    if (/timed out|timeout|Zeitüberschreitung/i.test(f)) return 'Keine Antwort vom Server – Internet prüfen. (' + f + ')';
    return 'Abruf ging nicht: ' + f;
  }
  function mailOeffnen(uid) {
    A().blatt('<h2>' + sym('mail') + '<span>E-Mail</span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' + X.laedt('Wird geladen …'));
    mailAbruf({ uid: uid }, function (s) {
      if (!$('#blatt') || $('#blatt').hidden) return;
      var m = s.ok && s.mail;
      if (!m) { A().blatt('<h2>' + sym('mail') + 'E-Mail<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><div class="fehler">' + h(mailFehlerText(s.fehler || 'nicht gefunden')) + '</div>'); return; }
      EX.offeneMail = m;
      A().blatt('<h2>' + sym('mail') + '<span>' + h(m.betreff || '(ohne Betreff)') + '<br><small style="font-weight:400;font-size:13px">' + h(nameAus(m.von)) + ' · ' + h(datumText(m.datum)) + '</small></span><button data-tun="blatt-zu">' + sym('zu') + '</button></h2>' +
        '<div class="mailtext">' + h(m.text || '(kein Text)').replace(/\n/g, '<br>') + '</div>' +
        (m.anhaenge && m.anhaenge.length ? '<p class="klein2">' + sym('notiz', 'inline') + ' Anhänge: ' + h(m.anhaenge.join(', ')) + ' (im E-Mail-Programm öffnen)</p>' : '') +
        '<div class="zweier"><button class="rand knopf" data-tun="mail-vorlesen">' + sym('ton') + 'Vorlesen</button><button class="rand knopf" data-tun="mail-still">' + sym('zu') + 'Stopp</button></div>');
    });
  }
  Tun['mail-auf'] = function (el) { mailOeffnen(+el.getAttribute('data-u')); };
  Tun['mail-vorlesen'] = function () { var m = EX.offeneMail; if (m) B.sprich('E-Mail von ' + nameAus(m.von) + '. Betreff: ' + (m.betreff || 'ohne Betreff') + '. ' + String(m.text || '').slice(0, 3000)); };
  Tun['mail-still'] = function () { B.still(); };
  Tun['mail-neu'] = function () { mailListe = null; mailFehler = ''; mailLetzt = 0; mailZeigen(); };
  Tun['mail-konto'] = function () { var b = $('#nliste'); if (b) { b.innerHTML = mailFormHtml(konto()); mailFormRichten(); } };
  function mailFormHtml(k) {
    k = k || {};
    var a = k.anbieter || 'gmx';
    return '<form class="block" data-form="mail-speichern" autocomplete="off"><h2>' + sym('mail') + 'E-Mail-Konto</h2>' +
      '<label class="feld">E-Mail-Adresse<input class="eingabe" id="madr" type="email" value="' + h(k.adresse || '') + '" placeholder="name@gmx.de" autocapitalize="none" spellcheck="false"></label>' +
      '<label class="feld">Passwort<input class="eingabe" id="mpass" type="password" value="' + h(k.passwort || '') + '" autocomplete="new-password"></label>' +
      '<label class="feld">Anbieter<select class="eingabe" id="manb">' + ANBIETER.map(function (x) { return '<option value="' + x.id + '"' + (x.id === a ? ' selected' : '') + '>' + h(x.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="feld" id="mserverfeld">IMAP-Server<input class="eingabe" id="mserver" value="' + h(k.server || '') + '" placeholder="imap.beispiel.de" autocapitalize="none" spellcheck="false"></label>' +
      '<p class="klein2" id="mhinweis" style="margin:0 0 10px"></p>' +
      '<button class="gold knopf breit">' + sym('haken') + 'Speichern und abrufen</button>' + (k.adresse ? '<div style="height:8px"></div><button type="button" class="rand knopf breit" data-tun="mail-weg">' + sym('muell') + 'Konto vom Handy löschen</button>' : '') +
      '<p class="klein2" style="margin:10px 0 0">Das Passwort bleibt nur auf diesem Handy und wird beim Abmelden gelöscht. Verbindung immer verschlüsselt (IMAP über SSL, Port 993). Das Navi liest nur – es löscht und verschickt nichts.</p></form>';
  }
  function mailFormRichten() {
    var adr = $('#madr'), anb = $('#manb'); if (!adr || !anb) return;
    function richten(neuWahl) {
      var x = ANBIETER.filter(function (y) { return y.id === anb.value; })[0] || ANBIETER[0];
      if (neuWahl && x.server) $('#mserver').value = x.server;
      $('#mserverfeld').style.display = x.id === 'anders' || !x.server ? '' : 'none';
      $('#mhinweis').textContent = x.hinweis || '';
    }
    adr.oninput = function () { var a = anbieterZu(adr.value); if (a && a !== anb.value) { anb.value = a; richten(true); } };
    anb.onchange = function () { richten(true); };
    richten(!$('#mserver').value);
  }
  Tun['mail-speichern'] = function () {
    var adr = $('#madr').value.trim(), pw = $('#mpass').value, an = $('#manb').value, sv = $('#mserver').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adr)) { A().toast('Bitte eine gültige E-Mail-Adresse eintragen.'); return; }
    if (!pw) { A().toast('Bitte das Passwort eintragen.'); return; }
    if (!sv) { var x = ANBIETER.filter(function (y) { return y.id === an; })[0]; sv = x && x.server; }
    if (!sv) { A().toast('Bitte den IMAP-Server eintragen.'); return; }
    B.schreiben('mailkonto', { adresse: adr, benutzer: adr, passwort: pw, anbieter: an, server: sv });
    mailListe = null; mailFehler = ''; mailBekannt = 0; B.schreiben('mail_bekannt', 0); mailLetzt = 0;
    mailZeigen();
  };
  Tun['mail-weg'] = function () { A().frage('E-Mail-Konto von diesem Handy löschen?', 'Löschen').then(function (ja) { if (!ja) return; B.schreiben('mailkonto', null); B.schreiben('mail_bekannt', null); mailListe = null; mailBekannt = 0; mailZeigen(); }); };

  /* ====================== Musik (Spotify) ====================== */
  var musikT = null;
  Tun.musik = function () { musikBlatt(); clearInterval(musikT); musikT = setInterval(function () { var b = $('#musikbox'); if (!b) { clearInterval(musikT); return; } b.innerHTML = musikInhalt(); }, 2500); };
  function musikInhalt() {
    if (!B.hatExtra()) return '<p class="klein2">Musik steuern geht nur in der App auf dem Handy (ab 4.4).</p>';
    var m = B.extra('medien', '') || {};
    var titel = m.aktiv ? (m.titel || 'Unbekannter Titel') : m.spielt ? 'Es läuft Musik' : 'Gerade läuft nichts';
    var wer = m.aktiv ? [m.kuenstler, m.app === 'com.spotify.music' ? 'Spotify' : ''].filter(Boolean).join(' · ') : '';
    return '<div class="musik"><div class="mtitel">' + sym('musik') + '<div><b>' + h(titel) + '</b><span>' + h(wer || ' ') + '</span></div></div>' +
      '<div class="mtasten"><button data-tun="m-taste" data-k="zurueck" aria-label="Zurück">' + sym('zurueckspur') + '</button><button class="gross" data-tun="m-taste" data-k="umschalten" aria-label="Abspielen/Pause">' + sym(m.spielt ? 'pause' : 'abspielen') + '</button><button data-tun="m-taste" data-k="weiter" aria-label="Weiter">' + sym('weiterspur') + '</button></div>' +
      (!m.zugriff ? '<p class="klein2" style="margin:8px 0 0">Titel und Künstler erscheinen hier, wenn der „Zugriff auf Benachrichtigungen“ erlaubt ist (Nachrichten → Zugriff erlauben). Die Tasten gehen auch so.</p>' : '') + '</div>';
  }
  function musikBlatt() {
    var da = B.hatExtra() && B.appDa('com.spotify.music');
    A().blatt('<h2>' + sym('musik') + 'Musik<button data-tun="blatt-zu">' + sym('zu') + '</button></h2><div id="musikbox">' + musikInhalt() + '</div>' +
      '<button class="gold knopf breit gross" data-tun="spotify">' + sym('extern') + (da ? 'Zu Spotify wechseln' : 'Spotify öffnen / installieren') + '</button>' +
      '<p class="klein2" style="margin:8px 0 0">Zurück ins Navi: mit der Zurück-Taste oder über die zuletzt benutzten Apps. Die Zielführung und die Ansagen laufen weiter.</p>');
  }
  Tun['m-taste'] = function (el) { if (!B.hatExtra()) return nurApp(); B.extra('medienTaste', { taste: el.getAttribute('data-k') }); setTimeout(function () { var b = $('#musikbox'); if (b) b.innerHTML = musikInhalt(); }, 600); };
  Tun.spotify = function () {
    A().blattZu();
    if (B.hatExtra()) { var r = B.extra('appOeffnen', { paket: 'com.spotify.music' }); if (r && r.ok) return; }
    if (!B.appStarten('com.spotify.music', 'https://open.spotify.com/')) B.oeffnen('https://play.google.com/store/apps/details?id=com.spotify.music');
  };

  /* ====================== Verkehrsfunk: Radio live + Meldungen rund um den Standort ====================== */
  var SENDER = [
    { id: 'ndr1nds', name: 'NDR 1 Niedersachsen', suche: 'NDR 1 Niedersachsen', ersatz: 'https://icecast.ndr.de/ndr/ndr1niedersachsen/oldenburg/mp3/128/stream.mp3', info: 'Region Oldenburg – Verkehr zur halben Stunde' },
    { id: 'ndr2', name: 'NDR 2', suche: 'NDR 2', ersatz: 'https://icecast.ndr.de/ndr/ndr2/niedersachsen/mp3/128/stream.mp3', info: 'Verkehr zur vollen und halben Stunde' },
    { id: 'ffn', name: 'radio ffn', suche: 'radio ffn', ersatz: '', info: 'Niedersachsen' },
    { id: 'antenne', name: 'Antenne Niedersachsen', suche: 'Antenne Niedersachsen', ersatz: '', info: 'Niedersachsen' },
    { id: 'bremen1', name: 'Bremen Eins', suche: 'Bremen Eins', ersatz: '', info: 'Radio Bremen' },
    { id: 'wdr2', name: 'WDR 2', suche: 'WDR 2', ersatz: '', info: 'Nordrhein-Westfalen' },
    { id: 'nporadio1', name: 'NPO Radio 1', suche: 'NPO Radio 1', ersatz: '', info: 'Niederlande' }
  ];
  var RB = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://all.api.radio-browser.info'];
  var streamMerker = B.lesen('radio_urls', {}) || {}, radio = null, radioSender = null;
  /** Aktuelle Stream-Adresse über radio-browser.info (freies Verzeichnis), sonst die eingebaute */
  function streamUrl(s) {
    if (streamMerker[s.id] && Date.now() - streamMerker[s.id].t < 7 * 86400000) return Promise.resolve(streamMerker[s.id].u);
    var i = 0;
    function frag() {
      return B.json({ url: RB[i] + '/json/stations/byname/' + encodeURIComponent(s.suche) + '?limit=8&hidebroken=true&order=clickcount&reverse=true', kopf: { 'User-Agent': 'FehnverleihNavi/4.4' }, zeit: 10000 }).catch(function (e) { if (++i < RB.length) return frag(); throw e; });
    }
    return frag().then(function (l) {
      var x = (l || []).filter(function (r) { return r.url_resolved && /^https:/.test(r.url_resolved) && FV.norm(r.name).indexOf(FV.norm(s.suche)) >= 0; })[0] || (l || []).filter(function (r) { return r.url_resolved; })[0];
      if (!x) throw new Error('nicht gefunden');
      streamMerker[s.id] = { u: x.url_resolved, t: Date.now() }; B.schreiben('radio_urls', streamMerker);
      return x.url_resolved;
    }).catch(function () { if (s.ersatz) return s.ersatz; throw new Error('Sender nicht gefunden'); });
  }
  EX.radioSpielt = function () { return !!(radio && !radio.paused); };
  function radioStopp() { if (radio) { try { radio.pause(); radio.removeAttribute('src'); radio.load(); } catch (e) {} } radioSender = null; radioNeu(); }
  function radioStart(s) {
    if (!radio) { radio = document.createElement('audio'); radio.id = 'radio'; radio.preload = 'none'; document.body.appendChild(radio); radio.onerror = function () { if (radioSender) { delete streamMerker[radioSender.id]; A().toast('Der Sender ist gerade nicht erreichbar.'); radioSender = null; radioNeu(); } }; radio.onplaying = radioNeu; }
    radioSender = s; radioNeu();
    streamUrl(s).then(function (u) {
      if (radioSender !== s) return;
      radio.src = u;
      var p = radio.play(); if (p && p.catch) p.catch(function () { A().toast('Das Radio konnte nicht starten.'); radioSender = null; radioNeu(); });
    }).catch(function () { A().toast(s.name + ' wurde nicht gefunden.'); radioSender = null; radioNeu(); });
  }
  function radioNeu() { var b = $('#radioliste'); if (b) b.innerHTML = radioHtml(); }
  function radioHtml() {
    return SENDER.map(function (s) {
      var an = radioSender === s, laeuft = an && radio && !radio.paused;
      return '<div class="eintrag tippbar' + (an ? ' zielbf' : '') + '" data-tun="radio" data-s="' + s.id + '">' + sym('radio') + '<div class="txt"><b>' + h(s.name) + '</b><span>' + h(an ? (laeuft ? 'läuft …' : 'verbindet …') : s.info) + '</span></div><div class="ende">' + sym(an ? 'pause' : 'abspielen') + '</div></div>';
    }).join('');
  }
  Tun.radio = function (el) { var s = SENDER.filter(function (x) { return x.id === el.getAttribute('data-s'); })[0]; if (!s) return; if (radioSender === s) radioStopp(); else radioStart(s); };
  Tun.verkehrsfunk = function () { A().blattZu(); A().zeige('verkehrsfunk'); };
  var vfStand = { liste: null, fehler: '', zeit: 0, wo: null };
  Se.verkehrsfunk = function () {
    X.seite(X.kopf('Verkehrsfunk', '<button class="rand knopf klein" data-tun="vf-neu">' + sym('neu') + 'Neu</button>') + '<div class="rollen">' +
      '<h3 class="ueber">' + sym('radio') + 'Radio live – Verkehr zur vollen und halben Stunde</h3><div id="radioliste">' + radioHtml() + '</div>' +
      '<p class="klein2" style="margin:2px 4px 10px">Das Radio läuft weiter, während das Navi die Route ansagt. Bei einer Ansage wird es nicht leiser – dafür kurz Pause drücken.</p>' +
      '<h3 class="ueber">' + sym('warnung') + 'Meldungen im Umkreis von 60 km</h3><div id="vfliste">' + X.laedt('Meldungen werden geholt …') + '</div>' +
      '<div class="zweier" style="margin:8px 0"><button class="gold knopf" data-tun="vf-vorlesen">' + sym('ton') + 'Vorlesen</button><button class="rand knopf" data-tun="mail-still">' + sym('zu') + 'Stopp</button></div>' +
      '<p class="klein2" style="margin:0 4px 10px">Quellen: Autobahn GmbH des Bundes' + (FV.V.schluessel() ? ' und TomTom (alle Straßen)' : ' (nur Autobahnen – mit TomTom-Schlüssel in der Verwaltung auch Land- und Bundesstraßen)') + '. Radio-Adressen: radio-browser.info.</p></div>');
    vfLaden(false);
  };
  function vfLaden(neu) {
    var o = B.ort() || (B.lesen('festorte', {}) || {}).lagerhalle || { lat: 53.2, lon: 7.6 };
    if (!neu && vfStand.liste && Date.now() - vfStand.zeit < 180000 && vfStand.wo && G.abstand(vfStand.wo, o) < 10000) { vfZeigen(); return; }
    FV.V.umgebung(o, 60000).then(function (l) { vfStand = { liste: l, fehler: '', zeit: Date.now(), wo: o }; vfZeigen(); })
      .catch(function (e) { vfStand.fehler = e && e.message || 'nicht erreichbar'; vfZeigen(); });
  }
  function vfZeigen() {
    var b = $('#vfliste'), V = FV.V; if (!b) return;
    if (vfStand.fehler && !vfStand.liste) { b.innerHTML = '<div class="fehler">Die Meldungen konnten gerade nicht geladen werden.</div>'; return; }
    var l = (vfStand.liste || []).filter(function (m) { return m.art !== 'baustelle' || m.gesperrt; }), bau = (vfStand.liste || []).length - l.length;
    b.innerHTML = l.length ? l.slice(0, 40).map(function (m) {
      return '<div class="eintrag vmeld ' + V.klasse(m) + '">' + sym(m.art === 'baustelle' ? 'baustelle' : 'warnung') + '<div class="txt"><b>' + h(V.titel(m)) + ' · ' + h(m.strasse || '') + '</b><span>' + h([m.abschnitt, m.richtung].filter(Boolean).join(' · ')) + '</span>' + (m.text ? '<small>' + h(m.text) + '</small>' : '') + '</div><div class="ende"><small>' + G.km(m.weit) + '</small>' + (m.verzoegerung >= 60 ? '<em class="spaet">' + h(V.verzText(m.verzoegerung)) + '</em>' : '') + '</div></div>';
    }).join('') + (bau ? '<p class="klein2" style="margin:4px">Dazu ' + bau + ' Baustellen ohne Sperrung.</p>' : '') : '<div class="gut">Keine Staus, Unfälle oder Sperrungen in der Nähe' + (bau ? ' (nur ' + bau + ' Baustellen)' : '') + '.</div>';
  }
  Tun['vf-neu'] = function () { var b = $('#vfliste'); if (b) b.innerHTML = X.laedt('Meldungen werden geholt …'); vfLaden(true); };
  Tun['vf-vorlesen'] = function () {
    var V = FV.V, l = (vfStand.liste || []).filter(function (m) { return m.art !== 'baustelle' || m.gesperrt; }).slice(0, 8);
    if (!l.length) { B.sprich('Verkehrsfunk: Keine Staus, Unfälle oder Sperrungen in der Nähe.'); return; }
    B.sprich('Verkehrsfunk. ' + l.map(function (m) { return (m.strasse || '') + ', ' + (m.abschnitt || '') + (m.richtung ? ', ' + m.richtung : '') + ': ' + V.sprache(m) + '.'; }).join(' '));
  };

  /* ====================== Einstellungen ====================== */
  EX.einstellungen = function (sch) {
    var e = A().e, k = konto(), zg = B.hatExtra() && zugriff(), r = B.hatExtra() ? B.extra('rechteStand', { liste: RECHTE_TEL }) : null;
    var tel = r ? (rechteFehlen(r).length ? 'noch nicht alles erlaubt' : 'Kontakte, Anrufliste und Anrufen erlaubt') : 'nur in der App';
    var ais = FV.LIVE ? FV.LIVE.aisSchluessel() : '', vonServer = !!(A().z.verkehr && A().z.verkehr.aisstream);
    return '<div class="block"><h2>' + sym('chat') + 'Telefon, Nachrichten, Musik</h2>' +
      '<button class="schalter" data-tun="telefon">' + sym('telefon') + '<span>Telefon<small>' + h(tel) + '</small></span>' + sym('rechts') + '</button>' +
      '<button class="schalter" data-tun="n-zugriff">' + sym('chat') + '<span>WhatsApp, Telegram, Signal, SMS einblenden<small>' + (B.hatExtra() ? (zg ? 'Zugriff erlaubt ✓' : 'Zugriff auf Benachrichtigungen erlauben') : 'nur in der App') + '</small></span>' + sym('rechts') + '</button>' +
      sch('nachrichtenAn', 'chat', 'Neue Nachrichten auf der Karte einblenden') +
      sch('nachrichtenVorlesen', 'ton', 'Nachrichten während der Fahrt vorlesen', 'Absender und Text, nur während der Zielführung') +
      '<button class="schalter" data-tun="nachrichten-mail">' + sym('mail') + '<span>E-Mail-Konto<small>' + h(k ? k.adresse : 'noch keins eingetragen') + '</small></span>' + sym('rechts') + '</button>' +
      '<button class="schalter" data-tun="musik">' + sym('musik') + '<span>Musik / Spotify<small>Titel, Pause, Weiter – und zu Spotify wechseln</small></span>' + sym('rechts') + '</button></div>' +
      '<div class="block"><h2>' + sym('schiff') + 'Züge und Schiffe live</h2>' +
      sch('zuege', 'zug', 'Züge, Busse und Fähren live', 'nach Fahrplan und Echtzeit (Transitous), mit Liniennummer') +
      sch('schiffe', 'schiff', 'Schiffe live (AIS)', 'alle Schiffe mit Namen und Kennung, wie bei MarineTraffic') +
      '<label class="feld">Schlüssel für aisstream.io' + (vonServer && !e.aisSchluessel ? ' <small>(kommt aus der Verwaltung)</small>' : '') + '<input class="eingabe" id="aiskey" value="' + h(e.aisSchluessel || '') + '" placeholder="' + (vonServer ? 'aus der Verwaltung' : 'leer = keine Schiffe') + '" autocapitalize="none" spellcheck="false"></label>' +
      '<button class="rand knopf breit" data-tun="ais-speichern">Speichern</button>' +
      '<p class="klein2" style="margin:8px 2px 0">Schiffe kommen per AIS von aisstream.io. Der Schlüssel ist kostenlos: auf aisstream.io mit einem GitHub-Konto anmelden → „API Keys“ → Schlüssel kopieren. Am besten trägt ihn das Büro in der Verwaltung (Einstellungen → App) ein, dann gilt er für alle Handys.' +
      (ais ? '' : ' Zurzeit ist kein Schlüssel da – Fähren mit Fahrplan erscheinen trotzdem.') + '</p></div>';
  };
  Tun['ais-speichern'] = function () { A().e.aisSchluessel = $('#aiskey').value.trim(); A().speichern(); A().toast(A().e.aisSchluessel ? 'Gespeichert. Schiffe erscheinen auf der Karte.' : 'Gelöscht.'); if (FV.LIVE) FV.LIVE.neu(); };
  Tun['nachrichten-mail'] = function () { A().z.nTab = 'mail'; A().zeige('nachrichten'); };

  /* ====================== Vollbild-Leiste während der Zielführung: Uhrzeit · Abfahrt · Ankunft ====================== */
  EX.vollLeiste = function () { return '<div class="vollzeiten" id="vollzeiten"><div><b id="vzuhr">–</b><span>Uhrzeit</span></div><div><b id="vzab">–</b><span>Abfahrt</span></div><div><b id="vzan">–</b><span>Ankunft</span></div><div class="km"><b id="vzgef">–</b><span>Gefahren</span></div><div class="km"><b id="vzrest">–</b><span>Bis zum Ziel</span></div></div>'; };
  function kmZahl(m) { return G.km(m); }
  EX.vollNeu = function (s, n) {
    var u = $('#vzuhr'); if (!u) return;
    u.textContent = G.uhr(new Date());
    var ab = n && (n.abfahrt || (n.reise && n.reise.legs && n.reise.legs[0] && n.reise.legs[0].ab));
    $('#vzab').textContent = ab ? G.uhr(new Date(ab)) : '–';
    if (s) { $('#vzan').textContent = s.ankunft ? G.uhr(s.ankunft) : '–'; $('#vzrest').textContent = s.restM != null ? kmZahl(s.restM) : '–'; }
    var gm = (FV.B.zaehler() || {}).meter || 0, gf = $('#vzgef'); if (gf) gf.textContent = kmZahl(gm);
  };
  setInterval(function () { var u = $('#vzuhr'); if (u) u.textContent = G.uhr(new Date()); }, 10000);
})();
