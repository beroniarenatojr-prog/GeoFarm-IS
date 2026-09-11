<?php

namespace App\Http\Controllers\Farmer;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Services\ClimateRecommendationEngine;
use App\Services\ParcelRiskAnalyser;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * A farmer's own farm analysis, on the portal.
 *
 * The same analysis the office reads, produced by the same service, so the two
 * can never disagree about the same farm in front of the person who owns it.
 * What differs is only which farm can be asked for.
 *
 * The farmer is resolved from the signed-in account and never from the URL.
 * There is deliberately no farmer parameter on this route: with one, the
 * ownership check becomes a thing that can be forgotten, and forgetting it
 * would hand one farmer another's production records.
 */
class FarmAnalysisController extends Controller
{
    public function show(
        Request $request,
        ParcelRiskAnalyser $analyser,
        ClimateRecommendationEngine $recommendations,
    ) {
        $requested = $request->validate([
            'season' => 'nullable|in:wet,dry',
            'year'   => 'nullable|integer|min:2000|max:2100',
        ]);

        $farmer = Farmer::where('user_id', $request->user()->id)->firstOrFail();

        $analysis = $analyser->forFarmer(
            $farmer,
            $requested['season'] ?? null,
            isset($requested['year']) ? (int) $requested['year'] : null,
        );

        $all = $analysis['recommendations'];

        return Inertia::render('Farmer/Analysis', [
            'analysis'   => $analysis,
            'topActions' => $recommendations->topOf($all),
            'allActions' => $all,

            // No period picker on the portal. A farmer wants to know about the
            // season ahead; offering four choices invites them to read a past
            // one as a forecast.
            'periods'    => [],

            // Assistance programmes are the office's to offer, not a list the
            // farmer should read as an entitlement.
            'assistance' => [],
        ]);
    }
}
