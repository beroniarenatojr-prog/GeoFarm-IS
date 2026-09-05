/**
 * The two identifiers the registry writes in a fixed shape.
 *
 * These mirror App\Models\Farmer's RSBSA_REGEX and MOBILE_REGEX. The server is
 * the authority — these exist so a clerk is not made to type punctuation by
 * hand and then told off for getting it wrong.
 */

export const RSBSA_MASK = '00-00-00-000-000000';
export const MOBILE_MASK = '09000000000';

/** Digits per group: region, province, municipality, barangay, sequence. */
const RSBSA_GROUPS = [2, 2, 2, 3, 6];
const RSBSA_DIGITS = RSBSA_GROUPS.reduce((a, b) => a + b, 0);   // 15

/**
 * Digit counts a hyphen follows: 2, 4, 6, 9. The 15th is the end of the
 * number, so nothing trails it.
 */
const RSBSA_BREAKS = RSBSA_GROUPS.reduce(
    (acc, size) => [...acc, acc[acc.length - 1] + size],
    [0],
).slice(1, -1);

const atBreak = (count) => count > 0 && RSBSA_BREAKS.includes(count);

export const isValidRsbsa = (value) => /^\d{2}-\d{2}-\d{2}-\d{3}-\d{6}$/.test(value ?? '');
export const isValidMobile = (value) => /^09\d{9}$/.test(value ?? '');

/**
 * Reshapes whatever was typed into 00-00-00-000-000000.
 *
 * Everything that is not a digit is dropped first, so pasting a number that
 * already carries hyphens, spaces or stray dots still lands correctly. The
 * hyphen appears the moment a group is filled, so the clerk types only digits
 * and the next one lands after the separator.
 *
 * Pass `deleting` (from the input event) when the edit was a backspace. A
 * trailing separator is otherwise impossible to remove: the key deletes the
 * hyphen, this function puts it straight back, and backspace looks broken.
 */
export function formatRsbsa(value, { deleting = false } = {}) {
    const raw = String(value ?? '');
    let digits = raw.replace(/\D/g, '').slice(0, RSBSA_DIGITS);
    if (!digits) return '';

    // Backspace over an auto-inserted hyphen: the hyphen is gone from `raw`
    // but the digits are untouched, so take the digit in front of it instead.
    if (deleting && !/\D$/.test(raw) && atBreak(digits.length)) {
        digits = digits.slice(0, -1);
        if (!digits) return '';
    }

    const parts = [];
    let at = 0;
    for (const size of RSBSA_GROUPS) {
        if (at >= digits.length) break;
        parts.push(digits.slice(at, at + size));
        at += size;
    }

    let out = parts.join('-');

    // Offer the next separator while typing forward, never while deleting.
    if (!deleting && atBreak(digits.length)) out += '-';

    return out;
}

/**
 * Keeps a mobile number as 09XXXXXXXXX.
 *
 * Numbers get written locally as 09xx, internationally as +639xx, and pasted
 * from spreadsheets with spaces in them. All three land on the same 11 digits.
 */
export function formatMobile(value) {
    let digits = String(value ?? '').replace(/\D/g, '');

    // +63 9xx xxx xxxx and 63 9xx … both mean 09xx …
    if (digits.startsWith('63') && digits.length > 10) digits = '0' + digits.slice(2);
    // A number typed without its leading zero.
    else if (digits.startsWith('9') && digits.length >= 10) digits = '0' + digits;

    return digits.slice(0, 11);
}
