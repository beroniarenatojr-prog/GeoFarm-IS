<?php

namespace App\Services;

use App\Models\Farmer;

/**
 * Maps a Farmer record onto the field names used by the RSBSA overlay map.
 *
 * Kept apart from RsbsaFormFiller so the database schema and the printed
 * coordinates can change independently of each other.
 */
class RsbsaFieldMapper
{
    /** @return array<string, mixed> */
    public function map(Farmer $farmer): array
    {
        return array_merge(
            $this->identity($farmer),
            $this->addresses($farmer),
            $this->birthAndContact($farmer),
            $this->family($farmer),
            $this->classification($farmer),
            $this->education($farmer),
            $this->religion($farmer),
            $this->livelihood($farmer),
            $this->parcels($farmer),
        );
    }

    /**
     * PART 3 takes up to three parcel blocks, keyed parcel1_*, parcel2_*,
     * parcel3_*. Only a FARMER declares parcels — Farm Workers, Fishers and
     * Agri-Youth skip Part 3 entirely, exactly as the form instructs.
     */
    private function parcels(Farmer $farmer): array
    {
        $out = [];

        if ($farmer->livelihood_type !== 'Farmer') {
            return $out;
        }

        $slots = (int) config('rsbsa-overlay.parcels.count', 3);

        foreach ($farmer->parcels->take($slots)->values() as $i => $p) {
            $n = 'parcel' . ($i + 1) . '_';

            $out += [
                $n . 'barangay'      => $this->upper($p->barangay),
                $n . 'city_province' => $this->upper(
                    collect([$p->city_municipality, $p->province])->filter()->implode(', ')
                ),
                $n . 'total_area' => $p->total_area_ha !== null
                    ? number_format((float) $p->total_area_ha, 2)
                    : null,
                $n . 'proof'      => $this->upper($p->proof_of_ownership),
                $n . 'land_owner' => $this->upper($p->land_owner_name),

                $n . 'cropping_schedule' => $this->upper($p->cropping_schedule),
                $n . 'commodity'         => $this->upper($p->commodity),
                $n . 'size_ha'           => $p->total_area_ha !== null
                    ? number_format((float) $p->total_area_ha, 2)
                    : null,
                $n . 'heads_trees' => $p->no_of_heads_trees,
                $n . 'farm_type'   => $this->upper($p->farmType?->type_name),
                $n . 'organic'     => $p->is_organic ? 'Y' : 'N',

                $n . 'ad_yes'  => (bool) $p->within_ancestral,
                $n . 'ad_no'   => ! $p->within_ancestral,
                $n . 'arb_yes' => (bool) $p->arb,
                $n . 'arb_no'  => ! $p->arb,

                $n . 'own_registered' => $p->ownership_type === 'Registered Owner',
                $n . 'own_lessee'     => $p->ownership_type === 'Lessee',
                $n . 'own_tenant'     => $p->ownership_type === 'Tenant',
                $n . 'own_others'     => $p->ownership_type !== null
                    && ! in_array($p->ownership_type, ['Registered Owner', 'Lessee', 'Tenant'], true),
            ];
        }

        return $out;
    }

    private function identity(Farmer $farmer): array
    {
        return [
            // The form instructs "Write in CAPITAL LETTERS".
            'surname'     => $this->upper($farmer->last_name),
            'first_name'  => $this->upper($farmer->first_name),
            'middle_name' => $this->upper($farmer->middle_name),
            'ext_name'    => $this->upper($farmer->suffix),

            'no_middle_name' => blank($farmer->middle_name),
            'no_ext_name'    => blank($farmer->suffix),

            'sex_male'   => $farmer->sex === 'Male',
            'sex_female' => $farmer->sex === 'Female',

            'id_type'   => $this->upper($farmer->valid_id_type),
            'id_number' => $this->upper($farmer->id_number),
        ];
    }

    private function addresses(Farmer $farmer): array
    {
        return [
            'perm_house'    => $this->upper($farmer->house_lot_number),
            'perm_street'   => $this->upper($farmer->street_sitio),
            'perm_barangay' => $this->upper($farmer->barangay),
            'perm_city'     => $this->upper($farmer->city_municipality),
            'perm_province' => $this->upper($farmer->province),
            'perm_region'   => $this->upper($farmer->region),

            'prov_house'    => $this->upper($farmer->provincial_house_lot),
            'prov_street'   => $this->upper($farmer->provincial_street_sitio),
            'prov_barangay' => $this->upper($farmer->provincial_barangay),
            'prov_city'     => $this->upper($farmer->provincial_city_municipality),
            'prov_province' => $this->upper($farmer->provincial_province),
            'prov_region'   => $this->upper($farmer->provincial_region),
        ];
    }

    private function birthAndContact(Farmer $farmer): array
    {
        $birth = $farmer->birthdate;
        $mobile = $this->mobileDigits($farmer->mobile_no);

        return [
            'birth_month' => $birth?->format('m'),
            'birth_day'   => $birth?->format('d'),
            'birth_year'  => $birth?->format('Y'),

            'birth_city' => $this->upper($farmer->birth_city_municipality),
            'birth_prov' => $this->upper($farmer->birth_province),

            'mobile' => $mobile,

            // No column records whose phone this is; a number on the farmer's
            // own record is treated as their own. Add a column if the office
            // needs to record borrowed numbers.
            'owns_mobile_yes' => $mobile !== '',
        ];
    }

    private function family(Farmer $farmer): array
    {
        $status = $farmer->civil_status;

        return [
            'mother_first' => $this->upper($farmer->mother_first_name),
            'mother_mid'   => $this->upper($farmer->mother_middle_name),
            'mother_sur'   => $this->upper($farmer->mother_last_name ?: $farmer->mother_maiden_name),

            // Printed only for a married farmer. The row stays blank otherwise
            // even if a name lingers in the columns, because the form asks for
            // it "if married" and a spouse against Single reads as an error.
            'spouse_first' => $status === 'Married' ? $this->upper($farmer->spouse_first_name) : null,
            'spouse_mid'   => $status === 'Married' ? $this->upper($farmer->spouse_middle_name) : null,
            'spouse_sur'   => $status === 'Married' ? $this->upper($farmer->spouse_last_name) : null,

            'civil_single'    => $status === 'Single',
            'civil_married'   => $status === 'Married',
            'civil_widow'     => $status === 'Widowed',
            'civil_separated' => $status === 'Separated',
        ];
    }

    private function classification(Farmer $farmer): array
    {
        return [
            'icc_yes'     => (bool) $farmer->is_indigenous,
            'icc_no'      => ! $farmer->is_indigenous,
            'icc_ip_name' => $this->upper($farmer->indigenous_community),

            'pwd_yes' => (bool) $farmer->pwd,
            'pwd_no'  => ! $farmer->pwd,

            'fourps_yes' => (bool) $farmer->is_4ps,
            'fourps_no'  => ! $farmer->is_4ps,

            'org_1' => $this->upper($farmer->organization_name),
            'org_2' => $this->upper($farmer->organization_name_2),
            'org_3' => $this->upper($farmer->organization_name_3),
        ];
    }

    private function education(Farmer $farmer): array
    {
        $edu = strtolower((string) $farmer->highest_education);

        $match = fn (string $needle) => $edu !== '' && str_contains($edu, $needle);

        return [
            'edu_preschool'  => $match('pre-school') || $match('preschool'),
            'edu_elementary' => $match('element'),
            'edu_hs_nonk12'  => $match('high school (non') || $match('non k-12'),
            'edu_jhs'        => $match('junior'),
            'edu_shs'        => $match('senior'),
            'edu_college'    => $match('college'),
            'edu_postgrad'   => $match('post'),
            'edu_vocational' => $match('vocational'),
            'edu_none'       => $edu === '' || $match('none'),
        ];
    }

    private function religion(Farmer $farmer): array
    {
        $rel = strtolower((string) $farmer->religion);

        $christian = str_contains($rel, 'christ') || str_contains($rel, 'catholic');
        $islam     = str_contains($rel, 'islam') || str_contains($rel, 'muslim');
        $none      = $rel === '' || str_contains($rel, 'none');

        return [
            'relig_christ' => $christian,
            'relig_islam'  => $islam,
            'relig_none'   => $none,
            'relig_others' => ! $christian && ! $islam && ! $none,
        ];
    }

    private function livelihood(Farmer $farmer): array
    {
        $type = $farmer->livelihood_type;

        return [
            'sector_farmer'     => $type === 'Farmer',
            'sector_farmworker' => $type === 'Farm Worker',
            'sector_fisher'     => $type === 'Fisher',
            'sector_agriyouth'  => $type === 'Agri-Youth',
        ];
    }

    // -------------------------------------------------------------- helpers

    private function upper(?string $value): ?string
    {
        return blank($value) ? null : mb_strtoupper(trim($value));
    }

    /**
     * The form's mobile row starts with a pre-printed "0" and "9", so only the
     * remaining 10 digits are stamped. Writing the full 09xxxxxxxxx would
     * double them up.
     */
    private function mobileDigits(?string $mobile): string
    {
        $digits = preg_replace('/\D+/', '', (string) $mobile);

        if ($digits === '') {
            return '';
        }

        foreach (['639', '09'] as $prefix) {
            if (str_starts_with($digits, $prefix)) {
                return substr($digits, strlen($prefix));
            }
        }

        // Already a bare 10-digit subscriber number, e.g. 9171234567.
        return ltrim($digits, '0');
    }
}
