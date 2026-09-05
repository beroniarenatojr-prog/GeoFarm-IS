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

        $request->merge(['email' => $email]);

        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'Invalid credentials.']);
        }

        $user = Auth::user();

        // Farmers who registered online stay deactivated until staff verifies
        // their documents at the Agriculture Office.
        if (!$user->is_active) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return back()->withErrors([
                'email' => 'Your account is not yet active. Please visit the Agriculture Office with your documents so staff can verify your registration.',
            ]);
        }

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

        // Order matters: clearHistory() writes a session flag, so calling it
        // before invalidate() would throw the flag away and silently do nothing.
        //
        // This is the part that actually stops Back returning to the dashboard.
        // Inertia replays pages straight out of window.history.state without
        // issuing a request, so no Cache-Control header can reach it - the
        // client has to be told to drop that state.
        Inertia::clearHistory();

        return redirect()->route('login');
    }
}
