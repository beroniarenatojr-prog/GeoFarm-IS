<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Models\FarmerMessage;
use App\Models\User;
use App\Notifications\FarmRiskAlert;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Telling a farmer what the analysis found.
 *
 * The email is composed from the analysis, not typed, so it cannot say
 * something the screen does not. The two refusals below are the point of the
 * feature: no alert without a raised factor, and no alert without an address
 * on the farmer's own record.
 */
class FarmRiskAlertTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;
    private Farmer $farmer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        Notification::fake();

        $this->farmer = Farmer::create([
            'first_name' => 'Renato', 'last_name' => 'Beronia', 'sex' => 'Male',
            'barangay' => 'Caligayan', 'email' => 'renato@example.test',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);
    }

    private function staff(): User
    {
        return $this->staff ??= tap(User::create([
            'name' => 'Office Admin', 'email' => 'admin@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Admin'));
    }

    private function withRisk(): void
    {
        $this->farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2,
            'commodity' => 'Rice', 'parcel_number' => '1',
        ]);

        ClimateRiskAssessment::create([
            'farmer_id' => $this->farmer->id, 'assessed_at' => now(),
            'flood_frequency' => 'very_frequently',
            'worst_effect' => 'total_loss',
        ]);
    }

    private function send()
    {
        return $this->actingAs($this->staff())
            ->post(route('admin.farmers.analysis.alert', $this->farmer));
    }

    public function test_an_alert_is_sent_when_a_factor_was_actually_raised(): void
    {
        $this->withRisk();

        $this->send()->assertRedirect();

        Notification::assertSentOnDemand(FarmRiskAlert::class);
    }

    public function test_nothing_is_sent_when_no_factor_was_raised(): void
    {
        // An alert about a risk nobody identified is exactly the fabricated
        // notification this must never produce.
        $this->farmer->parcels()->create([
            'barangay' => 'Caligayan', 'total_area_ha' => 2, 'commodity' => 'Rice',
        ]);

        $this->send()->assertSessionHasErrors('alert');

        Notification::assertNothingSent();
    }

    public function test_nothing_is_sent_without_an_address_on_the_farmers_record(): void
    {
        $this->withRisk();
        $this->farmer->update(['email' => null]);

        $this->send()->assertSessionHasErrors('alert');

        Notification::assertNothingSent();
    }

    public function test_the_recipient_cannot_be_supplied_by_the_request(): void
    {
        // The same rule the manual email follows: an address from the form
        // would turn a staff page into a relay for the office's mail account.
        $this->withRisk();

        $this->actingAs($this->staff())->post(
            route('admin.farmers.analysis.alert', $this->farmer),
            ['email' => 'attacker@example.test', 'to' => 'attacker@example.test'],
        );

        Notification::assertSentOnDemand(
            FarmRiskAlert::class,
            fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'renato@example.test',
        );
    }

    public function test_the_alert_is_logged_with_the_office_correspondence(): void
    {
        $this->withRisk();

        $this->send();

        $message = FarmerMessage::where('farmer_id', $this->farmer->id)->firstOrFail();

        $this->assertStringContainsString('Farm risk alert', $message->subject);
        $this->assertSame('renato@example.test', $message->sent_to);
        $this->assertSame($this->staff()->id, $message->sent_by);
        $this->assertStringContainsString('Main concern', $message->body);
    }

    public function test_a_farmer_account_cannot_send_one(): void
    {
        $account = tap(User::create([
            'name' => 'A Farmer', 'email' => 'f@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]), fn (User $u) => $u->assignRole('Farmer'));

        $this->actingAs($account)
            ->post(route('admin.farmers.analysis.alert', $this->farmer))
            ->assertForbidden();

        Notification::assertNothingSent();
    }
}
