<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\User;
use App\Notifications\FarmerRegistrationSubmitted;
use App\Notifications\FarmerVerificationDecided;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Email around the verification workflow.
 *
 * The notification bell is deliberately untouched: it counts pending farmers
 * live rather than storing notifications, which is why it cannot drift and why
 * a page refresh cannot duplicate it. Email is the part that was missing.
 */
class FarmerVerificationEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->seed(RolePermissionSeeder::class);
    }

    private function staffWhoCanVerify(): User
    {
        $user = User::create([
            'name'      => 'Verifier',
            'email'     => 'verifier@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $user->assignRole('Admin');   // the admin route group requires a role, not just a permission

        return $user;
    }

    private function staffWhoCanOnlyLook(): User
    {
        $user = User::create([
            'name'      => 'Viewer',
            'email'     => 'viewer@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $user->assignRole('Viewer');  // can see the queue, cannot approve or reject

        return $user;
    }

    private function register(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        return $this->post('/farmer-registration', array_merge([
            'email'                 => 'farmer@example.test',
            'password'              => 'a-long-enough-password',
            'password_confirmation' => 'a-long-enough-password',
            'first_name'            => 'Johnny',
            'last_name'             => 'Evangelista',
            'sex'                   => 'Male',
            'barangay'              => 'San Pedro',
        ], $overrides));
    }

    public function test_a_submitted_registration_emails_staff_who_can_verify(): void
    {
        $verifier = $this->staffWhoCanVerify();

        $this->register();

        Notification::assertSentTo($verifier, FarmerRegistrationSubmitted::class);
    }

    public function test_staff_who_can_only_view_are_not_emailed(): void
    {
        // They can see the queue but cannot approve or reject, so an email
        // asking them to act on it would be work they cannot do.
        $viewer = $this->staffWhoCanOnlyLook();

        $this->register();

        Notification::assertNotSentTo($viewer, FarmerRegistrationSubmitted::class);
    }

    public function test_the_staff_email_names_the_farmer_and_links_to_the_queue(): void
    {
        $verifier = $this->staffWhoCanVerify();

        $this->register();

        Notification::assertSentTo($verifier, FarmerRegistrationSubmitted::class,
            function (FarmerRegistrationSubmitted $notification) use ($verifier) {
                $mail = $notification->toMail($verifier);

                $this->assertSame('New Farmer Registration Requires Verification', $mail->subject);
                $this->assertSame(route('admin.farmer-verification.index'), $mail->actionUrl);
                $this->assertStringContainsString('Johnny', implode(' ', $mail->introLines));

                return true;
            });
    }

    public function test_a_retried_submission_does_not_email_twice(): void
    {
        // alreadySubmitted() rejects a repeat of the same name and birthdate
        // before any record is created, so a browser refresh cannot re-notify.
        $verifier = $this->staffWhoCanVerify();

        $this->register(['birthdate' => '1999-10-18']);
        $this->register(['birthdate' => '1999-10-18', 'email' => 'second@example.test']);

        Notification::assertSentToTimes($verifier, FarmerRegistrationSubmitted::class, 1);
    }

    public function test_approving_emails_the_farmer(): void
    {
        $verifier = $this->staffWhoCanVerify();
        $this->register();
        $farmer = Farmer::firstOrFail();

        $this->actingAs($verifier)->post(route('admin.farmer-verification.approve', $farmer));

        Notification::assertSentOnDemand(FarmerVerificationDecided::class);
        $this->assertTrue($farmer->fresh()->isVerified());
    }

    public function test_rejecting_emails_the_farmer_with_the_reason(): void
    {
        $verifier = $this->staffWhoCanVerify();
        $this->register();
        $farmer = Farmer::firstOrFail();

        $this->actingAs($verifier)->post(route('admin.farmer-verification.reject', $farmer), [
            'rejection_reason' => 'The birth certificate was not legible.',
        ]);

        Notification::assertSentOnDemand(FarmerVerificationDecided::class,
            function (FarmerVerificationDecided $notification) {
                $mail = $notification->toMail(null);

                $this->assertStringContainsString(
                    'The birth certificate was not legible.',
                    implode(' ', $mail->introLines) . implode(' ', $mail->outroLines),
                );

                return true;
            });
    }

    public function test_a_user_without_edit_farmers_cannot_approve(): void
    {
        $viewer = $this->staffWhoCanOnlyLook();
        $this->register();
        $farmer = Farmer::firstOrFail();

        $this->actingAs($viewer)
            ->post(route('admin.farmer-verification.approve', $farmer))
            ->assertForbidden();

        $this->assertTrue($farmer->fresh()->isPending());
    }
}
