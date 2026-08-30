<?php

namespace App\Console\Commands;

use App\Models\Farmer;
use App\Services\RsbsaFieldMapper;
use App\Services\RsbsaFormFiller;
use Illuminate\Console\Command;
use Throwable;

/**
 * Fills one RSBSA form with either a real farmer or deliberately awkward test
 * data, so the overlay coordinates can be checked before anything is printed
 * on an official document.
 */
class RsbsaTestFill extends Command
{
    protected $signature = 'rsbsa:test-fill
        {--farmer= : Farmer id to use instead of the built-in test data}
        {--out=storage/app/rsbsa-test.pdf : Where to write the filled form}';

    protected $description = 'Fill the official RSBSA form and report what was stamped';

    public function handle(RsbsaFieldMapper $mapper): int
    {
        $template = config('rsbsa-overlay.template');

        $this->line("template : {$template}");

        if (! is_file(base_path($template))) {
            $this->error("Missing. Export public/rsbsa/rsbsa-registration-form-01-2024_latest.docx");
            $this->error("to PDF (or download the DA-issued PDF) and save it as {$template}.");

            return self::FAILURE;
        }

        if (! class_exists(\setasign\Fpdi\Fpdi::class)) {
            $this->error('FPDI is not installed. Run: composer require setasign/fpdi setasign/fpdf');

            return self::FAILURE;
        }

        [$data, $label] = $this->data($mapper);
        $this->line("data     : {$label}");

        try {
            $bytes = (new RsbsaFormFiller())->setData($data)->output();
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $out = $this->option('out');
        file_put_contents(base_path($out), $bytes);

        preg_match_all('/\/Type\s*\/Page[^s]/', $bytes, $pages);
        preg_match('/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/', $bytes, $m);

        $this->newLine();
        $this->info(sprintf(
            'Wrote %s — %d pages, %.0f x %.0f pt, %d KB',
            $out,
            count($pages[0]),
            $m[1] ?? 0,
            $m[2] ?? 0,
            round(strlen($bytes) / 1024)
        ));

        $stamped = collect($data)->filter(fn ($v) => $v !== null && $v !== '' && $v !== false);
        $this->line(sprintf('Stamped %d of %d mapped values.', $stamped->count(), count($data)));

        $this->newLine();
        $this->warn('Now check it by eye: render page 1 at 150 dpi and confirm every value');
        $this->warn('sits inside its box, then print at 100% (never "Fit to page").');
        $this->warn('civil_single and civil_separated are UNVERIFIED — confirm on the grid.');

        return self::SUCCESS;
    }

    /** @return array{0: array<string,mixed>, 1: string} */
    private function data(RsbsaFieldMapper $mapper): array
    {
        if ($id = $this->option('farmer')) {
            $farmer = Farmer::with('parcels.farmType')->findOrFail($id);

            return [$mapper->map($farmer), "farmer #{$id} — {$farmer->full_name}"];
        }

        // Deliberately awkward: a long name, an Ñ, every checkbox group set,
        // a full date and a mobile number written the long way.
        return [[
            'surname'      => 'DE LOS SANTOS-MAGTANGGOL',
            'first_name'   => 'MARÍA CONCEPCIÓN',
            'middle_name'  => 'PEÑAFLORIDA',
            'ext_name'     => 'JR',
            'sex_female'   => true,

            'perm_house'    => 'BLK 12 LOT 34',
            'perm_street'   => 'PUROK MASAGANA',
            'perm_barangay' => 'ANNAFUNAN',
            'perm_city'     => 'TUMAUINI',
            'perm_province' => 'ISABELA',
            'perm_region'   => 'REGION II',

            'birth_month' => '10',
            'birth_day'   => '18',
            'birth_year'  => '1985',
            'birth_city'  => 'TUMAUINI',
            'birth_prov'  => 'ISABELA, PHILIPPINES',

            'mobile'          => '1712345678',
            'owns_mobile_yes' => true,

            'mother_first' => 'JOSEFINA',
            'mother_mid'   => 'REYES',
            'mother_sur'   => 'PEÑAFLORIDA',

            'civil_married' => true,
            'spouse_first'  => 'ANDRÉS',
            'spouse_sur'    => 'MAGTANGGOL',

            'edu_college'  => true,
            'relig_christ' => true,

            'icc_yes'     => true,
            'icc_ip_name' => 'IBANAG',
            'pwd_no'      => true,
            'fourps_yes'  => true,

            'id_type'   => "DRIVER'S LICENSE",
            'id_number' => 'N01-23-456789',

            'org_1' => 'SAMAHAN NG MAGSASAKA',
            'org_2' => 'IRRIGATORS ASSOCIATION',
            'org_3' => 'AGRI COOPERATIVE',

            'sector_farmer' => true,
        ], 'built-in test data (long name, Ñ, all groups)'];
    }
}
