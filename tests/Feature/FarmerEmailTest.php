<?php

namespace Tests\Feature;

use App\Models\AssistanceDistribution;
use App\Models\AuditLog;
use App\Models\Farmer;
use App\Models\FinancialAssistance;
use App\Models\InventoryItem;
use App\Models\User;
use App\Notifications\FarmerAssistanceDistributed;
use App\Notifications\FarmerManualEmail;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * The two ways the office writes to a farmer by email.
 *
 * One is automatic - a hand-out was recorded, so the farmer is told. The other
 * is staff typing a message themselves. They share the rule that matters here:
 * the address is never taken from the browser. It is read from the farmer's
 * own record, so the form cannot be turned into a way to mail arbitrary
 * strangers from the office's account.
 */
class FarmerEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->seed(RolePermissionSeeder::class);
    }

    // ---------------------------------------------------------------- actors

    private function staff(string $role = 'Admin'): User
    {
        $user = User::create([
            'name'      => $role,
            'email'     => strtolower($role) . '@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $user->assignRole($role);

        return $user;
    }

    private function farmer(array $overrides = []): Farmer
    {
        return Farmer::create(array_merge([
            'first_name' => 'Maria',
            'last_name'  => 'Bautista',
            'sex'        => 'Female',
            'barangay'   => 'San Pedro',
            'email'      => 'maria@example.test',
        ], $overrides));
    }

    private function programme(): FinancialAssistance
    {
        return FinancialAssistance::create([
            'program_name' => 'Rice Seed Subsidy 2026',
            'total_budget' => 100000,
            'status'       => 'active',
        ]);
    }

    private function distribute(FinancialAssistance $programme, Farmer $farmer, array $extra = [])
    {
        return $this->actingAs($this->staff())
            ->post(route('admin.assistance.distribute', $programme), array_merge([
                'farmer_id'         => $farmer->id,
                'distribution_date' => now()->toDateString(),
                'amount_given'      => 2500,
            ], $extra));
    }

    // ------------------------------------------- task 1: the hand-out email

    public function test_recording_a_distribution_emails_the_farmer(): void
    {
        $farmer = $this->farmer();

        $this->distribute($this->programme(), $farmer);

        Notification::assertSentOnDemand(FarmerAssistanceDistributed::class);
    }

    public function test_a_distribution_that_fails_emails_nobody(): void
    {
        // The point of sending after the commit rather than inside it. Stock is
        // short, so InventoryService throws and the payout is rolled back - the
        // farmer must not be told they received something they did not.
        $farmer = $this->farmer();
        $empty  = InventoryItem::create([
            'item_name' => 'Certified Rice Seed',
            'category'  => 'seed',
            'unit'      => 'bags',
            'quantity'  => 0,
        ]);

        $this->distribute($this->programme(), $farmer, [
            'items' => [['inventory_item_id' => $empty->id, 'quantity' => 5]],
        ]);

        $this->assertSame(0, AssistanceDistribution::count(), 'the payout should have rolled back');
        Notification::assertNothingSent();
    }

    public function test_the_handout_email_names_the_programme(): void
    {
        $farmer = $this->farmer();

        $this->distribute($this->programme(), $farmer);

        Notification::assertSentOnDemand(FarmerAssistanceDistributed::class,
            function (FarmerAssistanceDistributed $notification) {
                $mail = $notification->toMail(null);
                $body = implode(' ', $mail->introLines) . implode(' ', $mail->outroLines);

                $this->assertStringContainsString('Rice Seed Subsidy 2026', $body);

                return true;
            });
    }

    public function test_a_farmer_with_no_address_anywhere_is_not_emailed(): void
    {
        $farmer = $this->farmer(['email' => null]);

        $this->distribute($this->programme(), $farmer);

        $this->assertSame(1, AssistanceDistribution::count(), 'the hand-out is still recorded');
        Notification::assertNothingSent();
    }

    public function test_the_linked_account_address_is_used_when_the_record_has_none(): void
    {
        // Farmers who registered online carry their address on the user account
        // rather than the farmer row.
        $account = User::create([
            'name'      => 'Maria Bautista',
            'email'     => 'maria.account@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $farmer = $this->farmer(['email' => null, 'user_id' => $account->id]);

        $this->distribute($this->programme(), $farmer);

        Notification::assertSentOnDemand(FarmerAssistanceDistributed::class);
    }

    // ------------------------------------------ task 2: the manual message

    private function send(Farmer $farmer, array $payload = [], ?User $as = null)
    {
        return $this->actingAs($as ?? $this->staff())
            ->from(route('admin.farmers.show', $farmer))
            ->post(route('admin.farmers.send-email', $farmer), $payload);
    }

    public function test_staff_can_send_a_farmer_a_typed_message(): void
    {
        $farmer = $this->farmer();

        $this->send($farmer, [
            'subject' => 'Seed distribution on Monday',
            'message' => 'Please bring your RSBSA card to the barangay hall.',
        ])->assertRedirect();

        Notification::assertSentOnDemand(FarmerManualEmail::class,
            function (FarmerManualEmail $notification) {
                $mail = $notification->toMail(null);

                $this->assertSame('Seed distribution on Monday', $mail->subject);
                $this->assertStringContainsString(
                    'Please bring your RSBSA card',
                    implode(' ', $mail->introLines),
                );

                return true;
            });
    }

    public function test_an_address_supplied_by_the_browser_is_ignored(): void
    {
        // The form must not become a relay. Whatever the request says, the mail
        // goes to the address on the farmer named in the URL.
        $farmer = $this->farmer(['email' => 'real@example.test']);

        $this->send($farmer, [
            'email'     => 'attacker@elsewhere.test',
            'to'        => 'attacker@elsewhere.test',
            'recipient' => 'attacker@elsewhere.test',
            'subject'   => 'Hello',
            'message'   => 'Body text.',
        ]);

        Notification::assertSentOnDemand(FarmerManualEmail::class,
            function (FarmerManualEmail $notification, array $channels, object $notifiable) {
                $this->assertSame(['mail' => 'real@example.test'], $notifiable->routes);

                return true;
            });
    }

    public function test_a_farmer_with_no_address_cannot_be_emailed(): void
    {
        $farmer = $this->farmer(['email' => null]);

        $this->send($farmer, [
            'subject' => 'Hello',
            'message' => 'Body text.',
        ])->assertSessionHas('error', 'This farmer does not have a valid email address.');

        Notification::assertNothingSent();
    }

    public function test_the_subject_and_message_are_required(): void
    {
        $farmer = $this->farmer();

        $this->send($farmer)->assertSessionHasErrors(['subject', 'message']);

        Notification::assertNothingSent();
    }

    public function test_an_over_long_subject_or_message_is_rejected(): void
    {
        $farmer = $this->farmer();

        $this->send($farmer, [
            'subject' => str_repeat('a', 201),
            'message' => str_repeat('b', 10001),
        ])->assertSessionHasErrors(['subject', 'message']);

        Notification::assertNothingSent();
    }

    public function test_someone_without_edit_farmers_cannot_send_email(): void
    {
        /*
         * A Staff member with that one permission taken away.
         *
         * This used to be the Viewer role, which has been retired — and every
         * remaining staff role holds "edit farmers", so nothing real sits on
         * the wrong side of this gate now. The role still has to be one the
         * admin route group admits, or the refusal would come from the role
         * middleware and prove nothing about the permission.
         */
        \Spatie\Permission\Models\Role::findByName('Staff')->revokePermissionTo('edit farmers');

        $farmer = $this->farmer();

        $this->send($farmer, [
            'subject' => 'Hello',
            'message' => 'Body text.',
        ], $this->staff('Staff'))->assertForbidden();

        Notification::assertNothingSent();
    }

    public function test_a_guest_cannot_send_email(): void
    {
        $farmer = $this->farmer();

        $this->post(route('admin.farmers.send-email', $farmer), [
            'subject' => 'Hello',
            'message' => 'Body text.',
        ])->assertRedirect(route('login'));

        Notification::assertNothingSent();
    }

    public function test_sending_is_recorded_in_the_audit_log(): void
    {
        $staff  = $this->staff();
        $farmer = $this->farmer(['email' => 'audited@example.test']);

        $this->send($farmer, [
            'subject' => 'Barangay assembly on Friday',
            'message' => 'The assembly has moved to Friday at 9am.',
        ], $staff);

        $entry = AuditLog::where('table_name', 'farmers')
            ->where('action', 'email')
            ->latest('id')
            ->firstOrFail();

        $this->assertSame($staff->id, $entry->user_id);
        $this->assertSame($farmer->id, $entry->record_id);
        $this->assertSame('Barangay assembly on Friday', $entry->new_data['subject']);
        $this->assertSame('audited@example.test', $entry->new_data['to']);

        // The body is personal correspondence and is deliberately not kept.
        $this->assertStringNotContainsString(
            'The assembly has moved',
            json_encode($entry->new_data),
        );
    }

    public function test_the_notification_is_queued_rather_than_sent_inline(): void
    {
        // Shared hosting has no always-on worker, so delivery happens on a
        // cron. A notification that sent inline would hold the staff request
        // open for the whole SMTP handshake.
        $this->assertInstanceOf(
            ShouldQueue::class,
            new FarmerManualEmail($this->farmer(), 'Subject', 'Body'),
        );
    }

    public function test_a_farmer_cannot_reach_the_form(): void
    {
        $farmerUser = $this->staff('Farmer');

        $this->actingAs($farmerUser)
            ->get(route('admin.farmer-email.create'))
            ->assertForbidden();
    }

    public function test_the_form_offers_only_farmers_who_can_actually_be_reached(): void
    {
        $reachable = $this->farmer(['email' => 'reachable@example.test']);
        $this->farmer(['first_name' => 'Silent', 'email' => null]);

        $this->actingAs($this->staff())
            ->get(route('admin.farmer-email.create'))
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Farmers/SendEmail')
                ->has('farmers', 1)
                ->where('farmers.0.id', $reachable->id));
    }

    public function test_the_profile_page_carries_the_address_the_button_needs(): void
    {
        // The Send Email button on the profile hides itself when there is no
        // contact_email, so the prop has to reach the page or the action
        // silently disappears for every farmer.
        $farmer = $this->farmer(['email' => 'profile@example.test']);

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.show', $farmer))
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Farmers/Show')
                ->where('farmer.contact_email', 'profile@example.test'));
    }

    public function test_the_profile_falls_back_to_the_login_account_address(): void
    {
        $account = User::create([
            'name'      => 'Maria Bautista',
            'email'     => 'account@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]);
        $farmer = $this->farmer(['email' => null, 'user_id' => $account->id]);

        $this->actingAs($this->staff())
            ->get(route('admin.farmers.show', $farmer))
            ->assertInertia(fn ($page) => $page
                ->where('farmer.contact_email', 'account@example.test'));
    }
}
