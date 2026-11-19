#!/usr/bin/env python3
"""Active le lot Uruzal / Mère de la Toile : retire le flag locked des fiches du lot,
réapplique les fiches modifiées (Uruzal, Balam Kaal, Onaya, Mère de la Toile), la quête et le résumé.
Usage: python3 tools/activer_balamor.py puis python3 tools/check_data.py, incrémenter VER, commit.
"""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
M = json.loads((root / "tools/balamor/modifs.json").read_text(encoding="utf-8"))
idx = json.loads((root / "data/index.json").read_text(encoding="utf-8"))["fichiers"]
for f in idx:
    p = root / "data" / f
    d = json.loads(p.read_text(encoding="utf-8"))
    for i, e in enumerate(d):
        if e["id"] in M["locked"]:
            e.pop("locked", None)
        if e["id"] in M["entites"]:
            d[i] = M["entites"][e["id"]]
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
q = root / "data/quetes.json"
d = json.loads(q.read_text(encoding="utf-8"))
for x in d["quetes"]:
    if x["titre"] == M["quete"]["titre"]:
        x["texte"] = M["quete"]["texte"]
q.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
pp = root / "data/parties.json"
d = json.loads(pp.read_text(encoding="utf-8"))
if not any(x["titre"] == M["partie"]["titre"] for x in d["parties"]):
    d["parties"].append(M["partie"])
pp.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Lot Balamor activé.")
