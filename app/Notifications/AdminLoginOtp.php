<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The six-digit code for an administrative login.
 *
 * NOTE THE MISSING `implements ShouldQueue`. That is not an oversight, and it
 * is the single most important line that is not in this file.
 *
 * Every other notification in this application queues, QUEUE_CONNECTION is
 * `database`, and no queue worker runs on the server — the only queue:listen
 * anywhere is in composer.json's local `dev` script. A queued notification
 * here would be written to the jobs table and never sent, and because a valid
 * password alone no longer opens the administrative area, every administrator
 * would be locked out of GeoFarm-IS with no way back in through a browser.
 *
 * So this one is sent synchronously, in the request, via notifyNow(). The
 * caller catches a send failure and tells the user plainly — see
 * LoginOtpService::deliver().
 *
 * The code is passed in and used once. It is not stored on the model, not
 * logged, and not included anywhere but the body of this message.
 */
class AdminLoginOtp extends Notification
{
    public function __construct(private readonly string $code)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('GeoFarm-IS Login Verification Code')
            ->greeting('Hello ' . ($notifiable->name ?: 'there') . ',')
            ->line('A login verification code was requested for your GeoFarm-IS administrative account.')
            ->line('Your verification code is:')
            // The code on its own line, large and alone, so it is easy to read
            // off a phone at the counter without transcribing neighbouring text.
            ->line('**' . $this->code . '**')
            ->line('This code will expire in ' . config('geofarm.admin_otp.ttl_minutes', 5) . ' minutes.')
            /*
             * The only security advice in here. Deliberately no link, no
             * button and no account details: a login code email is a common
             * phishing template, and one that never asks the reader to click
             * anything is one they cannot be trained to click.
             */
            ->line('If you did not attempt to log in, you can safely ignore this email. Your account remains secure.')
            ->salutation("GeoFarm-IS\nMunicipal Agriculture Office");
    }
}
