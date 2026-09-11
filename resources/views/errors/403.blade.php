@php
    /**
     * A 403 that says who you are.
     *
     * The default page reads "USER DOES NOT HAVE THE RIGHT ROLES", which is
     * true and useless: it does not say which user, which roles they have, or
     * where they should have gone instead. Someone holding two accounts — one
     * for the office and one as a farmer — cannot tell a broken permission
     * from being signed in as the wrong person.
     *
     * Nothing here weakens the guard. The request is still refused; the page
     * only explains the refusal to the person who hit it.
     *
     * What it shows is what the viewer already knows about themselves: their
     * own name, their own email, their own roles. No other account's details
     * and no system internals.
     */
    $user = auth()->user();
    $roles = $user?->getRoleNames() ?? collect();
    $isOffice = $roles->intersect(['Super Admin', 'Admin', 'Staff'])->isNotEmpty();
    $wantsFarmerPortal = str_starts_with(request()->path(), 'farmer');
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Access denied — GeoFarm-IS</title>
    <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body {
            margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
            padding: 24px; background: #FAF8F3; color: #1f2937;
            font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        }
        .card {
            width: 100%; max-width: 520px; background: #fff; border: 1px solid #dcfce7;
            border-radius: 18px; padding: 28px; box-shadow: 0 1px 3px rgb(0 0 0 / .06);
        }
        .badge {
            display: inline-block; padding: 4px 10px; border-radius: 999px;
            background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700;
            text-transform: uppercase; letter-spacing: .04em;
        }
        h1 { margin: 14px 0 8px; font-size: 22px; line-height: 1.25; }
        p { margin: 0 0 12px; color: #4b5563; }
        dl { margin: 18px 0; padding: 14px; background: #f9fafb; border-radius: 12px; font-size: 14px; }
        dt { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
        dd { margin: 2px 0 10px; font-weight: 600; color: #111827; word-break: break-word; }
        dd:last-child { margin-bottom: 0; }
        .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
        a.btn, button.btn {
            flex: 1 1 auto; text-align: center; padding: 11px 16px; border-radius: 10px;
            font-weight: 600; font-size: 14px; text-decoration: none; cursor: pointer;
            border: 1px solid #d1d5db; background: #fff; color: #374151; font-family: inherit;
        }
        a.primary { background: #006400; border-color: #006400; color: #fff; }
        form { flex: 1 1 auto; margin: 0; display: flex; }
        form button { width: 100%; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">403 · Access denied</span>

        @if ($user && $wantsFarmerPortal && $isOffice)
            <h1>That page is the farmer&rsquo;s own portal</h1>
            <p>
                You are signed in with an office account, and the farmer portal shows one
                farmer&rsquo;s private records. To see a farmer&rsquo;s analysis as staff, open their
                profile in the admin area instead.
            </p>
        @elseif ($user)
            <h1>Your account cannot open this page</h1>
            <p>
                This page needs a role your account does not currently hold. If you believe that is
                wrong, ask the Agriculture Office to check the roles on your account.
            </p>
        @else
            <h1>You are not signed in</h1>
            <p>Sign in to continue.</p>
        @endif

        @if ($user)
            {{-- The viewer's own details, so a wrong-account mix-up is obvious --}}
            <dl>
                <dt>Signed in as</dt>
                <dd>{{ $user->name }} &middot; {{ $user->email }}</dd>

                <dt>Roles on this account</dt>
                <dd>{{ $roles->isEmpty() ? 'No role assigned' : $roles->implode(', ') }}</dd>

                <dt>Page requested</dt>
                <dd>/{{ request()->path() }}</dd>
            </dl>
        @endif

        <div class="actions">
            @if ($user && $isOffice)
                <a class="btn primary" href="/admin">Go to the admin dashboard</a>
            @elseif ($user)
                <a class="btn primary" href="/farmer/dashboard">Go to my portal</a>
            @else
                <a class="btn primary" href="/login">Sign in</a>
            @endif

            @auth
                {{-- The way out of a wrong-account mix-up, on the page where
                     someone actually discovers they are in one. --}}
                <form method="POST" action="/logout">
                    @csrf
                    <button class="btn" type="submit">Sign out</button>
                </form>
            @endauth
        </div>
    </div>
</body>
</html>
