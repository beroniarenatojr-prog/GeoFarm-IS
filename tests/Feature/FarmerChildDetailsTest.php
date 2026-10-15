<?php

namespace Tests\Feature;

use App\Models\Farmer;
use App\Models\FarmerChild;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Occupation and current location on a child record.
 *
 * Everything goes through Farmer::childrenFrom, which is where all three save
 * paths converge — the admin create, the admin update and the public
 * registration — so testing it directly covers them all.
 *
 * The cases that matter are the ones where a value should NOT be stored as
 * typed: an occupation outside the list, and "Other" text left behind after
 * the dropdown moved off Other.
 */
class FarmerChildDetailsTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<int, array<string, mixed>> */
    private function parse(array $rows): array
    {
        return Farmer::childrenFrom(json_encode($rows));
    }

    public function test_a_child_can_be_recorded_with_an_occupation_and_a_location(): void
    {
        $children = $this->parse([[
            'name'             => 'Ana Dela Cruz',
            'sex'              => 'Female',
            'birthdate'        => '2005-04-12',
            'occupation'       => 'Student',
            'current_location' => 'San Vicente, Tumauini, Isabela',
        ]]);

        $this->assertCount(1, $children);
        $this->assertSame('Student', $children[0]['occupation']);
        $this->assertSame('San Vicente, Tumauini, Isabela', $children[0]['current_location']);
        $this->assertNull($children[0]['occupation_other'], 'nothing to specify unless Other');
    }

    public function test_other_keeps_what_was_typed(): void
    {
        $children = $this->parse([[
            'name'             => 'Mario Dela Cruz',
            'occupation'       => 'Other',
            'occupation_other' => 'Tricycle driver',
        ]]);

        $this->assertSame('Other', $children[0]['occupation']);
        $this->assertSame('Tricycle driver', $children[0]['occupation_other']);
    }

    public function test_other_with_nothing_typed_is_still_recorded_as_other(): void
    {
        /*
         * Not rejected. "Other" alone says the livelihood is not in the list,
         * which is real information — and failing here would take a whole
         * farmer registration down over one optional detail on one child.
         */
        $children = $this->parse([[
            'name'       => 'Unspecified Work',
            'occupation' => 'Other',
        ]]);

        $this->assertSame('Other', $children[0]['occupation']);
        $this->assertNull($children[0]['occupation_other']);
    }

    public function test_stale_other_text_is_discarded_when_the_dropdown_moved_on(): void
    {
        /*
         * Someone types a trade, then changes the dropdown to Student. Keeping
         * the text would leave the record contradicting its own selection.
         */
        $children = $this->parse([[
            'name'             => 'Changed Mind',
            'occupation'       => 'Student',
            'occupation_other' => 'Tricycle driver',
        ]]);

        $this->assertSame('Student', $children[0]['occupation']);
        $this->assertNull($children[0]['occupation_other']);
    }

    public function test_an_occupation_outside_the_list_is_refused(): void
    {
        // Only a crafted request can produce this: the dropdown cannot offer it.
        $children = $this->parse([[
            'name'       => 'Crafted Request',
            'occupation' => 'Pirate',
        ]]);

        $this->assertNull($children[0]['occupation'], 'an unlisted occupation is not stored as typed');
        $this->assertSame('Crafted Request', $children[0]['name'], 'but the child is still recorded');
    }

    public function test_both_new_fields_may_be_left_blank(): void
    {
        $children = $this->parse([[
            'name' => 'Only A Name',
            'sex'  => 'Male',
        ]]);

        $this->assertCount(1, $children, 'a child with neither field is still a child');
        $this->assertNull($children[0]['occupation']);
        $this->assertNull($children[0]['current_location']);
    }

    public function test_each_child_keeps_its_own_details(): void
    {
        $children = $this->parse([
            ['name' => 'First', 'occupation' => 'Student', 'current_location' => 'Tumauini'],
            ['name' => 'Second', 'occupation' => 'Overseas Filipino Worker (OFW)', 'current_location' => 'Riyadh, Saudi Arabia'],
            ['name' => 'Third', 'occupation' => 'Other', 'occupation_other' => 'Fisherman'],
        ]);

        $this->assertCount(3, $children);
        $this->assertSame('Student', $children[0]['occupation']);
        $this->assertSame('Riyadh, Saudi Arabia', $children[1]['current_location'], 'a child abroad fits');
        $this->assertSame('Fisherman', $children[2]['occupation_other']);

        // Nothing has leaked between rows.
        $this->assertNull($children[0]['occupation_other']);
        $this->assertNull($children[2]['current_location']);
    }

    public function test_a_nameless_row_is_still_dropped(): void
    {
        $children = $this->parse([
            ['name' => '', 'occupation' => 'Student', 'current_location' => 'Tumauini'],
            ['name' => 'Real Child'],
        ]);

        $this->assertCount(1, $children, 'the new fields do not rescue a row with no name');
        $this->assertSame('Real Child', $children[0]['name']);
    }

    // ── Storage and read-back ─────────────────────────────────────────────

    public function test_the_details_survive_a_save_and_reload(): void
    {
        $farmer = Farmer::create([
            'first_name' => 'Juan', 'last_name' => 'Dela Cruz',
            'sex' => 'Male', 'barangay' => 'Caligayan',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        foreach ($this->parse([
            ['name' => 'Ana', 'occupation' => 'Student', 'current_location' => 'Tumauini, Isabela'],
            ['name' => 'Mario', 'occupation' => 'Other', 'occupation_other' => 'Tricycle driver'],
        ]) as $child) {
            $farmer->children()->create($child);
        }

        $reloaded = $farmer->fresh('children');

        $this->assertSame('Student', $reloaded->children[0]->occupation);
        $this->assertSame('Tumauini, Isabela', $reloaded->children[0]->current_location);
        $this->assertSame('Tricycle driver', $reloaded->children[1]->occupation_other);
    }

    public function test_a_child_recorded_before_these_fields_existed_still_works(): void
    {
        $farmer = Farmer::create([
            'first_name' => 'Maria', 'last_name' => 'Santos',
            'sex' => 'Female', 'barangay' => 'Antagan I',
            'verification_status' => Farmer::STATUS_VERIFIED,
        ]);

        // Exactly what an old row looks like: name, sex, birthdate, nothing else.
        $child = $farmer->children()->create([
            'name' => 'Legacy Child', 'sex' => 'Male', 'birthdate' => '2001-01-01',
        ]);

        $this->assertNull($child->fresh()->occupation);
        $this->assertNull($child->fresh()->current_location);
        $this->assertSame('Legacy Child', $child->fresh()->name);
    }

    public function test_the_occupation_label_resolves_other(): void
    {
        $plain = new FarmerChild(['occupation' => 'Student']);
        $this->assertSame('Student', $plain->occupation_label);

        $other = new FarmerChild(['occupation' => 'Other', 'occupation_other' => 'Tricycle driver']);
        $this->assertSame('Tricycle driver', $other->occupation_label, 'never shows "Other" bare');

        $bare = new FarmerChild(['occupation' => 'Other']);
        $this->assertSame('Other', $bare->occupation_label);

        $none = new FarmerChild([]);
        $this->assertNull($none->occupation_label);
    }

    public function test_the_form_and_the_model_offer_the_same_occupations(): void
    {
        /*
         * The dropdown in FormRSBSA.jsx is validated against this list. A value
         * only in the form would be discarded on save, silently, and the office
         * would watch its selection vanish with no explanation.
         */
        $form = file_get_contents(resource_path('js/Pages/Admin/Farmers/FormRSBSA.jsx'));

        foreach (FarmerChild::OCCUPATIONS as $occupation) {
            $this->assertStringContainsString(
                "'{$occupation}'",
                $form,
                "the form is missing the occupation \"{$occupation}\"",
            );
        }
    }
}
