<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \App\Http\Middleware\PreventBackHistory::class,
            // Inertia keeps each visited page in window.history.state so Back
            // can restore it without a round trip. That state holds whatever
            // the page was showing - farmer records, assistance lists - in
            // plain text. Encrypting it means the entries left behind after
            // logout cannot be read, and clearHistory() on logout rotates the
            // key so they cannot be decrypted again.
            \Inertia\EncryptHistoryMiddleware::class,
        ]);
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        /*
         * A 419 means the session behind the open tab is gone — usually because
         * it outlived session.lifetime while the page sat there. Laravel's
         * default reply is a bare "419 PAGE EXPIRED" page, which Inertia then
         * shows in an error modal on top of the app: a dead end for the user,
         * and alarming for a farmer using the public portal.
         *
         * Send them to the login screen with an explanation instead. The
         * redirect also hands back a fresh session and CSRF token.
         */
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if ($response->getStatusCode() === 419) {
                $response = redirect()
                    ->guest(route('login'))
                    ->with('error', 'Your session expired because the page was open for a while. Please sign in again.');
            }

            /*
             * A refused action should say so in the app, not replace it.
             *
             * abort(403) renders Symfony's bare "Oops! An Error Occurred"
             * page, which Inertia then shows in a modal over the interface —
             * so a staff member told "you may not delete Admin users", which
             * is an ordinary and correct answer, instead saw a crash. Sent
             * back where they were with the reason flashed, it becomes the
             * toast every other refusal on this system already uses.
             *
             * Only for Inertia requests. A JSON or API caller still gets a
             * real 403, because a redirect would tell it the action worked.
             */
            if ($response->getStatusCode() === 403 && $request->header('X-Inertia')) {
                $reason = $e->getMessage();
                $message = $reason !== '' ? $reason : 'You do not have permission to do that.';

                /*
                 * Never back to the page that just refused.
                 *
                 * url()->previous() is the referer, and for a GET that lands
                 * straight on a forbidden address the referer can be that same
                 * address — which would bounce between the two forever.
                 *
                 * The fallback is the site root, not the admin dashboard:
                 * /admin is itself gated on role, so sending a Farmer there
                 * would answer one 403 with another and loop anyway. The root
                 * is public and redirects each role onward from there.
                 */
                $previous = url()->previous();

                $response = $previous === $request->fullUrl()
                    ? redirect('/')->with('error', $message)
                    : back()->with('error', $message);
            }

            /*
             * Redirects answering PUT, PATCH or DELETE must be 303.
             *
             * This is what produced the 405. A 302 tells the browser to repeat
             * the request at the new address WITH THE SAME METHOD, so a
             * DELETE that was redirected to the login page arrived as
             * DELETE /login — and /login accepts only GET and POST, so
             * Laravel answered 405 Method Not Allowed and the user got a raw
             * error page instead of the sign-in screen. 303 See Other is the
             * status that tells the browser to switch to GET, and it is what
             * the Inertia protocol requires for these verbs.
             *
             * Inertia's own middleware normally applies this, but it is
             * appended to the web group AFTER VerifyCsrfToken — so a 419
             * thrown by CSRF never reaches it, and the redirect above went out
             * as a 302. Doing it here covers every exception path, including
             * the authentication redirect.
             */
            if ($response->isRedirect()
                && in_array($request->method(), ['PUT', 'PATCH', 'DELETE'], true)) {
                $response->setStatusCode(303);
            }

            return $response;
        });
    })->create();
