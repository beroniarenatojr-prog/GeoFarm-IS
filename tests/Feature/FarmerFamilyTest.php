<?php

namespace Tests\Feature;

use App\Models\Farmer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Spouse name and children, as the RSBSA form collects them.
 */
class FarmerFamilyTest extends TestCase
{
    use RefreshDatabase;

    private function farmer(array $attributes = []): Farmer
    {
        return Farmer::create(array_merge([
            'first_name' => 'Renato',
            'last_name'  => 'Beronia',
        ], $attributes));
    }

    public function test_a_married_farmer_keeps_the_spouse_name_in_parts(): void
    {
        // The RSBSA form rules the spouse row into four captioned columns -
        // FIRST NAME, MIDDLE NAME, SURNAME, EXT NAME - the same shape as the
        // farmer's own name and their mother's. One free-text field could not
        // be printed back into them.
        $farmer = $this->farmer([
            'civil_status'        => 'Married',
            'spouse_first_name'   => 'Maria',
            'spouse_middle_name'  => 'Santos',
            'spouse_last_name'    => 'Beronia',
            'spouse_ext_name'     => 'Jr',
        ]);

        $fresh = $farmer->fresh();

        $this->assertSame('Maria', $fresh->spouse_first_name);
        $this->assertSame('Santos', $fresh->spouse_middle_name);
        $this->assertSame('Beronia', $fresh->spouse_last_name);
        $this->assertSame('Jr', $fresh->spouse_ext_name);
    }

    public function test_a_farmer_keeps_each_child_with_a_birthdate(): void
    {
        $farmer = $this->farmer();

        $farmer->children()->create(['name' => 'Ana Beronia', 'birthdate' => '2015-04-02']);
        $farmer->children()->create(['name' => 'Jose Beronia', 'birthdate' => '2018-11-20']);

        $children = $farmer->fresh()->children;

        $this->assertCount(2, $children);
        $this->assertSame('Ana Beronia', $children[0]->name);
        $this->assertSame('2015-04-02', $children[0]->birthdate->toDateString());
    }

    public function test_a_child_keeps_their_sex(): void
    {
        $farmer = $this->farmer();

        $farmer->children()->create(['name' => 'Ana Beronia', 'sex' => 'Female']);

        $this->assertSame('Female', $farmer->fresh()->children->first()->sex);
    }

    public function test_a_child_may_be_recorded_without_a_birthdate(): void
    {
        // Parents registering at the office do not always have the birth
        // certificate to hand; a name alone is still worth recording.
        $farmer = $this->farmer();

        $farmer->children()->create(['name' => 'Baby Beronia']);

        $this->assertNull($farmer->fresh()->children->first()->birthdate);
    }

    public function test_children_go_when_the_farmer_does(): void
    {
        $farmer = $this->farmer();
        $farmer->children()->create(['name' => 'Ana Beronia']);

        $farmer->delete();

        $this->assertDatabaseCount('farmer_children', 0);
    }
}
