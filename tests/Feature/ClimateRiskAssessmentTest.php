<?php

namespace Tests\Feature;

use App\Models\ClimateRiskAssessment;
use App\Models\Farmer;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The climate and financial risk questionnaire.
 *
 * Nothing here scores anything - that is a later phase. These cover what the
 * instrument must not get wrong: contradictory answers, answers that belong to
 * somebody else's farm, and history quietly overwritten.
 */
class ClimateRiskAssessmentTest extends TestCase
{
    use RefreshDatabase;

    private User $account;
    private Farmer $farmer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        $this->account = User::create([
            'name' => 'Johnny Evangelista', 'email' => 'johnny@example.test',
            'password' => bcrypt('secret-for-test-only'), 'is_active' => true,
        ]);
        $this->account->assignRole('Farmer');

        $this->farmer = Farmer::create([
            'first_name' => 'Johnny', 'last_name' => 'Evangelista',
            'user_id' => $this->account->id,
        ]);
    }

    private function submit(array $answers = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->account)
            ->post('/farmer/risk-assessment', array_merge([
                'flood_frequency' => 'frequently',
                'perceived_risk'  => 'likely',
            ], $answers));
    }

    public function test_a_farmer_can_record_an_assessment(): void
    {
        $this->submit()->assertRedirect('/farmer/dashboard');

        $assessment = ClimateRiskAssessment::firstOrFail();

        $this->assertSame($this->farmer->id, $assessment->farmer_id);
        $this->assertSame('frequently', $assessment->flood_frequency);
        $this->assertSame($this->account->id, $assessment->assessed_by);
    }

    public function test_multi_select_answers_are_stored_as_lists(): void
    {
        $this->submit(['climate_events' => ['flooding', 'drought']]);

        $this->assertSame(['flooding', 'drought'], ClimateRiskAssessment::firstOrFail()->climate_events);
    }

    public function test_none_cannot_be_chosen_alongside_a_real_answer(): void
    {
        // A farmer who selects both has answered two incompatible things, and
        // the row would be unusable for analysis.
        $this->submit(['climate_events' => ['none', 'flooding']])
            ->assertSessionHasErrors('climate_events');

        $this->assertSame(0, ClimateRiskAssessment::count());
    }

    public function test_none_on_its_own_is_accepted(): void
    {
        $this->submit(['climate_events' => ['none']])->assertSessionHasNoErrors();

        $this->assertSame(['none'], ClimateRiskAssessment::firstOrFail()->climate_events);
    }

    public function test_claiming_a_loss_requires_saying_how_much(): void
    {
        $this->submit(['had_financial_loss' => 'yes'])
            ->assertSessionHasErrors('estimated_loss_amount');
    }

    public function test_the_amount_is_ignored_when_no_loss_is_claimed(): void
    {
        // Left over from a farmer who typed a figure then changed the answer:
        // storing it would record a loss they said they did not have.
        $this->submit(['had_financial_loss' => 'no', 'estimated_loss_amount' => 5000])
            ->assertSessionHasNoErrors();

        $this->assertNull(ClimateRiskAssessment::firstOrFail()->estimated_loss_amount);
    }

    public function test_money_cannot_be_negative(): void
    {
        $this->submit(['had_financial_loss' => 'yes', 'estimated_loss_amount' => -1])
            ->assertSessionHasErrors('estimated_loss_amount');
    }

    public function test_at_most_three_anticipated_factors(): void
    {
        $this->submit(['anticipated_factors' => ['flooding', 'drought', 'low_price', 'no_capital']])
            ->assertSessionHasErrors('anticipated_factors');
    }

    public function test_an_answer_outside_the_instrument_is_refused(): void
    {
        $this->submit(['flood_frequency' => 'constantly'])
            ->assertSessionHasErrors('flood_frequency');
    }

    public function test_an_assessment_cannot_be_attached_to_another_farmers_parcel(): void
    {
        $other = Farmer::create(['first_name' => 'Someone', 'last_name' => 'Else']);
        $parcel = $other->parcels()->create(['barangay' => 'San Pedro']);

        $this->submit(['farm_parcel_id' => $parcel->id])
            ->assertSessionHasErrors('farm_parcel_id');
    }

    public function test_reassessing_adds_a_row_and_keeps_the_previous_one(): void
    {
        // The office needs to see how exposure changed, and the research needs
        // the history intact.
        $this->submit(['flood_frequency' => 'rarely']);
        $this->submit(['flood_frequency' => 'very_frequently']);

        $this->assertSame(2, ClimateRiskAssessment::count());
        $this->assertSame('very_frequently', $this->farmer->fresh()->latestRiskAssessment->flood_frequency);
    }

    public function test_a_signed_out_visitor_cannot_submit(): void
    {
        $this->post('/farmer/risk-assessment', ['flood_frequency' => 'never'])
            ->assertRedirect('/login');

        $this->assertSame(0, ClimateRiskAssessment::count());
    }

    public function test_an_assessment_goes_stale_after_a_year(): void
    {
        $fresh = new ClimateRiskAssessment(['assessed_at' => now()->subMonths(2)]);
        $old   = new ClimateRiskAssessment(['assessed_at' => now()->subMonths(14)]);

        $this->assertFalse($fresh->is_stale);
        $this->assertTrue($old->is_stale);
    }
}
