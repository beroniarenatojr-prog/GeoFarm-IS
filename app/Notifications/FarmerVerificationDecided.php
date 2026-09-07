<?php

namespace App\Notifications;

use App\Models\Farmer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells a farmer what the office decided about their registration.
 *
 * One notification for both outcomes rather than two classes: the decision is
 * a single event with two results, and splitting it would duplicate the
 * addressing, the queue behaviour and most of the wording.
 *
 * Sent on demand to the address on the record, so it works for a farmer with
 * no login account - staff can encode someone at the office who never
 * registered online.
 */
class FarmerVerificationDecided extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Farmer $farmer,
        private readonly bool $approved,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(?object $notifiable = null): MailMessage
    {
        $reference = $this->farmer->reference_code ?: $this->farmer->rsbsa_no ?: 'Not yet issued';

        if ($this->approved) {
            return (new MailMessage())
                ->subject('Farmer Registration Verified')
                ->greeting('Farmer Registration Verified')
                ->line('Your farmer registration has been successfully verified.')
                ->line('**Registration No.:** ' . $reference)
                ->line('You may now sign in to GeoFarm-IS with the account you created during registration.')
                ->action('Sign in', route('login'))
                ->salutation('GeoFarm-IS — Farmer Information & Management System');
        }

        return (new MailMessage())
            ->subject('Farmer Registration Requires Attention')
            ->greeting('Farmer Registration Requires Attention')
            ->line('Your farmer registration has been reviewed and could not be approved at this time.')
            ->line('**Registration No.:** ' . $reference)
            // Only when the office actually gave one. "Reason: —" reads worse
            // than no reason line at all.
            ->when(
                filled($this->farmer->rejection_reason),
                fn (MailMessage $mail) => $mail->line('**Reason:** ' . $this->farmer->rejection_reason),
            )
            ->line('Please visit the Municipal Agriculture Office to correct your registration.')
            ->salutation('GeoFarm-IS — Farmer Information & Management System');
    }
}
