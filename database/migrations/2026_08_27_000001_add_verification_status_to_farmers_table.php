<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Farmers who register themselves online start as "pending" and are only
     * counted as real farmers once staff verifies their documents in person.
     * Records encoded by staff at the office default to "verified", so all
     * existing rows keep their current meaning.
     */
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            if (!Schema::hasColumn('farmers', 'verification_status')) {
                $table->enum('verification_status', ['pending', 'verified', 'rejected'])
                    ->default('verified')
                    ->index()
                    ->after('user_id');
            }

            if (!Schema::hasColumn('farmers', 'reference_code')) {
                $table->string('reference_code', 20)->nullable()->unique()->after('verification_status');
            }

            if (!Schema::hasColumn('farmers', 'submitted_online_at')) {
                $table->timestamp('submitted_online_at')->nullable()->after('reference_code');
            }

            if (!Schema::hasColumn('farmers', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('submitted_online_at');
            }

            if (!Schema::hasColumn('farmers', 'verified_by')) {
                $table->foreignId('verified_by')->nullable()->after('verified_at')
                    ->constrained('users')->nullOnDelete();
            }

            if (!Schema::hasColumn('farmers', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable()->after('verified_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            if (Schema::hasColumn('farmers', 'verified_by')) {
                $table->dropForeign(['verified_by']);
            }

            $table->dropColumn([
                'verification_status',
                'reference_code',
                'submitted_online_at',
                'verified_at',
                'verified_by',
                'rejection_reason',
            ]);
        });
    }
};
