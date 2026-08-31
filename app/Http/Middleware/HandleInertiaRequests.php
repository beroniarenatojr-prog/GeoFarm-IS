<?php

namespace App\Http\Middleware;

use App\Models\Farmer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    /** How many pending registrations the header dropdown lists at once. */
    private const NOTIFICATION_PREVIEW_LIMIT = 5;

    public function share(Request $request): array
    {
        $user = $request->user();

        if ($user) {
            $user->loadMissing(['roles.permissions', 'permissions']);
        }

        return array_merge(parent::share($request), [
            'csrf_token' => csrf_token(),
            'auth' => [
                'user' => $user ? [
                    'id'    => $user->id,
                    'name'  => $user->name,
                    'email' => $user->email,
                    'role'  => $user->roles->first()?->name,
                ] : null,
                'permissions' => $user
                    ? $user->getAllPermissions()->pluck('name')->toArray()
                    : [],
            ],
            'flash' => (function () use ($request) {
                $success = $request->session()->get('success');
                $error   = $request->session()->get('error');

                return [
                    'success' => $success,
                    'error'   => $error,
                    // A one-shot id so the client can tell a genuinely new
                    // message from a stale one. Partial reloads (`only: [...]`)
                    // keep whatever props they did not request, so without this
                    // the previous message would be announced again every time
                    // someone typed in a search box.
                    'id' => ($success || $error) ? (string) Str::uuid() : null,
                ];
            })(),
            'notifications' => [
                'pendingFarmers' => $this->pendingFarmers($user),
            ],
        ]);
    }

    /**
     * Farmers who registered online and are still waiting on staff review.
     *
     * Surfaced in the header bell on every admin page, so it replaces the old
     * sidebar link. Gated on the same permission as the verification queue so
     * staff without access never see the count.
     */
    private function pendingFarmers($user): array
    {
        if (! $user || ! $user->can('view farmers')) {
            return ['count' => 0, 'recent' => []];
        }

        $recent = Farmer::pending()
            ->orderByDesc('submitted_online_at')
            ->limit(self::NOTIFICATION_PREVIEW_LIMIT)
            ->get(['id', 'first_name', 'middle_name', 'last_name', 'suffix', 'reference_code', 'barangay', 'submitted_online_at'])
            ->map(fn (Farmer $farmer) => [
                'id'             => $farmer->id,
                'name'           => $farmer->full_name,
                'reference_code' => $farmer->reference_code,
                'barangay'       => $farmer->barangay,
                'submitted_at'   => $farmer->submitted_online_at?->toIso8601String(),
            ])
            ->all();

        return [
            'count'  => Farmer::pending()->count(),
            'recent' => $recent,
        ];
    }
}
