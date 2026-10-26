#!/usr/bin/env python3
"""Convertit des images en WebP pour le Codex.
Usage:
  python3 tools/optimize_images.py <dossier_source> <dossier_cible> [--type pnj|paysage]
- pnj     : largeur max 600 px, transparence conservée (portraits et pions)
- paysage : largeur max 1800 px (villes, cartes)
Le nom du fichier de sortie est le nom d'entrée en minuscules, sans accents ni espaces (ex: Yureï Poison.png -> yurei-poison.webp).
Nécessite: pip install pillow
"""
import sys, re, unicodedata
from pathlib import Path
from PIL import Image

def slug(name):
    s = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    kind = sys.argv[sys.argv.index("--type") + 1] if "--type" in sys.argv else "pnj"
    width = 600 if kind == "pnj" else 1800
    dst.mkdir(parents=True, exist_ok=True)
    for f in sorted(src.iterdir()):
        if f.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        im = Image.open(f)
        im = im.convert("RGBA") if kind == "pnj" else im.convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        out = dst / (slug(f.stem) + ".webp")
        im.save(out, "WEBP", quality=82, method=6)
        print(f"{f.name} -> {out.name} ({out.stat().st_size // 1024} Ko)")

if __name__ == "__main__":
    main()
