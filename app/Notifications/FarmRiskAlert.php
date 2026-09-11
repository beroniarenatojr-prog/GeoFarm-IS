<?php

namespace App\Notifications;

use App\Models\Farmer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Telling a farmer what the analysis found on their own land.
 *
 * Every line is drawn from the analysis that produced it — the level, the
 * factor that raised it, and the office's configured wording for what to do.
 * Nothing here composes a claim of its own, which is why the constructor takes
 * finished values rather than a farm to interpret: an email that reasoned
 * independently could tell a farmer something the screen never said.
 *
 * The controller refuses to send one when no factor was raised, so there is no
 * such thing as an alert about a risk nobody identified.
 *
 * The recipient is resolved from the farmer's record, never from a request.
 */
class FarmRiskAlert extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  string  $level     'high', 'moderate' or 'low'
     * @param  string  $concern   the heaviest factor's own label
     * @param  array<int, string>  $actions  the office's configured advice
     */
    public function __construct(
        private readonly Farmer $farmer,
        private readonly string $level,
        private readonly string $period,
        private readonly ?string $parcel,
        private readonly string $concern,
        private readonly array $actions,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(?object $notifiable = null): MailMessage
    {
        $name = trim($this->farmer->full_name);

        $heading = match ($this->level) {
            'high'     => 'Elevated risk identified on your farm',
            'moderate' => 'Some risk identified on your farm',
            default    => 'Your farm assessment result',
        };

        $mail = (new MailMessage())
            ->subject("{$heading} — {$this->period}")
            ->greeting($name !== '' ? 'Dear ' . $name : 'Dear farmer')
            ->line("The Municipal Agriculture Office has reviewed the records held for your farm for the coming {$this->period}.");

        if ($this->parcel) {
            $mail->line("Affected: {$this->parcel}");
        }

        $mail->line("Main concern: {$this->concern}");

        if ($this->actions !== []) {
            $mail->line('Recommended actions:');

            foreach ($this->actions as $i => $action) {
                $mail->line(($i + 1) . '. ' . $action);
            }
        }

        /*
         * Said plainly, and last.
         *
         * A farmer who reads an official email about "risk" may reasonably
         * take it for a prediction of what will happen. It is not one, and the
         * message that omitted this would be the message that misled.
         */
        return $mail
            ->line('This is a review of your recorded farm data and your own assessment answers. It is not a prediction of what will happen, and the suggestions above are general guidance rather than a technical prescription.')
            ->line('Please coordinate with the Municipal Agriculture Office of Tumauini for assistance appropriate to your farm.')
            ->salutation('Municipal Agriculture Office, Tumauini, Isabela');
    }
}
