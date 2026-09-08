<?php

namespace App\Observers;

use App\Models\FarmParcel;
use App\Services\CroppingScheduleService;

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
        $this->schedule->openFor($parcel);
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
            $this->schedule->openFor($parcel);
        }
    }
}
