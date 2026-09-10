<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Role;

/**
 * Retires the Viewer role.
 *
 * It was the read-only tier — able to see the registry but change nothing —
 * and the office does not use it. Every account is Super Admin, Admin, Staff
 * or Farmer.
 *
 * Guarded rather than unconditional. Deleting a role that somebody holds
 * strips their access without warning, and a person locked out of a municipal
 * system on a Monday morning has no idea why. If any account still holds it
 * the role is left alone and the accounts are named, so somebody can move them
 * to Staff first and re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        $role = Role::where('name', 'Viewer')->first();

        if (! $role) {
            return;   // already gone, or never seeded here
        }

        $holders = DB::table('model_has_roles')
            ->where('role_id', $role->id)
            ->where('model_type', \App\Models\User::class)
            ->pluck('model_id');

        if ($holders->isNotEmpty()) {
            $names = DB::table('users')->whereIn('id', $holders)->pluck('email')->implode(', ');

            Log::warning('Viewer role not removed: accounts still hold it.', [
                'accounts' => $names,
            ]);

            echo "\n  SKIPPED removing the Viewer role: {$holders->count()} account(s) still hold it.\n"
                . "  {$names}\n"
                . "  Move them to Staff, then re-run this migration.\n\n";

            return;
        }

        // Spatie clears role_has_permissions itself on delete.
        $role->delete();
    }

    /**
     * Recreated bare, with no permissions.
     *
     * What Viewer was allowed to do lived in RolePermissionSeeder, which no
     * longer describes it. Guessing a permission set here would invent a role
     * nobody defined; re-running the seeder is the honest way back.
     */
    public function down(): void
    {
        Role::firstOrCreate(['name' => 'Viewer', 'guard_name' => 'web']);
    }
};
