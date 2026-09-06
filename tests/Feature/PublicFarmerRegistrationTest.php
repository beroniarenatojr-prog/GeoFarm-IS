<?php

namespace Tests\Feature;

use App\Models\Farmer;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The public self-registration path, which no test covered.
 *
 * Children support was added to both controllers at once, but only the admin
 * one was tested. The public controller creates its farmer inside a
 * DB::transaction closure, and the closure's use() list was never updated -
 * so every submission died on "Undefined variable $children" with a 500,
 * while the admin tests stayed green.
 */
class PublicFarmerRegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The controller assigns the Farmer role to the new account.
        $this->seed(RolePermissionSeeder::class);
    }

    private function submit(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        return $this->post('/farmer-registration', array_merge([
            'email'                 => 'farmer@example.test',
            'password'              => 'a-long-enough-password',
            'password_confirmation' => 'a-long-enough-password',
            'first_name'            => 'Renato',
            'last_name'             => 'Beronia',
            'sex'                   => 'Male',
        ], $overrides));
    }

    public function test_a_farmer_can_register_themselves(): void
    {
        $response = $this->submit();

        $response->assertSessionHasNoErrors();
        $this->assertSame('Renato', Farmer::firstOrFail()->first_name);
    }

    public function test_registering_with_children_does_not_blow_up(): void
    {
        // The regression: $children was resolved outside the transaction but
        // never passed into it, so this path threw rather than saving.
        $this->submit([
            'children' => json_encode([
                ['name' => 'Ana Beronia', 'sex' => 'Female', 'birthdate' => '2015-04-02'],
            ]),
        ]);

        $children = Farmer::firstOrFail()->children;

        $this->assertCount(1, $children);
        $this->assertSame('Ana Beronia', $children[0]->name);
    }

    public function test_the_spouse_name_survives_public_registration(): void
    {
        $this->submit([
            'civil_status'      => 'Married',
            'spouse_first_name' => 'Maria',
            'spouse_last_name'  => 'Beronia',
        ]);

        $farmer = Farmer::firstOrFail();

        $this->assertSame('Maria', $farmer->spouse_first_name);
        $this->assertSame('Beronia', $farmer->spouse_last_name);
    }
}
