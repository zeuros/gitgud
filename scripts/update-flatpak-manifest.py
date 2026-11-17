#!/usr/bin/env python3
"""Points the Flathub manifest at a release's sources.

Usage:
  python3 scripts/update-flatpak-manifest.py --manifest <path> \
    --url https://github.com/zeuros/gitgud/archive/refs/tags/v2.14.0.tar.gz --sha256 <hex>

Rewrites the `url` and `sha256` of the source archive of a GitGud tag, whatever the field order in its block.
"""

import argparse
import re
import sys
from pathlib import Path

TAG_ARCHIVE = re.compile(r'https://github\.com/zeuros/gitgud/archive/refs/tags/\S+')


def replace_tag_archive(text: str, url: str, sha256: str) -> str:
    # One part per source block, so a block's url and sha256 are rewritten together
    parts = re.split(r'(?=\n[ \t]*- type:)', text)
    found = False
    for index, part in enumerate(parts):
        if TAG_ARCHIVE.search(part):
            found = True
            part = re.sub(r'([ \t]+url:[ \t]+)\S+', rf'\g<1>{url}', part)
            parts[index] = re.sub(r'([ \t]+sha256:[ \t]+)\S+', rf'\g<1>{sha256}', part)
    if not found:
        sys.exit("ERROR: no source archive of a GitGud tag in the manifest")
    return "".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="The tag's source archive")
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--manifest", required=True, help="Path to the manifest YAML")
    args = parser.parse_args()

    manifest = Path(args.manifest)
    if not manifest.exists():
        sys.exit(f"ERROR: manifest not found: {manifest}")

    manifest.write_text(replace_tag_archive(manifest.read_text(), args.url, args.sha256))
    print(f"Updated {manifest} to {args.url}")


if __name__ == "__main__":
    main()
