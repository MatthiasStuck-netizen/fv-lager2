"""Baut die neue Navi-APK aus der installierten Version:
1. Oberfläche (assets/www) austauschen, Version im Manifest erhöhen, alte Signatur entfernen
2. v1-Signatur mit jarsigner
3. Ausrichten (unkomprimierte Einträge auf 4 Byte)
4. v2-Signatur (APK Signature Scheme v2) mit demselben Schlüssel
Aufruf: bauen.py basis.apk www-ordner schluessel.jks passwort alias ziel.apk versionName versionCode"""
import hashlib, io, os, struct, subprocess, sys, tempfile, zipfile
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa, ec
from cryptography.hazmat.primitives.serialization import pkcs12
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import axml

basis, www, jks, pw, alias, ziel, vname, vcode = sys.argv[1:9]
arbeit = tempfile.mkdtemp(dir=os.path.dirname(os.path.abspath(ziel)))

# ---------- 1. Inhalt zusammenstellen ----------
alt = zipfile.ZipFile(basis)
eintraege = []   # (name, daten, komprimiert)
www_dateien = {}
for wurzel, _, dateien in os.walk(www):
    for d in dateien:
        p = os.path.join(wurzel, d)
        www_dateien['assets/www/' + os.path.relpath(p, www).replace(os.sep, '/')] = open(p, 'rb').read()
for zi in alt.infolist():
    n = zi.filename
    if n.startswith('META-INF/') and (n == 'META-INF/MANIFEST.MF' or n.endswith(('.SF', '.RSA', '.DSA', '.EC'))):
        continue
    if n.startswith('assets/www/'):
        continue
    daten = alt.read(n)
    if n == 'AndroidManifest.xml':
        daten = bytearray(daten)
        s, attrs = axml.lesen(bytes(daten))
        for el, an, raw, t, d, off in attrs:
            if el == 'manifest' and an == 'versionCode':
                struct.pack_into('<I', daten, off + 16, int(vcode))
        altname = s[[a for a in attrs if a[1] == 'versionName'][0][2]]
        assert len(altname) == len(vname), 'Versionsname muss gleich lang bleiben'
        for kod in ('utf-8', 'utf-16le'):
            a, b = altname.encode(kod), vname.encode(kod)
            if bytes(daten).count(a) == 1:
                i = bytes(daten).find(a); daten[i:i + len(a)] = b; break
        else:
            raise SystemExit('Versionsname nicht eindeutig gefunden')
        daten = bytes(daten)
    eintraege.append((n, daten, zi.compress_type != zipfile.ZIP_STORED))
alt_www = {zi.filename: zi.compress_type != zipfile.ZIP_STORED for zi in alt.infolist() if zi.filename.startswith('assets/www/')}
for n in sorted(www_dateien):
    eintraege.append((n, www_dateien[n], alt_www.get(n, not n.endswith(('.png', '.jpg', '.woff2')))))

def zip_schreiben(pfad, liste):
    """Schreibt die Einträge; unkomprimierte werden auf 4 Byte ausgerichtet (über das Extra-Feld)."""
    with open(pfad, 'wb') as f, zipfile.ZipFile(f, 'w') as z:
        for n, daten, komp in liste:
            zi = zipfile.ZipInfo(n, date_time=(2026, 10, 15, 0, 0, 0))
            zi.create_system = 0; zi.external_attr = 0
            zi.compress_type = zipfile.ZIP_DEFLATED if komp else zipfile.ZIP_STORED
            if not komp:
                kopf = f.tell() + 30 + len(n.encode('utf-8'))
                ausr = 4096 if n.endswith('.so') else 4
                pad = (-(kopf + 4)) % ausr
                zi.extra = struct.pack('<HH', 0xd935, pad) + b'\0' * pad
            z.writestr(zi, daten)

unsigniert = os.path.join(arbeit, 'unsigniert.apk')
zip_schreiben(unsigniert, eintraege)

# ---------- 2. v1-Signatur ----------
v1 = os.path.join(arbeit, 'v1.apk')
subprocess.run(['jarsigner', '-keystore', jks, '-storepass', pw, '-keypass', pw, '-digestalg', 'SHA-256', '-sigalg', 'SHA256withRSA',
                '-sigfile', 'FEHNVERL', '-signedjar', v1, unsigniert, alias], check=True, capture_output=True)

# ---------- 3. Ausrichten (jarsigner verschiebt die Einträge) ----------
z = zipfile.ZipFile(v1)
neu = [(zi.filename, z.read(zi.filename), zi.compress_type != zipfile.ZIP_STORED) for zi in z.infolist()]
ausgerichtet = os.path.join(arbeit, 'ausgerichtet.apk')
zip_schreiben(ausgerichtet, neu)

# ---------- 4. v2-Signatur ----------
schl, zert, _ = pkcs12.load_key_and_certificates(open(jks, 'rb').read(), pw.encode())
apk = open(ausgerichtet, 'rb').read()
eocd = apk.rfind(b'PK\x05\x06')
cd_off = struct.unpack('<I', apk[eocd + 16:eocd + 20])[0]
teile = [apk[:cd_off], apk[cd_off:eocd], apk[eocd:]]

def lp(b): return struct.pack('<I', len(b)) + b
def digest(stuecke):
    chunk_digests = []
    for t in stuecke:
        for i in range(0, len(t), 1048576):
            c = t[i:i + 1048576]
            chunk_digests.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest())
    return hashlib.sha256(b'\x5a' + struct.pack('<I', len(chunk_digests)) + b''.join(chunk_digests)).digest()

if isinstance(schl, rsa.RSAPrivateKey):
    alg = 0x0103
    def signieren(d): return schl.sign(d, padding.PKCS1v15(), hashes.SHA256())
else:
    alg = 0x0201
    def signieren(d): return schl.sign(d, ec.ECDSA(hashes.SHA256()))
dg = digest(teile)
signed_data = lp(lp(struct.pack('<I', alg) + lp(dg))) + lp(lp(zert.public_bytes(serialization.Encoding.DER))) + lp(b'')
signer = lp(signed_data) + lp(lp(struct.pack('<I', alg) + lp(signieren(signed_data)))) + \
         lp(schl.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo))
wert = lp(lp(signer))
paar = struct.pack('<Q', len(wert) + 4) + struct.pack('<I', 0x7109871a) + wert
groesse = len(paar) + 8 + 16
block = struct.pack('<Q', groesse) + paar + struct.pack('<Q', groesse) + b'APK Sig Block 42'
neues_eocd = bytearray(teile[2]); struct.pack_into('<I', neues_eocd, 16, cd_off + len(block))
open(ziel, 'wb').write(teile[0] + block + teile[1] + bytes(neues_eocd))
print('fertig:', ziel, len(teile[0]) + len(block) + len(teile[1]) + len(neues_eocd), 'Bytes, Signatur', hex(alg))
