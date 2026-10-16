"""Liest die Versionsangaben aus einer binären AndroidManifest.xml und ändert sie an Ort und Stelle."""
import struct, sys
def lesen(b):
    assert struct.unpack('<HHI', b[:8])[0] == 3
    pos = 8; strings = []; res = []; attrs = []
    while pos < len(b):
        typ, hsz, sz = struct.unpack('<HHI', b[pos:pos+8])
        if typ == 0x0001:  # Stringpool
            n, stile, flags, sstart, _ = struct.unpack('<IIIII', b[pos+8:pos+28])
            utf8 = flags & 0x100
            offs = struct.unpack('<%dI' % n, b[pos+28:pos+28+4*n])
            for o in offs:
                p = pos + sstart + o
                if utf8:
                    l = b[p]; p += 2 if l & 0x80 else 1
                    l = b[p]; 
                    if l & 0x80: l = ((l & 0x7f) << 8) | b[p+1]; p += 2
                    else: p += 1
                    strings.append(b[p:p+l].decode('utf8', 'replace'))
                else:
                    l = struct.unpack('<H', b[p:p+2])[0]; p += 2
                    strings.append(b[p:p+2*l].decode('utf-16le'))
        elif typ == 0x0180:
            res = list(struct.unpack('<%dI' % ((sz-8)//4), b[pos+8:pos+sz]))
        elif typ == 0x0102:  # Start-Element
            name = struct.unpack('<I', b[pos+20:pos+24])[0]
            astart, asize, acount = struct.unpack('<HHH', b[pos+24:pos+30])
            for i in range(acount):
                a = pos + 16 + astart + i * asize
                ns, an, raw, vsz, _, dtyp, data = struct.unpack('<IIIHBBI', b[a:a+20])
                attrs.append((strings[name], strings[an], raw, dtyp, data, a))
        pos += sz
    return strings, attrs
if __name__ == '__main__':
    b = open(sys.argv[1], 'rb').read()
    s, a = lesen(b)
    for el, an, raw, t, d, off in a:
        if el == 'manifest' or an in ('minSdkVersion', 'targetSdkVersion'):
            print(el, an, 'roh=' + (s[raw] if raw != 0xffffffff else '-'), 'typ', hex(t), 'wert', d if t != 3 else s[d])
