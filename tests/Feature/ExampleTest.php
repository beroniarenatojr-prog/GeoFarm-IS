<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * This previously asserted that "/" redirects to login, which stopped being
     * true when the public landing page was added - leaving the suite red, and
     * a permanently failing test hides the next real one.
     */
    public function test_the_landing_page_is_public(): void
    {
        $response = $this->get('/');

        $response->assertOk();
    }
}
