#!/usr/bin/env python3
"""
Script to verify all HTML links in design iterations
"""

import os
import re
from pathlib import Path

design_dir = Path("/Users/jeik/Documents/obsidian/work-vault/mi-empresa-app/.superdesign/design_iterations")

# Get all HTML files (excluding old/deprecated)
html_files = sorted([f for f in design_dir.glob("*.html") if "old" not in f.name and "deprecated" not in f.name])

print("=" * 80)
print("LINK VERIFICATION REPORT")
print("=" * 80)
print()

all_broken = []
all_ok = True

for html_file in html_files:
    content = html_file.read_text(encoding='utf-8')

    # Find all href links to .html files
    links = re.findall(r'href="([^"]*\.html)"', content)
    # Remove duplicates and filter out external links
    links = sorted(set([l for l in links if not l.startswith('http')]))

    if links:
        print(f"\n📄 {html_file.name}")
        print("-" * 80)

        for link in links:
            target_file = design_dir / link
            if target_file.exists():
                print(f"  ✓ {link}")
            else:
                print(f"  ✗ MISSING: {link}")
                all_broken.append(f"{html_file.name} -> {link}")
                all_ok = False

print("\n" + "=" * 80)
if all_ok:
    print("✅ ALL LINKS ARE VALID!")
else:
    print(f"❌ FOUND {len(all_broken)} BROKEN LINKS:")
    for broken in all_broken:
        print(f"  • {broken}")
print("=" * 80)
