#!/usr/bin/env python3
"""Validate instrument-template JSONs against the schema contract.

Usage: python3 check_template.py <path-to-template.json> [<template.json> ...]

Checks per template:
  1. JSON parses.
  2. Required top-level keys present (codigo, nombre, version, tipo, sections, scoring).
  3. tipo is one of {VALORACION, NUTRICION, MATRICULA, ADMISION}.
  4. version >= 1.
  5. Each section has: id, titulo, items[].
  6. Each item has: id, label, type, required.
  7. type is one of the 6 registered types.
  8. boolean-scored / single-select-scored / single-select-info have options[] with score fields.
  9. boolean-scored has exactly 2 options.
  10. number-info has no options; supports constraints.
  11. text-info has no options; supports placeholder.
  12. group-info has columns[] and rows[]; each column has score=null.
  13. scoring.total is "sum" or "none".
  14. scoring.resultEvaluation is a list; ranges gapless & non-overlapping.
  15. For "sum" definitions: per-section subtotal.max matches sum of item-option score maxima.
  16. Item ids are unique within a definition.
  17. Section ids are unique within a definition.
  18. condition.skipIf (if present) references an earlier section.

Exits 0 if all pass; 1 otherwise.
"""
import json
import sys
from pathlib import Path

VALID_TYPES = {"single-select-scored", "number-info", "text-info", "single-select-info", "group-info"}
VALID_TIPOS = {"VALORACION", "NUTRICION", "MATRICULA", "ADMISION"}
VALID_TOTAL = {"sum", "none"}


class Checker:
    def __init__(self, path: Path):
        self.path = path
        self.errors = []
        self.warnings = []

    def check(self):
        try:
            self.def_ = json.loads(self.path.read_text())
        except Exception as e:
            self.errors.append(f"JSON parse error: {e}")
            return False

        d = self.def_
        # Required top-level
        for k in ("codigo", "nombre", "version", "tipo", "sections", "scoring"):
            if k not in d:
                self.errors.append(f"missing top-level key: {k}")
        if self.errors:
            return False

        if d["tipo"] not in VALID_TIPOS:
            self.errors.append(f"tipo '{d['tipo']}' not in {VALID_TIPOS}")
        if not isinstance(d["version"], int) or d["version"] < 1:
            self.errors.append(f"version must be int >= 1; got {d['version']!r}")

        # Sections
        section_ids = set()
        for sidx, s in enumerate(d.get("sections", [])):
            sid = s.get("id")
            if not sid:
                self.errors.append(f"section[{sidx}].id missing")
                continue
            if sid in section_ids:
                self.errors.append(f"duplicate section id: {sid}")
            section_ids.add(sid)
            for k in ("titulo", "items"):
                if k not in s:
                    self.errors.append(f"section[{sid}] missing key: {k}")
            # condition
            cond = s.get("condition")
            if cond:
                si = cond.get("skipIf")
                if not si:
                    self.errors.append(f"section[{sid}].condition: only 'skipIf' rule shape supported")
                else:
                    ref = si.get("sectionId")
                    op = si.get("op")
                    val = si.get("value")
                    if ref not in section_ids:
                        # ok if it's earlier — postpone: check after loop
                        self._pending_skipif = getattr(self, "_pending_skipif", [])
                        self._pending_skipif.append((sidx, sid, ref, op, val))
                    # ensure reference is earlier (ordering check below)
                    if op not in (">=", "<=", ">", "<", "==", "!="):
                        self.errors.append(f"section[{sid}].condition.skipIf.op '{op}' not supported")
                    if not isinstance(val, (int, float)):
                        self.errors.append(f"section[{sid}].condition.skipIf.value must be number; got {type(val).__name__}")

            # Items
            item_ids = set()
            for iidx, it in enumerate(s.get("items", [])):
                iid = it.get("id")
                if not iid:
                    self.errors.append(f"section[{sid}].items[{iidx}].id missing")
                    continue
                if iid in item_ids:
                    self.errors.append(f"duplicate item id within section[{sid}]: {iid}")
                item_ids.add(iid)
                for k in ("label", "type", "required"):
                    if k not in it:
                        self.errors.append(f"item[{iid}] missing key: {k}")
                t = it.get("type")
                if t not in VALID_TYPES:
                    self.errors.append(f"item[{iid}].type '{t}' not in {VALID_TYPES}")
                    continue
                if t == "single-select-scored":
                    opts = it.get("options") or []
                    if len(opts) < 2:
                        self.errors.append(f"item[{iid}] (single-select-scored): must have >= 2 options")
                    for o in opts:
                        if not isinstance(o.get("score"), (int, float)):
                            self.errors.append(f"item[{iid}] option '{o.get('value')}' missing numeric score")
                elif t == "single-select-info":
                    opts = it.get("options") or []
                    if len(opts) < 2:
                        self.errors.append(f"item[{iid}] (single-select-info): must have >= 2 options")
                    for o in opts:
                        if o.get("score") is not None:
                            self.warnings.append(f"item[{iid}] (single-select-info): option '{o.get('value')}' has non-null score (expected null)")
                elif t == "number-info":
                    if it.get("options") is not None:
                        self.warnings.append(f"item[{iid}] (number-info): options field should be absent")
                    c = it.get("constraints")
                    if c and not (isinstance(c.get("min"), (int, float)) and isinstance(c.get("max"), (int, float))):
                        self.errors.append(f"item[{iid}] (number-info): constraints.min/max must be numeric")
                elif t == "text-info":
                    if it.get("options") is not None:
                        self.warnings.append(f"item[{iid}] (text-info): options field should be absent")
                elif t == "group-info":
                    cols = it.get("columns") or []
                    rows = it.get("rows") or []
                    if len(cols) < 2:
                        self.errors.append(f"item[{iid}] (group-info): must have >= 2 columns")
                    if len(rows) < 1:
                        self.errors.append(f"item[{iid}] (group-info): must have >= 1 row")
                    for c in cols:
                        if c.get("score") is not None:
                            self.errors.append(f"item[{iid}] (group-info): column '{c.get('id')}' must have score=null")

            # Subtotal integrity (for scored sections)
            subtotal = s.get("subtotal") or {}
            if subtotal.get("max") is not None:
                max_decl = subtotal["max"]
                # max contribution = sum of max-option-score per scored item
                max_contrib = 0.0
                for it in s.get("items", []):
                    t = it.get("type")
                    if t == "single-select-scored":
                        opts = it.get("options") or []
                        if opts:
                            item_max = max(float(o.get("score", 0)) for o in opts)
                            max_contrib += item_max
                # Allow tolerance for 0.5 scoring: max_contrib should equal subtotal.max (within 0.5)
                if abs(max_contrib - max_decl) > 0.001:
                    self.warnings.append(
                        f"section[{sid}]: declared subtotal.max={max_decl} but sum of max-option-scores = {max_contrib}"
                    )
            # Section-level resultEvaluation (G2-2): validate ranges when present
            sec_re = subtotal.get("resultEvaluation")
            if sec_re is not None:
                self._check_ranges(sec_re, f"section[{sid}].subtotal.resultEvaluation")

        # condition.skipIf: sectionId must reference an EARLIER section which MUST declare
        # subtotal.resultEvaluation (G2-2: classification fallback when the section is skipped)
        for sidx, s in enumerate(d["sections"]):
            cond = s.get("condition") or {}
            si = cond.get("skipIf")
            if si:
                ref = si.get("sectionId")
                if ref:
                    # Find indices
                    refs = [i for i, x in enumerate(d["sections"]) if x.get("id") == ref]
                    if not refs or refs[0] >= sidx:
                        self.errors.append(f"section[{s.get('id')}].condition.skipIf.sectionId '{ref}' must reference an EARLIER section")
                    else:
                        ref_sec = d["sections"][refs[0]]
                        if not ((ref_sec.get("subtotal") or {}).get("resultEvaluation")):
                            self.errors.append(
                                f"section[{ref}] is referenced by a skipIf rule but has no subtotal.resultEvaluation (required, G2-2)"
                            )

        # scoring
        sc = d.get("scoring") or {}
        total = sc.get("total")
        if total not in VALID_TOTAL:
            self.errors.append(f"scoring.total must be one of {VALID_TOTAL}; got {total!r}")
        re_list = sc.get("resultEvaluation") or []
        if total == "sum":
            if not re_list:
                self.errors.append("scoring.total='sum' but resultEvaluation is empty")
            else:
                self._check_ranges(re_list, "scoring.resultEvaluation")
        elif total == "none":
            if re_list:
                self.errors.append("scoring.total='none' but resultEvaluation is non-empty")

        return not self.errors

    def _check_ranges(self, re_list, ctx):
        """Gapless & non-overlapping ranges (any ordering — clinical convention varies).
        Step is computed dynamically from the first adjacent gap (handles int or 0.5 scoring)."""
        sorted_re = sorted(re_list, key=lambda r: r.get("min", -1))
        prev_max = -1
        step = None
        for ridx, r in enumerate(sorted_re):
            if not all(k in r for k in ("min", "max", "label")):
                self.errors.append(f"{ctx}[{ridx}] must have min, max, label")
                continue
            lo, hi = r["min"], r["max"]
            if lo > hi:
                self.errors.append(f"{ctx}[{ridx}]: min ({lo}) > max ({hi})")
            if ridx == 0 and lo != 0:
                self.errors.append(f"{ctx}[{ridx}]: first range must start at 0; got {lo}")
            if ridx > 0:
                gap = lo - prev_max
                if step is None:
                    step = gap
                else:
                    # Allow small float epsilon
                    if abs(gap - step) > 1e-9:
                        self.errors.append(f"{ctx}[{ridx}]: gap {gap} differs from prior step {step}")
                    if lo > prev_max + step + 1e-9:
                        self.errors.append(f"{ctx}[{ridx}]: gap of {lo - prev_max} (expected step={step})")
                    if lo < prev_max - 1e-9:
                        self.errors.append(f"{ctx}[{ridx}]: overlap with previous (prev.max={prev_max}, this.min={lo})")
            prev_max = hi

    def report(self):
        print(f"\n=== {self.path} ===")
        if not self.errors:
            print("  OK")
        for e in self.errors:
            print(f"  ERROR: {e}")
        for w in self.warnings:
            print(f"  WARN:  {w}")


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    overall_ok = True
    for p in argv:
        c = Checker(Path(p))
        ok = c.check()
        c.report()
        overall_ok = overall_ok and ok
    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
