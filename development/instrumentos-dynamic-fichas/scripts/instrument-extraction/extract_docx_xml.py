#!/usr/bin/env python3
"""Extract content from docx using raw XML parsing — works when python-docx misses nested tables.

Usage: python3 extract_docx_xml.py <path.docx>
Prints to stdout: paragraphs + every table (incl. nested), in document order.
"""
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def paragraphs_and_tables(doc_xml: bytes) -> str:
    root = ET.fromstring(doc_xml)
    body = root.find(f"{NS}body")
    out = []
    idx_para = 0
    idx_tbl = 0

    def cell_text(c):
        # All <w:t> in this cell, joined.
        return "".join(t.text or "" for t in c.iter(f"{NS}t"))

    def render_table(tbl, depth=0):
        prefix = "  " * depth
        rows = list(tbl.findall(f"{NS}tr"))
        out.append(f"\n{prefix}----- TABLE depth={depth} rows={len(rows)} -----")
        for r, tr in enumerate(rows):
            cells = tr.findall(f"{NS}tc")
            cell_strs = []
            for tc in cells:
                # Look for nested table; render its text inline if present.
                nested = tc.find(f"{NS}tbl")
                txt = cell_text(tc)
                if nested is not None:
                    inner = "\n".join(render_table_lines(nested, depth + 1))
                    cell_strs.append(f"{txt} {{NESTED: {inner}}}" if txt else f"{{NESTED: {inner}}}")
                else:
                    cell_strs.append(txt)
            out.append(f"{prefix}R{r}: " + " || ".join(cell_strs))
        out.append(f"{prefix}----- END TABLE -----\n")

    def render_table_lines(tbl, depth):
        rows = list(tbl.findall(f"{NS}tr"))
        lines = [f"NESTED TABLE rows={len(rows)}"]
        for r, tr in enumerate(rows):
            cells = tr.findall(f"{NS}tc")
            cell_strs = []
            for tc in cells:
                nested = tc.find(f"{NS}tbl")
                txt = cell_text(tc)
                if nested is not None:
                    inner = "\n".join(render_table_lines(nested, depth + 1))
                    cell_strs.append(f"{txt} {{NESTED: {inner}}}" if txt else f"{{NESTED: {inner}}}")
                else:
                    cell_strs.append(txt)
            lines.append("  " * depth + f"R{r}: " + " || ".join(cell_strs))
        return lines

    def walk(el, depth=0):
        for child in el:
            tag = child.tag
            if tag == f"{NS}p":
                txt = "".join(t.text or "" for t in child.iter(f"{NS}t")).strip()
                if txt:
                    out.append(txt)
                idx_para_local = idx_para  # noqa: F841
            elif tag == f"{NS}tbl":
                render_table(child, depth)
                idx_tbl_local = idx_tbl  # noqa: F841
            elif tag == f"{NS}sdt":
                # Structured document tag — may contain content
                walk(child, depth + 1)
            else:
                walk(child, depth + 1)

    walk(body)
    return "\n".join(out)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: extract_docx_xml.py <file.docx>", file=sys.stderr)
        return 2
    with zipfile.ZipFile(sys.argv[1]) as z:
        with z.open("word/document.xml") as f:
            xml = f.read()
    text = paragraphs_and_tables(xml)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
