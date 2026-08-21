<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

class RegisterController extends Controller
{
    public function show()
    {
        return Inertia::render('Auth/Register');
    }

    public function store(Request $request)
    {
        $request->validate([
            'rsbsa_no' => ['required', 'string', 'exists:farmers,rsbsa_no'],
            'last_name' => ['required', 'string', 'max:50'],
            'birthdate' => ['required', 'date', 'before:today'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ], [
            'rsbsa_no.exists' => 'This RSBSA number is not registered in Tumauini. Please contact the Agriculture Office.',
            'birthdate.required' => 'Birthdate is required for identity verification.',
            'birthdate.before' => 'Birthdate must be a date before today.',
            'last_name.required' => 'Last name is required for identity verification.',
        ]);

        // Find the farmer by RSBSA number
        $farmer = Farmer::where('rsbsa_no', $request->rsbsa_no)->first();

        // Check if farmer already has a user account
        if ($farmer->user_id) {
            return back()->withErrors([
                'rsbsa_no' => 'This RSBSA number already has a registered account. Please use the login page.'
            ])->withInput($request->except('password', 'password_confirmation'));
        }

        // Verify the farmer is from Tumauini
        if (strtolower($farmer->city_municipality ?? '') !== 'tumauini') {
            return back()->withErrors([
                'verification' => 'Only farmers from Tumauini, Isabela can register. If you believe this is an error, please contact the Agriculture Office.'
            ])->withInput($request->except('password', 'password_confirmation'));
        }

        // ===================================================================
        // ENHANCED SECURITY: Multi-Field Verification
        // Verify Last Name + Birthdate
        // ===================================================================
        
        // 1. Verify Birthdate
        $birthdateMatch = false;
        if ($farmer->birthdate) {
            $birthdateMatch = $farmer->birthdate->format('Y-m-d') === $request->birthdate;
        }
        
        // 2. Verify Last Name (case-insensitive)
        $lastNameMatch = strtolower(trim($farmer->last_name)) === strtolower(trim($request->last_name));

        // Both must pass
        if (!$birthdateMatch || !$lastNameMatch) {
            // Log failed verification attempt for security
            AuditService::log('failed_registration', 'farmer_registration', null, null, [
                'rsbsa_no' => $request->rsbsa_no,
                'attempted_email' => $request->email,
                'ip_address' => $request->ip(),
                'reason' => 'Personal information mismatch',
                'birthdate_match' => $birthdateMatch,
                'lastname_match' => $lastNameMatch,
            ]);

            return back()->withErrors([
                'verification' => 'The personal information you provided does not match our records. Please verify your Last Name and Birthdate, or contact the Agriculture Office for assistance.'
            ])->withInput($request->except('password', 'password_confirmation'));
        }

        // ===================================================================
        // Create User Account
        // ===================================================================
        
        $user = User::create([
            'name' => $farmer->full_name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        // Assign 'Farmer' role
        $user->assignRole('Farmer');

        // Link farmer to user
        $farmer->update(['user_id' => $user->id]);

        // Log successful registration for audit
        AuditService::log('create', 'farmer_registration', $user->id, null, [
            'farmer_id' => $farmer->id,
            'rsbsa_no' => $farmer->rsbsa_no,
            'email' => $user->email,
            'ip_address' => $request->ip(),
            'verified_fields' => ['rsbsa', 'last_name', 'birthdate'],
        ]);

        // Log the user in
        auth()->login($user);

        return redirect()->route('farmer.dashboard')->with('success', 'Account created successfully! Welcome to GeoFarm-IS, ' . $farmer->first_name . '!');
    }
}
