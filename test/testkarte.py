"""Kleine echte Vektorkarte (MVT, OpenMapTiles-Ebenen) als PMTiles für den Browsertest.
Gebiet um Rhauderfehn, z0..14. Jede Kachel: Wasser, Wald, Wohngebiet, Straßen, Gebäude (Muster, keine echten Daten)."""
import gzip, math, struct, sys, json
sys.path.insert(0, sys.argv[2] if len(sys.argv) > 2 else '.')
from pmtiles_schreiben import tile_id, dir_bytes

def vint(v):
    out = bytearray()
    while True:
        b = v & 0x7F; v >>= 7
        if v: out.append(b | 0x80)
        else: out.append(b); return bytes(out)
def feld(nr, typ, daten):
    if typ == 0: return vint(nr << 3) + vint(daten)
    return vint((nr << 3) | 2) + vint(len(daten)) + daten
def gepackt(werte): return b''.join(vint(v) for v in werte)
def zz(n): return (n << 1) ^ (n >> 31)

def geom(ringe, typ):
    out = []; cx = cy = 0
    for ring in ringe:
        pts = ring[:-1] if typ == 3 else ring
        x, y = pts[0]; out += [1 | (1 << 3), zz(x - cx), zz(y - cy)]; cx, cy = x, y
        out.append(2 | ((len(pts) - 1) << 3))
        for x, y in pts[1:]:
            out += [zz(x - cx), zz(y - cy)]; cx, cy = x, y
        if typ == 3: out.append(7 | (1 << 3))
    return out

def ebene(name, merkmale):
    keys, vals, feats = [], [], b''
    for typ, ringe, tags in merkmale:
        t = []
        for k, v in tags.items():
            if k not in keys: keys.append(k)
            if v not in vals: vals.append(v)
            t += [keys.index(k), vals.index(v)]
        feats += feld(2, 2, feld(2, 2, gepackt(t)) + feld(3, 0, typ) + feld(4, 2, gepackt(geom(ringe, typ))))
    body = feld(15, 0, 2) + feld(1, 2, name.encode()) + feats
    for k in keys: body += feld(3, 2, k.encode())
    for v in vals:
        body += feld(4, 2, feld(1, 2, v.encode()) if isinstance(v, str) else feld(6, 0, v))
    body += feld(5, 0, 4096)
    return feld(3, 2, body)

def rechteck(x0, y0, x1, y1): return [[(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]]

def kachel(z):
    t = b''
    t += ebene('landcover', [(3, rechteck(2600, 0, 4096, 1500), {'class': 'wood'})])
    t += ebene('landuse', [(3, rechteck(1500, 2200, 3600, 3900), {'class': 'residential'})])
    t += ebene('water', [(3, rechteck(0, 0, 1200, 4096), {'class': 'river'})])
    t += ebene('transportation', [
        (2, [[(0, 2000), (4096, 2000)]], {'class': 'motorway'}),
        (2, [[(1300, 0), (4096, 4096)]], {'class': 'primary'}),
        (2, [[(2000, 2200), (2000, 4096)]], {'class': 'minor'})])
    if z >= 13:
        t += ebene('building', [(3, rechteck(1700 + i * 400, 2600, 1950 + i * 400, 2850), {}) for i in range(4)])
    return t

def kxy(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return x, y

def main(pfad):
    tiles = {}
    for z in range(15):
        x0, y0 = kxy(7.3, 53.5, z); x1, y1 = kxy(8.1, 52.9, z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                tiles[tile_id(z, x, y)] = gzip.compress(kachel(z), mtime=0)
    ids = sorted(tiles); data = bytearray(); entries = []
    for i in ids:
        entries.append({'id': i, 'run': 1, 'off': len(data), 'len': len(tiles[i])}); data += tiles[i]
    blaetter = bytearray(); wurzel = []
    for k in range(0, len(entries), 200):
        teil = entries[k:k + 200]; b = dir_bytes(teil)
        wurzel.append({'id': teil[0]['id'], 'run': 0, 'off': len(blaetter), 'len': len(b)}); blaetter += b
    w = dir_bytes(wurzel); meta = gzip.compress(b'{}', mtime=0)
    wo = 127; mo = wo + len(w); bo = mo + len(meta); do = bo + len(blaetter)
    h = bytearray(b'PMTiles') + bytes([3])
    for v in (wo, len(w), mo, len(meta), bo, len(blaetter), do, len(data), len(tiles), len(entries), len(tiles)):
        h += struct.pack('<Q', v)
    h += bytes([1, 2, 2, 1, 0, 14]) + struct.pack('<iiii', int(7.3e7), int(52.9e7), int(8.1e7), int(53.5e7)) + bytes([10]) + struct.pack('<ii', int(7.7e7), int(53.2e7))
    open(pfad, 'wb').write(bytes(h) + w + meta + blaetter + data)
    print('Kacheln', len(tiles), 'Bytes', len(h) + len(w) + len(meta) + len(blaetter) + len(data))

main(sys.argv[1])
