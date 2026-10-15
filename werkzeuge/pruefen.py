"""Prüft eine APK wie Android: v2-Signatur (Inhalts-Prüfsumme + Unterschrift), Zertifikat, Ausrichtung, Version."""
import hashlib, struct, sys, zipfile
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, ec
sys.path.insert(0, __import__('os').path.dirname(__file__))
import axml

def lp_liste(b):
    out, p = [], 0
    while p < len(b):
        l = struct.unpack('<I', b[p:p + 4])[0]; out.append(b[p + 4:p + 4 + l]); p += 4 + l
    return out
def lp1(b, p): l = struct.unpack('<I', b[p:p + 4])[0]; return b[p + 4:p + 4 + l], p + 4 + l

def pruefe(pfad):
    apk = open(pfad, 'rb').read()
    eocd = apk.rfind(b'PK\x05\x06'); cd = struct.unpack('<I', apk[eocd + 16:eocd + 20])[0]
    assert apk[cd - 16:cd] == b'APK Sig Block 42', 'kein Signaturblock'
    groesse = struct.unpack('<Q', apk[cd - 24:cd - 16])[0]; start = cd - groesse - 8
    assert struct.unpack('<Q', apk[start:start + 8])[0] == groesse
    p = start + 8; v2 = None; ids = []
    while p < cd - 24:
        l, i = struct.unpack('<QI', apk[p:p + 12]); ids.append(hex(i))
        if i == 0x7109871a: v2 = apk[p + 12:p + 8 + l]
        p += 8 + l
    assert v2, 'keine v2-Signatur'
    signer = lp_liste(lp1(v2, 0)[0])[0]
    sd, q = lp1(signer, 0); sigs, q = lp1(signer, q); pub, q = lp1(signer, q)
    pk = serialization.load_der_public_key(pub)
    dig_liste, r = lp1(sd, 0); zerts, r = lp1(sd, r)
    zert = x509.load_der_x509_certificate(lp_liste(zerts)[0])
    assert zert.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo) == pub, 'Zertifikat passt nicht zum Schlüssel'
    for s in lp_liste(sigs):
        alg = struct.unpack('<I', s[:4])[0]; sig = lp1(s, 4)[0]
        if alg == 0x0103: pk.verify(sig, sd, padding.PKCS1v15(), hashes.SHA256())
        elif alg == 0x0201: pk.verify(sig, sd, ec.ECDSA(hashes.SHA256()))
        elif alg in (0x0104,): pk.verify(sig, sd, padding.PKCS1v15(), hashes.SHA512())
        else: continue
        break
    # Inhalts-Prüfsumme neu berechnen (EOCD zeigt dabei auf den Signaturblock)
    e = bytearray(apk[eocd:]); struct.pack_into('<I', e, 16, start)
    ch = []
    for t in (apk[:start], apk[cd:eocd], bytes(e)):
        for i in range(0, len(t), 1048576):
            c = t[i:i + 1048576]; ch.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest())
    ist = hashlib.sha256(b'\x5a' + struct.pack('<I', len(ch)) + b''.join(ch)).digest()
    soll = {struct.unpack('<I', d[:4])[0]: lp1(d, 4)[0] for d in lp_liste(dig_liste)}
    assert soll.get(0x0103, soll.get(0x0201)) == ist, 'Inhalts-Prüfsumme stimmt NICHT'
    z = zipfile.ZipFile(pfad); schlecht = []
    for zi in z.infolist():
        if zi.compress_type == 0:
            n = len(zi.filename.encode()); el = struct.unpack('<H', apk[zi.header_offset + 28:zi.header_offset + 30])[0]
            if (zi.header_offset + 30 + n + el) % 4: schlecht.append(zi.filename)
    assert z.testzip() is None
    s, a = axml.lesen(z.read('AndroidManifest.xml'))
    ver = {an: (s[d] if t == 3 else d) for el, an, raw, t, d, off in a if el == 'manifest' and an in ('versionCode', 'versionName', 'package')}
    return {'blöcke': ids, 'zertifikat_sha256': zert.fingerprint(hashes.SHA256()).hex(':').upper()[:47] + '…',
            'v2_gueltig': True, 'nicht_ausgerichtet': schlecht, 'version': ver, 'dateien': len(z.infolist())}

for p in sys.argv[1:]:
    print(p.split('/')[-1], pruefe(p))
