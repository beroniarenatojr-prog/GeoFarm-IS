/**
 * Every photograph the landing page wants, in one place.
 *
 * HOW TO ADD THE REAL PHOTOS
 * --------------------------
 * 1. Drop the files into  public/images/landing/
 * 2. Set `src` below to the path, e.g. '/images/landing/municipal-hall.jpg'
 *
 * That is the whole job — nothing in the page markup needs touching. Until a
 * `src` is filled in, the slot renders as a labelled blank placeholder that
 * states what belongs there and at what size, so the page is presentable while
 * the office is still gathering the pictures.
 *
 * `src: null` is deliberate rather than a broken path: a missing file would
 * show the browser's torn-image icon and alt text, which looks like a fault.
 *
 * The `label` and `hint` are only ever shown on the placeholder. Once a real
 * photo is in, the visitor sees the photo and `alt` — so `alt` has to describe
 * the actual picture, and is worth revisiting when the files arrive.
 */

export const LANDING_PHOTOS = {
    /* The portrait beside "Why GeoFarm-IS?" — replaces what used to be a plain
       green panel with a map pin in it. */
    office: {
        src: null,
        alt: 'The Municipal Agriculture Office of Tumauini',
        label: 'Municipal Agriculture Office',
        hint: 'Square photo · at least 1000 × 1000',
    },

    /* The wide photograph in the "About Tumauini" band. */
    municipality: {
        src: null,
        alt: 'Farmland in Tumauini, Isabela',
        label: 'Tumauini farmland or the municipal hall',
        hint: 'Landscape · at least 1400 × 900',
    },

    /*
     * The activity gallery. Four slots, because four fills a row on a desktop
     * and stacks into two neat columns on a phone — and because asking the
     * office for four photographs is a request they can actually finish.
     */
    activities: [
        {
            src: null,
            alt: 'Farmers at a seed distribution in Tumauini',
            label: 'Seed or fertiliser distribution',
            hint: 'Landscape · at least 800 × 600',
        },
        {
            src: null,
            alt: 'Agriculture Office staff surveying a farm parcel',
            label: 'Parcel survey or field visit',
            hint: 'Landscape · at least 800 × 600',
        },
        {
            src: null,
            alt: 'A farmers training session at the Agriculture Office',
            label: 'Farmer training or seminar',
            hint: 'Landscape · at least 800 × 600',
        },
        {
            src: null,
            alt: 'Harvest season in a Tumauini barangay',
            label: 'Harvest or planting season',
            hint: 'Landscape · at least 800 × 600',
        },
    ],
};

/**
 * What the page says about the municipality.
 *
 * Kept here, apart from the markup, because this is the copy most likely to be
 * rewritten — and because it should be rewritten BY THE OFFICE. What is here is
 * deliberately limited to what can be stated without a source: where Tumauini
 * is, and what this office does. There are no population figures, no land-area
 * totals and no production rankings, because inventing those on a public page
 * that carries the municipal seal would be worse than saying less.
 *
 * The figures the page does show — barangays, farmers, hectares — come from the
 * registry itself and are therefore true by construction.
 */
export const ABOUT_TUMAUINI = {
    eyebrow: 'The Municipality',
    heading: 'Tumauini, Isabela',
    lead: 'A farming municipality in the Cagayan Valley, served by the Municipal Agriculture Office.',
    body: [
        'The Municipal Agriculture Office supports the farmers of Tumauini — registering them under the RSBSA, mapping the land they work, recording what each season produces, and distributing the assistance that reaches them.',
        'GeoFarm-IS is where all of that is kept. Every figure on this page is counted from the registry itself, not estimated.',
    ],
};
