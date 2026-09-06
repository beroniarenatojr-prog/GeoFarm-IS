<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\FarmParcel;
use App\Models\FarmerChild;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Guards the failure mode that produced two production 500s in a row: a model
 * declaring a field the table does not have. Both came from editing a
 * migration after it had run, which Laravel cannot detect - it tracks
 * migrations by filename, so the schema silently stops matching the code.
 */
class SchemaMatchesModelsTest extends TestCase
{
    use RefreshDatabase;

    public static function models(): array
    {
        return [
            'Farmer'      => [Farmer::class],
            'FarmerChild' => [FarmerChild::class],
            'FarmParcel'  => [FarmParcel::class],
        ];
    }

    /** @dataProvider models */
    public function test_every_fillable_field_exists_as_a_column(string $class): void
    {
        $model   = new $class;
        $columns = Schema::getColumnListing($model->getTable());
        $missing = array_diff($model->getFillable(), $columns);

        $this->assertSame([], array_values($missing), sprintf(
            '%s declares fillable fields with no column: %s',
            class_basename($class),
            implode(', ', $missing),
        ));
    }
}
