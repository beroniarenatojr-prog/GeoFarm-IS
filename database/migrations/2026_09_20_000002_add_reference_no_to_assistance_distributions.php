<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The office's own reference for a release.
 *
 * A distribution is a government disbursement: goods or money handed to a
 * named farmer on a named date. Those are referenced on paper — "FS-2026-0001"
 * on a fuel subsidy voucher — and staff need to find the record from the slip
 * in front of them, which today is only possible by guessing at farmer,
 * programme and date together.
 *
 * Nullable, because every existing release was recorded without one and none
 * of them is wrong for that. Indexed rather than unique: the office issues its
 * own references and a duplicate is a data-entry problem for staff to see and
 * fix, not something a database error should block a distribution over at the
 * counter.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assistance_distributions', function (Blueprint $table) {
            if (! Schema::hasColumn('assistance_distributions', 'reference_no')) {
                $table->string('reference_no', 60)->nullable()->after('status');
                $table->index('reference_no', 'idx_dist_reference');
            }
        });
    }

    public function down(): void
    {
        Schema::table('assistance_distributions', function (Blueprint $table) {
            if (Schema::hasColumn('assistance_distributions', 'reference_no')) {
                $table->dropIndex('idx_dist_reference');
                $table->dropColumn('reference_no');
            }
        });
    }
};
