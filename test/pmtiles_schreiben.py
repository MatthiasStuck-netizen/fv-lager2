"""Unabhängiger PMTiles-v3-Schreiber (nach Spezifikation) für Tests.
Erzeugt Kacheln für z0..zmax; Inhalt = gzip("z/x/y"), einige Kacheln fehlen, einige sind Duplikate (Lauflängen).
Mit kleinem Wurzelverzeichnis, damit Blattverzeichnisse entstehen."""
import gzip, struct, sys, json, random

def xy2d(n, x, y):
    # Wikipedia-Hilbert mit voller Kantenlänge n
    d = 0
    s = n // 2
    while s > 0:
        rx = 1 if (x & s) > 0 else 0
        ry = 1 if (y & s) > 0 else 0
        d += s * s * ((3 * rx) ^ ry)
        if ry == 0:
            if rx == 1:
                x = n - 1 - x
                y = n - 1 - y
            x, y = y, x
        s //= 2
    return d

def tile_id(z, x, y):
    return sum(4 ** i for i in range(z)) + xy2d(2 ** z, x, y)

def varint(v):
    out = bytearray()
    while True:
        b = v & 0x7F
        v >>= 7
        if v:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)

def dir_bytes(entries):
    out = bytearray(varint(len(entries)))
    last = 0
    for e in entries:
        out += varint(e['id'] - last); last = e['id']
    for e in entries: out += varint(e['run'])
    for e in entries: out += varint(e['len'])
    for i, e in enumerate(entries):
        if i > 0 and e['off'] == entries[i - 1]['off'] + entries[i - 1]['len']:
            out += varint(0)
        else:
            out += varint(e['off'] + 1)
    return gzip.compress(bytes(out), mtime=0)

def main(pfad, zmax, blatt_groesse):
    random.seed(7)
    tiles = {}
    for z in range(zmax + 1):
        for x in range(2 ** z):
            for y in range(2 ** z):
                r = random.random()
                if r < 0.1:
                    continue  # fehlt
                inhalt = f"{z}/{x}/{y}".encode()
                tiles[tile_id(z, x, y)] = (inhalt, (z, x, y))
    # Duplikate: einige Nachbar-IDs mit gleichem Inhalt "DUP"
    ids = sorted(tiles)
    for k in range(0, len(ids), 23):
        for i in ids[k:k + 5]:
            tiles[i] = (b"DUP", tiles[i][1])
    ids = sorted(tiles)
    data = bytearray(); entries = []; seen = {}
    for i in ids:
        inhalt, _ = tiles[i]
        if entries and inhalt == b"DUP" and entries[-1]['dup'] and entries[-1]['id'] + entries[-1]['run'] == i:
            entries[-1]['run'] += 1
            continue
        if inhalt == b"DUP" and b"DUP" in seen:
            off, ln = seen[b"DUP"]
        else:
            c = gzip.compress(inhalt, mtime=0)
            off, ln = len(data), len(c)
            data += c
            seen[inhalt] = (off, ln)
        entries.append({'id': i, 'run': 1, 'off': off, 'len': ln, 'dup': inhalt == b"DUP"})
    # Blattverzeichnisse
    blaetter = bytearray(); wurzel = []
    for k in range(0, len(entries), blatt_groesse):
        teil = entries[k:k + blatt_groesse]
        b = dir_bytes(teil)
        wurzel.append({'id': teil[0]['id'], 'run': 0, 'off': len(blaetter), 'len': len(b)})
        blaetter += b
    w = dir_bytes(wurzel)
    meta = gzip.compress(json.dumps({"name": "test"}).encode(), mtime=0)
    kopf_len = 127
    wurzel_off = kopf_len; meta_off = wurzel_off + len(w); blatt_off = meta_off + len(meta); daten_off = blatt_off + len(blaetter)
    h = bytearray(b"PMTiles") + bytes([3])
    for v in (wurzel_off, len(w), meta_off, len(meta), blatt_off, len(blaetter), daten_off, len(data), len(tiles), len(entries), len(seen)):
        h += struct.pack('<Q', v)
    h += bytes([1, 2, 2, 1, 0, zmax])  # clustered, innen gzip, kacheln gzip, mvt, minz, maxz
    h += struct.pack('<iiii', int(5.8e7), int(47.2e7), int(15.1e7), int(55.1e7))
    h += bytes([6]) + struct.pack('<ii', int(10.4e7), int(51.1e7))
    assert len(h) == 127, len(h)
    with open(pfad, 'wb') as f:
        f.write(h + w + meta + blaetter + data)
    # Erwartung für den Test
    erwart = {f"{z}/{x}/{y}": (None if tile_id(z, x, y) not in tiles else tiles[tile_id(z, x, y)][0].decode())
              for z in range(zmax + 1) for x in range(2 ** z) for y in range(2 ** z)}
    with open(pfad + '.json', 'w') as f:
        json.dump(erwart, f)
    print('Kacheln', len(tiles), 'Einträge', len(entries), 'Blätter', len(wurzel), 'Bytes', len(h + w + meta + blaetter + data))

if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]))
