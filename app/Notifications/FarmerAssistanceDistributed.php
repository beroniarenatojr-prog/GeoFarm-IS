<?php

namespace App\Notifications;

use App\Models\AssistanceDistribution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells a farmer that the office recorded a hand-out to them.
 *
 * Sent only once the distribution has actually committed. A payout can be
 * rolled back mid-transaction when stock turns out to be short, and telling
 * someone they received seed that never left the store would be worse than
 * telling them nothing.
 *
 * Addressed on demand, like the verification email, because a farmer encoded
 * at the office may have no login account - only an address on their record.
 */
class FarmerAssistanceDistributed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly AssistanceDistribution $distribution,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(?object $notifiable = null): MailMessage
    {
        // The relationship is named program(), not assistance(): the row's
        // foreign key is assistance_id but it points at a programme.
        $programme = $this->distribution->program?->program_name ?: 'a municipal assistance programme';
        $farmer    = $this->distribution->farmer;
        $date      = $this->distribution->distribution_date;

        $mail = (new MailMessage())
            ->subject('Assistance Distribution Recorded')
            ->greeting('Assistance Distribution Recorded')
            ->line(trim(sprintf(
                '%s, the Municipal Agriculture Office has recorded assistance issued to you under "%s".',
                $farmer?->first_name ? 'Dear ' . $farmer->first_name : 'Dear farmer',
                $programme,
            )))
            ->line('**Programme:** ' . $programme);

        if ($date) {
            $mail->line('**Date issued:** ' . $date->format('d M Y'));
        }

        // Programmes hand out goods, cash, or both. Only state what this one
        // actually gave - a zero line reads as an error to the farmer.
        if ((float) $this->distribution->quantity_given > 0) {
            $mail->line('**Quantity:** ' . rtrim(rtrim(number_format((float) $this->distribution->quantity_given, 2), '0'), '.'));
        }

        if ((float) $this->distribution->amount_given > 0) {
            $mail->line('**Amount:** PHP ' . number_format((float) $this->distribution->amount_given, 2));
        }

        $items = $this->distribution->itemIssues
            ->map(fn ($issue) => trim(sprintf(
                '%s — %s %s',
                $issue->item?->item_name ?? 'Item',
                rtrim(rtrim(number_format((float) $issue->quantity, 2), '0'), '.'),
                $issue->item?->unit ?? '',
            )))
            ->all();

        foreach ($items as $line) {
            $mail->line('• ' . $line);
        }

        // "Pending" means the record exists but the farmer has not collected.
        if ($this->distribution->status === 'pending') {
            $mail->line('This hand-out is recorded as **not yet collected**. Please visit the Municipal Agriculture Office to claim it.');
        }

        return $mail
            ->line('If any detail above is wrong, contact the Municipal Agriculture Office of Tumauini, Isabela.')
            ->salutation('GeoFarm-IS — Farmer Information & Management System');
    }
}
