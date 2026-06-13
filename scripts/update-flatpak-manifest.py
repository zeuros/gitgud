#!/usr/bin/env python3
"""Update the Flathub manifest with a new release version and sha256 checksums.

Usage:
  python3 scripts/update-flatpak-manifest.py --version 2.5.0 \
    --sha256-x64 <hex> [--sha256-arm64 <hex>]

The script rewrites the `url` and `sha256` fields for both arches in
build/flatpak/io.github.zeuros.gitgud.yml (or a path given via --manifest).
Works regardless of field ordering within each source block.
"""

import argparse
import re
import sys
from pathlib import Path


def replace_arch(text: str, arch_tag: str, version: str, sha256: str) -> str:
    asset_arch = "x64" if arch_tag == "x86_64" else "arm64"
    new_url = (
        f"https://github.com/zeuros/gitgud/releases/download/"
        f"v{version}/GitGud-{version}-Linux-{asset_arch}.tar.gz"
    )

    # Split on source-item boundaries (lines that begin a new "- type:" block)
    # so nested list items like "- x86_64" under only-arches stay in the same
    # part as their parent key — field ordering within a block doesn't matter.
    parts = re.split(r'(?=\n[ \t]*- type:)', text)

    arch_re = re.escape(arch_tag)
    # Matches a block that belongs to this arch via:
    #   (a) only-arches: [x86_64] / only-arches:\n  - x86_64  (manifest with arch annotations)
    #   (b) a URL containing Linux-x64.tar.gz                  (manifest without only-arches)
    arch_marker = re.compile(
        rf'only-arches:[ \t]*(?:\[[ \t]*{arch_re}[ \t]*\]|[ \t]*\n[ \t]*-[ \t]+{arch_re}\b)'
        rf'|Linux-{asset_arch}\.tar\.gz'
    )

    found = False
    result_parts = []
    for part in parts:
        if arch_marker.search(part):
            found = True
            part = re.sub(r'([ \t]+url:[ \t]+)\S+', rf'\g<1>{new_url}', part)
            part = re.sub(r'([ \t]+sha256:[ \t]+)\S+', rf'\g<1>{sha256}', part)
        result_parts.append(part)

    if not found:
        sys.exit(f"ERROR: could not find url block for arch {arch_tag}")

    return "".join(result_parts)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True, help="New release version (no leading v)")
    parser.add_argument("--sha256-x64", required=True, dest="sha256_x64")
    parser.add_argument("--sha256-arm64", required=False, default=None, dest="sha256_arm64")
    parser.add_argument(
        "--manifest",
        default="build/flatpak/io.github.zeuros.gitgud.yml",
        help="Path to the manifest YAML",
    )
    args = parser.parse_args()

    manifest = Path(args.manifest)
    if not manifest.exists():
        sys.exit(f"ERROR: manifest not found: {manifest}")

    text = manifest.read_text()
    text = replace_arch(text, "x86_64", args.version, args.sha256_x64)
    if args.sha256_arm64:
        text = replace_arch(text, "aarch64", args.version, args.sha256_arm64)
    manifest.write_text(text)
    print(f"Updated {manifest} to v{args.version}")


if __name__ == "__main__":
    main()
