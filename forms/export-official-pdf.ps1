<#
    Re-export the official RSBSA DOCX to forms/rsbsa-official.pdf.

    Run this only if the DA reissues the form, or if forms/rsbsa-official.pdf
    is lost. Requires Microsoft Word.

        powershell -ExecutionPolicy Bypass -File forms\export-official-pdf.ps1

    Three things here are deliberate and must not be dropped:

    1. PDF/A export (UseISO19005_1 = true) produces a PDF 1.4-based file with
       no compressed cross-reference streams. FPDI's free parser cannot read
       those, so a plain export would break the overlay.

    2. Bottom margin and footer distance are set to 0. Word otherwise lays the
       form out over FOUR pages: the repeating footer steals just enough room
       that the enrollment stub is pushed onto its own sheet, and a final page
       is produced containing nothing but the footer.

    3. Only the EMPTY spacer paragraphs AFTER the first table are shrunk. The
       spacer before it is left alone: shrinking that one pulls table 1 upward
       and invalidates every coordinate in config/rsbsa-overlay.php.

    The DOCX is opened and closed WITHOUT saving, so the official file is never
    modified.

    After running, verify: 2 pages, 612 x 792 pt, and the "SURNAME" caption
    still at y = 178.1 from the top of page 1.
#>

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'public\rsbsa\rsbsa-registration-form-01-2024_latest.docx'
$out  = Join-Path $root 'forms\rsbsa-official.pdf'

if (-not (Test-Path $src)) { throw "Source DOCX not found at $src" }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($src, $false, $false)

    # (2) room at the foot, without moving anything down the page
    foreach ($s in $doc.Sections) {
        $s.PageSetup.BottomMargin = 0
        $s.PageSetup.FooterDistance = 0
    }

    # (3) empty spacers after table 1 only
    $firstTableEnd = $doc.Tables.Item(1).Range.End
    $shrunk = 0
    foreach ($p in $doc.Paragraphs) {
        if ($p.Range.Tables.Count -eq 0 -and
            $p.Range.Text.Trim().Length -eq 0 -and
            $p.Range.Start -gt $firstTableEnd) {
            $p.Range.Font.Size = 1
            $p.SpaceAfter  = 0
            $p.SpaceBefore = 0
            $shrunk++
        }
    }

    $pages = $doc.ComputeStatistics(2)
    Write-Output "shrank $shrunk spacer paragraphs; Word reports $pages pages"

    if ($pages -ne 2) {
        Write-Warning "Expected 2 pages. The overlay page map assumes page 1 = Part 1 + Part 2 + stub, page 2 = Part 3 + Part 4."
    }

    # (1) PDF/A so FPDI can read it
    $doc.ExportAsFixedFormat($out, 17, $false, 0, 0, 0, 0, 0, $true, $true, 0, $true, $true, $true)
    $doc.Close($false)   # never save
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output ("wrote {0} ({1:N0} bytes)" -f $out, (Get-Item $out).Length)
Write-Output 'Now run: php artisan rsbsa:test-fill'
