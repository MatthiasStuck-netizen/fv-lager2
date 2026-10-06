/* Nur für die Vorschau ohne Internet: einfacher Ersatz für die Karten-Bibliothek (zeichnet Felder, Route und Marken). */
(function () {
  function merc(lon, lat) { var s = Math.sin(lat * Math.PI / 180); return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]; }
  function rnd(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
  function Map(o) {
    var me = this; this.c = o.container; this.center = o.center || [7.7, 53.2]; this.zoom = o.zoom || 10; this.bearing = 0; this.pad = { top: 0, bottom: 0, left: 0, right: 0 };
    this.q = {}; this.l = []; this.h = {}; this.m = []; this.touchZoomRotate = { disableRotation: function () {} };
    this.cv = document.createElement('canvas'); this.cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; this.c.appendChild(this.cv);
    this.resize(); setTimeout(function () { me.fire('load'); }, 20);
  }
  Map.prototype = {
    on: function (e, f) { (this.h[e] = this.h[e] || []).push(f); return this; }, fire: function (e) { (this.h[e] || []).forEach(function (f) { f({}); }); },
    getContainer: function () { return this.c; }, getStyle: function () { return { layers: [], sources: {} }; },
    addSource: function (id, s) { var me = this; this.q[id] = { type: s.type, data: s.data, setData: function (d) { me.q[id].data = d; me.draw(); } }; }, getSource: function (id) { return this.q[id]; },
    addLayer: function (l) { this.l.push(l); }, getLayer: function (id) { return this.l.filter(function (x) { return x.id === id; })[0]; },
    getZoom: function () { return this.zoom; }, zoomIn: function () { this.zoom += 1; this.draw(); }, zoomOut: function () { this.zoom -= 1; this.draw(); }, remove: function () {},
    resize: function () { this.w = this.c.clientWidth || 300; this.hh = this.c.clientHeight || 300; this.cv.width = this.w * 2; this.cv.height = this.hh * 2; this.draw(); },
    px: function (lon, lat) {
      var s = 256 * Math.pow(2, this.zoom), a = merc(lon, lat), c = merc(this.center[0], this.center[1]), dx = (a[0] - c[0]) * s, dy = (a[1] - c[1]) * s, b = -this.bearing * Math.PI / 180;
      return [(this.w + this.pad.left - this.pad.right) / 2 + dx * Math.cos(b) - dy * Math.sin(b), (this.hh + this.pad.top - this.pad.bottom) / 2 + dx * Math.sin(b) + dy * Math.cos(b)];
    },
    jumpTo: function (o) { if (o.center) this.center = o.center; if (o.zoom != null) this.zoom = o.zoom; if (o.bearing != null) this.bearing = o.bearing; if (o.padding) this.pad = Object.assign({ top: 0, bottom: 0, left: 0, right: 0 }, o.padding); this.draw(); },
    easeTo: function (o) { this.jumpTo(o); },
    fitBounds: function (b, o) {
      var p = Object.assign({ top: 0, bottom: 0, left: 0, right: 0 }, o && o.padding || {}), a = merc(b[0][0], b[0][1]), c = merc(b[1][0], b[1][1]);
      var z = Math.min(Math.log2((this.w - p.left - p.right) / (256 * Math.abs(c[0] - a[0]))), Math.log2((this.hh - p.top - p.bottom) / (256 * Math.abs(c[1] - a[1]))));
      this.jumpTo({ center: [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2], zoom: Math.min(z, o && o.maxZoom || 18), bearing: 0, padding: p });
    },
    draw: function () {
      var g = this.cv.getContext('2d'), me = this; g.setTransform(2, 0, 0, 2, 0, 0); g.fillStyle = '#17361f'; g.fillRect(0, 0, this.w, this.hh);
      var st = this.zoom > 14 ? 0.002 : this.zoom > 11.5 ? 0.008 : 0.03, far = ['#1b3f24', '#20492a', '#16351e', '#24502d', '#1d4526', '#123019'];
      var lon0 = Math.floor((this.center[0] - 60 * st) / st) * st, lat0 = Math.floor((this.center[1] - 40 * st) / st) * st;
      for (var i = 0; i < 120; i++) for (var j = 0; j < 80; j++) {
        var x = lon0 + i * st, y = lat0 + j * st, a = this.px(x, y), b = this.px(x + st, y), c = this.px(x + st, y + st), d = this.px(x, y + st);
        if (Math.max(a[0], b[0], c[0], d[0]) < 0 || Math.min(a[0], b[0], c[0], d[0]) > this.w || Math.max(a[1], b[1], c[1], d[1]) < 0 || Math.min(a[1], b[1], c[1], d[1]) > this.hh) continue;
        g.fillStyle = far[Math.floor(rnd(Math.round(x / st), Math.round(y / st)) * far.length)]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.fill();
      }
      function linie(pts, farbe, breite) { if (!pts || pts.length < 2) return; g.strokeStyle = farbe; g.lineWidth = breite; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(function (p, k) { var q = me.px(p[0], p[1]); if (k) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke(); }
      linie([[7.40, 53.26], [7.52, 53.23], [7.60, 53.205], [7.70, 53.19], [7.82, 53.2]], '#e9c869', 2.5); linie([[7.45, 53.10], [7.47, 53.2], [7.46, 53.3]], '#f2b632', 3);
      linie([[7.55, 53.08], [7.62, 53.14], [7.66, 53.2], [7.76, 53.23]], '#ded8c4', 1.6); linie([[7.5, 53.16], [7.58, 53.165], [7.68, 53.15]], '#1a5d92', 3);
      var r = this.q.route && this.q.route.data.geometry.coordinates, w = Math.max(4, 6 * Math.pow(1.25, this.zoom - 13));
      linie(r, '#0a3f96', Math.min(22, w * 1.5)); linie(r, '#2b93ff', Math.min(15, w)); linie(this.q.gefahren && this.q.gefahren.data.geometry.coordinates, '#7f8a96', Math.min(15, w));
      this.m.forEach(function (x) { me.setze(x); });
    },
    setze: function (x) {
      if (!x.ll) return; var p = this.px(x.ll[0], x.ll[1]), o = x.o.offset || [0, 0], an = x.o.anchor || 'center';
      var t = an === 'bottom' ? 'translate(-50%,-100%)' : an === 'left' ? 'translate(0,-50%)' : an === 'right' ? 'translate(-100%,-50%)' : 'translate(-50%,-50%)';
      x.el.style.left = (p[0] + o[0]) + 'px'; x.el.style.top = (p[1] + o[1]) + 'px'; x.el.style.transform = t + (x.o.rotationAlignment === 'map' ? ' rotate(' + (x.rot - this.bearing) + 'deg)' : ''); x.el.style.zIndex = 2;
    }
  };
  function Marker(o) { this.o = o; this.el = o.element; this.rot = 0; }
  Marker.prototype = {
    setLngLat: function (l) { this.ll = l; if (this.map) this.map.setze(this); return this; }, setRotation: function (r) { this.rot = r; if (this.map) this.map.setze(this); return this; },
    addTo: function (m) { this.map = m; this.el.style.position = 'absolute'; m.c.appendChild(this.el); m.m.push(this); m.setze(this); return this; },
    remove: function () { var me = this; if (this.el.parentNode) this.el.parentNode.removeChild(this.el); if (this.map) this.map.m = this.map.m.filter(function (x) { return x !== me; }); return this; }
  };
  window.maplibregl = { Map: Map, Marker: Marker };
})();
