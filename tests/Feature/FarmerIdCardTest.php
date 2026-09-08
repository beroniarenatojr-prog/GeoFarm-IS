<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The RSBSA identification card.
 *
 * The card is printed and handed to a farmer, so what matters here is that
 * everything it needs is embedded in the response itself: a linked image that
 * resolves on screen can still come out blank on the paper.
 */
class FarmerIdCardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        Storage::fake('public');
    }

    private function staff(): User
    {
        $user = User::create([
            'name'      => 'Encoder',
            'email'     => 'encoder@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $user->assignRole('Admin');

        return $user;
    }

    private function verifiedFarmer(): Farmer
    {
        return Farmer::create([
            'first_name'          => 'Maria',
            'last_name'           => 'Bautista',
            'sex'                 => 'Female',
            'barangay'            => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    public function test_the_card_carries_the_new_header(): void
    {
        $this->actingAs($this->staff())
            ->get(route('admin.farmers.id-card', $this->verifiedFarmer()))
            ->assertOk()
            ->assertSee('LGU Tumauini Registered Farmers')
            ->assertSee('Municipal Agriculture Office');
    }

    public function test_the_municipal_seal_is_embedded_not_linked(): void
    {
        // The whole point of inlining: a src="/images/Logo.jpeg" would depend
        // on the print dialog fetching it, and often prints blank.
        $html = $this->actingAs($this->staff())
            ->get(route('admin.farmers.id-card', $this->verifiedFarmer()))
            ->assertOk()
            ->getContent();

        $this->assertStringContainsString('data:image/jpeg;base64,', $html);
        $this->assertStringNotContainsString('src="/images/Logo.jpeg"', $html);
    }

    public function test_an_unverified_farmer_gets_no_card(): void
    {
        // A card asserts the office checked this person.
        $pending = Farmer::create([
            'first_name'          => 'Juan',
            'last_name'           => 'Cruz',
            'sex'                 => 'Male',
            'barangay'            => 'Ugad',
            'verification_status' => Farmer::STATUS_PENDING,
        ]);

        $this->actingAs($this->staff())
            ->from(route('admin.farmers.show', $pending))
            ->get(route('admin.farmers.id-card', $pending))
            ->assertRedirect()
            ->assertSessionHas('error');
    }
}
