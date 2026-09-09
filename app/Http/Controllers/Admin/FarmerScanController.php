<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use Illuminate\Http\Request;

/**
 * Turns a scanned ID card into the farmer it belongs to.
 *
 * The QR on the back of the card holds the farmer's own page — the URL that
 * FarmerController writes with QrCode::generate(url("/admin/farmers/{id}")).
 * At a distribution counter that is faster and far safer than typing a name
 * with a queue waiting: no spelling, no picking the wrong Dela Cruz.
 *
 * The parsing lives here rather than in the browser so it sits beside the code
 * that writes the QR. If the card format ever changes, both ends change in one
 * place, and a scanner pointed at some other QR is refused by the server
 * rather than by a regular expression in a bundle nobody re-reads.
 *
 * It reads the id and nothing else. The card carries no credentials, and
 * scanning one grants no access — the staff member is already signed in and
 * already holds "view farmers"; this only saves them the typing.
 */
class FarmerScanController extends Controller
{
    public function __invoke(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:2048',
        ]);

        $id = $this->farmerIdFrom($data['code']);

        if ($id === null) {
            return response()->json([
                'message' => 'That does not look like a GeoFarm-IS farmer ID card.',
            ], 422);
        }

        $farmer = Farmer::find($id);

        if (! $farmer) {
            // A card for a record since deleted. Saying so is better than an
            // empty box that looks like the scanner misfired.
            return response()->json([
                'message' => 'That card is for a farmer who is no longer on the register.',
            ], 404);
        }

        /*
         * An unverified farmer is refused unless the caller says otherwise,
         * matching the type-ahead. A card should not exist for one — the ID
         * card route issues them only to verified farmers — but a scan must
         * not become the way around that.
         */
        if (! $request->boolean('include_unverified') && ! $farmer->isVerified()) {
            return response()->json([
                'message' => $farmer->full_name . ' is not verified yet, so they cannot be served.',
            ], 422);
        }

        return response()->json($this->asOption($farmer));
    }

    /**
     * The farmer id inside a scanned card, or null if this is not one of ours.
     *
     * Accepts the full URL the card carries, and a bare id, which is what a
     * scanner configured to strip the prefix sends. Anything else — a product
     * barcode, a link to another site — returns null.
     */
    private function farmerIdFrom(string $code): ?int
    {
        $code = trim($code);

        if (ctype_digit($code)) {
            return (int) $code;
        }

        /*
         * The path this application writes, wherever it is hosted: the domain
         * differs between the office's server and a laptop, and a card printed
         * under one must still scan under the other.
         *
         * Delimited with ~ deliberately. With # as the delimiter, the # inside
         * the character class ends the pattern early — PCRE then reads "]|$)"
         * as modifiers, preg_match fails, and Laravel turns that warning into
         * a 500 on every scan.
         */
        if (preg_match('~/admin/farmers/(\d+)(?:[/?\#]|$)~', $code, $found)) {
            return (int) $found[1];
        }

        return null;
    }

    /** The same shape the type-ahead returns, so the picker needs no new path. */
    private function asOption(Farmer $farmer): array
    {
        return [
            'id'    => $farmer->id,
            'label' => trim(collect([$farmer->last_name, $farmer->first_name])->filter()->implode(', ')
                . ($farmer->suffix ? " {$farmer->suffix}" : '')),
            'meta'  => collect([
                $farmer->rsbsa_no ? "RSBSA {$farmer->rsbsa_no}" : ($farmer->reference_code ? "Ref {$farmer->reference_code}" : null),
                $farmer->barangay,
                $farmer->mobile_no,
            ])->filter()->implode(' · '),
            'verified' => $farmer->isVerified(),
        ];
    }
}
