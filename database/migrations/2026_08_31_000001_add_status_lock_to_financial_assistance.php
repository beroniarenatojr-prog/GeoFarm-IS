<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Two controls for assistance programmes:
 *
 *  - "inactive" lets a programme be paused without claiming it is finished
 *    (completed) or abandoned (cancelled), which is what the office actually
 *    means when it stops a programme mid-cycle.
 *
 *  - a lock freezes the record: no edits, no deletion, no new distributions,
 *    so a closed-out programme's figures cannot drift afterwards.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE financial_assistance MODIFY status "
            . "ENUM('draft','active','inactive','completed','cancelled') NOT NULL DEFAULT 'draft'"
        );

        Schema::table('financial_assistance', function (Blueprint $table) {
            if (!Schema::hasColumn('financial_assistance', 'is_locked')) {
                $table->boolean('is_locked')->default(false)->after('status');
                $table->timestamp('locked_at')->nullable()->after('is_locked');
                $table->foreignId('locked_by')->nullable()->after('locked_at')
                    ->constrained('users')->nullOnDelete();

                // The list filters locked/unlocked and sorts by status.
                $table->index(['status', 'is_locked'], 'fin_asst_status_lock_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('financial_assistance', function (Blueprint $table) {
            if (Schema::hasColumn('financial_assistance', 'is_locked')) {
                $table->dropIndex('fin_asst_status_lock_idx');
                $table->dropConstrainedForeignId('locked_by');
                $table->dropColumn(['is_locked', 'locked_at']);
            }
        });

        // Nothing may sit on a value the narrowed enum cannot hold.
        DB::table('financial_assistance')->where('status', 'inactive')->update(['status' => 'draft']);

        DB::statement(
            "ALTER TABLE financial_assistance MODIFY status "
            . "ENUM('draft','active','completed','cancelled') NOT NULL DEFAULT 'draft'"
        );
    }
};
