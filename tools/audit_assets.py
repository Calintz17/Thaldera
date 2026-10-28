#!/usr/bin/env python3
"""Audit des ressources du Codex, sans changer les données ni les images."""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
index = json.loads((ROOT / "data/index.json").read_text(encoding="utf-8"))
entries = [e for name in index["fichiers"]
           for e in json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))]
by_id = {e["id"]: e for e in entries}
images = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*")
          if p.is_file() and p.suffix.lower() in {".webp", ".png", ".jpg", ".jpeg", ".svg"}}
references = set()
warnings = []
FIELDS = {"img", "fond", "blason", "vignette"}

def inspect(value, owner):
    if isinstance(value, list):
        for x in value:
            inspect(x, owner)
    elif isinstance(value, dict):
        for field, child in value.items():
            if field in FIELDS and isinstance(child, str) and child and not child.startswith("http"):
                references.add(child)
                if child not in images:
                    warnings.append(f"IMAGE MANQUANTE [{owner}] {child}")
            else:
                inspect(child, owner)

for entity in entries:
    ident = entity["id"]
    inspect(entity, ident)
    if entity.get("parent") and entity["parent"] not in by_id:
        warnings.append(f"PARENT INCONNU [{ident}]: {entity['parent']}")
    if entity.get("lieu") and entity["lieu"] not in by_id:
        warnings.append(f"LIEU INCONNU [{ident}]: {entity['lieu']}")
    coords = [entity.get("pos"), entity.get("lab")]
    coords += [entity.get("zone")]
    for point in coords:
        if isinstance(point, dict):
            values = [point.get("x"), point.get("y")]
            if "w" in point:
                values += [point.get("x", 0) + point.get("w", 0),
                           point.get("y", 0) + point.get("h", 0)]
        elif isinstance(point, list):
            values = point
        else:
            continue
        if any(not isinstance(v, (int, float)) or not 0 <= v <= 1 for v in values):
            warnings.append(f"COORDONNEES HORS CARTE [{ident}]: {point}")
    for polygon in [entity.get("poly", []), *entity.get("polyx", [])]:
        for pt in polygon:
            if len(pt) != 2 or any(not isinstance(v, (int, float)) or not 0 <= v <= 1 for v in pt):
                warnings.append(f"POLYGONE HORS CARTE [{ident}]: {pt}")

unused_npcs = sorted(p for p in images - references if "/pnj/" in p or p.startswith("img/pnj/"))
print(f"{len(entries)} fiches | {len(images)} images | {len(references)} références visuelles")
print(f"{len(unused_npcs)} portraits PNJ sans référence directe :")
for p in unused_npcs:
    print("  [À VÉRIFIER]", p)
print(f"{len(warnings)} erreurs ou anomalies de structure :")
for line in warnings:
    print("  [ERREUR]", line)
print("Attention : un portrait orphelin peut être un doublon, un vestige ou une future fiche.")
sys.exit(1 if warnings else 0)
