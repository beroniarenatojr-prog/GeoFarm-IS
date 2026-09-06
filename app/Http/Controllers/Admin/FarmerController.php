<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Services\AuditService;
use App\Services\RsbsaFieldMapper;
use App\Services\RsbsaFormFiller;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class FarmerController extends Controller
{
    public function index(Request $request)
    {
        // Searching and sorting happen in SQL, not in the browser. The registry
        // is expected to hold 8,000+ farmers, so a client-side filter would only
        // ever see the current page — a farmer on page 200 would look missing.
        $sortable = ['last_name', 'first_name', 'rsbsa_no', 'barangay', 'birthdate', 'created_at'];
        $sort = in_array($request->sort, $sortable, true) ? $request->sort : 'last_name';
        $direction = $request->direction === 'desc' ? 'desc' : 'asc';
        $perPage = in_array((int) $request->per_page, [25, 50, 100], true) ? (int) $request->per_page : 25;

        // The registry shows verified farmers only. Online submissions awaiting
        // staff verification live in the verification queue instead.
        $farmers = Farmer::query()
            ->verified()
            // Only the columns the table renders: hydrating all ~50 RSBSA
            // fields for every row is wasted work at this size.
            ->select([
                'id', 'rsbsa_no', 'first_name', 'middle_name', 'last_name', 'suffix',
                'barangay', 'city_municipality', 'province', 'birthdate', 'sex',
                'mobile_no', 'is_4ps', 'is_indigenous', 'pwd', 'organization_name',
            ])
            ->when($request->search, fn ($q, $s) => $q->where(function ($query) use ($s) {
                $query->where('first_name', 'like', "%$s%")
                    ->orWhere('last_name', 'like', "%$s%")
                    ->orWhere('middle_name', 'like', "%$s%")
                    ->orWhere('rsbsa_no', 'like', "%$s%")
                    ->orWhere('mobile_no', 'like', "%$s%");
            }))
            ->when($request->barangay, fn ($q, $b) => $q->where('barangay', $b))
            ->orderBy($sort, $direction)
            // Ties on a common surname would otherwise shuffle between pages.
            ->orderBy('id')
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('Admin/Farmers/Index', [
            'farmers'      => $farmers,
            'filters'      => $request->only(['search', 'barangay', 'sort', 'direction', 'per_page']),
            'sort'         => ['column' => $sort, 'direction' => $direction],
            'perPage'      => $perPage,
            'barangays'    => Farmer::verified()->distinct()->orderBy('barangay')->pluck('barangay')->filter()->values(),
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
            'rsbsa_no'          => ['nullable', 'string', Farmer::RSBSA_RULE, 'unique:farmers'],
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
            'spouse_first_name'  => 'nullable|string|max:50',
            'spouse_middle_name' => 'nullable|string|max:50',
            'spouse_last_name'   => 'nullable|string|max:50',
            'spouse_ext_name'    => 'nullable|string|max:10',
            'religion'          => 'nullable|string|max:50',
            'highest_education' => 'nullable|string|max:50',
            'mobile_no'         => ['nullable', 'string', Farmer::MOBILE_RULE],
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

            // Children (as JSON) - Optional
            'children'          => 'nullable|json',
        ], Farmer::FORMAT_MESSAGES);

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

        $children = Farmer::childrenFrom($data['children'] ?? null);
        unset($data['children']);

        $farmer = Farmer::create($data);

        foreach ($parcels as $parcelData) {
            $farmer->parcels()->create($parcelData);
        }

        foreach ($children as $childData) {
            $farmer->children()->create($childData);
        }

        // Generate QR code
        $qr = QrCode::format('svg')->size(200)->generate(url("/admin/farmers/{$farmer->id}"));
        $qrPath = "farmers/qrcodes/{$farmer->id}.svg";
        Storage::disk('public')->put($qrPath, $qr);
        $farmer->update(['qr_code_path' => $qrPath]);

        AuditService::log('create', 'farmers', $farmer->id, null, $farmer->toArray());

        return redirect()->route('admin.farmers.index')->with('success', 'Farmer registered successfully.');
    }

    /**
     * The farmer's RSBSA identification card, front and back, ready to print.
     *
     * Rendered as HTML rather than a generated PDF so the browser's own print
     * dialog handles both card stock and "Save as PDF" — the same approach as
     * the farm assets record.
     *
     * Two fields on the card are DERIVED, not stored: the ID number and the
     * expiry. Both are computed the same way every time, so reprinting a card
     * reproduces it exactly, but the office should confirm the numbering
     * format and the validity period before these go out.
     */
    public function idCard(Farmer $farmer)
    {
        // An identification card asserts that the office has checked this
        // person. A pending or rejected record has not been checked.
        if ($farmer->verification_status !== Farmer::STATUS_VERIFIED) {
            return back()->with(
                'error',
                'Only a verified farmer can be issued an ID card. This record is '
                . $farmer->verification_status . '.'
            );
        }

        // Older records predate QR generation, so make one now rather than
        // printing a card with an empty box on the back.
        if (!$farmer->qr_code_path || !Storage::disk('public')->exists($farmer->qr_code_path)) {
            $qrPath = "farmers/qrcodes/{$farmer->id}.svg";
            Storage::disk('public')->put(
                $qrPath,
                QrCode::format('svg')->size(200)->generate(url("/admin/farmers/{$farmer->id}"))
            );
            $farmer->update(['qr_code_path' => $qrPath]);
        }

        $farmer->load(['parcels.farmType', 'children']);

        // What this farmer actually produces, for the "Farmer Type" line.
        $commodities = $farmer->parcels->pluck('commodity')->filter()->unique();
        if ($commodities->isEmpty()) {
            $commodities = $farmer->parcels->pluck('farmType.type_name')->filter()->unique();
        }

        $issued = $farmer->verified_at ?? $farmer->created_at ?? now();

        return response()->view('farmers.id-card', [
            'farmer'      => $farmer,
            'idNumber'    => sprintf('GF-%s-%06d', $issued->format('Y'), $farmer->id),
            'issued'      => $issued,
            'validUntil'  => $issued->copy()->addYears(3),
            'farmerType'  => $commodities->take(3)->implode(' / ') ?: '—',
            'qrSvg'       => $this->inlineSvg($farmer->qr_code_path),
            'photoData'   => $this->inlineImage($farmer->photo_path),
        ]);
    }

    /**
     * A stored SVG, ready to drop into an HTML body.
     *
     * simple-qrcode writes a full XML document, prolog and all. Inlined into
     * HTML that leading `<?xml …?>` is a stray processing instruction the
     * parser treats as a bogus comment, so everything before the <svg> tag is
     * dropped here.
     */
    private function inlineSvg(string $path): string
    {
        $svg = Storage::disk('public')->get($path);

        return preg_replace('/^.*?(?=<svg)/s', '', $svg) ?? $svg;
    }

    /**
     * A stored image as a data: URI.
     *
     * The card is printed, and a browser will happily drop an <img> whose file
     * has gone missing without saying so — leaving a card with a blank photo
     * box. Reading it here means a missing file falls back to the placeholder.
     */
    private function inlineImage(?string $path): ?string
    {
        if (!$path || !Storage::disk('public')->exists($path)) {
            return null;
        }

        $mime = match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'png'        => 'image/png',
            'gif'        => 'image/gif',
            'webp'       => 'image/webp',
            default      => 'image/jpeg',
        };

        return 'data:' . $mime . ';base64,' . base64_encode(Storage::disk('public')->get($path));
    }

    public function show(Farmer $farmer)
    {
        return Inertia::render('Admin/Farmers/Show', [
            'farmer' => $farmer->load([
                'parcels.farmType',
                'children',
                'livestock.livestockType',
                'distributions.program',
                // Cropping seasons hang off the parcels, not the farmer, which
                // is why they were missing here: a farmer with fifty seasons
                // recorded looked like they farmed nothing at all.
                'cropSeasons' => fn ($q) => $q
                    ->with(['crop:id,crop_name', 'parcel:id,parcel_number'])
                    ->orderByDesc('cropping_year')
                    ->orderBy('season'),
                'treeCrops',
                'fishponds',
                'largeRuminants',
                'smallRuminants',
                'nativePigs',
                'swineHybrid',
                'poultry',
                // Staff who cleared the record, shown on the verification panel.
                'verifier:id,name',
            ]),
        ]);
    }

    /**
     * The farmer's record stamped onto the official RSBSA Enrollment Form
     * (DA revised 01-2024).
     *
     * The DA's own PDF is imported and only the farmer's values are drawn on
     * top, so what prints is the prescribed government document rather than a
     * reconstruction of it. Streamed so it opens straight in print preview.
     *
     * ?review=html renders the internal HTML rebuild instead — useful for
     * checking data on screen, but it is NOT the official form and must not be
     * submitted as one.
     */
    public function print(Request $request, Farmer $farmer, RsbsaFieldMapper $mapper)
    {
        $farmer->load(['parcels.farmType', 'children']);
        $slug = Str::slug($farmer->full_name) ?: "farmer-{$farmer->id}";

        if ($request->query('review') === 'html') {
            return Pdf::loadView('pdf.rsbsa-enrollment-form', ['farmer' => $farmer])
                ->setPaper(
                    config('rsbsa-form.paper.size'),
                    config('rsbsa-form.paper.orientation')
                )
                ->stream("rsbsa-review-{$slug}.pdf");
        }

        $filler = new RsbsaFormFiller();

        // Missing library or template is a setup problem, not a broken page —
        // send staff back with the reason rather than a 500.
        if ($reason = $filler->unavailableReason()) {
            return back()->with('error', "Cannot print the RSBSA form. {$reason}");
        }

        $bytes = $filler->setData($mapper->map($farmer))->output();

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="rsbsa-enrollment-' . $slug . '.pdf"',
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
        // The edit form has always offered this field, but it was missing from
        // the rules below, so validate() stripped it and every change to a
        // farmer's RSBSA number was discarded while the page still reported
        // that the record had been updated.
        $rsbsaRules = ['nullable', 'string', Rule::unique('farmers')->ignore($farmer->id)];

        // Records predating the format keep their old number until somebody
        // actually changes it. Enforcing the format on an untouched value
        // would block every unrelated edit — an address, a phone number —
        // behind an RSBSA number the clerk may not have to hand.
        if ($request->input('rsbsa_no') !== $farmer->rsbsa_no) {
            $rsbsaRules[] = Farmer::RSBSA_RULE;
        }

        $data = $request->validate([
            // Personal Information - Only name and sex are required
            'rsbsa_no'          => $rsbsaRules,
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
            'spouse_first_name'  => 'nullable|string|max:50',
            'spouse_middle_name' => 'nullable|string|max:50',
            'spouse_last_name'   => 'nullable|string|max:50',
            'spouse_ext_name'    => 'nullable|string|max:10',
            'religion'          => 'nullable|string|max:50',
            'highest_education' => 'nullable|string|max:50',
            'mobile_no'         => ['nullable', 'string', Farmer::MOBILE_RULE],
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

            // Children (as JSON) - Optional
            'children'          => 'nullable|json',
        ], Farmer::FORMAT_MESSAGES);

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

        $childrenSubmitted = array_key_exists('children', $data);
        $children = Farmer::childrenFrom($data['children'] ?? null);
        unset($data['children']);

        $farmer->update($data);

        if (!$isFarmer) {
            $farmer->parcels()->delete();
        } elseif (!empty($parcels)) {
            $farmer->parcels()->delete();

            foreach ($parcels as $parcelData) {
                $farmer->parcels()->create($parcelData);
            }
        }

        // Replaced wholesale rather than merged: the form posts the whole list
        // every time, so a child missing from it is one the user removed.
        // Guarded on the field being present at all, so a partial update that
        // never touches the repeater does not wipe the existing rows.
        if ($childrenSubmitted) {
            $farmer->children()->delete();

            foreach ($children as $childData) {
                $farmer->children()->create($childData);
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
            'children',
            'livestock.livestockType',
            'distributions.program',
            // Seasons hang off the parcels, not the farmer — without this the
            // portal shows nothing for someone with years of cropping recorded.
            'cropSeasons' => fn ($q) => $q
                ->with(['crop:id,crop_name', 'parcel:id,parcel_number'])
                ->orderByDesc('cropping_year')
                ->orderBy('season'),
            'machinery',
            'treeCrops',
            'fishponds',
            'largeRuminants',
            'smallRuminants',
            'nativePigs',
            'swineHybrid',
            'poultry'
        ])->firstOrFail();

        // Animals are spread across the legacy livestock table and the RSBSA
        // asset tables, so counting only the former reports zero for a farmer
        // who has poultry or ruminants recorded.
        $herds = [
            $farmer->largeRuminants,
            $farmer->smallRuminants,
            $farmer->nativePigs,
            $farmer->swineHybrid,
            $farmer->poultry,
        ];

        $animalHeads = $farmer->livestock->sum('count');
        $animalRecords = $farmer->livestock->count();

        foreach ($herds as $herd) {
            $animalHeads += $herd->sum('total_heads');
            $animalRecords += $herd->count();
        }

        $mapped = $farmer->parcels->filter(fn ($p) => filled($p->geojson_data));

        return Inertia::render('Farmer/Dashboard', [
            'farmer' => $farmer,
            'stats' => [
                'parcels'          => $farmer->parcels->count(),
                'parcels_mapped'   => $mapped->count(),
                'total_area'       => (float) $farmer->parcels->sum('total_area_ha'),
                'animal_heads'     => $animalHeads,
                'animal_records'   => $animalRecords,
                'tree_crops'       => $farmer->treeCrops->count(),
                'fishponds'        => $farmer->fishponds->count(),
                'machinery'        => $farmer->machinery->count(),
                'seasons'          => $farmer->cropSeasons->count(),
                'assistance'       => $farmer->distributions->count(),
                'assistance_total' => (float) $farmer->distributions->sum('amount_given'),
            ],
            // Read-only: the portal shows a farmer where their land is, it does
            // not let them redraw it. Boundaries are surveyed by the office.
            'parcelGeoJson' => $this->parcelGeoJson($mapped),
            'mapCenter'     => $this->centreOf($mapped),
        ]);
    }

    /**
     * The farmer's own parcels as a FeatureCollection.
     *
     * Only their own: the portal must never hand a farmer the outlines of
     * their neighbours' land, which is what the admin GIS endpoint returns.
     */
    private function parcelGeoJson($parcels): array
    {
        $features = [];

        foreach ($parcels as $parcel) {
            $geometry = json_decode((string) $parcel->geojson_data, true);

            // A malformed outline is skipped rather than crashing the page —
            // the parcel still appears in the list below the map.
            if (!is_array($geometry) || !isset($geometry['type'])) {
                continue;
            }

            $features[] = [
                'type'     => 'Feature',
                'geometry' => $geometry,
                'properties' => [
                    'id'            => $parcel->id,
                    'parcel_number' => $parcel->parcel_number ?? 'Parcel',
                    'barangay'      => $parcel->barangay,
                    'area_ha'       => $parcel->total_area_ha,
                    'commodity'     => $parcel->commodity,
                    'farm_type'     => $parcel->farmType?->type_name,
                ],
            ];
        }

        return ['type' => 'FeatureCollection', 'features' => $features];
    }

    /**
     * Roughly the middle of the farmer's land, so the map opens on their farm
     * rather than on the municipality. Null when nothing is mapped; the page
     * falls back to the Tumauini centre.
     */
    private function centreOf($parcels): ?array
    {
        $points = [];

        foreach ($parcels as $parcel) {
            $geometry = json_decode((string) $parcel->geojson_data, true);
            $this->collectPoints($geometry['coordinates'] ?? null, $points);
        }

        if (!$points) {
            return null;
        }

        $lngs = array_column($points, 0);
        $lats = array_column($points, 1);

        return [
            round((min($lngs) + max($lngs)) / 2, 6),
            round((min($lats) + max($lats)) / 2, 6),
        ];
    }

    /**
     * Pulls [lng, lat] pairs out of a GeoJSON coordinates array.
     *
     * Polygons nest their rings, MultiPolygons nest those again, so this
     * descends until it reaches a pair of numbers rather than assuming a depth.
     */
    private function collectPoints($coordinates, array &$points): void
    {
        if (!is_array($coordinates) || !$coordinates) {
            return;
        }

        if (is_numeric($coordinates[0] ?? null) && is_numeric($coordinates[1] ?? null)) {
            $points[] = [(float) $coordinates[0], (float) $coordinates[1]];
            return;
        }

        foreach ($coordinates as $child) {
            $this->collectPoints($child, $points);
        }
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
