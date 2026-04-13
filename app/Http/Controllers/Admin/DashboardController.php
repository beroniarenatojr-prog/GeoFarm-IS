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
                'total_farmers'        => Farmer::count(),
                'total_parcels'        => FarmParcel::count(),
                'total_livestock'      => Livestock::sum('count'),
                'recent_distributions' => AssistanceDistribution::with(['farmer', 'program'])
                    ->latest('distribution_date')->take(5)->get(),
            ]),
            'charts' => Inertia::defer(fn () => [
                'farmers_per_month' => Farmer::selectRaw("DATE_FORMAT(created_at, '%m') as month, COUNT(*) as count")
                    ->whereYear('created_at', now()->year)
                    ->groupBy('month')->orderBy('month')->get(),
                'crop_production' => CropSeason::selectRaw('cropping_year, SUM(yield_kg) as total_yield')
                    ->groupBy('cropping_year')->orderBy('cropping_year')->get(),
            ]),
        ]);
    }
}
