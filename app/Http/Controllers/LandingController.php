<?php

namespace App\Http\Controllers;

use App\Models\Barangay;
use App\Models\FarmParcel;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class LandingController extends Controller
{
    /** The landing page is public and hit often; these counts change rarely. */
    private const CACHE_TTL_SECONDS = 300;

    public function index()
    {
        return Inertia::render('Landing', [
            'canLogin' => true,
            'stats'    => Cache::remember('landing.stats', self::CACHE_TTL_SECONDS, fn () => $this->stats()),
            'barangays' => Cache::remember(
                'landing.barangays',
                self::CACHE_TTL_SECONDS,
                // Active only. Retired names are kept as rows so the boundaries
                // and programmes attached to them survive, but they are not
                // barangays of Tumauini any more and must not be listed as such
                // on a public page.
                fn () => Barangay::active()->orderBy('name')->pluck('name')->all()
            ),
        ]);
    }

    /**
     * Live figures straight from the registry.
     *
     * These are deliberately the real counts rather than aspirational ones: the
     * page is public and represents the Municipal Agriculture Office, so the
     * numbers on it have to be true. They grow on their own as the office
     * encodes data.
     */
    private function stats(): array
    {
        return [
            // Counted the whole table before, retired rows included — which is
            // why a public page claiming to serve Tumauini reported 75
            // barangays when the municipality has 46.
            'barangays'  => Barangay::active()->count(),
            'farmers'    => Farmer::verified()->count(),
            'hectares'   => round((float) FarmParcel::sum('total_area_ha'), 2),
            'programs'   => FinancialAssistance::count(),
        ];
    }
}
