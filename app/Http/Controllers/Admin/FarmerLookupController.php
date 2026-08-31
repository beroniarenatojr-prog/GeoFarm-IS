<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use Illuminate\Http\Request;

/**
 * Type-ahead farmer search, shared by every form that has to name a farmer.
 *
 * The registry is heading for 8,000+ records, so a <select> is out of the
 * question and typing a raw ID by hand is a data-entry error waiting to
 * happen — nobody knows a farmer by their database id.
 *
 * Lives on its own route, gated on "view farmers", so it is not tied to the
 * permissions of whichever module happens to embed it.
 */
class FarmerLookupController extends Controller
{
    /** Columns a user might reasonably type into the box. */
    private const SEARCHABLE = [
        'first_name', 'middle_name', 'last_name', 'suffix',
        'rsbsa_no', 'reference_code', 'mobile_no', 'email',
        'barangay', 'city_municipality',
    ];

    /** Those same columns as one string, for multi-word searching. */
    private const HAYSTACK = "CONCAT_WS(' ', first_name, middle_name, last_name, suffix,"
        . " rsbsa_no, reference_code, mobile_no, email, barangay, city_municipality)";

    public function __invoke(Request $request)
    {
        $term = trim((string) $request->query('q', ''));

        // Two characters keeps a single keystroke from scanning the registry.
        if (mb_strlen($term) < 2) {
            return response()->json([]);
        }

        $farmers = Farmer::query()
            ->when(
                !$request->boolean('include_unverified'),
                fn ($q) => $q->verified()
            )
            ->where(function ($q) use ($term) {
                // Commas are how people write "Dela Cruz, Juan"; they carry no
                // meaning here, so they become spaces.
                $words = preg_split('/\s+/', trim(str_replace(',', ' ', $term)), -1, PREG_SPLIT_NO_EMPTY);

                if (count($words) > 1) {
                    // Every word must appear somewhere in the farmer's details.
                    // This makes name order irrelevant and survives a middle
                    // name sitting between the two words typed: "Juan Cruz"
                    // still finds "Juan Santos Dela Cruz". It also allows
                    // mixing fields, e.g. "Juan Caligayan".
                    foreach ($words as $word) {
                        $q->whereRaw(self::HAYSTACK . ' LIKE ?', ["%{$word}%"]);
                    }

                    return;
                }

                foreach (self::SEARCHABLE as $column) {
                    $q->orWhere($column, 'like', "%{$term}%");
                }
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->limit(15)
            ->get([
                'id', 'first_name', 'middle_name', 'last_name', 'suffix',
                'rsbsa_no', 'reference_code', 'barangay', 'mobile_no', 'verification_status',
            ]);

        return response()->json(
            $farmers->map(fn ($f) => [
                'id'    => $f->id,
                'label' => trim(collect([$f->last_name, $f->first_name])->filter()->implode(', ')
                    . ($f->suffix ? " {$f->suffix}" : '')),
                'meta'  => collect([
                    $f->rsbsa_no ? "RSBSA {$f->rsbsa_no}" : ($f->reference_code ? "Ref {$f->reference_code}" : null),
                    $f->barangay,
                    $f->mobile_no,
                ])->filter()->implode(' · '),
                'verified' => $f->verification_status === Farmer::STATUS_VERIFIED,
            ])
        );
    }
}
