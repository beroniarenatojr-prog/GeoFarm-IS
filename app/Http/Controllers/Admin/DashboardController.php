<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AssistanceDistribution;
use App\Models\CropSeason;
use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\Livestock;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Dashboard', [
            'metrics' => Inertia::defer(fn () => [
                // Verified only - pending online registrations are not farmers yet.
                'total_farmers'        => Farmer::verified()->count(),
                'pending_verification' => Farmer::pending()->count(),
                'total_parcels'        => FarmParcel::count(),
                'total_livestock'      => Livestock::sum('count'),
                'recent_distributions' => AssistanceDistribution::with(['farmer', 'program'])
                    ->latest('distribution_date')->take(5)->get(),
            ]),
            'charts' => Inertia::defer(fn () => [
                'farmers_per_month' => Farmer::verified()
                    ->selectRaw("DATE_FORMAT(created_at, '%m') as month, COUNT(*) as count")
                    ->whereYear('created_at', now()->year)
                    ->groupBy('month')->orderBy('month')->get(),
                'crop_production' => CropSeason::selectRaw('cropping_year, SUM(yield_kg) as total_yield')
                    ->groupBy('cropping_year')->orderBy('cropping_year')->get(),

                // Real spend per programme, replacing the hard-coded pie that
                // used to sit here.
                'aid_by_program' => AssistanceDistribution::query()
                    ->join('financial_assistance', 'assistance_distributions.assistance_id', '=', 'financial_assistance.id')
                    ->selectRaw('financial_assistance.program_name as name, SUM(assistance_distributions.amount_given) as value')
                    ->groupBy('financial_assistance.program_name')
                    ->orderByDesc('value')
                    ->get(),
            ]),

            // Figures for the side panel. Every one is queried; nothing here is
            // an estimate or a placeholder.
            'quickStats' => Inertia::defer(fn () => [
                'active_seasons' => CropSeason::whereNotNull('planting_date')
                    ->whereNull('harvest_date')->count(),
                'pending_claims' => AssistanceDistribution::where('status', 'pending')->count(),
                'avg_yield_per_ha' => round((float) CropSeason::whereNotNull('yield_kg')
                    ->where('area_planted_ha', '>', 0)
                    ->selectRaw('AVG(yield_kg / area_planted_ha) as avg')
                    ->value('avg'), 2),
                'hectares_mapped' => round((float) FarmParcel::sum('total_area_ha'), 2),
            ]),
        ]);
    }
}
