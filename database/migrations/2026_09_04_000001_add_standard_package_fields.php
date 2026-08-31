<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Standard-package distribution.
 *
 * In practice every beneficiary of a programme gets the same package, so that
 * is the default and staff confirm it in one click. Departing from it is the
 * exception, and an exception should be recorded as such — hence the flag and
 * the reason, so a reduced hand-out can be explained months later.
 *
 * The per-farmer item quantities already live in assistance_program_items;
 * only the cash side of the package was missing. Note that standard_cash_amount
 * is per beneficiary, unlike total_budget which is the whole programme.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_assistance', function (Blueprint $table) {
            $table->decimal('standard_cash_amount', 12, 2)->nullable()->after('total_budget');
        });

        Schema::table('assistance_distributions', function (Blueprint $table) {
            $table->boolean('is_customized')->default(false)->after('status');
            $table->string('customization_reason')->nullable()->after('is_customized');
        });

        Schema::table('inventory_distributions', function (Blueprint $table) {
            // What the item's balance was straight after this issue, so the
            // history can show "45 -> 43" without replaying the whole ledger.
            // Mirrors inventory_adjustments.balance_after.
            $table->decimal('balance_after', 12, 2)->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_distributions', fn (Blueprint $t) => $t->dropColumn('balance_after'));
        Schema::table('assistance_distributions', fn (Blueprint $t) => $t->dropColumn(['is_customized', 'customization_reason']));
        Schema::table('financial_assistance', fn (Blueprint $t) => $t->dropColumn('standard_cash_amount'));
    }
};
