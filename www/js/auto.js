/* Verbindung zu Android Auto.
 * Die Zielführung läuft weiter hier im Handy. Dieses Skript legt jede Sekunde den Stand (Position, nächste Abbiegung,
 * Restweg, Ankunft) und bei jeder neuen Route die Strecke im Speicher der App ab. Der Android-Auto-Teil liest das und
 * zeigt Karte und Abbiegehinweis auf dem Bildschirm im Auto.
 * Umgekehrt legt das Auto Befehle ab (Auftrag anfahren, Navigation beenden), die hier abgeholt werden. */
window.FV = window.FV || {};
(function () {
  'use strict';
  var B = FV.B;
  if (!B || !B.nativ) return;   // nur in der App auf dem Handy
  var letzteRoute = null, routeNr = 0, warAktiv = false, letzterBefehl = (B.lesen('autoBefehl', null) || {}).id || '';

  /** Strecke für das Auto: höchstens rund 3000 Punkte, damit der Speicher schnell bleibt */
  function punkteKurz(r) {
    var p = r.punkte || [], n = p.length, s = Math.max(1, Math.ceil(n / 3000)), aus = [];
    for (var i = 0; i < n; i += s) aus.push([+(+p[i][0]).toFixed(5), +(+p[i][1]).toFixed(5)]);
    if (n && (n - 1) % s) aus.push([+(+p[n - 1][0]).toFixed(5), +(+p[n - 1][1]).toFixed(5)]);
    return aus;
  }
  /** Ausfahrt im Kreisverkehr aus dem Text („die 2. Ausfahrt“) */
  function ausfahrt(t) { var m = /(\d+)\.\s*Ausfahrt/.exec(t || ''); return m ? +m[1] : 0; }

  function takt() {
    var F = FV.F, jetzt = Date.now();
    try {
      if (F && F.aktiv && F.route) {
        var r = F.route;
        if (r !== letzteRoute) {
          letzteRoute = r; routeNr++;
          var z = F.ziel || {};
          B.schreiben('autoRoute', { nr: routeNr, punkte: punkteKurz(r), ziel: { lat: z.lat, lon: z.lon, name: z.name || r.zielName || 'Ziel' } });
        }
        var s = F.stand, o = B.ort() || {}, sch = s && s.schritt || {};
        B.schreiben('autoStand', {
          aktiv: true, t: jetzt, nr: routeNr, lat: o.lat, lon: o.lon, kurs: o.kurs >= 0 ? o.kurs : -1, kmh: s ? s.kmh : 0,
          bis: s ? Math.round(s.bis) : -1, art: sch.ziel ? 'a_ziel' : (sch.art || 'a_gerade'), text: sch.text || '', hinweis: sch.hinweis || '',
          ausfahrt: ausfahrt(sch.text), restM: s ? Math.round(s.restM) : -1, restS: s ? Math.round(s.restS) : -1,
          ankunft: s && s.ankunft ? +s.ankunft : 0, limit: s && s.limit || 0, rechnet: !!(s && s.rechnet), ziel: (F.ziel && F.ziel.name) || r.zielName || 'Ziel'
        });
        warAktiv = true;
      } else {
        if (warAktiv) { warAktiv = false; letzteRoute = null; }
        var q = B.ort() || {};   // ohne Zielführung zeigt das Auto die Karte um den Standort
        B.schreiben('autoStand', { aktiv: false, t: jetzt, lat: q.lat, lon: q.lon, kurs: q.kurs >= 0 ? q.kurs : -1, kmh: q.tempo > 0 ? Math.round(q.tempo * 3.6) : 0 });
      }
      B.schreiben('autoPuls', jetzt);   // Lebenszeichen: die Navi auf dem Handy läuft
    } catch (e) { console.error(e); }
    befehl();
  }

  function befehl() {
    var b = B.lesen('autoBefehl', null);
    if (!b || !b.id || b.id === letzterBefehl) return;
    letzterBefehl = b.id;
    if (Date.now() - (b.t || 0) > 60000) return;   // alter Befehl, z. B. von einer früheren Fahrt
    var A = FV.app, Tun = FV.Tun;
    if (!A || !Tun) return;
    if (b.art === 'stopp') {
      if (FV.F && FV.F.aktiv && FV.fahrtBeenden) FV.fahrtBeenden();
      else if (FV.F) FV.F.stopp();
      return;
    }
    if (b.art === 'auftrag' && b.id2) {
      Tun.navi({ getAttribute: function () { return b.id2; } });
      startWenn();
      return;
    }
    if (b.art === 'ziel' && b.adresse) {
      A.zeige('vorschau', { ziel: { name: b.name || b.adresse, adresse: b.adresse, art: 'frei' }, modus: 'auto' });
      startWenn();
    }
  }
  /** Sobald die Route berechnet ist, die Zielführung von selbst starten (der Fahrer sitzt am Steuer) */
  function startWenn() {
    var bis = Date.now() + 45000;
    (function warte() {
      var k = document.querySelector('#vfuss [data-tun="route-start"]');
      if (k && !k.disabled && FV.app.z.nav && FV.app.z.nav.route) { FV.Tun['route-start'](k); return; }
      if (Date.now() < bis) setTimeout(warte, 500);
    })();
  }

  setInterval(takt, 1000);
  setTimeout(takt, 300);
})();
