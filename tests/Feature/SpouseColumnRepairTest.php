<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * 2026_09_08_000001 was edited after it had already run in production, so the
 * server kept the single `spouse_name` column while the code wrote to four -
 * and "Nothing to migrate" hid it, because Laravel records a migration by
 * filename rather than content.
 *
 * These tests run the repair against each shape a database might be in.
 */
class SpouseColumnRepairTest extends TestCase
{
    use RefreshDatabase;

    private const NEW_COLUMNS = [
        'spouse_first_name',
        'spouse_middle_name',
        'spouse_last_name',
        'spouse_ext_name',
    ];

    private function repair(): void
    {
        (require database_path('migrations/2026_09_08_000003_fix_spouse_name_columns.php'))->up();
    }

    /** Put the table back the way production actually had it. */
    private function revertToOldShape(): void
    {
        Schema::table('farmers', function (Blueprint $table) {
            $table->dropColumn(self::NEW_COLUMNS);
        });

        Schema::table('farmers', function (Blueprint $table) {
            $table->string('spouse_name', 150)->nullable()->after('civil_status');
        });
    }

    public function test_it_replaces_the_old_column_with_the_four_new_ones(): void
    {
        $this->revertToOldShape();

        $this->repair();

        $this->assertFalse(Schema::hasColumn('farmers', 'spouse_name'), 'the old column should be gone');

        foreach (self::NEW_COLUMNS as $column) {
            $this->assertTrue(Schema::hasColumn('farmers', $column), "{$column} should exist");
        }
    }

    public function test_a_name_already_recorded_is_carried_over_not_dropped(): void
    {
        $this->revertToOldShape();

        $id = DB::table('farmers')->insertGetId([
            'first_name'  => 'Renato',
            'last_name'   => 'Beronia',
            'spouse_name' => 'Maria Santos Beronia',
        ]);

        $this->repair();

        $this->assertSame(
            'Maria Santos Beronia',
            DB::table('farmers')->where('id', $id)->value('spouse_first_name'),
        );
    }

    public function test_it_does_nothing_on_a_database_that_is_already_correct(): void
    {
        // A fresh database gets the four columns from 000001 itself, so the
        // repair must be a no-op there rather than an error.
        $this->repair();

        foreach (self::NEW_COLUMNS as $column) {
            $this->assertTrue(Schema::hasColumn('farmers', $column));
        }

        $this->assertFalse(Schema::hasColumn('farmers', 'spouse_name'));
    }

    public function test_running_it_twice_is_harmless(): void
    {
        $this->revertToOldShape();

        $this->repair();
        $this->repair();

        $this->assertTrue(Schema::hasColumn('farmers', 'spouse_first_name'));
        $this->assertFalse(Schema::hasColumn('farmers', 'spouse_name'));
    }
}
