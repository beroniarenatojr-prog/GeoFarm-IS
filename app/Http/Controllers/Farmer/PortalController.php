<?php

namespace App\Http\Controllers\Farmer;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\FarmerMessage;
use App\Models\FinancialAssistance;
use App\Models\Recommendation;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * The farmer's own screens on the mobile portal.
 *
 * Three destinations that the bottom navigation needs and the portal did not
 * have: their land, their assistance, and their advisories. None of this is new
 * business logic — every figure comes from the same tables and the same rules
 * the office screens use. What is new is only that a farmer can reach their own
 * copy of it on a phone.
 *
 * The farmer is resolved from the signed-in account on every action and never
 * from the URL, following the convention the rest of this namespace sets: with
 * an id in the path the ownership check becomes a thing that can be forgotten,
 * and forgetting it once would hand one farmer another's records.
 */
class PortalController extends Controller
{
    /** The signed-in account's own farmer record, or a 404. */
    private function farmer(Request $request): Farmer
    {
        return Farmer::where('user_id', $request->user()->id)->firstOrFail();
    }

    /**
     * My Farms — the parcels this farmer holds, with their boundaries.
     *
     * Read-only. The portal shows a farmer where their land is; it does not let
     * them redraw it, because boundaries are surveyed by the office and a
     * farmer editing their own area is the whole reason the register would stop
     * being trustworthy.
     */
    public function farms(Request $request)
    {
        $farmer = $this->farmer($request);

        $parcels = $farmer->parcels()
            ->with('farmType:id,type_name')
            ->orderBy('parcel_number')
            ->get();

        $mapped = $parcels->filter(fn ($p) => filled($p->geojson_data));

        return Inertia::render('Farmer/Farms', [
            'farmer' => [
                'name'     => $farmer->full_name,
                'barangay' => $farmer->barangay,
            ],
            'parcels' => $parcels->map(fn ($parcel) => [
                'id'            => $parcel->id,
                'parcel_number' => $parcel->parcel_number,
                'barangay'      => $parcel->barangay,
                'location'      => $parcel->location_address,
                'area_ha'       => (float) $parcel->total_area_ha,
                'commodity'     => $parcel->commodity,
                'farm_type'     => $parcel->farmType?->type_name,
                'ownership'     => $parcel->ownership_type,
                'is_organic'    => (bool) $parcel->is_organic,
                'heads_trees'   => $parcel->no_of_heads_trees,
                // Whether the office has surveyed it. A parcel without a
                // boundary is a real and common state, and saying so is better
                // than a map that silently shows fewer parcels than the list.
                'is_mapped'     => filled($parcel->geojson_data),
            ])->values(),

            'summary' => [
                'count'      => $parcels->count(),
                'mapped'     => $mapped->count(),
                'total_area' => round((float) $parcels->sum('total_area_ha'), 4),
                'commodities' => $parcels->pluck('commodity')->filter()->unique()->values()->all(),
            ],

            /*
             * Their own parcels only.
             *
             * Deliberately NOT the admin GIS endpoint, which returns every
             * parcel in the municipality — that is the whole difference between
             * this screen and that one.
             */
            'parcelGeoJson' => $this->ownParcelsAsGeoJson($mapped),
        ]);
    }

    /** The farmer's mapped parcels as a FeatureCollection. */
    private function ownParcelsAsGeoJson($parcels): array
    {
        $features = [];

        foreach ($parcels as $parcel) {
            $geometry = json_decode((string) $parcel->geojson_data, true);

            // A malformed outline is skipped rather than breaking the screen;
            // the parcel still appears in the list underneath the map.
            if (! is_array($geometry) || ! isset($geometry['type'])) {
                continue;
            }

            $features[] = [
                'type'       => 'Feature',
                'geometry'   => $geometry,
                'properties' => [
                    'id'            => $parcel->id,
                    'parcel_number' => $parcel->parcel_number ?? 'Parcel',
                    'barangay'      => $parcel->barangay,
                    'area_ha'       => $parcel->total_area_ha,
                    'commodity'     => $parcel->commodity,
                ],
            ];
        }

        return ['type' => 'FeatureCollection', 'features' => $features];
    }

    /**
     * Assistance — what this farmer has received, and what is running.
     *
     * Two separate lists, kept separate on purpose. Their own distributions are
     * fact. The programmes list is information about what the office is
     * running, and it carries no promise: a farmer seeing a programme here has
     * not been assigned to it, and nothing on this screen can assign them.
     * Eligibility is decided at the office, on the Manage Beneficiaries screen,
     * by staff who hold "edit assistance".
     */
    public function assistance(Request $request)
    {
        $farmer = $this->farmer($request);

        $distributions = $farmer->distributions()
            ->with([
                'program:id,program_name,assistance_type_id,start_date,end_date,status',
                'program.assistanceType:id,type_name,distribution_type',
                'itemIssues.item:id,item_name,unit',
            ])
            ->orderByDesc('distribution_date')
            ->get();

        /*
         * Programmes the farmer could be considered for: running now, and
         * either municipality-wide or covering a barangay they are in.
         *
         * This mirrors the office's own targeting rule rather than inventing a
         * second one — a programme with no barangays covers everyone, and a
         * farmer qualifies on their own barangay or any barangay they hold land
         * in, because someone may live in one and farm in another.
         */
        $areas = collect([$farmer->barangay])
            ->merge($farmer->parcels()->pluck('barangay'))
            ->filter()
            ->map(fn ($name) => mb_strtolower(trim($name)))
            ->unique();

        $programs = FinancialAssistance::query()
            ->with(['assistanceType:id,type_name,distribution_type', 'barangays:id,name'])
            // Draft and cancelled programmes are not announcements; a farmer
            // must not read a draft as something they can turn up for.
            ->where('status', 'active')
            ->orderByDesc('start_date')
            ->get()
            ->filter(function (FinancialAssistance $program) use ($areas) {
                $targets = $program->barangays->pluck('name')
                    ->filter()->map(fn ($n) => mb_strtolower(trim($n)));

                return $targets->isEmpty() || $targets->intersect($areas)->isNotEmpty();
            })
            ->map(fn (FinancialAssistance $program) => [
                'id'           => $program->id,
                'program_name' => $program->program_name,
                'type'         => $program->assistanceType?->type_name,
                'start_date'   => $program->start_date?->toDateString(),
                'end_date'     => $program->end_date?->toDateString(),
                'barangays'    => $program->barangays->pluck('name')->values()->all(),
                /*
                 * What one beneficiary receives, where the office set a figure.
                 * The total budget is NOT sent: it is the office's planning
                 * figure, not a farmer's entitlement, and showing it invites it
                 * to be read as money owed.
                 */
                'standard_cash_amount' => $program->standard_cash_amount,
                // Whether this farmer is already on it, from their own records.
                'already_on'   => $distributions
                    ->where('assistance_id', $program->id)
                    ->where('status', '!=', 'forfeited')
                    ->isNotEmpty(),
            ])
            ->values();

        return Inertia::render('Farmer/Assistance', [
            'distributions' => $distributions->map(fn ($d) => [
                'id'             => $d->id,
                'program_name'   => $d->program?->program_name ?? 'Programme no longer on file',
                'type'           => $d->program?->assistanceType?->type_name,
                'date'           => $d->distribution_date?->toDateString(),
                'status'         => $d->status,
                'amount_given'   => $d->amount_given,
                'quantity_given' => $d->quantity_given,
                'reference_no'   => $d->reference_no,
                'items'          => $d->itemIssues->map(fn ($i) => [
                    'item_name' => $i->item?->item_name,
                    'unit'      => $i->item?->unit,
                    'quantity'  => (float) $i->quantity,
                ])->values(),
            ])->values(),

            'summary' => [
                // Forfeited excluded from what they have received, for the same
                // reason the office excludes it: the goods went back.
                'received'   => $distributions->where('status', 'claimed')->count(),
                'awaiting'   => $distributions->where('status', 'pending')->count(),
                'forfeited'  => $distributions->where('status', 'forfeited')->count(),
                'cash_total' => round(
                    (float) $distributions->where('status', 'claimed')->sum('amount_given'),
                    2,
                ),
            ],

            'programs' => $programs,
        ]);
    }

    /**
     * Advisory — the advice raised for this farmer, and letters from the office.
     *
     * Both are real records. The recommendations come from the same engine the
     * office reads, scoped to this farmer; the messages are what staff actually
     * wrote to them. There is no announcements board here because the system
     * has no table for one, and a screen that invented notices would be worse
     * than a screen that has none.
     */
    public function advisory(Request $request)
    {
        $farmer = $this->farmer($request);

        $recommendations = Recommendation::forFarmer($farmer->id)
            ->with([
                'parcel:id,parcel_number,barangay,commodity',
                'fishpond:id,name',
            ])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return Inertia::render('Farmer/Advisory', [
            'advisories' => $recommendations->map(fn (Recommendation $r) => [
                'id'        => $r->id,
                'title'     => $r->title,
                // 'reason' is the body on this table: why the advice was
                // raised and what to do about it. There is no 'detail' column.
                'reason'    => $r->reason,
                'category'  => $r->category,
                'priority'  => $r->priority,
                'status'    => $r->status,
                'raised_on' => $r->created_at?->toDateString(),
                // Which holding the advice is about, when it is about one.
                'about'     => $r->parcel?->parcel_number
                    ?? $r->fishpond?->name
                    ?? null,
                'commodity' => $r->parcel?->commodity,
            ])->values(),

            'messages' => FarmerMessage::where('farmer_id', $farmer->id)
                ->with('sender:id,name')
                ->orderByDesc('created_at')
                ->limit(30)
                ->get()
                ->map(fn (FarmerMessage $m) => [
                    'id'      => $m->id,
                    'subject' => $m->subject,
                    'body'    => $m->body,
                    'from'    => $m->sender?->name ?? 'Agriculture Office',
                    'sent_on' => $m->created_at?->toDateString(),
                ])->values(),

            'assessment' => $farmer->latestRiskAssessment ? [
                'assessed_on' => $farmer->latestRiskAssessment->created_at?->toDateString(),
            ] : null,
        ]);
    }

    /**
     * Profile — the farmer's own record as the office holds it.
     *
     * Read-only, and deliberately so. A farmer correcting their own RSBSA
     * number or verification status would defeat the verification step
     * entirely, so this screen shows what is on file and says where to go to
     * have it changed.
     */
    public function profile(Request $request)
    {
        $farmer = $this->farmer($request);

        return Inertia::render('Farmer/Profile', [
            'farmer' => [
                'name'       => $farmer->full_name,
                'first_name' => $farmer->first_name,
                'last_name'  => $farmer->last_name,
                'rsbsa_no'   => $farmer->rsbsa_no,
                'birthdate'  => $farmer->birthdate?->toDateString(),
                'sex'        => $farmer->sex,
                'civil_status' => $farmer->civil_status,
                'barangay'   => $farmer->barangay,
                'street_sitio'  => $farmer->street_sitio,
                'municipality'  => $farmer->city_municipality,
                'province'      => $farmer->province,
                'mobile_no'  => $farmer->mobile_no,
                'email'      => $farmer->email,
                'livelihood_type' => $farmer->livelihood_type,
                'is_4ps'          => (bool) $farmer->is_4ps,
                'is_indigenous'   => (bool) $farmer->is_indigenous,
                'pwd'             => (bool) $farmer->pwd,

                'verification_status' => $farmer->verification_status,
                'reference_code'      => $farmer->reference_code,
                'submitted_online_at' => $farmer->submitted_online_at?->toDateString(),
            ],

            /*
             * The signed-in account, so they can see which login they are on.
             * No password, no session identifier and no token: nothing here is
             * a credential.
             */
            'account' => [
                'name'  => $request->user()->name,
                'email' => $request->user()->email,
            ],

            'household' => $farmer->children()->orderBy('name')->get()
                ->map(fn ($child) => [
                    'name'       => $child->name,
                    'birthdate'  => $child->birthdate?->toDateString(),
                    'occupation' => $child->occupation_label ?? $child->occupation,
                    'location'   => $child->current_location,
                ])->values(),
        ]);
    }
}
