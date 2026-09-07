<?php

namespace App\Notifications;

use App\Models\Farmer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells the office a farmer has registered online and is waiting on review.
 *
 * Mail only. The header bell already reports pending registrations by counting
 * them live, which cannot drift and cannot be duplicated by a page refresh -
 * storing a database notification alongside it would add a second copy of the
 * same fact that has to be kept in step.
 *
 * Queued, so a farmer submitting the form is not left waiting on SMTP. That
 * means nothing sends until a queue worker runs; on shared hosting that is a
 * cron entry, not a daemon.
 */
class FarmerRegistrationSubmitted extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Farmer $farmer)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $where = collect([$this->farmer->barangay, $this->farmer->city_municipality])
            ->filter()
            ->implode(', ');

        return (new MailMessage())
            ->subject('New Farmer Registration Requires Verification')
            ->greeting('Farmer Verification Required')
            ->line('A new farmer registration has been submitted and is waiting for verification.')
            ->line('**Farmer:** ' . $this->farmer->full_name)
            ->when($where !== '', fn (MailMessage $mail) => $mail->line('**Location:** ' . $where))
            ->line('**Registration No.:** ' . ($this->farmer->reference_code ?: $this->farmer->rsbsa_no ?: 'Not yet issued'))
            ->when(
                $this->farmer->submitted_online_at !== null,
                fn (MailMessage $mail) => $mail->line('**Submitted:** ' . $this->farmer->submitted_online_at->format('F j, Y \a\t g:i A')),
            )
            ->action('Open Verification Queue', route('admin.farmer-verification.index'))
            ->line('Please review the registration and verify the farmer\'s information.')
            ->salutation('GeoFarm-IS — Farmer Information & Management System');
    }
}
