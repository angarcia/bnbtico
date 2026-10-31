# Descarga de Wikimedia Commons (licencias libres: CC0, dominio público, CC BY, CC BY-SA) las fotos elegidas para las casas
# de prueba, genera las tres variantes (480/800/1600, JPEG calidad 80 con sips, como hace la app) y escribe creditos.md y
# fotos/manifest.json. Las fotos no se versionan (.gitignore). Las candidatas salen de candidatas.json.
import json, os, re, subprocess, time, urllib.request, concurrent.futures as cf
UA = "bnbtico-test-data/1.0 (test data seeding)"
HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(HERE, "fotos")
os.makedirs(F, exist_ok=True)
cand = {it["id"]: it for tag, l in json.load(open(os.path.join(HERE, "candidatas.json"))).items() for it in l}
# Casa -> fotos (la primera es la portada).
PLAN = {
 "a": ["exterior24", "pool14", "beach14", "living48", "bedroom3", "kitchen0", "bathroom4", "terrace53"],
 "b": ["exterior11", "terrace45", "kitchen45", "bedroom59", "bathroom8", "jungle13"],
 "c": ["living5", "bedroom50", "kitchen44", "bathroom15"],
 "d": ["bedroom34", "bathroom14", "exterior56"],
 "e": ["exterior28", "bedroom16", "bathroom9", "beach16"],
 "f": ["exterior57", "pool22", "pool25", "living53", "kitchen42", "bedroom44", "jungle4", "terrace50"],
 "g": ["living59", "kitchen30", "bedroom0"],
 "h": ["exterior18", "beach12", "beach13", "kitchen24"],
 "i": ["exterior44", "pool26", "beach7", "bedroom3", "bathroom5"],
 "j": ["exterior38", "living42", "kitchen43", "bathroom1", "beach2"],
 "l": ["exterior34", "beach8", "kitchen30", "bedroom59", "jungle7"],
 "m": ["exterior27", "beach17", "beach15"],
 "n": ["beach18", "exterior21", "bedroom44", "kitchen44"],
 "o": ["exterior2", "jungle5", "beach6"],
 "p": ["pool19", "exterior54", "kitchen0", "bathroom9"],
 "q": ["pool3", "jungle10", "bedroom16"],
 "r": ["pool4", "beach11", "living54", "bedroom0"],
 "s": ["pool0", "pool20", "bathroom0"],
 "t": ["beach9", "pool23", "bedroom3", "kitchen24"],
 "t_edit": ["bathroom14"],
}
ids = sorted({i for l in PLAN.values() for i in l})
def get(u):
    for k in range(5):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60).read()
        except Exception: time.sleep(3 + 3 * k)
def one(i):
    d = os.path.join(F, i)
    if os.path.exists(os.path.join(d, "1600.jpg")): return
    os.makedirs(d, exist_ok=True)
    src = os.path.join(d, "origen.jpg")
    if not os.path.exists(src):
        b = get(cand[i]["thumb"])
        if not b: raise SystemExit(f"no se pudo bajar {i}")
        open(src, "wb").write(b)
    for s in (480, 800, 1600):
        subprocess.run(["sips", "-Z", str(s), "-s", "format", "jpeg", "-s", "formatOptions", "80", src, "--out", os.path.join(d, f"{s}.jpg")], check=True, capture_output=True)
with cf.ThreadPoolExecutor(4) as ex: list(ex.map(one, ids))
json.dump(PLAN, open(os.path.join(F, "manifest.json"), "w"), indent=1)
clean = lambda s: re.sub(r"\s+", " ", s or "").strip()
rows = ["# Créditos de las fotos de prueba", "",
        "Fotos de Wikimedia Commons con licencia libre (CC0, dominio público, CC BY o CC BY-SA), solo para datos de prueba en bnbtico-pruebas. No se descargaron de Unsplash: su búsqueda queda detrás de un reto anti-bots y se evitó saltarlo. Los originales no se versionan; se redimensionaron a 480/800/1600 px.", "",
        "| Id | Título | Autor | Licencia | Página |", "|---|---|---|---|---|"]
for i in ids:
    c = cand[i]
    rows.append(f"| {i} | {clean(c['title']).replace('File:', '')} | {clean(c['artist'])[:70]} | {c['license']} | {c['page']} |")
open(os.path.join(HERE, "creditos.md"), "w").write("\n".join(rows) + "\n")
print(len(ids), "fotos")
