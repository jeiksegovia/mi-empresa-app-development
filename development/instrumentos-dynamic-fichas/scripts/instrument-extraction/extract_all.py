#!/usr/bin/env python3
"""Extract text content from raw instrument sources.

Usage: python3 extract_all.py [--source PATH] [--out PATH]

Outputs extracted text to stdout or to --out PATH. Auto-detects format by extension:
  .xlsx → openpyxl (cells + sheet names)
  .docx → python-docx (paragraphs + tables)
  .pdf  → pypdf (page-by-page)
"""
import argparse
import sys
from pathlib import Path


def extract_xlsx(path: Path) -> str:
    from openpyxl import load_workbook
    wb = load_workbook(path, data_only=True)
    out = []
    for ws in wb.worksheets:
        out.append(f"\n===== SHEET: {ws.title} (rows={ws.max_row}, cols={ws.max_column}) =====\n")
        for row in ws.iter_rows(values_only=True):
            cells = ["" if v is None else str(v).strip() for v in row]
            if any(cells):
                out.append(" | ".join(cells))
    return "\n".join(out)


def extract_docx(path: Path) -> str:
    from docx import Document
    doc = Document(path)
    out = []
    # Paragraphs in document order; include table cells inline at the position they appear
    body = doc.element.body
    para_idx = {p._p: i for i, p in enumerate(doc.paragraphs)}
    tbl_idx = {t._tbl: i for i, t in enumerate(doc.tables)}
    for child in body.iterchildren():
        if child.tag.endswith("}p"):
            i = para_idx.get(child)
            if i is not None:
                text = doc.paragraphs[i].text.strip()
                if text:
                    out.append(text)
        elif child.tag.endswith("}tbl"):
            i = tbl_idx.get(child)
            if i is not None:
                t = doc.tables[i]
                out.append(f"\n----- TABLE {i} (rows={len(t.rows)}, cols={len(t.columns)}) -----")
                for r, row in enumerate(t.rows):
                    cells = [c.text.strip().replace("\n", " | ") for c in row.cells]
                    out.append(f"R{r}: " + " || ".join(cells))
                out.append("----- END TABLE -----\n")
    return "\n".join(out)


def extract_pdf(path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    out = []
    for i, page in enumerate(reader.pages):
        out.append(f"\n===== PAGE {i+1}/{len(reader.pages)} =====")
        try:
            out.append(page.extract_text() or "")
        except Exception as e:
            out.append(f"[error: {e}]")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()
    path = Path(args.source)
    if not path.exists():
        print(f"missing: {path}", file=sys.stderr)
        return 2
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        text = extract_xlsx(path)
    elif suffix == ".docx":
        text = extract_docx(path)
    elif suffix == ".pdf":
        text = extract_pdf(path)
    else:
        print(f"unsupported extension: {suffix}", file=sys.stderr)
        return 2
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"wrote {args.out} ({len(text)} chars)", file=sys.stderr)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
