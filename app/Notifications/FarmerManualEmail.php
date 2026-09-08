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
        $mail = (new MailMessage())
            ->subject($this->subject)
            ->greeting($this->farmer->first_name
                ? 'Dear ' . $this->farmer->first_name
                : 'Dear farmer');

        // Each paragraph the sender typed becomes its own line, so a message
        // written with blank lines between points does not arrive as one wall
        // of text. Blank entries are dropped rather than rendered as gaps.
        foreach (preg_split('/\R/', trim($this->body)) as $paragraph) {
            if (trim($paragraph) !== '') {
                $mail->line(trim($paragraph));
            }
        }

        return $mail
            ->line('This message was sent by the Municipal Agriculture Office of Tumauini, Isabela.')
            ->salutation('GeoFarm-IS — Farmer Information & Management System');
    }
}
