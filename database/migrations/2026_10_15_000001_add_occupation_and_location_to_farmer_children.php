<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What each child does, and where they are.
 *
 * Columns on farmer_children rather than a JSON blob, because that is how this
 * table already works — name, sex and birthdate are columns, and a household
 * with four children is four rows. Two of these beside them keeps the shape.
 *
 * All three are nullable, so every existing child record stays valid without
 * being backfilled. A row written before today simply has them empty, which is
 * the truthful answer: nobody was asked.
 *
 * `occupation` is a plain string, not an enum. The list of occupations is the
 * kind of thing an office revises, and an enum turns that into a migration
 * every time. The permitted values live on FarmerChild::OCCUPATIONS and are
 * enforced on the way in; anything unrecognised is discarded there rather than
 * reaching the column.
 *
 * `occupation_other` carries what somebody typed after choosing "Other" —
 * Overseas Filipino Worker is in the list, but "tricycle driver" is not, and
 * the office should be able to write it down rather than pick the nearest
 * wrong answer.
 *
 * `current_location` is deliberately one free-text field, not a barangay
 * foreign key. The whole point is children who live OUTSIDE the farmer's
 * barangay, municipality or the country: "Riyadh, Saudi Arabia" has to fit in
 * it as readily as "San Vicente, Tumauini, Isabela".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farmer_children', function (Blueprint $table) {
            $table->string('occupation', 60)->nullable()->after('birthdate');
            $table->string('occupation_other', 100)->nullable()->after('occupation');
            $table->string('current_location', 150)->nullable()->after('occupation_other');
        });
    }

    public function down(): void
    {
        Schema::table('farmer_children', function (Blueprint $table) {
            $table->dropColumn(['occupation', 'occupation_other', 'current_location']);
        });
    }
};
