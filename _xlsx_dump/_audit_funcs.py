import openpyxl, re, warnings
from collections import Counter
warnings.filterwarnings("ignore")

PATH = r"Nutrition Calculator.template .xlsx"
wb = openpyxl.load_workbook(PATH, data_only=False)

FUNCS = ["ROUNDUP", "ROUNDDOWN", "MROUND", "ROUND", "CEILING", "FLOOR",
         "TRUNC", "INT", "IF", "VLOOKUP", "SUMPRODUCT", "SUM"]

print("=== Function usage per sheet (formula cells) ===")
for ws in wb.worksheets:
    counts = Counter()
    samples = {}
    for row in ws.iter_rows():
        for c in row:
            v = c.value
            if hasattr(v, "text"):
                v = v.text
            if isinstance(v, str) and v.startswith("="):
                up = v.upper()
                for f in FUNCS:
                    # count as word-boundary-ish (function followed by "(")
                    for m in re.finditer(rf"{f}\(", up):
                        counts[f] += 1
                        if f not in samples:
                            samples[f] = f"{c.coordinate}: {v}"
    if counts:
        print(f"\n-- {ws.title}")
        for f in FUNCS:
            if counts[f]:
                print(f"   {f}: {counts[f]}   e.g. {samples.get(f,'')}")
