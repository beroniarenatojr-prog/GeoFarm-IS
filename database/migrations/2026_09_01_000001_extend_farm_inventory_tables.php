<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Farm Inventory records what a FARMER owns — crops, trees, animals, ponds and
 * machinery. (Distinct from inventory_items, which is the Agriculture Office's
 * own warehouse stock.)
 *
 * The RSBSA tables captured headcounts only, because that is all the
 * registration form asks for. Monitoring needs more: whether animals are
 * vaccinated, whether trees are bearing yet, when a pond is due for harvest.
 * Those fields are added here, all nullable so existing rows stay valid.
 */
return new class extends Migration
{
    /** Health and husbandry fields shared by every animal table. */
    private function animalFields(Blueprint $table): void
    {
        $table->string('purpose', 40)->nullable()->after('total_heads');
        $table->enum('health_status', ['healthy', 'sick', 'treated', 'vaccinated'])
            ->default('healthy')->after('purpose');
        $table->date('last_vaccination')->nullable()->after('health_status');
        $table->text('notes')->nullable()->after('last_vaccination');
    }

    public function up(): void
    {
        Schema::table('tree_crops', function (Blueprint $table) {
            $table->unsignedSmallInteger('age_years')->nullable()->after('area_hectares');
            // Non-bearing trees are planted but not yet productive — they must
            // not be counted when projecting harvest.
            $table->enum('status', ['bearing', 'non_bearing'])->default('bearing')->after('age_years');
            $table->foreignId('parcel_id')->nullable()->after('status')
                ->constrained('farm_parcels')->nullOnDelete();
            $table->text('notes')->nullable()->after('parcel_id');
        });

        foreach (['large_ruminants', 'small_ruminants', 'native_pigs', 'swine_hybrid', 'poultry'] as $t) {
            Schema::table($t, fn (Blueprint $table) => $this->animalFields($table));
        }

        Schema::table('poultry', function (Blueprint $table) {
            // Layers, broilers and native birds are managed and funded
            // differently, so the breed has to be recorded separately.
            $table->string('breed', 40)->nullable()->after('bird_type');
        });

        Schema::table('fishponds', function (Blueprint $table) {
            $table->enum('pond_type', ['freshwater', 'brackish'])->default('freshwater')->after('farmer_id');
            $table->decimal('stocking_density', 8, 2)->nullable()->after('area_hectares');
            $table->unsignedInteger('estimated_population')->nullable()->after('stocking_density');
            $table->unsignedTinyInteger('harvest_cycle_months')->nullable()->after('estimated_population');
            $table->date('last_harvest')->nullable()->after('harvest_cycle_months');
            $table->date('next_harvest')->nullable()->after('last_harvest');
            $table->text('notes')->nullable()->after('next_harvest');
        });

        Schema::create('farm_machinery', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $table->string('machinery_type', 60);
            $table->string('brand', 60)->nullable();
            $table->string('model', 60)->nullable();
            $table->string('serial_number', 60)->nullable();
            $table->string('engine_number', 60)->nullable();
            $table->year('year_acquired')->nullable();
            $table->enum('acquisition_type', ['purchased', 'donated', 'loaned', 'inherited'])
                ->default('purchased');
            $table->enum('status', ['active', 'for_repair', 'decommissioned'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['farmer_id', 'machinery_type'], 'farm_mach_farmer_type_idx');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farm_machinery');

        Schema::table('fishponds', function (Blueprint $table) {
            $table->dropColumn([
                'pond_type', 'stocking_density', 'estimated_population',
                'harvest_cycle_months', 'last_harvest', 'next_harvest', 'notes',
            ]);
        });

        Schema::table('poultry', fn (Blueprint $table) => $table->dropColumn('breed'));

        foreach (['large_ruminants', 'small_ruminants', 'native_pigs', 'swine_hybrid', 'poultry'] as $t) {
            Schema::table($t, fn (Blueprint $table) => $table->dropColumn(
                ['purpose', 'health_status', 'last_vaccination', 'notes']
            ));
        }

        Schema::table('tree_crops', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parcel_id');
            $table->dropColumn(['age_years', 'status', 'notes']);
        });
    }
};
