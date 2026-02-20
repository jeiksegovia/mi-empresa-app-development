# /ux-summary

Generate or update UX/UI Summary capturing current app state, user flows, and screen inventory.

## Description

This command creates or updates the `UX_UI_SUMMARY.md` file which documents:
- Current application structure and sections
- User flows and navigation paths
- Screen inventory with status
- Shared UI components and cross-section interactions
- Recent changes log
- Active design patterns

**Why this matters:** After context compaction (`/compact`), conversation history is lost. The UX/UI summary preserves critical design decisions and app structure so future design sessions can continue seamlessly.

## When to Use

Execute this command after ANY of these events:

- After completing design work - User approves new screens/flows
- Navigation changes - Menu items added/removed/reordered
- New module/section - Entire new area added to app
- Shared component changes - Components used across sections modified
- Before `/compact` - Preserve current state before context loss

## What It Does

1. **Scans** `.superdesign/design_iterations/` for all HTML files
2. **Reads** `DESIGN_GUIDELINES.md` for current patterns and navigation structure
3. **Analyzes** screen files to identify:
   - Sections and modules
   - User flow hierarchies (list → detail → edit patterns)
   - Navigation menu structure
   - Shared components usage
4. **Updates or creates** `UX_UI_SUMMARY.md` with:
   - Application structure overview
   - User flows by section (with ASCII diagrams)
   - Screen inventory table
   - Recent changes log entry
   - Cross-section dependencies
5. **Increments** version number (e.g., 1.3 → 1.4)
6. **Preserves** previous important notes and historical changes

## Usage

In an active Claude Code session, after completing design work:

```
User: "I've approved these designs. Update the UX/UI summary please."
Main Agent: "Updating UX/UI summary with your approved changes..."
Main Agent: [Invokes ux-summary-updater subagent]
```

**No parameters needed.** The subagent:
- Inherits context from your approval message
- Knows which screens/sections you just worked on
- Scans design_iterations/ to find and analyze the new files
- Updates only Recent Changes and affected sections
- Preserves all historical documentation

## Expected Output

After the subagent completes:

1. **Confirmation**:
   - ✓ UX/UI Summary updated successfully
   - ✓ Changes documented in .superdesign/UX_UI_SUMMARY.md

2. **Summary Report**:
   - Screens added: [count and filenames]
   - Screens modified: [count and filenames]
   - New flows documented: [ASCII diagrams shown]
   - Version updated: [old → new]
   - Navigation changes: [if any]

3. **Integrity Check**:
   - All historical data preserved
   - No duplicates in Recent Changes log
   - Cross-section dependencies noted
   - All existing sections intact

**Example:**
```
✓ UX/UI Summary updated (v1.3 → v1.4)

Screens Added:
- instrumentos_discovery_1.html
- instrumentos_list_1.html
- instrumentos_detail_1.html
- instrumentos_edit_1.html

New User Flow (Instrumentos):
  discovery_1.html (Entry)
  └── Click "Explore" → list_1.html
      └── Click Row → detail_1.html
          └── Click "Edit" → edit_1.html

Navigation Updated:
- Added "Instrumentos" at position 5 in sidebar menu
- Now 8 total menu items (was 7)

Recent Changes logged for Jan 10, 2026
```

## Detailed Update Workflow (For Subagent)

When the subagent runs (after user approval), it performs these focused steps:

### Priority 1: Identify Recent Changes

```
1. List all files in .superdesign/design_iterations/ (sort by modification time)
2. Compare file list against Screen Inventory section in UX_UI_SUMMARY.md
3. Identify: NEW files (not in inventory yet) + MODIFIED files (timestamp newer than last update)
4. Note which section each file belongs to (parse filename)
```

### Priority 2: Analyze New/Modified Screens

For each new or modified file:
```
- Parse filename: {section}_{screentype}_{version}.html
- Examples:
  ✓ employees_list_1.html → section: employees, type: list
  ✓ patients_profile_2.html → section: patients, type: profile (version 2 = modified)
  ✓ onboarding_step_1.html → section: onboarding, type: wizard_step_1
  ✓ onboarding_step_1_2.html → section: onboarding, type: wizard_step_1_2

- Determine type patterns:
  • list, discovery, overview = Entry points
  • detail, profile, summary = Secondary screens (accessed from list)
  • edit, create, new = Modification screens (accessed from detail)
  • step_X, step_X_Y = Wizard/multi-step flows
```

### Priority 3: Map User Flows for New Sections Only

If this is a NEW section (e.g., first time Instrumentos screens appear):
```
Build complete flow:
  {section}_discovery_1.html  (if exists, entry)
  └── {section}_list_1.html (if exists, main list)
      └── {section}_detail_1.html (if exists, detail view)
          └── {section}_edit_1.html (if exists, edit)
      └── {section}_create_1.html (if exists, new item)

Create ASCII diagram showing connections:
section_list_1.html (Entry Point)
├── Click Row → section_detail_1.html
│   ├── Display Info
│   ├── Related Data
│   └── Click "Edit" → section_edit_1.html → Save → Back to detail
└── Click "+ New" → section_create_1.html → Save → Back to list
```

If modifying EXISTING section, only document what changed (modified screens).

### Priority 4: Update UX_UI_SUMMARY.md Sections (In Order)

**A) Recent Changes Log (TOP of this section)**
- Add new entry with today's date
- Include:
  - Summary line (e.g., "Added Instrumentos module with 4 screens")
  - Screens added: [list filenames]
  - Screens modified: [list filenames only if functionally different]
  - New flows: [names of new flows, e.g., "Instrumentos discovery → list → detail → edit"]
  - Navigation changes: [e.g., "Added Instrumentos menu item at position 5"]
  - Version: v1.3 → v1.4

**B) Application Structure Overview (if navigation changed)**
- Update: "Current navigation menu structure" section
- List all menu items in order with their entry point file
- Count total items

**C) User Flows by Section (add new section or update existing)**
- NEW section: Create complete entry with:
  - Section name and entry point file
  - Status: "Active" (if just approved) or "In Development"
  - ASCII flow diagram (see example above)
  - Key screens with brief purpose
  - Shared UI elements used (reference DESIGN_GUIDELINES.md)
- EXISTING section: Update only the "ASCII flow diagram" and "Key screens" if flows changed

**D) Screen Inventory Table (add new rows)**
- For each NEW screen file, add row:
  - File: {filename}
  - Section: {section_name}
  - Screen Type: {type}
  - Purpose: [brief description, e.g., "View employee details, modify info, delete"]
  - Status: Active
  - Last Modified: [today's date]
  - Notes: [optional, e.g., "Uses shared employee card component"]

**E) Keep ALL Other Sections Intact**
- Design Patterns & Conventions - no changes
- Technical Notes - no changes
- Shared UI Components - no changes unless new reusable component identified
- Future Planned Sections - no changes
- Maintenance Guidelines - no changes

### Priority 5: Version Management

Increment version appropriately:
```
Minor (1.X) bump when:
  • New screens added to EXISTING section
  • Flows modified in existing section
  • Navigation menu order changed

Major (X.0) bump when:
  • NEW section added to app
  • Fundamental navigation structure change
  
Example:
  Before: v1.3
  Added Instrumentos (new section) → v2.0
  Added employee detail refinements → v1.4
```

### Priority 6: Quality Checks Before Saving

```
✓ No duplicate entries in Recent Changes log
✓ All new screens appear in Screen Inventory
✓ Version number incremented appropriately
✓ All filenames match actual files in design_iterations/
✓ Navigation menu matches DESIGN_GUIDELINES.md
✓ ASCII flows are readable and consistent with existing style
✓ No historical data overwritten or lost
```

### Priority 7: Report to Parent Conversation

Provide concise summary:
```
✓ Documentation updated (v1.3 → 1.4)

Changes:
- 4 screens documented (Instrumentos module)
- 1 new user flow documented
- Navigation menu updated (7 → 8 items)
- Recent changes logged

Status: Ready for next design phase or compaction
```

## Troubleshooting

**Issue:** "Subagent reports 'No new screens found'"

*Cause:* Files may not be saved yet or are in wrong directory
*Fix:*
- Confirm HTML files are saved to `.superdesign/design_iterations/` (not `old_design_iterations/`)
- Check file naming: `{section}_{type}_{version}.html` format
- Verify DESIGN_GUIDELINES.md is up to date with navigation changes

**Issue:** "Version not incremented correctly"

*Cause:* Subagent couldn't determine if change is Major/Minor/Patch
*Fix:*
- For NEW section: Should increment Major (X.0)
- For new screens in existing section: Should increment Minor (1.X)
- For cosmetic changes: Should increment Patch (1.1.X)
- Let main agent clarify scope if subagent unsure

**Issue:** "Recent Changes log shows duplicates"

*Cause:* Command ran twice for same changes
*Fix:*
- Check if entry already exists with today's date
- If duplicate, remove one and keep most detailed version
- This shouldn't happen in normal workflow (run once per approval)

**Issue:** "Navigation menu in summary doesn't match DESIGN_GUIDELINES.md"

*Cause:* DESIGN_GUIDELINES.md wasn't updated before running command
*Fix:*
- Update DESIGN_GUIDELINES.md navigation section BEFORE running command
- Re-run subagent if it detected stale navigation
- Confirm menu items, order, and icons all match

**Issue:** "Lost context from design work"

*Cause:* User didn't describe changes when triggering command
*Fix:*
- When asking for summary update, include: what was added, what sections, navigation changes
- Example: "Added 4 new screens in Instrumentos module, add to menu position 5"
- Subagent inherits this context and uses it to understand recent work

## Integration with Workflow

This command integrates into the superdesign workflow:

**Standard Workflow:**
```
1. User requests design work
2. Agent creates/modifies screens
3. User approves designs
4. Agent updates DESIGN_GUIDELINES.md (if needed)
5. Agent runs /ux-summary ← AUTOMATIC STEP
6. Agent confirms completion with summary report
```

**Before Context Compaction:**
```
1. User: "/compact"
2. Agent: "Before compacting, let me update the UX/UI summary..."
3. Agent: /ux-summary
4. Agent: "Summary updated. Ready to compact."
5. Proceed with /compact
```

## How This Command Works in Claude Code

This command is designed to run **within an active Claude Code session** after the user completes design work. The main agent will invoke it as a subagent task to keep documentation in sync with approved designs.

### Before Running This Command

**Ensure these are complete:**
1. ✅ Design work is approved by user (new screens or flows)
2. ✅ HTML files are saved to `.superdesign/design_iterations/`
3. ✅ DESIGN_GUIDELINES.md reflects navigation updates (if any)
4. ✅ You have context of: what screens were added/modified, what flows changed, any new sections

**User Checklist:**
```
"I've completed and approved the design for [module/feature]. 
Should be documented now. Key changes:
- Screens added: [list]
- New sections: [yes/no]
- Navigation changes: [yes/no, details]
- Modified flows: [which sections]"
```

### Subagent Configuration

Create `.claude/agents/ux-summary-updater.md` in your project:

```markdown
---
name: ux-summary-updater
description: Updates UX/UI Summary after user approves design work. Scans new screens, analyzes flows, and documents changes. Use after design approval to keep summary in sync.
tools: Read, Edit, Glob, Grep
model: Haiku
---

You are a UX/UI documentation specialist working within an active design session.

## Context You Inherit

From the parent session, you have:
- Current design work completed and approved (user described changes)
- Full project context and previous design decisions
- Knowledge of what screens/sections were just added or modified
- Understanding of existing navigation and flow patterns

## Your Task

1. **Verify** the latest screens in `.superdesign/design_iterations/`
   - Compare against last documented version in UX_UI_SUMMARY.md
   - Identify NEW files (these are recent additions)
   - Note MODIFIED files (flows changed, screens updated)

2. **Analyze** file naming and structure
   - Parse: `{section}_{screentype}_{version}.html`
   - Examples: `employees_list_1.html`, `patients_profile_1.html`, `onboarding_step_2.html`

3. **Map** user flows for newly added/modified screens
   - List screens = entry points
   - Detail/Profile screens = accessible from list
   - Edit/Create screens = accessible from detail
   - Wizard sequences = multi-step flows
   - Build ASCII diagrams showing connections

4. **Extract** from DESIGN_GUIDELINES.md
   - Current navigation menu (items, order, icons)
   - Shared UI patterns used in new screens
   - Any noted design decisions for this session

5. **Update** UX_UI_SUMMARY.md with ONLY recent changes
   - **Recent Changes Log**: NEW entry at TOP with today's date
     - Summary of what was added/modified
     - Screens added (list filenames)
     - Screens modified (list filenames)
     - New flows (ASCII diagrams for new sections/flows)
     - Navigation updates (if any)
     - Breaking changes (if any)
   - **Screen Inventory**: Add new rows for new screens
   - **User Flows by Section**: Add or update section entry if new screens added
   - **Application Structure Overview**: Update nav menu if changed
   - Keep all existing sections and historical data

6. **Increment** version appropriately
   - Minor (1.X) if new screens added in existing sections or flows modified
   - Major (X.0) if new section added or navigation fundamentally changed
   - Note: Version in Recent Changes entry

7. **Report** to parent conversation
   - Confirm changes made
   - Summary: N screens documented, M flows updated, version bumped to X.Y
   - Highlight any important new patterns or breaking changes
   - Flag any concerns (missing files, inconsistencies)

## Important Notes

- **Context is inherited**: You have full knowledge of this session's design work
- **Don't overwrite history**: Only ADD to Recent Changes, modify Screen Inventory, update active sections
- **Be precise**: Reference exact file names, don't approximate
- **Visual clarity**: ASCII flows should be clear and follow existing style
- **Cross-references**: Note if new screens create links between previously disconnected sections
```

### Execution Flow

**In your Claude Code session:**

```
User: "I've approved the new Instrumentos module. 
  - Added 4 screens (discovery, list, detail, edit)
  - New flow: list → detail, detail → edit
  - Add to navigation menu (position 5)"

Main Agent: "Perfect! Let me document that in the UX/UI summary..."

Main Agent: [Delegates to ux-summary-updater subagent]

Subagent: 
  [Scans design_iterations/ for new instrumentos_*.html files]
  [Reads DESIGN_GUIDELINES.md for navigation update]
  [Builds ASCII flow diagram: discovery → list → detail ↔ edit]
  [Updates UX_UI_SUMMARY.md with new section, flows, and nav menu]
  [Increments version 1.3 → 1.4]

Subagent Reports:
  "✓ Instrumentos module documented (v1.4)
   - 4 new screens added
   - 1 new section with 2 flows
   - Navigation updated (8 items)
   - Recent Changes logged for Jan 10, 2026"

Main Agent: "All done! Design is now documented and protected against context loss."
```

### Key Advantages of This Approach

- **Clean separation**: Complex file scanning/parsing stays in subagent context
- **Context inheritance**: Subagent knows what you just approved (via parent conversation)
- **Incremental updates**: Only new/modified sections updated, historical data preserved
- **Team consistency**: Subagent uses the same analysis process every time
- **Safe operations**: Limited tools (Read, Edit, Glob, Grep only) prevent accidents
- **Cost-efficient**: Haiku model balances capability and cost

## Examples in Practice

### Example 1: After Completing New Module

```
Session: Design new Instrumentos module
────────────────────────────────────────

User: "I've finished and approved the Instrumentos module designs.
  Four screens total: discovery, list, detail, edit.
  Add to navigation menu."

Main Agent: "Great! Let me update the UX/UI summary with these changes..."

[Main agent delegates to ux-summary-updater subagent]

Subagent Work:
  1. Scans design_iterations/ → finds 4 new files:
     - instrumentos_discovery_1.html
     - instrumentos_list_1.html
     - instrumentos_detail_1.html
     - instrumentos_edit_1.html
  
  2. Analyzes naming → identifies: new section "Instrumentos" with 4 screens
  
  3. Maps flows:
     discovery → list → detail ↔ edit
  
  4. Reads DESIGN_GUIDELINES.md → confirms navigation menu update
  
  5. Updates UX_UI_SUMMARY.md:
     ✓ Recent Changes: new entry dated Jan 10
     ✓ Application Structure: navigation menu now shows 8 items (added Instrumentos)
     ✓ User Flows: new Instrumentos section with flow diagram
     ✓ Screen Inventory: 4 new rows added
     ✓ Version: 1.3 → 1.4

Subagent Reports:
  "✓ Documentation complete (v1.4)
   
   Added:
   - Instrumentos section with 4 screens
   - Flow: discovery → list → detail → edit
   - Navigation item at position 5
   
   Updated: v1.3 → v1.4"

Main Agent: "All set. Instrumentos module is now documented. Ready for next work!"
```

### Example 2: Before Context Compaction

```
Session: Completing major design phase
────────────────────────────────────────

User: "We're almost done with this phase. Should we compact context?
  But I want to preserve what we've built."

Main Agent: "Let me update the UX/UI summary first, then we can safely compact.
This protects all your design decisions."

[Main agent delegates to ux-summary-updater]

Subagent Updates:
  - Scans all screens in design_iterations/
  - Updates all active sections with latest flows
  - Logs all changes from this session
  - Increments version: 1.2 → 1.3

Subagent Reports:
  "✓ Summary updated (v1.3)
   - 23 total screens documented
   - 5 sections with complete flows
   - Recent changes: [summarizes this session]
   
   Safe to compact now."

Main Agent: "Done! Summary is current. Now we can compact context safely."
User: "/compact"

[New session later]
User: "I want to continue with the Reports module..."
Main Agent: [Reads UX_UI_SUMMARY.md]
Main Agent: "I see we have 5 active sections and 8 menu items. 
  Reports is ready to design. Following existing patterns..."
```

### Example 3: Modifying Existing Section

```
Session: Refinement work
────────────────────────

User: "I've refined the employee detail screen. 
  Added tabs for performance metrics and history.
  Same filename but better organized."

Main Agent: "I'll document this refinement..."

[Main agent delegates to ux-summary-updater]

Subagent Work:
  1. Detects: employees_detail_1.html is MODIFIED (timestamp newer)
  2. Determines: File was already in inventory, so this is a flow enhancement
  3. Updates:
     ✓ Recent Changes: "Enhanced employees_detail_1.html with new tabs"
     ✓ User Flows (Employees section): 
        - Updated flow diagram showing new tabs
        - Notes: "Added performance metrics and history tabs"
     ✓ Screen Inventory: same row, updated Last Modified date and notes
     ✓ Version: 1.3 → 1.3 (Patch, minor changes - or Minor if significant)

Subagent Reports:
  "✓ Refinement documented
   
   Modified: employees_detail_1.html
   Changes: Added tabs for performance metrics and history
   
   Status: Ready for approval"
```

## Related Commands

- `/compact` - Compress conversation context (run /ux-summary before this)
- `/design` - Trigger superdesign workflow (run /ux-summary after completion)

## File Locations

- **Command file:** `.claude/commands/ux-summary.md`
- **Template:** `.superdesign/UX_UI_SUMMARY_template.md`
- **Output:** `.superdesign/UX_UI_SUMMARY.md`
- **Reference:** `.superdesign/DESIGN_GUIDELINES.md`
- **Screens:** `.superdesign/design_iterations/*.html`
- **Subagent (optional):** `.claude/agents/ux-summary-updater.md`

---

**Version:** 2.0
**Updated:** 2026-01-10
**Status:** Active
**Changes:** Replaced inaccurate Task() pseudocode with Claude Code subagent patterns and official documentation
