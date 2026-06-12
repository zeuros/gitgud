#!/usr/bin/env python3
"""Update the Flathub manifest with a new release version and sha256 checksums.

Usage:
  python3 scripts/update-flatpak-manifest.py --version 2.5.0 \
    --sha256-x64 <hex> --sha256-arm64 <hex>

The script rewrites the `url` and `sha256` fields for both arches in
build/flatpak/io.github.zeuros.gitgud.yml (or a path given via --manifest).
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

    # Replace url under the matching only-arches block
    url_pattern = re.compile(
        rf"(only-arches: \[{re.escape(arch_tag)}\]\n\s+url: )[^\n]+"
    )
    text, n = url_pattern.subn(rf"\g<1>{new_url}", text)
    if n == 0:
        sys.exit(f"ERROR: could not find url block for arch {arch_tag}")

    # Replace sha256 on the line immediately after that url
    sha_pattern = re.compile(
        rf"(only-arches: \[{re.escape(arch_tag)}\]\n\s+url: [^\n]+\n\s+sha256: )[^\n]+"
    )
    text, n = sha_pattern.subn(rf"\g<1>{sha256}", text)
    if n == 0:
        sys.exit(f"ERROR: could not find sha256 block for arch {arch_tag}")

    return text


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True, help="New release version (no leading v)")
    parser.add_argument("--sha256-x64", required=True, dest="sha256_x64")
    parser.add_argument("--sha256-arm64", required=True, dest="sha256_arm64")
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
    text = replace_arch(text, "aarch64", args.version, args.sha256_arm64)
    manifest.write_text(text)
    print(f"Updated {manifest} to v{args.version}")


if __name__ == "__main__":
    main()
