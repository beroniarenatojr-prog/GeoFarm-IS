<?php

namespace Tests\Feature;

use App\Models\Farmer;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * farmer_children was created without `sex`; the column was later folded into
 * the same migration file, which production had already run. Laravel tracks
 * migrations by filename, so "Nothing to migrate" hid a table that no longer
 * matched the code, and every registration 500'd on "Unknown column 'sex'".
 */
class ChildSexColumnRepairTest extends TestCase
{
    use RefreshDatabase;

    private function repair(): void
    {
        (require database_path('migrations/2026_09_08_000004_add_sex_to_farmer_children.php'))->up();
    }

    /** Put the table back the way production actually had it. */
    private function dropSexColumn(): void
    {
        Schema::table('farmer_children', function (Blueprint $table) {
            $table->dropColumn('sex');
        });
    }

    public function test_it_adds_the_missing_column(): void
    {
        $this->dropSexColumn();
        $this->assertFalse(Schema::hasColumn('farmer_children', 'sex'));

        $this->repair();

        $this->assertTrue(Schema::hasColumn('farmer_children', 'sex'));
    }

    public function test_a_child_can_be_saved_with_their_sex_afterwards(): void
    {
        // The actual regression: this insert is what threw in production.
        $this->dropSexColumn();
        $this->repair();

        $farmer = Farmer::create(['first_name' => 'Renato', 'last_name' => 'Beronia']);
        $farmer->children()->create(['name' => 'Ana Beronia', 'sex' => 'Female']);

        $this->assertSame('Female', $farmer->fresh()->children->first()->sex);
    }

    public function test_existing_children_are_kept(): void
    {
        $farmer = Farmer::create(['first_name' => 'Renato', 'last_name' => 'Beronia']);
        $farmer->children()->create(['name' => 'Jose Beronia']);

        $this->dropSexColumn();
        $this->repair();

        $this->assertSame('Jose Beronia', $farmer->fresh()->children->first()->name);
    }

    public function test_it_is_a_no_op_on_a_database_that_already_has_the_column(): void
    {
        // A fresh database gets `sex` from 000002 itself.
        $this->repair();
        $this->repair();

        $this->assertTrue(Schema::hasColumn('farmer_children', 'sex'));
    }
}
