#!/usr/bin/env python3
"""
Script to verify sidebar and header consistency across certificate screens
"""

import re
from pathlib import Path

design_dir = Path("/Users/jeik/Documents/obsidian/work-vault/mi-empresa-app/.superdesign/design_iterations")

# Files to check
files_to_check = [
    "certificates-v2_1.html",
    "certificate-v2_create_1.html",
    "certificate-v2_detail_1.html"
]

print("=" * 80)
print("SIDEBAR & HEADER CONSISTENCY VERIFICATION")
print("=" * 80)
print()

issues_found = []

for filename in files_to_check:
    file_path = design_dir / filename
    if not file_path.exists():
        print(f"❌ File not found: {filename}")
        issues_found.append(f"{filename} - File missing")
        continue

    content = file_path.read_text(encoding='utf-8')

    print(f"📄 {filename}")
    print("-" * 80)

    # Check 1: Sidebar structure
    has_correct_sidebar_wrapper = 'padding: var(--spacing-xl)' in content
    has_wrong_sidebar_header = 'class="sidebar-header"' in content or 'class="sidebar-nav"' in content

    if has_correct_sidebar_wrapper and not has_wrong_sidebar_header:
        print("  ✓ Sidebar structure: CORRECT")
    else:
        print("  ✗ Sidebar structure: INCORRECT")
        issues_found.append(f"{filename} - Wrong sidebar structure")

    # Check 2: Menu labels
    has_inicio = '>Inicio<' in content
    has_dashboard = '>Dashboard<' in content
    has_certificados = '>Certificados<' in content
    has_certificacion = '>Certificación Empresarial<' in content

    if has_inicio and has_certificados and not has_dashboard and not has_certificacion:
        print("  ✓ Menu labels: CORRECT")
    else:
        print("  ✗ Menu labels: INCORRECT")
        if has_dashboard:
            issues_found.append(f"{filename} - Has 'Dashboard' instead of 'Inicio'")
        if has_certificacion:
            issues_found.append(f"{filename} - Has 'Certificación Empresarial' instead of 'Certificados'")

    # Check 3: Menu icons
    has_file_check = 'data-lucide="file-check"' in content
    has_shield_check = 'data-lucide="shield-check"' in content
    has_wallet = 'data-lucide="wallet"' in content
    has_banknote = 'data-lucide="banknote"' in content

    if has_file_check and has_wallet and not has_shield_check and not has_banknote:
        print("  ✓ Menu icons: CORRECT")
    else:
        print("  ✗ Menu icons: INCORRECT")
        if has_shield_check:
            issues_found.append(f"{filename} - Has 'shield-check' instead of 'file-check'")
        if has_banknote:
            issues_found.append(f"{filename} - Has 'banknote' instead of 'wallet'")

    # Check 4: Header structure
    has_notification_badge = 'background: #ef4444; color: white;">3<' in content
    has_username_text = '>jeik-sa<' in content
    has_back_button_in_header = re.search(r'<header[^>]*>.*?arrow-left.*?</header>', content, re.DOTALL)

    if has_notification_badge and has_username_text and not has_back_button_in_header:
        print("  ✓ Header structure: CORRECT")
    else:
        print("  ✗ Header structure: INCORRECT")
        if not has_notification_badge:
            issues_found.append(f"{filename} - Missing notification badge with count")
        if not has_username_text:
            issues_found.append(f"{filename} - Missing username text 'jeik-sa'")
        if has_back_button_in_header:
            issues_found.append(f"{filename} - Has back button in header (should be in page content)")

    # Check 5: JavaScript pattern
    has_correct_toggle = "sidebar.classList.toggle('open')" in content
    has_correct_overlay_class = "sidebarOverlay.classList.toggle('show')" in content
    has_wrong_functions = 'function openSidebar()' in content or 'function closeSidebarFunc()' in content

    if has_correct_toggle and has_correct_overlay_class and not has_wrong_functions:
        print("  ✓ JavaScript pattern: CORRECT")
    else:
        print("  ✗ JavaScript pattern: INCORRECT")
        if has_wrong_functions:
            issues_found.append(f"{filename} - Uses old function pattern instead of toggle")

    print()

print("=" * 80)
if len(issues_found) == 0:
    print("✅ ALL CHECKS PASSED - Sidebar and header are consistent!")
else:
    print(f"❌ FOUND {len(issues_found)} ISSUES:")
    for issue in issues_found:
        print(f"  • {issue}")
print("=" * 80)
