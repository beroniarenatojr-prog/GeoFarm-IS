<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Prevent users from being logged in on multiple devices/browsers simultaneously.
 * 
 * When a user logs in from a new session, their old session is invalidated.
 * This middleware checks on each request if the current session is still the
 * active one for this user.
 */
class PreventConcurrentLogins
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Skip checking on login/logout routes to allow new sessions to be created
        if ($request->is('login') || $request->is('logout') || $request->routeIs('login') || $request->routeIs('logout')) {
            return $next($request);
        }

        // Only check for authenticated users
        if (Auth::check()) {
            $user = Auth::user();
            $currentSessionId = $request->session()->getId();
            
            // If user has an active session ID stored and it's different from current
            if ($user->active_session_id && $user->active_session_id !== $currentSessionId) {
                // This session was replaced by a newer login
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
                
                // Redirect to login with message
                return redirect()->route('login')->with('error', 
                    'Your account was logged in from another device or browser. You have been logged out.'
                );
            }
        }
        
        return $next($request);
    }
}
