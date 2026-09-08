<?php

namespace App\Observers;

use App\Models\FarmParcel;
use App\Services\CroppingScheduleService;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Keeps a parcel's seasonal records in step with its cropping schedule.
 *
 * On the model rather than in a controller because parcels are created from
 * four places — public registration, the admin RSBSA form, the parcel form and
 * the parcel modal — and a rule enforced in three of them is a rule that
 * quietly does not hold.
 */
class FarmParcelObserver
{
    public function __construct(
        private readonly CroppingScheduleService $schedule,
    ) {
    }

    public function created(FarmParcel $parcel): void
    {
        $this->open($parcel);
    }

    /**
     * A schedule that widens opens the season it gained.
     *
     * Wet corrected to Wet/Dry means the parcel was always worked twice and
     * the office has been recording half of it. Narrowing deletes nothing:
     * a season already encoded holds real production, and a correction to a
     * dropdown is not authority to destroy it.
     */
    public function updated(FarmParcel $parcel): void
    {
        if ($parcel->wasChanged('cropping_schedule')) {
            $this->open($parcel);
        }
    }

    /**
     * Open the seasons, but never at the cost of the parcel itself.
     *
     * This runs inside the save of a farmer or a parcel, so anything thrown
     * here takes that save down with it — and it did: with the seasonal
     * migrations not yet run on a server, every attempt to edit a farmer
     * returned a 500 because a column this writes to did not exist yet.
     *
     * The parcel is the record the office came to enter. A cropping season is
     * a convenience derived from it, and one that `seasons:backfill` can
     * recreate at any time, so a failure here is logged and swallowed rather
     * than handed to a clerk as a server error they cannot act on.
     */
    private function open(FarmParcel $parcel): void
    {
        try {
            $this->schedule->openFor($parcel);
        } catch (Throwable $e) {
            Log::error('Could not open cropping seasons for a parcel.', [
                'parcel_id' => $parcel->id,
                'schedule'  => $parcel->cropping_schedule,
                'error'     => $e->getMessage(),
            ]);
        }
    }
}
