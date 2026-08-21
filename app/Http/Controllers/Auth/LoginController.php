<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class LoginController extends Controller
{
    public function show()
    {
        return Inertia::render('Auth/Login');
    }

    public function store(Request $request)
    {
        $email = strtolower(trim((string) $request->input('email')));

        // Keep the sample administrator login compatible with older project builds.
        $email = match ($email) {
            'admin@geofarm',
            'admin@geofarm.local',
            'admin@geofarm.test' => 'admin@geofarm.com',
            default => $email,
        };

        $request->merge(['email' => $email]);

        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'Invalid credentials.']);
        }

        $user = Auth::user();
        $user->update(['last_login' => now()]);

        $request->session()->regenerate();
        
        // Redirect based on user role
        if ($user->hasRole('Farmer')) {
            return redirect()->route('farmer.dashboard');
        }
        
        return redirect()->route('admin.dashboard');
    }

    public function destroy(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login');
    }
}
