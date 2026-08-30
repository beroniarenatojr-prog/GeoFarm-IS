<?php

namespace App\Services;

use RuntimeException;
use setasign\Fpdi\Fpdi;

/**
 * Stamps a farmer's data onto the official RSBSA Enrollment Form.
 *
 * The government's own PDF is imported page by page and used as the page
 * background; only the farmer's values are drawn on top. The form itself is
 * never redrawn, so the printed result is the prescribed document rather than
 * a lookalike.
 *
 * Coordinates live in config/rsbsa-overlay.php and are points from the
 * top-left of the page. Pages with no mapped fields still pass through, so the
 * output is always the complete form.
 */
class RsbsaFormFiller
{
    private Fpdi $pdf;

    private array $config;

    private array $data = [];

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? config('rsbsa-overlay');
    }

    /**
     * @param  array<string, mixed>  $data  keyed by the field names in the map
     */
    public function setData(array $data): static
    {
        $this->data = $data;

        return $this;
    }

    public function save(string $path): string
    {
        $this->render();
        $this->pdf->Output('F', $path);

        return $path;
    }

    /** Raw PDF bytes, for streaming through a controller response. */
    public function output(): string
    {
        $this->render();

        return $this->pdf->Output('S');
    }

    // ------------------------------------------------------------ rendering

    /**
     * Whether the form can actually be produced right now: both the FPDI
     * library and the official template have to be present. Lets callers show
     * staff a clear message instead of a 500 page.
     *
     * @return string|null  null when ready, otherwise what is missing
     */
    public function unavailableReason(): ?string
    {
        if (! class_exists(Fpdi::class)) {
            return 'The PDF overlay library is not installed. Run: composer require setasign/fpdi setasign/fpdf';
        }

        $path = str_replace('\\', '/', $this->rawTemplatePath());

        if (! is_file($path)) {
            return "The official RSBSA form is missing at {$path}. Export "
                . 'public/rsbsa/rsbsa-registration-form-01-2024_latest.docx to PDF '
                . '(or download the DA-issued PDF) and save it there.';
        }

        return null;
    }

    private function render(): void
    {
        $template = $this->templatePath();

        $this->pdf = new Fpdi('P', 'pt', [
            $this->config['page_width'],
            $this->config['page_height'],
        ]);
        $this->pdf->SetAutoPageBreak(false);
        $this->pdf->SetTextColor(0, 0, 0);

        try {
            $pageCount = $this->pdf->setSourceFile($template);
        } catch (\Throwable $e) {
            // The usual cause is a PDF newer than 1.4: FPDI's free parser
            // cannot read compressed cross-reference streams.
            throw new RuntimeException(
                "Could not read the RSBSA template at {$template}. If it is a modern PDF, "
                . 'flatten it once with: qpdf --stream-data=uncompress in.pdf ' . $template
                . ' — original error: ' . $e->getMessage(),
                previous: $e
            );
        }

        for ($page = 1; $page <= $pageCount; $page++) {
            $this->pdf->AddPage();
            $tpl = $this->pdf->importPage($page);
            $this->pdf->useTemplate($tpl, 0, 0, $this->config['page_width'], $this->config['page_height']);

            $this->stampFields($page);
            $this->stampChecks($page);
            $this->stampCharBoxes($page);
            $this->stampParcels($page);
        }
    }

    /**
     * PART 3's three parcel blocks are identical and evenly stacked, so the
     * map holds parcel 1 once and each further block is the same coordinates
     * shifted down by y_offset.
     */
    private function stampParcels(int $page): void
    {
        $cfg = $this->config['parcels'] ?? null;

        if (! $cfg || $cfg['page'] !== $page) {
            return;
        }

        for ($i = 0; $i < $cfg['count']; $i++) {
            $shift  = $i * $cfg['y_offset'];
            $prefix = 'parcel' . ($i + 1) . '_';

            foreach ($cfg['fields'] as $name => [$x, $y, $size]) {
                $value = $this->text($this->data[$prefix . $name] ?? null);

                if ($value === '') {
                    continue;
                }

                $this->pdf->SetFont($this->config['font'], '', $size);
                $this->pdf->Text($x, $y + $shift, $value);
            }

            $this->pdf->SetFont($this->config['font'], 'B', $this->config['check_font_size']);
            $glyph = $this->pdf->GetStringWidth('X');

            foreach ($cfg['checks'] as $name => [$cx, $cy]) {
                if (empty($this->data[$prefix . $name])) {
                    continue;
                }

                $this->pdf->Text(
                    $cx - $glyph / 2,
                    $cy + $shift + $this->config['check_baseline_drop'],
                    'X'
                );
            }
        }
    }

    private function stampFields(int $page): void
    {
        foreach ($this->config['fields'][$page] ?? [] as $name => [$x, $y, $size]) {
            $value = $this->text($this->data[$name] ?? null);

            if ($value === '') {
                continue;
            }

            $this->pdf->SetFont($this->config['font'], '', $size);
            $this->pdf->Text($x, $y, $value);
        }
    }

    private function stampChecks(int $page): void
    {
        $size = $this->config['check_font_size'];
        $drop = $this->config['check_baseline_drop'];

        $this->pdf->SetFont($this->config['font'], 'B', $size);
        $glyphWidth = $this->pdf->GetStringWidth('X');

        foreach ($this->config['checks'][$page] ?? [] as $name => [$cx, $cy]) {
            if (empty($this->data[$name])) {
                continue;
            }

            $this->pdf->Text($cx - $glyphWidth / 2, $cy + $drop, 'X');
        }
    }

    private function stampCharBoxes(int $page): void
    {
        $size = $this->config['char_box_font_size'];
        $this->pdf->SetFont($this->config['font'], '', $size);

        foreach ($this->config['char_boxes'][$page] ?? [] as $name => [$x, $y, $pitch, $max]) {
            $value = $this->text($this->data[$name] ?? null);

            if ($value === '') {
                continue;
            }

            foreach (str_split(substr($value, 0, $max)) as $i => $char) {
                $w = $this->pdf->GetStringWidth($char);
                $this->pdf->Text($x + ($i * $pitch) - $w / 2, $y, $char);
            }
        }
    }

    // -------------------------------------------------------------- helpers

    /**
     * FPDF's core fonts are Latin-1, so UTF-8 has to be converted or names
     * containing Ñ — common here — come out mangled.
     */
    private function text(mixed $value): string
    {
        if ($value === null || $value === '' || is_bool($value)) {
            return '';
        }

        $value = trim((string) $value);

        return @iconv('UTF-8', 'windows-1252//TRANSLIT', $value) ?: $value;
    }

    private function rawTemplatePath(): string
    {
        $path = $this->config['template'];

        if (! str_contains($path, ':') && ! str_starts_with($path, '/')) {
            $path = base_path($path);
        }

        return $path;
    }

    private function templatePath(): string
    {
        if ($reason = $this->unavailableReason()) {
            throw new RuntimeException($reason);
        }

        return $this->rawTemplatePath();
    }
}
