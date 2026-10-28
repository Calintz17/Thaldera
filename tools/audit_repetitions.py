#!/usr/bin/env python3
"""Signal repetition candidates without editing narrative content."""
import json
import re
import unicodedata
from pathlib import Path

root = Path(__file__).resolve().parent.parent
index = json.loads((root / "data/index.json").read_text(encoding="utf-8"))
entries = [e for f in index["fichiers"]
           for e in json.loads((root / "data" / f).read_text(encoding="utf-8"))]

def terms(value):
    value = unicodedata.normalize("NFD", str(value)).lower()
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return {w for w in re.findall(r"[a-z0-9]+", value) if len(w) >= 4}

def blocks(e):
    out = []
    for key in ("resume", "chapeau", "question"):
        if isinstance(e.get(key), str) and len(e[key]) > 30:
            out.append((key, e[key]))
    for key in ("connu", "histoire"):
        for i, text in enumerate(e.get(key, [])):
            if isinstance(text, str) and len(text) > 30:
                out.append((f"{key}[{i}]", text))
    for i, step in enumerate(e.get("etapes", [])):
        if isinstance(step.get("texte"), str):
            out.append((f"etapes[{i}]", step["texte"]))
    return out

candidates = []
for e in entries:
    if e["type"] not in ("pnj", "pj"):
        continue
    texts = blocks(e)
    for i, (ka, a) in enumerate(texts):
        for kb, b in texts[i + 1:]:
            ta, tb = terms(a), terms(b)
            if not ta or not tb:
                continue
            common = len(ta & tb)
            similarity = common / len(ta | tb)
            containment = common / min(len(ta), len(tb))
            if common >= 5 and (similarity >= 0.36 or containment >= 0.51):
                candidates.append((similarity, containment, e["id"], e["nom"], ka, kb))
candidates.sort(reverse=True)
print(f"{len(candidates)} paires à relire dans {len({c[2] for c in candidates})} fiches.")
for similarity, containment, ident, nom, ka, kb in candidates[:35]:
    print(f"[À RELIRE] {nom} ({ident}), {ka} / {kb}, similarité {similarity:.0%}, recouvrement {containment:.0%}")
print("Diagnostic éditorial uniquement. Résumé/chronologie peuvent volontairement reprendre des faits.")
