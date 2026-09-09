<?php

namespace Tests\Feature;

use App\Models\AssistanceType;
use App\Models\Barangay;
use App\Models\FinancialAssistance;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Choosing an assistance type and the barangays a programme runs in.
 *
 * Both fields are typed rather than picked from a list now, which puts the
 * weight on two server-side rules: a type typed a second time in different
 * capitals must not become a second type, and what a programme targets must be
 * stored as barangay ids on the pivot rather than as names.
 */
class AssistanceProgramFormTest extends TestCase
{
    use RefreshDatabase;

    private ?User $staff = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function staff(): User
    {
        return $this->staff ??= tap(User::create([
            'name'      => 'Programme Officer',
            'email'     => 'officer@example.test',
            'password'  => bcrypt('secret-for-test-only'),
            'is_active' => true,
        ]), fn (User $user) => $user->assignRole('Admin'));
    }

    /** @return array<string, string> the barangay name => id */
    private function barangays(array $names): array
    {
        $made = [];

        foreach ($names as $name) {
            $made[$name] = Barangay::create([
                'name'         => $name,
                'municipality' => 'Tumauini',
                'province'     => 'Isabela',
                'is_active'    => true,
            ])->id;
        }

        return $made;
    }

    private function submit(array $overrides = [])
    {
        return $this->actingAs($this->staff())->post(route('admin.assistance.store'), array_merge([
            'program_name'  => 'Rice Input Support',
            'total_budget'  => 500000,
            'start_date'    => '2026-01-01',
            'end_date'      => '2026-12-31',
        ], $overrides));
    }

    // ------------------------------------------------------ assistance type

    public function test_an_existing_type_is_saved_by_its_id(): void
    {
        $type = AssistanceType::create([
            'type_name'         => 'Seed Distribution',
            'category'          => 'Production Inputs',
            'distribution_type' => 'material',
        ]);

        $this->submit(['assistance_type_id' => $type->id])->assertSessionHasNoErrors();

        $this->assertSame(
            $type->id,
            FinancialAssistance::firstOrFail()->assistance_type_id,
            'the programme must reference the type, not carry its label',
        );
        $this->assertSame(1, AssistanceType::count(), 'nothing new should have been created');
    }

    public function test_a_new_type_is_created_and_its_id_used(): void
    {
        $this->submit([
            'assistance_type_id'     => '__other__',
            'new_type_name'          => 'Fuel Subsidy',
            'new_type_distribution'  => 'financial',
        ])->assertSessionHasNoErrors();

        $type = AssistanceType::whereRaw('LOWER(type_name) = ?', ['fuel subsidy'])->firstOrFail();

        $this->assertSame('financial', $type->distribution_type);
        $this->assertSame($type->id, FinancialAssistance::firstOrFail()->assistance_type_id);
    }

    public function test_the_same_type_typed_differently_does_not_become_a_second_one(): void
    {
        /*
         * The case the field exists to prevent. Every assistance report groups
         * by this list, so "Fuel Subsidy" sitting beside "fuel subsidy" splits
         * one programme's figures across two headings.
         */
        foreach (['Fuel Subsidy', 'fuel subsidy', '  FUEL   SUBSIDY  '] as $index => $typed) {
            $this->submit([
                'program_name'          => "Programme {$index}",
                'assistance_type_id'    => '__other__',
                'new_type_name'         => $typed,
                'new_type_distribution' => 'financial',
            ])->assertSessionHasNoErrors();
        }

        $this->assertSame(1, AssistanceType::count());
        // The first spelling wins rather than being rewritten by whoever
        // typed it last.
        $this->assertSame('Fuel Subsidy', AssistanceType::firstOrFail()->type_name);

        // All three programmes point at the one type.
        $this->assertSame(
            [AssistanceType::firstOrFail()->id],
            FinancialAssistance::pluck('assistance_type_id')->unique()->values()->all(),
        );
    }

    public function test_a_new_type_without_a_name_is_rejected(): void
    {
        $this->submit([
            'assistance_type_id'    => '__other__',
            'new_type_distribution' => 'material',
        ])->assertSessionHasErrors('new_type_name');

        $this->assertSame(0, FinancialAssistance::count());
    }

    public function test_a_new_type_needs_to_say_what_it_hands_out(): void
    {
        // It decides whether the programme gets an item list to deduct stock
        // from, so it cannot be guessed.
        $this->submit([
            'assistance_type_id' => '__other__',
            'new_type_name'      => 'Fishery Support',
        ])->assertSessionHasErrors('new_type_distribution');
    }

    public function test_a_missing_type_is_rejected(): void
    {
        $this->submit()->assertSessionHasErrors('assistance_type_id');

        $this->assertSame(0, FinancialAssistance::count());
    }

    public function test_a_type_that_does_not_exist_is_rejected(): void
    {
        $this->submit(['assistance_type_id' => 99999])
            ->assertSessionHasErrors('assistance_type_id');
    }

    // --------------------------------------------------------- barangays

    private function typedProgramme(array $overrides = [])
    {
        $type = AssistanceType::create([
            'type_name'         => 'Seed Distribution',
            'category'          => 'Production Inputs',
            'distribution_type' => 'material',
        ]);

        return $this->submit(['assistance_type_id' => $type->id] + $overrides);
    }

    public function test_several_barangays_are_stored_as_ids_on_the_pivot(): void
    {
        $ids = $this->barangays(['Annafunan', 'Caligayan', 'Ugad']);

        $this->typedProgramme(['barangay_ids' => [$ids['Annafunan'], $ids['Ugad']]])
            ->assertSessionHasNoErrors();

        $programme = FinancialAssistance::with('barangays')->firstOrFail();

        $this->assertEqualsCanonicalizing(
            [$ids['Annafunan'], $ids['Ugad']],
            $programme->barangays->pluck('id')->all(),
        );
        // Names are read through the relationship, never copied onto the row.
        $this->assertEqualsCanonicalizing(
            ['Annafunan', 'Ugad'],
            $programme->barangays->pluck('name')->all(),
        );
    }

    public function test_selecting_every_barangay_stores_every_id(): void
    {
        $ids = $this->barangays(['Annafunan', 'Caligayan', 'Ugad', 'Pilitan']);

        $this->typedProgramme(['barangay_ids' => array_values($ids)])->assertSessionHasNoErrors();

        $this->assertCount(4, FinancialAssistance::firstOrFail()->barangays);
    }

    public function test_removing_one_barangay_leaves_the_others(): void
    {
        $ids = $this->barangays(['Annafunan', 'Caligayan', 'Ugad']);

        $this->typedProgramme(['barangay_ids' => array_values($ids)]);
        $programme = FinancialAssistance::firstOrFail();

        // What the form sends after a chip is removed: the remaining ids.
        $this->actingAs($this->staff())
            ->put(route('admin.assistance.update', $programme), [
                'program_name'       => $programme->program_name,
                'assistance_type_id' => $programme->assistance_type_id,
                'total_budget'       => $programme->total_budget,
                'start_date'         => '2026-01-01',
                'end_date'           => '2026-12-31',
                'barangay_ids'       => [$ids['Annafunan'], $ids['Ugad']],
            ])
            ->assertSessionHasNoErrors();

        $this->assertEqualsCanonicalizing(
            [$ids['Annafunan'], $ids['Ugad']],
            $programme->fresh()->barangays->pluck('id')->all(),
        );
    }

    public function test_no_barangay_means_the_whole_municipality(): void
    {
        // The existing rule: an empty target list is not an error, it means the
        // programme is not restricted.
        $this->typedProgramme(['barangay_ids' => []])->assertSessionHasNoErrors();

        $this->assertCount(0, FinancialAssistance::firstOrFail()->barangays);
    }

    public function test_a_barangay_that_does_not_exist_is_rejected(): void
    {
        $this->typedProgramme(['barangay_ids' => [99999]])
            ->assertSessionHasErrors('barangay_ids.0');

        $this->assertSame(0, FinancialAssistance::count());
    }
}
