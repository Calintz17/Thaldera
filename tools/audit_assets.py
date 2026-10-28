#!/usr/bin/env python3
"""Audit des ressources du Codex, sans changer les données ni les images."""
import json
import sys
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

def point_in_polygon(point, polygon):
    """Ray-casting in normalized atlas coordinates, restricted to the correct map."""
    inside = False
    x, y = point["x"], point["y"]
    for i, curr in enumerate(polygon):
        prev = polygon[i - 1]
        if (curr[1] > y) != (prev[1] > y):
            if x < (prev[0] - curr[0]) * (y - curr[1]) / (prev[1] - curr[1]) + curr[0]:
                inside = not inside
    return inside

manual_map_review = []
for entity in entries:
    parent = by_id.get(entity.get("parent"))
    pos = entity.get("pos")
    if not parent or not parent.get("poly") or not isinstance(pos, dict):
        continue
    if not point_in_polygon(pos, parent["poly"]) or any(
        point_in_polygon(pos, hole) for hole in parent.get("polyx", [])
    ):
        manual_map_review.append((entity["id"], entity["nom"], parent["nom"], pos))

unused_npcs = sorted(p for p in images - references if "/pnj/" in p or p.startswith("img/pnj/"))
print(f"{len(entries)} fiches | {len(images)} images | {len(references)} références visuelles")
print(f"{len(unused_npcs)} portraits PNJ sans référence directe :")
for p in unused_npcs:
    print("  [À VÉRIFIER]", p)
print(f"{len(manual_map_review)} points à vérifier visuellement sur la carte source :")
for ident, name, region, point in manual_map_review:
    print(f"  [CARTE À VÉRIFIER] {name} ({ident}), territoire {region}, coordonnées {point}")
print(f"{len(warnings)} erreurs ou anomalies de structure :")
for line in warnings:
    print("  [ERREUR]", line)
print("Attention : un portrait orphelin peut être un doublon, un vestige ou une future fiche.")
sys.exit(1 if warnings else 0)
