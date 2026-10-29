#!/usr/bin/env python3
"""Codex media audit: dimensions and visual reference coverage without resizing assets.

Reports warnings to review. Only genuinely malformed linked images fail the build.
Standard-library parsing supports lossless and lossy WebP, PNG and baseline JPEG.
"""
import json
import re
import struct
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
index = json.loads((ROOT / "data/index.json").read_text(encoding="utf-8"))
entries = [e for name in index["fichiers"]
           for e in json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))]
assets = {p.relative_to(ROOT).as_posix(): p
          for p in (ROOT / "img").rglob("*") if p.is_file()}
used = set()

def inspect(value):
    if isinstance(value, list):
        for item in value:
            inspect(item)
    elif isinstance(value, dict):
        for key, val in value.items():
            if key in {"img", "fond", "vignette", "blason"} and isinstance(val, str):
                if not val.startswith("http"): used.add(val)
            else:
                inspect(val)

for entry in entries:
    inspect(entry)

def dimensions(path):
    data = path.read_bytes()
    if len(data) < 24: return None
    if data[:4] == b"\x89PNG":
        return struct.unpack(">II", data[16:24])
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        kind = data[12:16]
        if kind == b"VP8X" and len(data) >= 30:
            return (1 + int.from_bytes(data[24:27], "little"),
                    1 + int.from_bytes(data[27:30], "little"))
        if kind == b"VP8 ":
            mark = data.find(b"\x9d\x01\x2a", 20, 80)
            if mark != -1 and len(data) >= mark + 7:
                return (struct.unpack_from("<H", data, mark + 3)[0] & 0x3fff,
                        struct.unpack_from("<H", data, mark + 5)[0] & 0x3fff)
        if kind == b"VP8L" and len(data) >= 25:
            v = int.from_bytes(data[21:25], "little")
            return (1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff))
        return None
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 8 < len(data):
            if data[i] != 255: i += 1; continue
            code = data[i + 1]; i += 2
            if code in {0xD8, 0xD9, 0x01} or 0xD0 <= code <= 0xD7: continue
            if i + 2 > len(data): return None
            length = int.from_bytes(data[i:i+2], "big")
            if code in {0xC0, 0xC1, 0xC2, 0xC3} and i + 7 <= len(data):
                return (int.from_bytes(data[i+5:i+7], "big"),
                        int.from_bytes(data[i+3:i+5], "big"))
            i += length
    if path.suffix.lower() == ".svg":
        body = data.decode("utf-8", errors="replace")
        viewbox = re.search(r'viewBox=["\']\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', body)
        if viewbox: return (float(viewbox[3]), float(viewbox[4]))
    return None

results = {}
unreadable = []
for name, path in assets.items():
    if path.suffix.lower() not in {".webp", ".png", ".jpg", ".jpeg", ".svg"}: continue
    dims = dimensions(path)
    if not dims or min(dims) < 1:
        unreadable.append(name)
    else:
        results[name] = dims

linked_missing = sorted(x for x in used if x not in assets)
linked_unreadable = sorted(x for x in used if x in unreadable)
short_portraits = sorted((p, d) for p, d in results.items()
                         if p in used and (p.startswith("img/pnj/") or "/pnj/" in p)
                         and min(d) < 220)
short_landscapes = sorted((p, d) for p, d in results.items()
                          if p in used and (p.startswith("img/paysages/") or "/lieux/" in p)
                          and d[0] < 640)
extreme = sorted((p, d) for p, d in results.items()
                  if p in used and d[0] / d[1] > 4.2)
unused_portraits = sorted(x for x in assets if x.endswith(".webp")
                          and (x.startswith("img/pnj/") or "/pnj/" in x) and x not in used)
unassigned_landscapes = sorted(x for x in assets if x.startswith("img/paysages/")
                               and x.endswith(".webp") and x not in used)
no_portrait = [e for e in entries if e["type"] == "pnj" and not e.get("img")
               and not any(x.get("img") for x in e.get("formes", []))]
no_visual_place = [e for e in entries if e["type"] == "lieu"
                   and not e.get("galerie") and not e.get("cartes")]

print(f"Media audited: {len(results)} decodable assets, {len(used)} referenced image paths.")
print(f"Referenced missing: {len(linked_missing)}; referenced unreadable: {len(linked_unreadable)}.")
print(f"Low-resolution portrait candidates (<220 short side): {len(short_portraits)}.")
for p, d in short_portraits[:25]: print(f"  [PORTRAIT] {p} {d}")
print(f"Small landscape candidates (<640px wide): {len(short_landscapes)}.")
for p, d in short_landscapes[:25]: print(f"  [LANDSCAPE] {p} {d}")
print(f"Extreme panoramas (>4.2:1): {len(extreme)}.")
print(f"Unassigned portraits: {len(unused_portraits)}; unassigned landscapes: {len(unassigned_landscapes)}.")
print(f"NPCs without a portrait: {len(no_portrait)}; places without own galleries: {len(no_visual_place)}.")
for name in sorted(set(linked_missing + linked_unreadable)):
    print("  [BROKEN]", name)
if unreadable:
    print(f"Unparsable or unsupported formats: {len(unreadable)} (inspect individually).")
sys.exit(1 if linked_missing or linked_unreadable else 0)
