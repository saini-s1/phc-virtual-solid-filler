import openpyxl, re, warnings
from pathlib import Path
warnings.filterwarnings("ignore")

PATH = Path(__file__).resolve().parent.parent / "docs" / "nutrition-reference" / "Nutrition Calculator.template .xlsx"
wb = openpyxl.load_workbook(PATH, data_only=False)

# 1) Reference/formula-list sheet: dump every non-empty cell (this is the human doc of rules)
def dump_sheet(name, max_rows=None, max_cols=None):
    ws = wb[name]
    print(f"\n===== SHEET: {name}  (dims {ws.dimensions}) =====")
    for row in ws.iter_rows():
        for c in row:
            v = c.value
            if v is None:
                continue
            if hasattr(v, "text"):  # ArrayFormula
                v = v.text
            s = str(v).strip()
            if s:
                print(f"  {c.coordinate}: {s}")

dump_sheet("Formula list and Reference Docs")
dump_sheet("Net contents calculation")
