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
        // The registry shows verified farmers only. Online submissions awaiting
        // staff verification live in the verification queue instead.
        $farmers = Farmer::query()
            ->verified()
            ->when($request->search, fn($q, $s) => $q->where(function ($query) use ($s) {
                $query->where('first_name', 'like', "%$s%")
                    ->orWhere('last_name', 'like', "%$s%")
                    ->orWhere('rsbsa_no', 'like', "%$s%");
            }))
            ->when($request->barangay, fn($q, $b) => $q->where('barangay', $b))
            ->orderBy('last_name')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Farmers/Index', [
            'farmers'    => $farmers,
            'filters'    => $request->only(['search', 'barangay']),
            'barangays'  => Farmer::verified()->distinct()->pluck('barangay')->filter()->sort()->values(),
            'pendingCount' => Farmer::pending()->count(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Farmers/FormRSBSA', [
            'farmTypes' => \App\Models\FarmType::all(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // Personal Information - Only name and sex are required
            'rsbsa_no'          => 'nullable|string|unique:farmers',
            'sex'               => 'required|in:Male,Female',
            'first_name'        => 'required|string|max:50',
            'last_name'         => 'required|string|max:50',
            'middle_name'       => 'nullable|string|max:50',
            'suffix'            => 'nullable|string|max:10',
            'birthdate'         => 'nullable|date',
            'birth_city_municipality' => 'nullable|string|max:100',
            'birth_province'    => 'nullable|string|max:100',
            'mother_first_name' => 'nullable|string|max:50',
            'mother_middle_name'=> 'nullable|string|max:50',
            'mother_last_name'  => 'nullable|string|max:50',
            'civil_status'      => 'nullable|in:Single,Married,Widowed,Separated',
            'religion'          => 'nullable|string|max:50',
            'highest_education' => 'nullable|string|max:50',
            'mobile_no'         => 'nullable|string|max:20',
            'email'             => 'nullable|email|max:100',
            'valid_id_type'     => 'nullable|string|max:50',
            'id_number'         => 'nullable|string|max:100',
            
            // Address - All optional
            'house_lot_number'  => 'nullable|string|max:100',
            'street_sitio'      => 'nullable|string|max:100',
            'barangay'          => 'nullable|string|max:50',
            'city_municipality' => 'nullable|string|max:50',
            'province'          => 'nullable|string|max:50',
            'region'            => 'nullable|string|max:100',
            
            // Provincial Address (for NCR residents)
            'provincial_house_lot' => 'nullable|string|max:100',
            'provincial_street_sitio' => 'nullable|string|max:100',
            'provincial_barangay' => 'nullable|string|max:50',
            'provincial_city_municipality' => 'nullable|string|max:50',
            'provincial_province' => 'nullable|string|max:50',
            'provincial_region' => 'nullable|string|max:100',
            
            // Classification
            'is_indigenous'     => 'boolean',
            'indigenous_community' => 'nullable|string|max:100',
            'pwd'               => 'boolean',
            'is_4ps'            => 'boolean',
            'organization_name' => 'nullable|string|max:200',
            'organization_name_2' => 'nullable|string|max:200',
            'organization_name_3' => 'nullable|string|max:200',
            
            // Livelihood
            'livelihood_type'   => 'nullable|in:Farmer,Farm Worker,Fisher,Agri-Youth',
            
            // Documents
            'photo'             => 'nullable|image|max:5120',
            'id_proof'          => 'nullable|file|max:5120',
            
            // Parcels (as JSON) - Optional
            'parcels'           => 'nullable|json',
        ]);

        // Handle file uploads
        if ($request->hasFile('photo')) {
            $data['photo_path'] = $request->file('photo')->store('farmers/photos', 'public');
        }
        
        if ($request->hasFile('id_proof')) {
            $data['id_proof_path'] = $request->file('id_proof')->store('farmers/id_proofs', 'public');
        }

        // Only a FARMER declares farm parcels (Part 3 of the RSBSA form).
        // Farm Workers, Fishers and Agri-Youth skip that part entirely.
        $parcels = $this->parcelsFor($data);
        unset($data['parcels']);

        $farmer = Farmer::create($data);

        foreach ($parcels as $parcelData) {
            $farmer->parcels()->create($parcelData);
        }

        // Generate QR code
        $qr = QrCode::format('svg')->size(200)->generate(url("/admin/farmers/{$farmer->id}"));
        $qrPath = "farmers/qrcodes/{$farmer->id}.svg";
        Storage::disk('public')->put($qrPath, $qr);
        $farmer->update(['qr_code_path' => $qrPath]);

        AuditService::log('create', 'farmers', $farmer->id, null, $farmer->toArray());

        return redirect()->route('admin.farmers.index')->with('success', 'Farmer registered successfully.');
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
        $farmer->load('parcels');
        return Inertia::render('Admin/Farmers/FormRSBSA', [
            'farmer' => $farmer,
            'farmTypes' => \App\Models\FarmType::all(),
        ]);
    }

    public function update(Request $request, Farmer $farmer)
    {
        $data = $request->validate([
            // Personal Information - Only name and sex are required
            'sex'               => 'required|in:Male,Female',
            'first_name'        => 'required|string|max:50',
            'last_name'         => 'required|string|max:50',
            'middle_name'       => 'nullable|string|max:50',
            'suffix'            => 'nullable|string|max:10',
            'birthdate'         => 'nullable|date',
            'birth_city_municipality' => 'nullable|string|max:100',
            'birth_province'    => 'nullable|string|max:100',
            'mother_first_name' => 'nullable|string|max:50',
            'mother_middle_name'=> 'nullable|string|max:50',
            'mother_last_name'  => 'nullable|string|max:50',
            'civil_status'      => 'nullable|in:Single,Married,Widowed,Separated',
            'religion'          => 'nullable|string|max:50',
            'highest_education' => 'nullable|string|max:50',
            'mobile_no'         => 'nullable|string|max:20',
            'email'             => 'nullable|email|max:100',
            'valid_id_type'     => 'nullable|string|max:50',
            'id_number'         => 'nullable|string|max:100',
            
            // Address - All optional
            'house_lot_number'  => 'nullable|string|max:100',
            'street_sitio'      => 'nullable|string|max:100',
            'barangay'          => 'nullable|string|max:50',
            'city_municipality' => 'nullable|string|max:50',
            'province'          => 'nullable|string|max:50',
            'region'            => 'nullable|string|max:100',
            
            // Provincial Address (for NCR residents)
            'provincial_house_lot' => 'nullable|string|max:100',
            'provincial_street_sitio' => 'nullable|string|max:100',
            'provincial_barangay' => 'nullable|string|max:50',
            'provincial_city_municipality' => 'nullable|string|max:50',
            'provincial_province' => 'nullable|string|max:50',
            'provincial_region' => 'nullable|string|max:100',
            
            // Classification
            'is_indigenous'     => 'boolean',
            'indigenous_community' => 'nullable|string|max:100',
            'pwd'               => 'boolean',
            'is_4ps'            => 'boolean',
            'organization_name' => 'nullable|string|max:200',
            'organization_name_2' => 'nullable|string|max:200',
            'organization_name_3' => 'nullable|string|max:200',
            
            // Livelihood
            'livelihood_type'   => 'nullable|in:Farmer,Farm Worker,Fisher,Agri-Youth',
            
            // Documents
            'photo'             => 'nullable|image|max:5120',
            'id_proof'          => 'nullable|file|max:5120',
            
            // Parcels (as JSON) - Optional
            'parcels'           => 'nullable|json',
        ]);

        $old = $farmer->toArray();

        // Handle file uploads
        if ($request->hasFile('photo')) {
            if ($farmer->photo_path) Storage::disk('public')->delete($farmer->photo_path);
            $data['photo_path'] = $request->file('photo')->store('farmers/photos', 'public');
        }
        
        if ($request->hasFile('id_proof')) {
            if ($farmer->id_proof_path) Storage::disk('public')->delete($farmer->id_proof_path);
            $data['id_proof_path'] = $request->file('id_proof')->store('farmers/id_proofs', 'public');
        }

        // Only a FARMER keeps farm parcels. If the livelihood changed to
        // Farm Worker / Fisher / Agri-Youth, any previously declared parcels
        // no longer apply and are removed.
        $isFarmer = ($data['livelihood_type'] ?? null) === 'Farmer';
        $parcels = $this->parcelsFor($data);
        unset($data['parcels']);

        $farmer->update($data);

        if (!$isFarmer) {
            $farmer->parcels()->delete();
        } elseif (!empty($parcels)) {
            $farmer->parcels()->delete();

            foreach ($parcels as $parcelData) {
                $farmer->parcels()->create($parcelData);
            }
        }

        AuditService::log('update', 'farmers', $farmer->id, $old, $farmer->fresh()->toArray());

        return redirect()->route('admin.farmers.index')->with('success', 'Farmer updated successfully.');
    }

    public function destroy(Farmer $farmer)
    {
        AuditService::log('delete', 'farmers', $farmer->id, $farmer->toArray(), null);
        $farmer->delete();
        return redirect()->route('admin.farmers.index')->with('success', 'Farmer deleted.');
    }

    /**
     * Resolve the farm parcels to persist from validated request data.
     *
     * Part 3 of the RSBSA form (Farm Parcel Information) is answered only by a
     * FARMER, so parcels posted alongside any other livelihood type are ignored.
     * Rows with no barangay and no area are treated as blank and dropped, and
     * empty numeric values are normalised to null so they don't hit non-numeric
     * columns as empty strings.
     */
    private function parcelsFor(array $data): array
    {
        if (($data['livelihood_type'] ?? null) !== 'Farmer') {
            return [];
        }

        $parcels = isset($data['parcels']) ? json_decode($data['parcels'], true) : [];

        if (!is_array($parcels)) {
            return [];
        }

        $numericFields = ['total_area_ha', 'no_of_heads_trees', 'farm_type_id'];
        $resolved = [];

        foreach ($parcels as $parcel) {
            if (!is_array($parcel)) {
                continue;
            }

            if (empty($parcel['barangay']) && empty($parcel['total_area_ha'])) {
                continue;
            }

            foreach ($numericFields as $field) {
                $parcel[$field] = !empty($parcel[$field]) ? $parcel[$field] : null;
            }

            $resolved[] = $parcel;
        }

        return $resolved;
    }

    // Farmer Dashboard (for logged-in farmers with Farmer role)
    public function dashboard()
    {
        $user = auth()->user();
        $farmer = Farmer::where('user_id', $user->id)->with([
            'parcels.farmType',
            'livestock',
            'distributions.program',
            'treeCrops',
            'fishponds',
            'largeRuminants',
            'smallRuminants',
            'nativePigs',
            'swineHybrid',
            'poultry'
        ])->firstOrFail();

        // Debug: Log the distributions data
        \Log::info('Farmer Distributions:', [
            'farmer_id' => $farmer->id,
            'distributions' => $farmer->distributions->toArray()
        ]);

        return Inertia::render('Farmer/Dashboard', [
            'farmer' => $farmer,
            'stats' => [
                'parcels' => $farmer->parcels->count(),
                'livestock' => $farmer->livestock->count(),
                'assistance' => $farmer->distributions->count(),
                'total_area' => $farmer->parcels->sum('total_area'),
            ]
        ]);
    }

    public function export()
    {
        $farmers = Farmer::orderBy('last_name')->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="farmers_export_' . date('Y-m-d') . '.csv"',
        ];

        $callback = function() use ($farmers) {
            $file = fopen('php://output', 'w');
            
            // CSV Headers
            fputcsv($file, [
                'RSBSA No',
                'Last Name',
                'First Name',
                'Middle Name',
                'Suffix',
                'Birthdate',
                'Sex',
                'Civil Status',
                'Mobile No',
                'Email',
                'Barangay',
                'Municipality',
                'Province',
                'PWD',
                '4PS',
                'Indigenous',
                'Organization'
            ]);

            // CSV Data
            foreach ($farmers as $farmer) {
                fputcsv($file, [
                    $farmer->rsbsa_no ?? '',
                    $farmer->last_name,
                    $farmer->first_name,
                    $farmer->middle_name ?? '',
                    $farmer->suffix ?? '',
                    $farmer->birthdate ? $farmer->birthdate->format('Y-m-d') : '',
                    $farmer->sex ?? '',
                    $farmer->civil_status ?? '',
                    $farmer->mobile_no ?? '',
                    $farmer->email ?? '',
                    $farmer->barangay ?? '',
                    $farmer->city_municipality ?? '',
                    $farmer->province ?? '',
                    $farmer->pwd ? 'Yes' : 'No',
                    $farmer->is_4ps ? 'Yes' : 'No',
                    $farmer->is_indigenous ? 'Yes' : 'No',
                    $farmer->organization_name ?? '',
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getPathname(), 'r');
        
        // Skip header row
        fgetcsv($handle);
        
        $imported = 0;
        $errors = [];

        while (($row = fgetcsv($handle)) !== false) {
            try {
                // Map CSV columns to farmer data
                $data = [
                    'rsbsa_no' => $row[0] ?? null,
                    'last_name' => $row[1],
                    'first_name' => $row[2],
                    'middle_name' => $row[3] ?? null,
                    'suffix' => $row[4] ?? null,
                    'birthdate' => $row[5] ?? null,
                    'sex' => $row[6] ?? null,
                    'civil_status' => $row[7] ?? null,
                    'mobile_no' => $row[8] ?? null,
                    'email' => $row[9] ?? null,
                    'barangay' => $row[10] ?? null,
                    'city_municipality' => $row[11] ?? null,
                    'province' => $row[12] ?? null,
                    'pwd' => strtolower($row[13] ?? 'no') === 'yes',
                    'is_4ps' => strtolower($row[14] ?? 'no') === 'yes',
                    'is_indigenous' => strtolower($row[15] ?? 'no') === 'yes',
                    'organization_name' => $row[16] ?? null,
                ];

                $farmer = Farmer::create($data);
                
                // Generate QR code
                $qr = QrCode::format('svg')->size(200)->generate(url("/admin/farmers/{$farmer->id}"));
                $qrPath = "farmers/qrcodes/{$farmer->id}.svg";
                Storage::disk('public')->put($qrPath, $qr);
                $farmer->update(['qr_code_path' => $qrPath]);

                $imported++;
            } catch (\Exception $e) {
                $errors[] = "Row {$imported}: " . $e->getMessage();
            }
        }

        fclose($handle);

        if (count($errors) > 0) {
            return back()->with('error', "Imported {$imported} farmers with errors: " . implode(', ', array_slice($errors, 0, 5)));
        }

        AuditService::log('import', 'farmers', null, null, ['count' => $imported]);

        return back()->with('success', "{$imported} farmers imported successfully.");
    }
}
