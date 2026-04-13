<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class FarmerController extends Controller
{
    public function index(Request $request)
    {
        $farmers = Farmer::query()
            ->when($request->search, fn($q, $s) => $q->where('first_name', 'like', "%$s%")
                ->orWhere('last_name', 'like', "%$s%")
                ->orWhere('rsbsa_no', 'like', "%$s%"))
            ->when($request->barangay, fn($q, $b) => $q->where('barangay', $b))
            ->orderBy('last_name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Farmers/Index', [
            'farmers'    => $farmers,
            'filters'    => $request->only(['search', 'barangay']),
            'barangays'  => Farmer::distinct()->pluck('barangay')->filter()->sort()->values(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Farmers/Form');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'rsbsa_no'          => 'nullable|string|unique:farmers',
            'first_name'        => 'required|string|max:50',
            'last_name'         => 'required|string|max:50',
            'middle_name'       => 'nullable|string|max:50',
            'suffix'            => 'nullable|string|max:10',
            'birthdate'         => 'nullable|date',
            'sex'               => 'nullable|in:Male,Female',
            'civil_status'      => 'nullable|in:Single,Married,Widowed,Separated',
            'mobile_no'         => 'nullable|string|max:20',
            'email'             => 'nullable|email|max:100',
            'barangay'          => 'nullable|string|max:50',
            'city_municipality' => 'nullable|string|max:50',
            'province'          => 'nullable|string|max:50',
            'pwd'               => 'boolean',
            'is_4ps'            => 'boolean',
            'is_indigenous'     => 'boolean',
            'organization_name' => 'nullable|string|max:100',
            'photo'             => 'nullable|image|max:2048',
        ]);

        if ($request->hasFile('photo')) {
            $data['photo_path'] = $request->file('photo')->store('farmers/photos', 'public');
        }

        $farmer = Farmer::create($data);

        // Generate QR code using SVG (no imagick/gd required)
        $qr = QrCode::format('svg')->size(200)->generate(url("/admin/farmers/{$farmer->id}"));
        $qrPath = "farmers/qrcodes/{$farmer->id}.svg";
        Storage::disk('public')->put($qrPath, $qr);
        $farmer->update(['qr_code_path' => $qrPath]);

        AuditService::log('create', 'farmers', $farmer->id, null, $farmer->toArray());

        return redirect()->route('admin.farmers.index')->with('success', 'Farmer added successfully.');
    }

    public function show(Farmer $farmer)
    {
        return Inertia::render('Admin/Farmers/Show', [
            'farmer' => $farmer->load([
                'parcels.farmType',
                'livestock.livestockType',
                'distributions.program',
                'treeCrops',
                'fishponds',
                'largeRuminants',
                'smallRuminants',
                'nativePigs',
                'swineHybrid',
                'poultry',
            ]),
        ]);
    }

    public function edit(Farmer $farmer)
    {
        return Inertia::render('Admin/Farmers/Form', ['farmer' => $farmer]);
    }

    public function update(Request $request, Farmer $farmer)
    {
        $data = $request->validate([
            'first_name'        => 'required|string|max:50',
            'last_name'         => 'required|string|max:50',
            'middle_name'       => 'nullable|string|max:50',
            'mobile_no'         => 'nullable|string|max:20',
            'barangay'          => 'nullable|string|max:50',
            'city_municipality' => 'nullable|string|max:50',
            'province'          => 'nullable|string|max:50',
            'pwd'               => 'boolean',
            'is_4ps'            => 'boolean',
            'is_indigenous'     => 'boolean',
            'organization_name' => 'nullable|string|max:100',
            'photo'             => 'nullable|image|max:2048',
        ]);

        $old = $farmer->toArray();

        if ($request->hasFile('photo')) {
            if ($farmer->photo_path) Storage::disk('public')->delete($farmer->photo_path);
            $data['photo_path'] = $request->file('photo')->store('farmers/photos', 'public');
        }

        $farmer->update($data);
        AuditService::log('update', 'farmers', $farmer->id, $old, $farmer->fresh()->toArray());

        return redirect()->route('admin.farmers.index')->with('success', 'Farmer updated.');
    }

    public function destroy(Farmer $farmer)
    {
        AuditService::log('delete', 'farmers', $farmer->id, $farmer->toArray(), null);
        $farmer->delete();
        return redirect()->route('admin.farmers.index')->with('success', 'Farmer deleted.');
    }
}
