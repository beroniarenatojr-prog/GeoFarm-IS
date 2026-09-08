<?php

namespace App\Notifications;

use App\Models\Farmer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A message staff typed themselves, sent to one farmer.
 *
 * Everything else the system emails is a fixed announcement about an event.
 * This one carries whatever the office needs to say - a schedule change, a
 * missing document, a reminder to collect something - so the subject and body
 * come from the person sending it.
 *
 * The recipient does not: it is resolved from the selected farmer's record by
 * the controller, never from the request. That is what stops the form being
 * usable as a way to send mail from the office's account to anyone at all.
 */
class FarmerManualEmail extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Farmer $farmer,
        private readonly string $subject,
        private readonly string $body,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(?object $notifiable = null): MailMessage
    {
        $name = trim($this->farmer->full_name);

        $mail = (new MailMessage())
            ->subject($this->subject)
            ->greeting($name !== '' ? 'Dear ' . $name : 'Dear farmer');

        /*
         * The staff message, reproduced and not rewritten.
         *
         * Each line they typed becomes its own line() call, which is how the
         * breaks survive - a single string would arrive as one run-on
         * paragraph. Blank entries are dropped rather than rendered as gaps.
         *
         * line() is also what makes this safe to send: Laravel escapes the
         * value in the Blade template and then parses the result with
         * html_input => strip, so markup a staff member pastes in arrives as
         * the text they typed rather than as live HTML.
         */
        foreach (preg_split('/\R/', trim($this->body)) as $paragraph) {
            if (trim($paragraph) !== '') {
                $mail->line(trim($paragraph));
            }
        }

        return $mail
            ->line('---')
            ->line('This message was sent through ' . config('mail.from.name', 'GeoFarm-IS') . '.')
            ->salutation('Tumauini Municipal Agriculture Office');
    }
}
