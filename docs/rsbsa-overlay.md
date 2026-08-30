# RSBSA Enrollment Form — overlay printing

The official DA form is **stamped, never redrawn**. `RsbsaFormFiller` imports
every page of `forms/rsbsa-official.pdf` with FPDI and writes only the farmer's
values on top, so each line, box, label and instruction in the output is the
government's own file. A rebuilt lookalike is not acceptable for a prescribed
government form.

## Setup

1. `composer require setasign/fpdi setasign/fpdf`
2. Put the blank official form at **`forms/rsbsa-official.pdf`**.
   Prefer a PDF issued directly by the Department of Agriculture. Exporting
   `public/rsbsa/rsbsa-registration-form-01-2024_latest.docx` to PDF also works
   and is what the coordinates were measured against.
3. Page size must be **US Letter, 612 × 792 pt**.

### If import fails

FPDI's free parser reads **PDF 1.4 and older only**. A newer file fails with a
compressed cross-reference error. Flatten it once:

```bash
qpdf --stream-data=uncompress in.pdf forms/rsbsa-official.pdf
```

Or re-save as PDF 1.4 from whatever produced it.

## Printing

Staff must print at **100% / "Actual size"**, never "Fit to page". Any scaling
shifts every value off its box.

## Coordinate system

Points (72/inch), measured from the **top-left** of the page. FPDF's
`Text($x, $y)` with `'pt'` units uses the same origin, so values are used
as-is. Text sits *on* the baseline given — for a field whose caption prints
underneath, aim a few points above that caption.

All coordinates live in **`config/rsbsa-overlay.php`**, in three arrays:

| Array | Shape |
|---|---|
| `fields` | `[x, y_from_top, font_size]` |
| `checks` | `[centre_x, centre_y_from_top]` |
| `char_boxes` | `[first_box_centre_x, y, pitch, max_chars]` |

Adding a field is one line in the config, not new code.

## Two things that are easy to get wrong

**Date boxes.** The centres come from the small `M O N` / `D D` / `Y Y Y Y`
guide letters printed beneath each box — each letter sits under its own box, so
the letter positions *are* the box centres. Guessing the pitch instead puts
every digit one box to the right.

**Mobile number.** The form's first two boxes are **pre-printed `0` and `9`**.
Only the remaining 10 digits are stamped, starting at box 3 (x = 387).
`RsbsaFieldMapper::mobileDigits()` strips a leading `09` / `+639` for this
reason. Writing the full `09…` doubles them up.

## Part 3 — mapped

The three parcel blocks are identical and evenly stacked, so parcel 1 is
mapped once under `parcels` in the config and the rest are derived by adding
`y_offset`. Measured on the official form:

| Anchor | P1 | P2 | P3 | pitch |
|---|---|---|---|---|
| `LOCATION:` | 87.7 | 224.3 | 361.1 | 136.6 / 136.8 |
| `Type of Ownership` | 151.7 | 288.4 | 425.1 | 136.7 / 136.7 |

Column boundaries come from the DOCX table grid (14 columns, 496.9pt from
x = 62): cropping 237-311, commodity 311-390, size 390-437, heads 437-479,
farm type 479-523, organic 523-558.

The schema stores one commodity per parcel, so values go in the first
commodity row. Parcels are only stamped when `livelihood_type` is `Farmer` —
Farm Workers, Fishers and Agri-Youth skip Part 3, as the form instructs.

## Still to map

**Part 4 (Consent Declaration)** — date, printed name of registrant, and the
control/reference fields. Leave the signature and the four "Verified True and
Correct By" lines blank; those are signed by hand.

Also unmapped: rotational tiller name and RSBSA number, and remarks.

## Unverified coordinates

Two civil-status checkboxes were **not** found by automatic detection and are
derived by symmetry from their neighbours. Both are marked `UNVERIFIED` in the
config and must be confirmed on the calibration grid — a wrong tick here
misstates a person's civil status:

- `civil_single` — `[71.8, 466.6]`
- `civil_separated` — `[177.4, 481.2]`

All eight **Part 3 checkboxes** (`ad_yes/no`, `arb_yes/no`, `own_registered`,
`own_lessee`, `own_tenant`, `own_others`) are likewise estimated from their
label positions rather than detected, because the detection script needs
`pdftoppm`, which is not installed here. Confirm them on the grid.

## Measuring new coordinates

### 1. Calibration grid (any field)

Stamps a labelled grid over the official form: X along the top, Y down the
left. Fine grid 10pt, labelled 50pt.

```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color
from pypdf import PdfReader, PdfWriter
import io

W, H = letter

def grid_overlay():
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setStrokeColor(Color(0.1, 0.3, 0.9, alpha=0.30)); c.setLineWidth(0.25)
    for x in range(0, int(W)+1, 10): c.line(x, 0, x, H)
    for y in range(0, int(H)+1, 10): c.line(0, y, W, y)
    c.setStrokeColor(Color(0.85, 0.1, 0.1, alpha=0.55)); c.setLineWidth(0.6)
    c.setFillColor(Color(0.85, 0.1, 0.1, alpha=0.55))
    for x in range(0, int(W)+1, 50):
        c.line(x, 0, x, H); c.setFont('Helvetica-Bold', 6)
        for ylab in range(0, int(H)+1, 100): c.drawString(x+1, H-ylab-7, str(x))
    for ytop in range(0, int(H)+1, 50):
        y = H-ytop; c.line(0, y, W, y); c.setFont('Helvetica-Bold', 6)
        for xlab in range(0, int(W)+1, 100): c.drawString(xlab+1, y+2, str(ytop))
    c.showPage(); c.save(); buf.seek(0); return buf

reader, writer = PdfReader('forms/rsbsa-official.pdf'), PdfWriter()
for page in reader.pages:
    page.merge_page(PdfReader(grid_overlay()).pages[0]); writer.add_page(page)
writer.write(open('calibration_grid.pdf', 'wb'))
```

### 2. Automatic checkbox detection (faster, more accurate for checkboxes)

Renders the blank page to PNG, finds small hollow squares, converts pixels to
points. This produced every checkbox coordinate in the config.

```python
# pdftoppm -png -r 150 forms/rsbsa-official.pdf page
import numpy as np
from PIL import Image
from scipy import ndimage

a = np.array(Image.open('page-1.png').convert('L'))
H, W = a.shape
sx, sy = 612.0/W, 792.0/H
dark = a < 160
lbl, _ = ndimage.label(dark)

for sl in ndimage.find_objects(lbl):
    ys, xs = sl
    h, w = (ys.stop-ys.start), (xs.stop-xs.start)
    if 14 <= h <= 34 and 14 <= w <= 34 and 0.7 <= w/h <= 1.4:
        if dark[ys, xs].mean() < 0.55:          # hollow, i.e. an outline
            print(round((xs.start+xs.stop)/2*sx, 1),
                  round((ys.start+ys.stop)/2*sy, 1))
```

Finds *isolated* box outlines only. Character-box rows are drawn as one
connected run and won't be detected — use the guide letters or the grid.

## Verifying a filled form

1. Fill one form with test data covering every field type — a long name, a name
   with `Ñ`, every checkbox group, a full date and mobile number.
2. Render page 1 to PNG at 150 dpi and look at it. Every value must sit inside
   its box or on its line, nothing overlapping a printed label, no digit
   escaping its box.
3. Compare against the blank official form — the form itself must be
   pixel-identical, since it is the same file.
4. Print at 100% and hold it against a blank printed copy.

## If the DA reissues the form

Every coordinate must be re-measured. The field map is configuration, not code
— that is why it lives in `config/rsbsa-overlay.php`.

## Routes

- `GET /admin/farmers/{farmer}/print` — the official stamped form
- `GET /admin/farmers/{farmer}/print?review=html` — the internal HTML rebuild,
  for checking data on screen. **Not the official form; never submit it as one.**
