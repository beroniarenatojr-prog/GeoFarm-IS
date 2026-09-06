<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The spouse name and children have to survive the round trip through the
 * form, not just the model. Children arrive as a JSON string in one field,
 * the same shape the parcels repeater already posts.
 */
class FarmerFamilyRegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');   // store() writes a generated QR code
        $this->seed(RolePermissionSeeder::class);

        $admin = User::create([
            'name'      => 'Office Staff',
            'email'     => 'staff@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $admin->syncRoles(['Admin']);

        $this->actingAs($admin);
    }

    private function submit(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        return $this->post(route('admin.farmers.store'), array_merge([
            'first_name' => 'Renato',
            'last_name'  => 'Beronia',
            'sex'        => 'Male',
        ], $overrides));
    }

    public function test_the_spouse_name_is_saved_with_the_farmer(): void
    {
        $this->submit([
            'civil_status' => 'Married',
            'spouse_name'  => 'Maria Santos Beronia',
        ]);

        $this->assertSame('Maria Santos Beronia', Farmer::firstOrFail()->spouse_name);
    }

    public function test_children_posted_as_json_are_saved_as_rows(): void
    {
        $this->submit([
            'children' => json_encode([
                ['name' => 'Ana Beronia',  'birthdate' => '2015-04-02'],
                ['name' => 'Jose Beronia', 'birthdate' => null],
            ]),
        ]);

        $children = Farmer::firstOrFail()->children;

        $this->assertCount(2, $children);
        $this->assertSame('Ana Beronia', $children[0]->name);
        $this->assertSame('2015-04-02', $children[0]->birthdate->toDateString());
        $this->assertNull($children[1]->birthdate);
    }

    public function test_blank_rows_left_behind_in_the_repeater_are_discarded(): void
    {
        // Clicking "Add Another Child" and then not filling it in should not
        // create a nameless record.
        $this->submit([
            'children' => json_encode([
                ['name' => 'Ana Beronia', 'birthdate' => null],
                ['name' => '',            'birthdate' => null],
                ['name' => '   ',         'birthdate' => null],
            ]),
        ]);

        $this->assertCount(1, Farmer::firstOrFail()->children);
    }
}
