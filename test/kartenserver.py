"""Nachbau des Strato-Ordners für den Test: liefert /karten/* mit Größe, Teil-Downloads (Range) und CORS-Freigabe.
Schickt langsam (für den Anhalten-Test). Protokolliert OPTIONS-Anfragen (Vorab-Prüfung des Browsers)."""
import http.server, os, sys, time, re
WURZEL = sys.argv[1]; PORT = int(sys.argv[2])
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def kopf(self, code, laenge=None, extra=()):
        self.send_response(code)
        if code < 300 or os.environ.get('CORS_IMMER'):   # wie Strato mit "Header set": Freigabe nur bei Erfolg
            self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Expose-Headers', 'Content-Length, Content-Range')
        self.send_header('Accept-Ranges', 'bytes')
        if laenge is not None: self.send_header('Content-Length', str(laenge))
        for k, v in extra: self.send_header(k, v)
        self.end_headers()
    def pfad(self):
        p = os.path.join(WURZEL, self.path.split('?')[0].lstrip('/'))
        return p if os.path.isfile(p) else None
    def do_OPTIONS(self):
        open(os.path.join(WURZEL, 'options.log'), 'a').write(self.path + '\n')
        self.kopf(204, 0, [('Access-Control-Allow-Headers', 'Range'), ('Access-Control-Allow-Methods', 'GET, HEAD')])
    def do_HEAD(self):
        p = self.pfad()
        if not p: return self.kopf(404, 0)
        self.kopf(200, os.path.getsize(p))
    def do_GET(self):
        p = self.pfad()
        if not p: return self.kopf(404, 0)
        d = open(p, 'rb').read(); ab = 0
        m = re.match(r'bytes=(\d+)-$', self.headers.get('Range', ''))
        if m:
            ab = int(m.group(1)); teil = d[ab:]
            self.kopf(206, len(teil), [('Content-Range', f'bytes {ab}-{len(d) - 1}/{len(d)}')])
        else:
            teil = d; self.kopf(200, len(teil))
        try:
            for i in range(0, len(teil), 4096):
                self.wfile.write(teil[i:i + 4096]); self.wfile.flush(); time.sleep(0.03)
        except (BrokenPipeError, ConnectionResetError):
            pass
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
