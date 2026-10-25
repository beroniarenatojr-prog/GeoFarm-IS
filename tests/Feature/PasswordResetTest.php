<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\User;
use App\Notifications\ResetPasswordLink;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Auth\Notifications\ResetPassword as FrameworkResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Forgotten passwords.
 *
 * The login page carried a dead "Forgot password?" link and there was no way
 * back into an account at all. These tests cover the flow, but mostly they pin
 * the four decisions that are security decisions rather than UX ones:
 *
 *   - the response never reveals whether an address is registered
 *   - a reset does not sign anyone in, so it cannot bypass the OTP check
 *   - a reset evicts every other session for that account
 *   - the notification is sent now, not queued onto a worker that does not run
 */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function user(string $email = 'someone@example.test', string $role = 'Farmer'): User
    {
        return tap(User::create([
            'name'      => 'Account Holder',
            'email'     => $email,
            'password'  => 'the-old-password',
            'is_active' => true,
        ]), fn (User $u) => $u->assignRole($role));
    }

    /** Ask for a link and read the token straight out of the notification. */
    private function requestLink(User $user): string
    {
        Notification::fake();

        $this->post('/forgot-password', ['email' => $user->email])
            ->assertSessionHas('success');

        $token = null;

        Notification::assertSentTo($user, ResetPasswordLink::class, function ($notification) use (&$token) {
            $token = (new \ReflectionProperty($notification, 'token'))->getValue($notification);

            return true;
        });

        $this->assertNotNull($token, 'no reset token was issued');

        return $token;
    }

    // ------------------------------------------------------------- the pages

    public function test_the_forms_are_reachable_to_someone_who_cannot_sign_in(): void
    {
        // The only people who need these are signed out, so `guest` is the
        // correct gate and these must not 403 or redirect to login.
        $this->get('/forgot-password')->assertOk();
        $this->get('/reset-password/any-token-shape')->assertOk();
    }

    public function test_a_signed_in_user_is_sent_away_from_the_reset_forms(): void
    {
        // They already have a session; the profile screen is where they change
        // a password they know.
        $this->actingAs($this->user())->get('/forgot-password')->assertRedirect();
    }

    // ---------------------------------------------------------- enumeration

    public function test_the_response_is_identical_whether_the_address_exists(): void
    {
        $this->user('real@example.test');

        Notification::fake();

        $known = $this->post('/forgot-password', ['email' => 'real@example.test']);
        $unknown = $this->post('/forgot-password', ['email' => 'nobody@example.test']);

        /*
         * The whole point. Different wording, a different status, or an error on
         * one and not the other turns this form into a way to test which
         * addresses belong to accounts — and the login form deliberately gives
         * nothing away either, so leaking it here would undo that.
         */
        $this->assertSame($known->status(), $unknown->status());
        $this->assertSame(
            session()->get('success'),
            $unknown->baseResponse->getSession()->get('success'),
        );

        $unknown->assertSessionHasNoErrors();
    }

    public function test_no_email_is_sent_to_an_address_with_no_account(): void
    {
        Notification::fake();

        $this->post('/forgot-password', ['email' => 'nobody@example.test']);

        Notification::assertNothingSent();
    }

    // ------------------------------------------------------------- the email

    public function test_the_reset_notification_is_not_queued(): void
    {
        /*
         * The single most important assertion in this file.
         *
         * QUEUE_CONNECTION is `database` and no queue worker runs on the
         * server. A queued notification is written to the jobs table and never
         * sent, so a reset email would silently never arrive — and the user
         * cannot tell that apart from "still sending". Laravel's own
         * ResetPassword notification queues, which is why it was replaced.
         */
        $this->assertNotInstanceOf(
            \Illuminate\Contracts\Queue\ShouldQueue::class,
            new ResetPasswordLink('a-token'),
        );

        // And the framework's queuing one is not what gets sent.
        $user = $this->user();
        Notification::fake();
        $this->post('/forgot-password', ['email' => $user->email]);

        Notification::assertSentTo($user, ResetPasswordLink::class);
        Notification::assertNotSentTo($user, FrameworkResetPassword::class);
    }

    public function test_the_emailed_link_points_at_the_reset_form(): void
    {
        $user = $this->user();
        $token = $this->requestLink($user);

        $mail = (new ResetPasswordLink($token))->toMail($user);

        $this->assertStringContainsString('/reset-password/' . $token, $mail->actionUrl);
        // The email is carried too: the token alone does not identify an account.
        $this->assertStringContainsString(urlencode($user->email), $mail->actionUrl);
    }

    // ------------------------------------------------------------ the reset

    public function test_a_valid_link_changes_the_password(): void
    {
        $user = $this->user();
        $token = $this->requestLink($user);

        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertRedirect(route('login'));

        $this->assertTrue(Hash::check('a-brand-new-password', $user->fresh()->password));
    }

    public function test_a_reset_does_not_sign_the_user_in(): void
    {
        $user = $this->user('admin@example.test', 'Admin');
        $token = $this->requestLink($user);

        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ]);

        /*
         * Laravel's scaffolding signs the user in here. For an administrator
         * that hands out an authenticated session with no verification code —
         * the exact bypass EnsureAdminOtpVerified exists to close, reached
         * through the front door instead of a remember-me cookie.
         */
        $this->assertGuest();
    }

    public function test_a_reset_evicts_every_other_session_for_that_account(): void
    {
        $user = $this->user();
        $user->forceFill(['active_session_id' => 'a-session-somebody-else-holds'])->save();

        $token = $this->requestLink($user);

        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ]);

        /*
         * Someone resetting because they think their account was used must not
         * leave the other party signed in. PreventConcurrentLogins compares a
         * caller's session id against this column, so clearing it means no
         * session is the blessed one any more.
         */
        $this->assertNull($user->fresh()->active_session_id);
    }

    public function test_a_link_works_only_once(): void
    {
        $user = $this->user();
        $token = $this->requestLink($user);

        $payload = [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'first-new-password',
            'password_confirmation' => 'first-new-password',
        ];

        $this->post('/reset-password', $payload)->assertRedirect(route('login'));

        // The broker deletes the token on success, so a replay fails.
        $this->post('/reset-password', array_merge($payload, [
            'password'              => 'second-new-password',
            'password_confirmation' => 'second-new-password',
        ]))->assertSessionHasErrors('email');

        $this->assertTrue(Hash::check('first-new-password', $user->fresh()->password));
    }

    public function test_an_expired_link_is_refused(): void
    {
        $user = $this->user();
        $token = $this->requestLink($user);

        // Age the stored token past the broker's 60-minute window.
        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->update(['created_at' => now()->subMinutes(61)]);

        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertSessionHasErrors('email');

        $this->assertTrue(Hash::check('the-old-password', $user->fresh()->password));
    }

    public function test_a_token_cannot_be_used_against_another_account(): void
    {
        $victim = $this->user('victim@example.test');
        $attacker = $this->user('attacker@example.test');

        $token = $this->requestLink($attacker);

        // The broker hashes the token against the email it was issued for.
        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $victim->email,
            'password'              => 'taken-over',
            'password_confirmation' => 'taken-over',
        ])->assertSessionHasErrors('email');

        $this->assertTrue(Hash::check('the-old-password', $victim->fresh()->password));
    }

    public function test_the_new_password_must_be_confirmed_and_long_enough(): void
    {
        $user = $this->user();
        $token = $this->requestLink($user);

        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'short',
            'password_confirmation' => 'short',
        ])->assertSessionHasErrors('password');

        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'long-enough-password',
            'password_confirmation' => 'does-not-match',
        ])->assertSessionHasErrors('password');

        $this->assertTrue(Hash::check('the-old-password', $user->fresh()->password));
    }

    // ------------------------------------------------------- account states

    public function test_an_inactive_farmer_can_still_set_a_password(): void
    {
        $user = $this->user('pending@example.test');
        $user->forceFill(['is_active' => false])->save();

        Farmer::create([
            'first_name' => 'Pending', 'last_name' => 'Farmer', 'sex' => 'Male',
            'barangay' => 'Antagan I', 'user_id' => $user->id,
            'verification_status' => Farmer::STATUS_PENDING,
        ]);

        $token = $this->requestLink($user);

        /*
         * They own the account, so they may set its password. Refusing here
         * would both leak the account's state and strand someone who simply
         * forgot it — the login step is where "not yet active" is explained.
         */
        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertRedirect(route('login'));

        $this->assertTrue(Hash::check('a-brand-new-password', $user->fresh()->password));

        // And it still does not let them in.
        $this->post('/login', [
            'email' => $user->email, 'password' => 'a-brand-new-password',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_the_request_is_rate_limited(): void
    {
        $user = $this->user();

        Notification::fake();

        /*
         * Without a limit this form is both a way to enumerate accounts and a
         * way to make the server send mail on demand. Five a minute, then the
         * throttle middleware answers 429.
         */
        for ($i = 0; $i < 5; $i++) {
            $this->post('/forgot-password', ['email' => $user->email])->assertRedirect();
        }

        $this->post('/forgot-password', ['email' => $user->email])->assertStatus(429);
    }

    public function test_a_reset_is_written_to_the_audit_trail(): void
    {
        $user = $this->user();
        $token = $this->requestLink($user);

        $this->post('/reset-password', [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action'     => 'password_reset',
            'table_name' => 'users',
            'record_id'  => $user->id,
        ]);

        // The password itself is never recorded.
        $entry = DB::table('audit_logs')->where('action', 'password_reset')->first();
        $this->assertStringNotContainsString('a-brand-new-password', (string) $entry->new_data);
    }
}
