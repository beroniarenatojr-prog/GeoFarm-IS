<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Administrative login OTP
    |--------------------------------------------------------------------------
    |
    | A one-time code emailed to Super Admin, Admin and Staff accounts after
    | their password is accepted but before they are logged in. Farmers are
    | never subject to it.
    |
    | `enabled` is DELIBERATELY off by default.
    |
    | Every notification in this application implements ShouldQueue and
    | QUEUE_CONNECTION is `database`, but no queue worker runs on the server —
    | which is why outgoing mail silently stopped once before. The OTP
    | notification is therefore sent synchronously and never queued, but that
    | only helps if SMTP itself works. Turning this on before a real code has
    | been seen arriving would lock every administrator out of the system with
    | no way back in through the browser.
    |
    | So: deploy, run `php artisan geofarm:mail-test you@example.com` on the
    | server, confirm the mail arrives, then set ADMIN_OTP_ENABLED=true.
    |
    | `php artisan geofarm:otp-recover` is the way back in if mail breaks
    | later. It needs shell access and is not reachable from a browser.
    |
    */

    'admin_otp' => [

        'enabled' => env('ADMIN_OTP_ENABLED', trues),

        /*
         * Which roles must pass the check.
         *
         * Read from config rather than hard-coded so a new administrative role
         * cannot quietly be created that skips verification — and so Farmer
         * can never be added here by accident.
         */
        'roles' => ['Super Admin', 'Admin', 'Staff'],

        /** How long a code stays valid. */
        'ttl_minutes' => 5,

        /** Wrong guesses allowed before the code is burned. */
        'max_attempts' => 5,

        /** Seconds between resend requests. */
        'resend_cooldown_seconds' => 60,
    ],

];
