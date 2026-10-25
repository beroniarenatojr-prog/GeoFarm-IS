<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The link that lets someone set a new password.
 *
 * NOTE THE MISSING `implements ShouldQueue`, for exactly the reason given in
 * AdminLoginOtp: QUEUE_CONNECTION is `database` and no queue worker runs on the
 * server, so a queued notification is written to the jobs table and never sent.
 * A password reset that silently goes nowhere is worse than no reset link on
 * the page at all — the user has no way to tell the difference between "still
 * sending" and "broken", and keeps asking for more.
 *
 * Sent through notifyNow() by User::sendPasswordResetNotification().
 *
 * This replaces Laravel's built-in ResetPassword notification, which uses
 * notify() and would therefore queue.
 */
class ResetPasswordLink extends Notification
{
    public function __construct(private readonly string $token)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        /*
         * The email is carried in the URL alongside the token because that is
         * what Laravel's broker checks the token against — the token alone does
         * not identify an account.
         */
        $url = url(route('password.reset', [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ], false));

        $minutes = config('auth.passwords.' . config('auth.defaults.passwords') . '.expire', 60);

        return (new MailMessage)
            ->subject('Reset your GeoFarm-IS password')
            ->greeting('Hello ' . ($notifiable->name ?: 'there') . ',')
            ->line('A password reset was requested for your GeoFarm-IS account.')
            ->action('Set a new password', $url)
            ->line("This link will expire in {$minutes} minutes and can only be used once.")
            /*
             * Said plainly, because an administrator who resets their password
             * and then meets the verification screen may otherwise think the
             * reset failed.
             */
            ->line('After setting a new password you will be asked to sign in again.')
            ->line('If you did not request this, you can ignore this email — your password will not change until the link above is used.')
            ->salutation("GeoFarm-IS\nMunicipal Agriculture Office");
    }
}
