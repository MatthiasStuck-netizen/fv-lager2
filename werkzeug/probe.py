#!/usr/bin/env python3
"""Holt echte Beispielantworten der Karten-, Routen- und Wetterdienste (nur zum Entwickeln/Testen)."""
import json, os, sys, time, math, urllib.request, urllib.parse
UA = "FehnverleihNavi/3.0 (+https://www.fehnverleih.de)"
OUT = "probe"; os.makedirs(OUT, exist_ok=True)
log = []
def get(url, data=None, name=None, binary=False, headers=None):
    h = {"User-Agent": UA, "Accept": "*/*"}
    if headers: h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            b = r.read(); code = r.status; hd = dict(r.headers)
    except urllib.error.HTTPError as e:
        b = e.read(); code = e.code; hd = dict(e.headers)
    except Exception as e:
        log.append({"url": url[:300], "fehler": repr(e)}); return None
    log.append({"url": url[:300], "code": code, "bytes": len(b), "cors": hd.get("Access-Control-Allow-Origin", hd.get("access-control-allow-origin")), "typ": hd.get("Content-Type")})
    if name:
        p = os.path.join(OUT, name); os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(b)
    return b if binary else b.decode("utf-8", "replace")
def dec6(s, prec=6):
    pts=[]; i=lat=lon=0; f=10**prec
    while i < len(s):
        for k in (0,1):
            sh=res=0
            while True:
                b=ord(s[i])-63; i+=1; res|=(b&0x1f)<<sh; sh+=5
                if b<0x20: break
            d = ~(res>>1) if res&1 else res>>1
            if k==0: lat+=d
            else: lon+=d
        pts.append((lat/f, lon/f))
    return pts
# 1 Adressen
adr = {"lager": "Schulze-Flimmenstraße 20, 26689 Apen", "verwaltung": "Am Deich 6, Ostrhauderfehn", "kunde": "Hauptstraße 12, 26842 Ostrhauderfehn", "baecker": "Bäckerei Rhauderfehn"}
geo = {}
for k, a in adr.items():
    t = get("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"format": "jsonv2", "q": a, "countrycodes": "de", "limit": 5, "addressdetails": 1, "accept-language": "de"}), name=f"nominatim_{k}.json")
    try: j = json.loads(t); geo[k] = (float(j[0]["lat"]), float(j[0]["lon"]))
    except Exception: geo[k] = None
    time.sleep(1.2)
    t = get("https://photon.komoot.io/api/?" + urllib.parse.urlencode({"q": a, "lang": "de", "limit": 5, "lat": 53.2, "lon": 7.7}), name=f"photon_{k}.json")
a = geo.get("lager") or (53.2247, 7.7560); b = geo.get("kunde") or (53.1386, 7.6238)
json.dump({"geo": geo, "a": a, "b": b}, open(f"{OUT}/geo.json", "w"))
# 2 Valhalla
body = {"locations": [{"lat": a[0], "lon": a[1]}, {"lat": b[0], "lon": b[1]}], "costing": "auto", "units": "kilometers", "language": "de-DE", "directions_options": {"units": "kilometers", "language": "de-DE"}}
shape = None
for host in ("https://valhalla1.openstreetmap.de",):
    t = get(host + "/route?json=" + urllib.parse.quote(json.dumps(body)), name="valhalla_route_get.json")
    t = get(host + "/route", data=json.dumps(body).encode(), name="valhalla_route.json", headers={"Content-Type": "application/json", "Origin": "https://appassets.androidplatform.net"})
    try: shape = json.loads(t)["trip"]["legs"][0]["shape"]
    except Exception: pass
    if shape:
        tb = {"encoded_polyline": shape, "costing": "auto", "shape_match": "edge_walk", "filters": {"attributes": ["edge.speed_limit", "edge.speed", "edge.names", "edge.begin_shape_index", "edge.end_shape_index", "edge.road_class", "edge.length"], "action": "include"}}
        get(host + "/trace_attributes", data=json.dumps(tb).encode(), name="valhalla_trace.json", headers={"Content-Type": "application/json"})
        tb["shape_match"] = "map_snap"
        get(host + "/trace_attributes", data=json.dumps(tb).encode(), name="valhalla_trace_snap.json", headers={"Content-Type": "application/json"})
# 3 OSRM
get(f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{a[1]},{a[0]};{b[1]},{b[0]}?steps=true&geometries=polyline6&overview=full", name="osrm_route.json")
get(f"https://router.project-osrm.org/route/v1/driving/{a[1]},{a[0]};{b[1]},{b[0]}?steps=true&geometries=polyline6&overview=full", name="osrm_demo_route.json")
# 4 Overpass
pts = dec6(shape) if shape else [a, b]
step = max(1, len(pts)//60); sm = pts[::step] + [pts[-1]]
poly = ",".join(f"{p[0]:.5f},{p[1]:.5f}" for p in sm)
q = f"""[out:json][timeout:40];
(nwr["amenity"="toilets"]["access"!~"private|customers|no"](around:600,{poly});)->.t;
(nwr["amenity"="parking"](around.t:120);nwr["highway"~"^(rest_area|services)$"](around.t:200);)->.p;
(nwr.t(around.p:200);
 nwr["highway"="rest_area"]["toilets"="yes"](around:600,{poly});
 nwr["amenity"="parking"]["toilets"="yes"](around:600,{poly});)->.wc;
.wc out center tags;
nwr["amenity"="charging_station"](around:600,{poly});
out center tags;"""
open(f"{OUT}/overpass_query.txt", "w").write(q)
for host in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"):
    n = "overpass_" + host.split("/")[2].replace(".", "_") + ".json"
    get(host, data=("data=" + urllib.parse.quote(q)).encode(), name=n, headers={"Content-Type": "application/x-www-form-urlencoded"})
# nur Toiletten/Ladesaeulen ohne Parkplatz-Bedingung (zum Vergleich)
q2 = f"""[out:json][timeout:40];(nwr["amenity"="toilets"](around:600,{poly});nwr["highway"~"^(rest_area|services)$"](around:600,{poly}););out center tags;"""
get("https://overpass-api.de/api/interpreter", data=("data=" + urllib.parse.quote(q2)).encode(), name="overpass_toiletten_alle.json", headers={"Content-Type": "application/x-www-form-urlencoded"})
# 5 Wetter
heute = time.strftime("%Y-%m-%d"); ende = time.strftime("%Y-%m-%d", time.localtime(time.time() + 6*86400))
get(f"https://api.brightsky.dev/current_weather?lat={a[0]}&lon={a[1]}&tz=Europe/Berlin", name="brightsky_current.json")
get(f"https://api.brightsky.dev/weather?lat={a[0]}&lon={a[1]}&date={heute}&last_date={ende}&tz=Europe/Berlin", name="brightsky_weather.json")
get(f"https://api.brightsky.dev/alerts?lat={a[0]}&lon={a[1]}&tz=Europe/Berlin", name="brightsky_alerts.json")
# 6 Karte (OpenFreeMap)
for s in ("liberty", "bright", "positron", "dark", "fiord"):
    get(f"https://tiles.openfreemap.org/styles/{s}", name=f"ofm/style_{s}.json")
tj = get("https://tiles.openfreemap.org/planet", name="ofm/planet.json")
tpl = None
try: tpl = json.loads(tj)["tiles"][0]
except Exception: pass
def tile(lat, lon, z):
    n = 2**z; x = int((lon+180)/360*n); y = int((1 - math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n); return x, y
if tpl:
    lat0, lat1 = min(a[0], b[0]) - 0.06, max(a[0], b[0]) + 0.06; lon0, lon1 = min(a[1], b[1]) - 0.12, max(a[1], b[1]) + 0.12
    n = 0
    for z in range(5, 15):
        x0, y1 = tile(lat0, lon0, z); x1, y0 = tile(lat1, lon1, z)
        if z == 14:   # nur entlang der Strecke
            want = set()
            for p in pts[::3]:
                x, y = tile(p[0], p[1], z)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1): want.add((x+dx, y+dy))
        else:
            want = {(x, y) for x in range(x0-1, x1+2) for y in range(y0-1, y1+2)}
        for (x, y) in sorted(want):
            if n > 900: break
            get(tpl.replace("{z}", str(z)).replace("{x}", str(x)).replace("{y}", str(y)), name=f"ofm/tiles/{z}/{x}/{y}.pbf", binary=True); n += 1
    for font in ("Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"):
        for r in ("0-255", "256-511", "8192-8447"):
            get("https://tiles.openfreemap.org/fonts/" + urllib.parse.quote(font) + f"/{r}.pbf", name=f"ofm/fonts/{font}/{r}.pbf", binary=True)
    for sp in ("ofliberty", "ofliberty@2x"):
        for ext in ("json", "png"):
            get(f"https://tiles.openfreemap.org/sprites/{sp}.{ext}", name=f"ofm/sprites/{sp}.{ext}", binary=True)
# OSM-Rasterkachel (Ausweichkarte)
x, y = tile(a[0], a[1], 12)
get(f"https://tile.openstreetmap.org/12/{x}/{y}.png", name="osm_12.png", binary=True)
json.dump(log, open(f"{OUT}/_log.json", "w"), indent=1)
bad = [l for l in log if l.get("code") != 200]
print(json.dumps(bad, indent=1)); print("Abrufe:", len(log), "nicht 200:", len(bad))
