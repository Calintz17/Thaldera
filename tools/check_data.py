#!/usr/bin/env python3
"""Vérifie les fichiers data/*.json avant commit.
Contrôles: ids uniques, parents et relations existants, pas de tiret cadratin,
champ 'mj' interdit (les secrets du MJ ne vont jamais dans le dépôt public).
Usage: python3 tools/check_data.py
"""
import json, sys
from pathlib import Path
root = Path(__file__).resolve().parent.parent / "data"
idx = json.loads((root / "index.json").read_text(encoding="utf-8"))
data = []
for f in idx["fichiers"]:
    txt = (root / f).read_text(encoding="utf-8")
    if "—" in txt:
        print("Tiret cadratin dans", f); sys.exit(1)
    data += json.loads(txt)
ids = [e["id"] for e in data]
err = []
if len(ids) != len(set(ids)): err.append("ids en double")
S = set(ids)
for e in data:
    if "mj" in e: err.append(f"{e['id']}: champ mj interdit")
    if e.get("parent") and e["parent"] not in S: err.append(f"{e['id']}: parent inconnu")
    for r in e.get("relations", []):
        if r["cible"] not in S: err.append(f"{e['id']}: relation vers {r['cible']} inconnue")
print(len(data), "fiches", "OK" if not err else err)
sys.exit(1 if err else 0)
