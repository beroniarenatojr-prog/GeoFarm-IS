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
                fn () => Barangay::orderBy('name')->pluck('name')->all()
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
            'barangays'  => Barangay::count(),
            'farmers'    => Farmer::verified()->count(),
            'hectares'   => round((float) FarmParcel::sum('total_area_ha'), 2),
            'programs'   => FinancialAssistance::count(),
        ];
    }
}
