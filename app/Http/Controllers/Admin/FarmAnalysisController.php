<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use App\Services\ClimateRecommendationEngine;
use App\Services\ParcelRiskAnalyser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

/**
 * One farmer's farm, analysed parcel by parcel.
 *
 * The municipality-wide page answers "who needs attention"; this answers "what
 * is happening on this farm, on what evidence, and what should be done about
 * it". Everything shown is computed by ParcelRiskAnalyser from records that
 * already exist — this controller decides what reaches the screen and nothing
 * about the analysis itself.
 *
 * Not cached. The whole point is that it is read while advising a specific
 * farmer, often just after their assessment was submitted, and a ten-minute
 * cache would show the adviser the answer from before the conversation.
 */
class FarmAnalysisController extends Controller
{
    public function show(
        Request $request,
        Farmer $farmer,
        ParcelRiskAnalyser $analyser,
        ClimateRecommendationEngine $recommendations,
    ) {
        /*
         * The season comes from the calendar, not from the query string, unless
         * a valid one is named. Anything else falls back rather than throwing:
         * a mistyped URL should show this season's analysis, not an error page.
         */
        $requested = $request->validate([
            'season' => 'nullable|in:wet,dry',
            'year'   => 'nullable|integer|min:2000|max:2100',
        ]);

        $analysis = $analyser->forFarmer(
            $farmer,
            $requested['season'] ?? null,
            isset($requested['year']) ? (int) $requested['year'] : null,
        );

        $all = $analysis['recommendations'];

        return Inertia::render('Admin/Analytics/FarmAnalysis', [
            'analysis' => $analysis,

            // Split here rather than in the page, so "the top three" means the
            // same thing wherever it is shown and the office can change it in
            // config without touching a component.
            'topActions' => $recommendations->topOf($all),
            'allActions' => $all,

            'periods' => $this->selectablePeriods($analyser),

            // What the office could actually offer. Only programmes that exist
            // — nothing is proposed that staff cannot then go and find.
            'assistance' => $this->availableAssistance(),

            'canRecordAssistance' => $request->user()?->can('create assistance') ?? false,
        ]);
    }

    /**
     * The upcoming season plus the two around it.
     *
     * Enough to look back at what was predicted last time without turning the
     * page into a date picker.
     */
    private function selectablePeriods(ParcelRiskAnalyser $analyser): array
    {
        $upcoming = $analyser->upcomingPeriod();
        $year = $upcoming['year'];

        $periods = [
            ['season' => 'wet', 'year' => $year],
            ['season' => 'dry', 'year' => $year],
            ['season' => 'wet', 'year' => $year - 1],
            ['season' => 'dry', 'year' => $year - 1],
        ];

        return collect($periods)
            ->map(fn (array $p) => $p + [
                'label' => ($p['season'] === 'wet' ? 'Wet Season ' : 'Dry Season ') . $p['year'],
                'is_upcoming' => $p['season'] === $upcoming['season'] && $p['year'] === $upcoming['year'],
            ])
            ->values()
            ->all();
    }

    /**
     * Assistance programmes the office actually holds.
     *
     * Guarded on the table, because financial_assistance has drifted between
     * the repository and the server before; a missing column here would take
     * down the whole analysis over a sidebar panel.
     */
    private function availableAssistance(): array
    {
        if (! Schema::hasTable('financial_assistance')) {
            return [];
        }

        try {
            return FinancialAssistance::query()
                ->latest('id')
                ->limit(5)
                ->get()
                ->map(fn (FinancialAssistance $a) => [
                    'id'   => $a->id,
                    'name' => $a->program_name ?? $a->assistance_type ?? 'Assistance programme',
                ])
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }
}
