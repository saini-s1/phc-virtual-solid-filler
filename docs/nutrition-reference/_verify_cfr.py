"""Extract the calorie-method paragraphs from the 21 CFR 101.9 PDF so we cite B/C exactly."""
import os, re
from pypdf import PdfReader

HERE = os.path.dirname(__file__)
PATH = os.path.join(HERE, "21 CFR 101.9 (up to date as of 6-18-2026).pdf")

reader = PdfReader(PATH)
full = []
for i, page in enumerate(reader.pages):
    full.append((i, page.extract_text() or ""))

alltext = "\n".join(t for _, t in full)

# Find the (c)(1)(i) calorie method block.
def show(anchor, before=80, after=1600):
    idx = alltext.find(anchor)
    if idx == -1:
        print(f"--- anchor {anchor!r} NOT FOUND ---")
        return
    print(f"\n===== around {anchor!r} (char {idx}) =====")
    print(alltext[max(0, idx - before): idx + after])

show("Caloric content")
show("4, 4, and 9")
show("insoluble dietary fiber", before=200, after=300)
print("\n\n========== ALSO: every line mentioning 'calories per gram' ==========")
for m in re.finditer(r".{0,120}calories per gram.{0,200}", alltext):
    print("•", " ".join(m.group(0).split()))

print("\nDONE")
