/* Tag- und Nachtdesign: helles oder dunkles Aussehen für die ganze App und die Karte.
 * Einstellung „design“: 'auto' (nach Sonnenauf- und -untergang am Standort), 'tag' (immer hell) oder 'nacht' (immer dunkel). */
window.FV = window.FV || {};
(function () {
  'use strict';
  var D = FV.D = {}, aktuell = null;
  var RAD = Math.PI / 180;
  function einst() { return (FV.app && FV.app.e) || (FV.B && FV.B.lesen('einstellungen', {})) || {}; }
  D.modus = function () { var m = einst().design; return m === 'tag' || m === 'nacht' ? m : 'auto'; };
  /** Höhe der Sonne über dem Horizont in Grad (Näherung, genau genug für Tag/Nacht) */
  D.sonnenhoehe = function (lat, lon, zeit) {
    var d = (zeit || new Date()).getTime() / 86400000 - 10957.5;   // Tage seit 1.1.2000 12 Uhr UTC
    var g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
    var dek = Math.asin(Math.sin(e) * Math.sin(L)), ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24, ha = (gmst * 15 + lon) * RAD - ra;
    return Math.asin(Math.sin(lat * RAD) * Math.sin(dek) + Math.cos(lat * RAD) * Math.cos(dek) * Math.cos(ha)) / RAD;
  };
  /** true = helles Design. Automatisch: hell, solange die Sonne höher als 3° unter dem Horizont steht (bürgerliche Dämmerung zählt noch zum Tag). */
  D.hell = function () {
    var m = D.modus(); if (m === 'tag') return true; if (m === 'nacht') return false;
    var o = FV.B && FV.B.ort && FV.B.ort();
    return D.sonnenhoehe(o ? o.lat : 53.2, o ? o.lon : 7.7) > -3;
  };
  /** Design anwenden; wechselt es, werden Karte und Seite angepasst */
  D.anwenden = function (erzwingen) {
    var hell = D.hell();
    if (hell === aktuell && !erzwingen) return;
    aktuell = hell;
    document.documentElement.classList.toggle('hell', hell);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', hell ? '#f4f1ea' : '#06090d');
    try { if (FV.B && FV.B.nativ && window.FVNative && FVNative.design) FVNative.design(hell ? 'hell' : 'dunkel'); } catch (e) {}
    if (FV.K && FV.K.designNeu) FV.K.designNeu();
  };
  D.anwenden(true);
  setInterval(function () { if (!document.hidden) D.anwenden(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) D.anwenden(); });
})();
