/**
 * Reading the climate risk instrument back into words.
 *
 * The questionnaire stores keys — flood_frequency: "very_frequently" — not
 * prose. The label a farmer sees is display text that gets reworded (it was
 * translated into Tagalog this week) while the key is what the score was
 * computed from, so turning one back into English happens at the point of
 * display rather than being written into the column.
 *
 * One copy, shared by the farmer profile's Risk tab and the farm analysis
 * page. Two copies would be free to drift, and then the same answer would read
 * differently on two screens about the same farmer.
 */

/** "very_frequently" → "Very frequently". Null for anything not a real answer. */
export const readable = (key) =>
    typeof key !== 'string' || key === ''
        ? null
        : key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** A multi-answer question, or null when nothing was ticked. */
export const readableList = (keys) =>
    Array.isArray(keys) && keys.length ? keys.map(readable).join(', ') : null;

/** Null rather than ₱0, so an unanswered amount renders as "Not provided". */
export const peso = (value) =>
    value === null || value === undefined || value === ''
        ? null
        : `₱${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

/** A date the office would recognise, or null. */
export const onDate = (value) =>
    value
        ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;
