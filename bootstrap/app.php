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
            if ($response->getStatusCode() !== 419) {
                return $response;
            }

            return redirect()
                ->guest(route('login'))
                ->with('error', 'Your session expired because the page was open for a while. Please sign in again.');
        });
    })->create();
