/* Verbindung zur Fehnverleih-Warenwirtschaft (warenwirtschaft.php, Adresse …/?lagerapp) */
(function () {
  'use strict';
  var B = FV.B;
  var S = FV.S = { url: 'https://www.fehnverleih.de/?lagerapp', an: B.anmeldung() || {} };
  S.demo = false;
  S.angemeldet = function () { return S.demo || !!(S.an && S.an.token); };
  S.admin = function () { return S.an && S.an.rolle === 'admin'; };

  function senden(daten, zeit) {
    if (S.demo) return new Promise(function (ok) { setTimeout(function () { ok(FV.Demo.server(daten)); }, 120); });
    return B.http({ methode: 'POST', url: S.url, kopf: { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json' }, daten: JSON.stringify(daten), zeit: zeit || 20000 })
      .then(function (r) {
        var j; try { j = JSON.parse(r.text); } catch (e) { throw new Error(r.status === 404 ? 'Server-Adresse nicht gefunden.' : 'Der Server antwortet nicht wie erwartet.'); }
        return j;
      });
  }
  /** Ruft eine Aktion auf. Wirft bei Fehlern; meldet Abmeldung und Stempel-Sperre an die App. */
  S.ruf = function (aktion, daten, zeit) {
    var d = Object.assign({ aktion: aktion, token: S.an.token || '' }, daten || {});
    return senden(d, zeit).then(function (r) {
      if (r.typ === 'abgemeldet') { S.abmeldenLokal(); if (FV.app) FV.app.abgemeldet('Deine Anmeldung ist abgelaufen. Bitte neu anmelden.'); var e1 = new Error('Abgemeldet'); e1.stop = true; throw e1; }
      if (r.typ === 'gesperrt') { if (FV.app) FV.app.gesperrt(r.msg || ''); var e2 = new Error(r.msg || 'Gesperrt'); e2.stop = true; throw e2; }
      if (r.typ !== 'ok') { var e3 = new Error(r.msg || 'Serverfehler'); e3.antwort = r; e3.unbekannt = /Unbekannte Aktion/i.test(r.msg || ''); throw e3; }
      if (!S.demo && r.name && r.name !== S.an.name) { S.an.name = r.name; B.anmeldungSetzen(S.an); }
      return r;
    });
  };
  S.anmelden = function (admin, passwort, ausweis) {
    var geraet = 'Fehnverleih Navi · ' + (B.info().geraet || 'Android');
    var d = admin ? { aktion: 'login_admin', passwort: passwort, geraet: geraet } : { aktion: 'login_ma', code: ausweis, passwort: passwort, geraet: geraet };
    return senden(d).then(function (r) {
      if (r.typ !== 'ok' || !r.token) throw new Error(r.msg || 'Anmeldung fehlgeschlagen.');
      S.an = { token: r.token, rolle: r.rolle || (admin ? 'admin' : 'lager'), name: r.name || '' };
      B.anmeldungSetzen(S.an);
      return S.an;
    });
  };
  S.abmeldenLokal = function () { if (S.demo) { S.demo = false; S.an = B.anmeldung() || {}; return; } S.an = {}; B.anmeldungSetzen({}); };
  S.abmelden = function () { var p = S.angemeldet() ? S.ruf('abmelden').catch(function () {}) : Promise.resolve(); return p.then(S.abmeldenLokal); };

  /* ---------- Warteschlange: Fahrten, Tankbelege und Standort gehen nicht verloren, wenn kein Netz da ist ---------- */
  var schlange = B.lesen('schlange', []) || [], laeuft = false;
  function merken() { B.schreiben('schlange', schlange.slice(-60)); }
  S.spaeter = function (aktion, daten) { if (S.demo) { FV.Demo.server(Object.assign({ aktion: aktion }, daten)); return; } schlange.push({ a: aktion, d: daten, t: Date.now() }); merken(); S.nachsenden(); };
  S.wartend = function () { return schlange.length; };
  S.nachsenden = function () {
    if (S.demo || laeuft || !schlange.length || !S.angemeldet()) return Promise.resolve();
    laeuft = true;
    var x = schlange[0];
    return S.ruf(x.a, x.d, 45000).then(function () { schlange.shift(); merken(); laeuft = false; return S.nachsenden(); })
      .catch(function (e) {
        laeuft = false;
        // Der Server kennt die Aktion noch nicht (alte warenwirtschaft.php): Eintrag behalten, später erneut versuchen
        if (e.unbekannt || e.stop || !e.antwort) return;
        schlange.shift(); merken();   // endgültig abgelehnt (z. B. ungültige Daten) – nicht ewig wiederholen
        return S.nachsenden();
      });
  };
})();
