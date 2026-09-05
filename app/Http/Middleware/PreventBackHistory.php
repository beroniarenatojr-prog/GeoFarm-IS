<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stops signed-in pages from being replayed out of the browser's history.
 *
 * Logging out destroys the session server-side, but that says nothing about
 * the copy of the page already sitting in the browser. Back, then Forward,
 * redisplays the admin dashboard from cache without a request ever reaching
 * Laravel - so a farmer's records stay readable on a shared machine after
 * someone has signed out. On the public terminals this system is used from,
 * that is the whole exposure.
 *
 * "no-store" is the directive that matters: "no-cache" still permits the
 * response to be written to disk and revalidated, whereas "no-store" forbids
 * keeping it at all, which is what forces Back to re-ask the server.
 */
class PreventBackHistory
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only signed-in responses. Public pages - the landing page, the login
        // screen, the farmer registration form - stay cacheable, since there is
        // nothing private in them and they are the most-hit pages on the site.
        if ($request->user()) {
            $response->headers->set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
            $response->headers->set('Pragma', 'no-cache');
            $response->headers->set('Expires', 'Sat, 01 Jan 2000 00:00:00 GMT');
        }

        return $response;
    }
}
