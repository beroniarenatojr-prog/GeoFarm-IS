<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\FarmType;
use App\Models\Farmer;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

/**
 * Self-service farmer registration.
 *
 * A farmer fills in the same RSBSA wizard staff uses at the office, but the
 * resulting record is created as "pending" and the login account is created
 * deactivated. The farmer then visits the Agriculture Office with their
 * documents; once staff verifies and approves the record, the account is
 * activated and the dashboard becomes accessible.
 */
class FarmerRegistrationController extends Controller
{
    public function show()
    {
        return Inertia::render('Admin/Farmers/FormRSBSA', [
            'farmTypes'  => FarmType::all(),
            'publicMode' => true,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // Account credentials (used once staff approves the record)
            'email'             => 'required|email|max:100|unique:users,email',
            'password'          => ['required', 'confirmed', Password::min(8)],

            // Personal information - only name and sex are required
            'rsbsa_no'          => ['nullable', 'string', Farmer::RSBSA_RULE, 'unique:farmers,rsbsa_no'],
            'sex'               => 'required|in:Male,Female',
            'first_name'        => 'required|string|max:50',
            'last_name'         => 'required|string|max:50',
            'middle_name'       => 'nullable|string|max:50',
            'suffix'            => 'nullable|string|max:10',
            'birthdate'         => 'nullable|date|before:today',
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
            'valid_id_type'     => 'nullable|string|max:50',
            'id_number'         => 'nullable|string|max:100',

            // Address
            'house_lot_number'  => 'nullable|string|max:100',
            'street_sitio'      => 'nullable|string|max:100',
            'barangay'          => 'nullable|string|max:50',
            'city_municipality' => 'nullable|string|max:50',
            'province'          => 'nullable|string|max:50',
            'region'            => 'nullable|string|max:100',
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

            // Farm parcels (only kept for livelihood_type = Farmer)
            'parcels'           => 'nullable|json',

            // Children (as JSON) - Optional
            'children'          => 'nullable|json',
        ], Farmer::FORMAT_MESSAGES);

        // Guard against an obvious duplicate submission for the same person.
        if ($this->alreadySubmitted($data)) {
            return back()
                ->withErrors(['first_name' => 'A registration for this name and birthdate already exists. Please visit the Agriculture Office instead of registering again.'])
                ->withInput($request->except('password', 'password_confirmation'));
        }

        $parcels  = $this->parcelsFor($data);
        $children = Farmer::childrenFrom($data['children'] ?? null);
        unset($data['children']);

        // The account credentials are not columns on the farmers table.
        $email    = $data['email'];
        $password = $data['password'];
        unset($data['email'], $data['password'], $data['parcels']);

        if ($request->hasFile('photo')) {
            $data['photo_path'] = $request->file('photo')->store('farmers/photos', 'public');
        }

        if ($request->hasFile('id_proof')) {
            $data['id_proof_path'] = $request->file('id_proof')->store('farmers/id_proofs', 'public');
        }

        // Self-submitted records are never trusted until staff verifies them.
        $data['verification_status'] = Farmer::STATUS_PENDING;
        $data['reference_code']      = $this->generateReferenceCode();
        $data['submitted_online_at'] = now();
        $data['email']               = $email;

        $farmer = DB::transaction(function () use ($data, $parcels, $email, $password) {
            // Account exists but stays locked until staff approves.
            $user = User::create([
                'name'      => trim("{$data['first_name']} {$data['last_name']}"),
                'email'     => $email,
                'password'  => Hash::make($password),
                'is_active' => false,
            ]);

            $user->assignRole('Farmer');

            $farmer = Farmer::create($data + ['user_id' => $user->id]);

            foreach ($parcels as $parcel) {
                $farmer->parcels()->create($parcel);
            }

            foreach ($children as $child) {
                $farmer->children()->create($child);
            }

            return $farmer;
        });

        AuditService::log('create', 'farmer_online_registration', $farmer->id, null, [
            'reference_code' => $farmer->reference_code,
            'email'          => $email,
            'ip_address'     => $request->ip(),
            'status'         => Farmer::STATUS_PENDING,
        ]);

        return redirect()->route('farmer-registration.submitted', ['reference' => $farmer->reference_code]);
    }

    public function submitted(Request $request)
    {
        $farmer = Farmer::where('reference_code', $request->query('reference'))->firstOrFail();

        return Inertia::render('Auth/RegistrationSubmitted', [
            'referenceCode' => $farmer->reference_code,
            'fullName'      => $farmer->full_name,
            'email'         => $farmer->email,
        ]);
    }

    /**
     * A person is considered already submitted when the same name and birthdate
     * is present, regardless of the current verification status.
     */
    private function alreadySubmitted(array $data): bool
    {
        if (empty($data['birthdate'])) {
            return false;
        }

        return Farmer::whereRaw('LOWER(first_name) = ?', [strtolower(trim($data['first_name']))])
            ->whereRaw('LOWER(last_name) = ?', [strtolower(trim($data['last_name']))])
            ->whereDate('birthdate', $data['birthdate'])
            ->exists();
    }

    private function generateReferenceCode(): string
    {
        do {
            $code = 'RSBSA-' . now()->format('Y') . '-' . strtoupper(Str::random(6));
        } while (Farmer::where('reference_code', $code)->exists());

        return $code;
    }

    /**
     * Part 3 (Farm Parcel Information) is answered only by a FARMER, so parcels
     * sent with any other livelihood type are discarded.
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

        $resolved = [];

        foreach ($parcels as $parcel) {
            if (!is_array($parcel)) {
                continue;
            }

            if (empty($parcel['barangay']) && empty($parcel['total_area_ha'])) {
                continue;
            }

            foreach (['total_area_ha', 'no_of_heads_trees', 'farm_type_id'] as $field) {
                $parcel[$field] = !empty($parcel[$field]) ? $parcel[$field] : null;
            }

            $resolved[] = $parcel;
        }

        return $resolved;
    }
}
