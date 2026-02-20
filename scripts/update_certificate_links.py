#!/usr/bin/env python3
"""
Script to update certificate menu links in all HTML files
"""

import os
import re
from pathlib import Path

design_dir = Path("/Users/jeik/Documents/obsidian/work-vault/mi-empresa-app/.superdesign/design_iterations")

# Files to update (excluding old, deprecated, and certificate files which are already correct)
files_to_update = [
    "dashboard_1.html",
    "employee_contract_1.html",
    "employee_edit_1.html",
    "employee_history_1.html",
    "employee_new_step_1_2_3_4_5.html",
    "employee_new_step_1_2_3_4.html",
    "employee_new_step_1_2_3.html",
    "employee_new_step_1_2.html",
    "employee_new_step_1.html",
    "employee_profile_1.html",
    "employees_list_1.html",
    "patient_clinical_history_1.html",
    "patient_new_note_1.html",
    "patient_note_detail_1.html",
    "patient_profile_1.html",
    "patients_list_1.html",
    "payroll_1.html"
]

# Pattern to find certificate menu link
old_pattern = r'<a href="certificates(_1)?\.html" class="sidebar-item'
new_link = '<a href="certificates-v2_1.html" class="sidebar-item'

updated_count = 0
error_count = 0

print("=" * 80)
print("UPDATING CERTIFICATE MENU LINKS")
print("=" * 80)
print()

for filename in files_to_update:
    file_path = design_dir / filename

    if not file_path.exists():
        print(f"⚠️  SKIP: {filename} (file not found)")
        continue

    try:
        content = file_path.read_text(encoding='utf-8')

        # Check if file has the old pattern
        if re.search(old_pattern, content):
            # Replace old pattern with new link
            new_content = re.sub(old_pattern, new_link, content)

            # Write back to file
            file_path.write_text(new_content, encoding='utf-8')

            print(f"✓ Updated: {filename}")
            updated_count += 1
        else:
            print(f"⊘ No change: {filename} (pattern not found)")

    except Exception as e:
        print(f"✗ ERROR: {filename} - {str(e)}")
        error_count += 1

print()
print("=" * 80)
print(f"SUMMARY: Updated {updated_count} files, {error_count} errors")
print("=" * 80)
