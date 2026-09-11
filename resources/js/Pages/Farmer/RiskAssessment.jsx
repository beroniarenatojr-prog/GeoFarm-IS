import { useState } from 'react';
import { useForm, Link } from '@inertiajs/react';
import { CloudRain, TrendingDown, Sprout, HandHeart, AlertTriangle, ChevronLeft, ChevronRight, Check, Layers } from 'lucide-react';

/**
 * The climate and financial risk questionnaire.
 *
 * Six sections on one page rather than a wizard: a farmer filling this in at
 * the office, often with staff beside them, needs to be able to look back at
 * an earlier answer without losing their place.
 *
 * Question 10 and 11 are absent on purpose. Production cost and income are
 * already recorded against the cropping season, so the season picker shows
 * what the office holds instead of asking for the figures a second time.
 */

const peso = (n) =>
    n == null ? '—' : `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

/*
 * Every option is [key, English, Tagalog].
 *
 * The KEY is what the server stores and validates against the instrument, and
 * it never changes — the Tagalog is a third element precisely so translating
 * cannot touch it. Rewording a label is safe; renaming a key would silently
 * invalidate every assessment already recorded.
 *
 * Both languages are shown together rather than behind a switch. Farmers here
 * read a mix of the two, staff sit beside them at the office reading the
 * English, and the whole register already works this way — Commodity
 * (Produkto), Total Area (Sukat).
 */

const FREQUENCIES = [
    ['never', 'Never', 'Hindi kailanman'],
    ['rarely', 'Rarely', 'Bihira'],
    ['sometimes', 'Sometimes', 'Minsan'],
    ['frequently', 'Frequently', 'Madalas'],
    ['very_frequently', 'Very frequently', 'Napakadalas'],
];

const CLIMATE_EVENTS = [
    ['heavy_rainfall', 'Heavy rainfall', 'Malakas na ulan'],
    ['flooding', 'Flooding', 'Pagbaha'],
    ['drought', 'Drought or prolonged dry periods', 'Tagtuyot o matagal na tag-araw'],
    ['extreme_heat', 'Extreme heat', 'Sobrang init'],
    ['strong_winds', 'Strong winds or typhoons', 'Malakas na hangin o bagyo'],
    ['unpredictable_rainfall', 'Unusual or unpredictable rainfall', 'Hindi inaasahang pag-ulan'],
    ['other', 'Other', 'Iba pa'],
    ['none', 'None', 'Wala'],
];

const EFFECTS = [
    ['no_significant_effect', 'No significant effect', 'Walang malaking epekto'],
    ['slight', 'Slight reduction or damage', 'Bahagyang pagbaba o pinsala'],
    ['moderate', 'Moderate reduction or damage', 'Katamtamang pagbaba o pinsala'],
    ['severe', 'Severe reduction or damage', 'Malubhang pagbaba o pinsala'],
    ['total_loss', 'Total crop or livestock loss', 'Lubusang nasira ang tanim o alagang hayop'],
];

const LOSS_TYPES = [
    ['reduced_yield', 'Reduced crop yield', 'Bumabang ani'],
    ['crop_damage', 'Crop damage', 'Nasirang pananim'],
    ['total_crop_loss', 'Total crop loss', 'Lubusang nawalang pananim'],
    ['livestock_death', 'Livestock death', 'Namatay na alagang hayop'],
    ['livestock_illness', 'Livestock illness or reduced productivity', 'Nagkasakit o humina ang alagang hayop'],
    ['delayed_planting', 'Delayed planting', 'Naantalang pagtatanim'],
    ['delayed_harvesting', 'Delayed harvesting', 'Naantalang pag-aani'],
    ['additional_expenses', 'Additional production expenses', 'Dagdag na gastos sa produksyon'],
    ['lost_income', 'Loss of expected income', 'Nawalang inaasahang kita'],
    ['other', 'Other', 'Iba pa'],
    ['none', 'None', 'Wala'],
];

const YES_NO_UNSURE = [
    ['yes', 'Yes', 'Oo'],
    ['no', 'No', 'Hindi'],
    ['not_sure', 'Not sure', 'Hindi sigurado'],
];

const SEASON_COMPARISONS = [
    ['much_better', 'Significantly improved', 'Malaki ang pagganda'],
    ['better', 'Improved', 'Gumanda'],
    ['about_the_same', 'About the same', 'Halos pareho lang'],
    ['worse', 'Declined', 'Bumaba'],
    ['much_worse', 'Significantly declined', 'Malaki ang pagbaba'],
    ['not_sure', 'Not sure', 'Hindi sigurado'],
];

const ADAPTATION_PRACTICES = [
    ['change_planting_schedule', 'Change planting schedule', 'Pagbabago ng iskedyul ng pagtatanim'],
    ['change_harvesting_schedule', 'Change harvesting schedule', 'Pagbabago ng iskedyul ng pag-aani'],
    ['drought_tolerant_varieties', 'Drought-tolerant varieties', 'Barayting kayang tiisin ang tagtuyot'],
    ['flood_tolerant_varieties', 'Flood-tolerant or climate-resilient varieties', 'Barayting matibay sa baha o klima'],
    ['improve_drainage', 'Improve drainage', 'Pagpapaayos ng daluyan ng tubig'],
    ['use_irrigation', 'Use irrigation', 'Paggamit ng irigasyon'],
    ['diversify_crops', 'Diversify crops', 'Pag-iba-iba ng pananim'],
    ['adjust_fertilizer', 'Adjust fertilizer application', 'Pag-aayos ng paglalagay ng abono'],
    ['crop_protection', 'Crop protection measures', 'Pag-iingat at proteksyon sa pananim'],
    ['farm_infrastructure', 'Improve farm infrastructure', 'Pagpapaganda ng pasilidad sa sakahan'],
    ['livestock_shelter', 'Shelter or protection for livestock', 'Kulungan o kanlungan para sa hayop'],
    ['crop_insurance', 'Agricultural insurance', 'Seguro sa agrikultura'],
    ['other', 'Other', 'Iba pa'],
    ['none', 'None', 'Wala'],
];

const EFFECTIVENESS = [
    ['very_effective', 'Very effective', 'Napakabisa'],
    ['effective', 'Effective', 'Mabisa'],
    ['moderately_effective', 'Moderately effective', 'Katamtaman ang bisa'],
    ['slightly_effective', 'Slightly effective', 'Bahagyang mabisa'],
    ['not_effective', 'Not effective', 'Hindi mabisa'],
    ['not_applicable', 'Not applicable', 'Hindi angkop'],
];

const BARRIERS = [
    ['no_money', 'Lack of financial resources', 'Kulang sa pera'],
    ['no_knowledge', 'Lack of technical knowledge', 'Kulang sa kaalamang teknikal'],
    ['no_equipment', 'Lack of access to equipment or materials', 'Walang makuhang kagamitan o materyales'],
    ['no_water', 'Lack of water or irrigation', 'Kulang sa tubig o irigasyon'],
    ['no_government_support', 'Lack of government assistance', 'Kulang sa tulong ng gobyerno'],
    ['not_available_locally', 'Not available in my area', 'Wala sa aming lugar'],
    ['not_needed', 'I do not consider them necessary', 'Sa tingin ko ay hindi kailangan'],
    ['other', 'Other', 'Iba pa'],
    ['not_applicable', 'Not applicable', 'Hindi angkop'],
];

const ASSISTANCE_TYPES = [
    ['seeds', 'Seeds or planting materials', 'Binhi o pananim'],
    ['fertilizer', 'Fertilizer', 'Abono'],
    ['irrigation', 'Irrigation support', 'Tulong sa irigasyon'],
    ['crop_protection', 'Crop protection materials', 'Gamot at proteksyon sa pananim'],
    ['financial', 'Financial assistance', 'Tulong pinansyal'],
    ['livestock', 'Livestock assistance', 'Tulong sa alagang hayop'],
    ['training', 'Technical or training assistance', 'Pagsasanay o teknikal na tulong'],
    ['disaster_recovery', 'Disaster recovery assistance', 'Tulong sa pagbangon mula sa sakuna'],
    ['other', 'Other', 'Iba pa'],
];

const HELPFULNESS = [
    ['very_helpful', 'Very helpful', 'Napakalaking tulong'],
    ['helpful', 'Helpful', 'Malaking tulong'],
    ['moderately_helpful', 'Moderately helpful', 'Katamtamang tulong'],
    ['slightly_helpful', 'Slightly helpful', 'Bahagyang tulong'],
    ['not_helpful', 'Not helpful', 'Hindi nakatulong'],
    ['not_applicable', 'Not applicable', 'Hindi angkop'],
];

const PERCEIVED_RISKS = [
    ['very_unlikely', 'Very unlikely', 'Halos hindi mangyayari'],
    ['unlikely', 'Unlikely', 'Malabong mangyari'],
    ['moderately_likely', 'Moderately likely', 'Katamtamang posible'],
    ['likely', 'Likely', 'Malamang mangyari'],
    ['very_likely', 'Very likely', 'Malaki ang posibilidad'],
    ['not_sure', 'Not sure', 'Hindi sigurado'],
];

const ANTICIPATED_FACTORS = [
    ['seed_cost', 'High cost of seeds or planting materials', 'Mahal na binhi o pananim'],
    ['fertilizer_cost', 'High fertilizer costs', 'Mahal na abono'],
    ['pesticide_cost', 'High pesticide or chemical costs', 'Mahal na gamot o kemikal'],
    ['labour_cost', 'High labour costs', 'Mahal na upa sa trabahador'],
    ['transport_cost', 'High transportation costs', 'Mahal na transportasyon'],
    ['low_price', 'Low selling price', 'Mababang presyo ng bilihan'],
    ['low_yield', 'Low crop yield', 'Mababang ani'],
    ['flooding', 'Flooding', 'Pagbaha'],
    ['drought', 'Drought', 'Tagtuyot'],
    ['extreme_heat', 'Extreme heat', 'Sobrang init'],
    ['typhoon', 'Typhoon or strong winds', 'Bagyo o malakas na hangin'],
    ['pests_disease', 'Pest or disease problems', 'Peste o sakit sa pananim'],
    ['no_irrigation', 'Lack of irrigation or water', 'Kulang sa irigasyon o tubig'],
    ['no_capital', 'Lack of capital', 'Kulang sa puhunan'],
    ['other', 'Other', 'Iba pa'],
];

const MAX_FACTORS = 3;
const EXCLUSIVE = 'none';

// ── Field components ─────────────────────────────────────────────────────────

function Section({ icon: Icon, title, tagalogTitle, subtitle, tagalogSubtitle, children }) {
    return (
        <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start gap-3 border-b border-green-100 pb-4">
                <span className="rounded-xl bg-green-50 p-2 text-[#006400]"><Icon className="h-5 w-5" /></span>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    {tagalogTitle && <p className="text-sm font-semibold text-[#006400]">{tagalogTitle}</p>}
                    {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
                    {tagalogSubtitle && <p className="text-sm italic text-gray-400">{tagalogSubtitle}</p>}
                </div>
            </div>
            <div className="space-y-6">{children}</div>
        </section>
    );
}

/**
 * The Tagalog sits under the English, not inside brackets after it.
 *
 * A full question is a sentence, and two sentences on one line is a wall of
 * text — the short field labels elsewhere in the register can take the
 * "English (Tagalog)" form, but these cannot.
 */
function Question({ number, label, tagalog, hint, tagalogHint, error, children }) {
    return (
        <div>
            <p className="text-sm font-semibold text-gray-900">
                <span className="mr-1.5 text-[#006400]">{number}.</span>{label}
            </p>
            {tagalog && (
                <p className="mt-0.5 pl-[1.15rem] text-sm font-medium text-[#006400]">{tagalog}</p>
            )}
            {hint && <p className="mt-1 pl-[1.15rem] text-xs text-gray-500">{hint}</p>}
            {tagalogHint && <p className="pl-[1.15rem] text-xs italic text-gray-400">{tagalogHint}</p>}
            <div className="mt-2">{children}</div>
            {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
        </div>
    );
}

/**
 * The English on top, the Tagalog beneath it in the same chip.
 *
 * Kept in one control rather than split into a language toggle: a farmer who
 * knows the Tagalog word and a staff member reading the English are usually
 * looking at the same screen at the same time.
 */
function ChoiceLabel({ text, tagalog, selected }) {
    return (
        <span className="block text-left leading-tight">
            {text}
            {tagalog && (
                <span className={`block text-[11px] ${selected ? 'text-white/75' : 'text-gray-500'}`}>
                    {tagalog}
                </span>
            )}
        </span>
    );
}

/** One answer from a list. */
function Choice({ options, value, onChange }) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map(([key, text, tagalog]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(value === key ? '' : key)}
                    className={`rounded-2xl border px-3 py-1.5 text-sm transition ${
                        value === key
                            ? 'border-[#006400] bg-[#006400] text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'
                    }`}
                >
                    <ChoiceLabel text={text} tagalog={tagalog} selected={value === key} />
                </button>
            ))}
        </div>
    );
}

/**
 * Several answers from a list.
 *
 * "None" clears everything else and anything else clears "None", so the
 * contradiction the server rejects cannot be built in the first place - the
 * farmer finds out here rather than after submitting.
 */
function MultiChoice({ options, values = [], onChange, max = null, exclusive = EXCLUSIVE }) {
    const atLimit = max !== null && values.length >= max;

    function toggle(key) {
        if (values.includes(key)) {
            onChange(values.filter((v) => v !== key));
            return;
        }
        if (key === exclusive) {
            onChange([exclusive]);
            return;
        }
        if (atLimit) return;

        onChange([...values.filter((v) => v !== exclusive), key]);
    }

    return (
        <div className="flex flex-wrap gap-2">
            {options.map(([key, text, tagalog]) => {
                const on = values.includes(key);
                const blocked = !on && atLimit && key !== exclusive;

                return (
                    <button
                        key={key}
                        type="button"
                        disabled={blocked}
                        onClick={() => toggle(key)}
                        className={`flex items-center gap-1 rounded-2xl border px-3 py-1.5 text-sm transition ${
                            on
                                ? 'border-[#006400] bg-[#006400] text-white'
                                : blocked
                                    ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'
                        }`}
                    >
                        {on && <Check className="h-3.5 w-3.5 flex-none" />}
                        <ChoiceLabel text={text} tagalog={tagalog} selected={on} />
                    </button>
                );
            })}
        </div>
    );
}

function Peso({ value, onChange, error }) {
    return (
        <div>
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">₱</span>
                <input
                    type="number" step="0.01" min="0"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                />
            </div>
            {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

/**
 * What a farmer can assess, and what each choice is called.
 *
 * A farm is several activities and each meets the weather differently, so the
 * first question is which one this assessment is about. Before this step
 * existed every submission landed on the whole farm, and a rice answer was
 * counted against a carabao.
 */
const SCOPES = [
    {
        key: 'farmer',
        icon: '🏡',
        label: 'My entire farm',
        tagalog: 'Buong sakahan',
        hint: 'General conditions affecting everything you farm.',
    },
    {
        key: 'parcel',
        icon: '🌾',
        label: 'A specific crop parcel',
        tagalog: 'Isang partikular na sakahan',
        hint: 'Answers apply to that parcel only.',
    },
    {
        key: 'livestock',
        icon: '🐄',
        label: 'Livestock',
        tagalog: 'Alagang hayop',
        hint: 'Answers apply to those animals only.',
    },
    {
        key: 'aquaculture',
        icon: '🐟',
        label: 'Fishpond',
        tagalog: 'Palaisdaan',
        hint: 'Answers apply to that pond only.',
    },
];

export default function RiskAssessment({ farmer, seasons = [], latest, activities = {}, scopeOptions = {} }) {
    const { data, setData, post, processing, errors } = useForm({
        scope_type: 'farmer',
        farm_parcel_id: '',
        fishpond_id: '',
        crop_season_id: '',
        climate_events: [],
        flood_frequency: '', drought_frequency: '', heat_frequency: '', storm_frequency: '',
        worst_effect: '',
        loss_types: [],
        had_financial_loss: '', estimated_loss_amount: '',
        had_cost_increase: '', estimated_extra_cost: '',
        season_comparison: '',
        adaptation_practices: [],
        adaptation_effectiveness: '', adaptation_barrier: '',
        received_assistance: '', assistance_types: [], assistance_helpfulness: '',
        perceived_risk: '', anticipated_factors: [],
    });

    const [season, setSeason] = useState(null);

    function pickSeason(id) {
        const chosen = seasons.find((s) => String(s.id) === String(id)) ?? null;

        setSeason(chosen);
        setData((current) => ({
            ...current,
            crop_season_id: id,
            // The parcel comes with the season; asking separately would let
            // the two disagree.
            farm_parcel_id: chosen?.parcel_id ?? '',
        }));
    }

    /**
     * Changing scope clears the activity chosen under the old one.
     *
     * Left behind, a parcel id would travel with an assessment that says it is
     * about a pond. The server clears it too — this is so the farmer sees the
     * choice reset rather than finding out later.
     */
    function pickScope(scope) {
        setData((current) => ({
            ...current,
            scope_type: scope,
            farm_parcel_id: '',
            fishpond_id: '',
            crop_season_id: '',
            // Answers the new scope does not offer would be rejected on
            // submit; clearing them means the farmer never loses work at the
            // end of a long form.
            loss_types: [],
            adaptation_practices: [],
            anticipated_factors: [],
            season_comparison: '',
        }));

        setSeason(null);
    }

    const narrowing = scopeOptions[data.scope_type] ?? {};

    /** The options this activity actually offers for one question. */
    const optionsFor = (question, full) => {
        const allowed = narrowing[question];

        return allowed ? full.filter(([key]) => allowed.includes(key)) : full;
    };

    const asks = (question) => !(narrowing.hidden ?? []).includes(question);

    // The activities a farmer can pick under the chosen scope.
    const choices = activities[data.scope_type] ?? [];
    const needsActivity = data.scope_type !== 'farmer';
    const activityKey = data.scope_type === 'aquaculture' ? 'fishpond_id' : 'farm_parcel_id';
    const chosen = choices.find((a) => String(a.id) === String(data[activityKey])) ?? null;

    function submit(e) {
        e.preventDefault();
        post('/farmer/risk-assessment');
    }

    return (
        <div className="relative min-h-screen bg-[#FAF8F3] px-4 py-8">
            <div className="mx-auto max-w-4xl space-y-6 pb-16">
                <div>
                    <Link href={'/farmer/dashboard'} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#006400]">
                        <ChevronLeft className="h-4 w-4" /> Back to my portal
                    </Link>
                    <h1 className="mt-2 text-2xl font-bold text-gray-900">Climate &amp; Financial Risk Assessment</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        {latest
                            ? 'Updating your assessment. Your previous answers are kept as a record.'
                            : 'This helps the Municipal Agriculture Office understand the risks your farm faces.'}
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6">

                    {/* ---------------------------------- what is being assessed */}
                    <Section
                        icon={Layers}
                        title="What are you assessing?"
                        tagalogTitle="Ano ang inyong sinusuri?"
                        subtitle="Your answers will be recorded against this activity only."
                        tagalogSubtitle="Ang inyong mga sagot ay itatala para lamang sa napiling gawain."
                    >
                        <div className="grid gap-2 sm:grid-cols-2">
                            {SCOPES.map((scope) => {
                                // A scope with nothing under it is not offered: a
                                // farmer with no pond should not be asked to pick one.
                                const available = scope.key === 'farmer' || (activities[scope.key] ?? []).length > 0;

                                if (!available) return null;

                                const on = data.scope_type === scope.key;

                                return (
                                    <button
                                        key={scope.key}
                                        type="button"
                                        onClick={() => pickScope(scope.key)}
                                        className={`rounded-xl border-2 p-3 text-left transition ${
                                            on
                                                ? 'border-[#006400] bg-green-50'
                                                : 'border-gray-200 bg-white hover:border-green-300'
                                        }`}
                                    >
                                        <p className="font-semibold text-gray-900">
                                            <span className="mr-1.5">{scope.icon}</span>
                                            {scope.label}
                                        </p>
                                        <p className="text-sm font-medium text-[#006400]">{scope.tagalog}</p>
                                        <p className="mt-1 text-xs text-gray-500">{scope.hint}</p>
                                    </button>
                                );
                            })}
                        </div>

                        {errors.scope_type && (
                            <p className="mt-2 text-xs font-medium text-red-600">{errors.scope_type}</p>
                        )}

                        {needsActivity && (
                            <div className="mt-4">
                                <p className="mb-2 text-sm font-semibold text-gray-900">
                                    Which one?
                                    <span className="ml-1 font-normal text-[#006400]">Alin dito?</span>
                                </p>

                                <div className="space-y-2">
                                    {choices.map((activity) => {
                                        const on = String(data[activityKey]) === String(activity.id);

                                        return (
                                            <button
                                                key={activity.id}
                                                type="button"
                                                onClick={() => setData(activityKey, activity.id)}
                                                className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 p-3 text-left transition ${
                                                    on
                                                        ? 'border-[#006400] bg-green-50'
                                                        : 'border-gray-200 bg-white hover:border-green-300'
                                                }`}
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate font-semibold text-gray-900">
                                                        {activity.commodity || 'Not recorded'}
                                                    </span>
                                                    <span className="block truncate text-sm text-gray-500">
                                                        {[activity.label, activity.barangay].filter(Boolean).join(' · ')}
                                                    </span>
                                                </span>

                                                <span className="flex-none text-sm font-semibold text-gray-700">
                                                    {activity.size.value} {activity.size.unit}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {(errors.farm_parcel_id || errors.fishpond_id) && (
                                    <p className="mt-2 text-xs font-medium text-red-600">
                                        {errors.farm_parcel_id || errors.fishpond_id}
                                    </p>
                                )}
                            </div>
                        )}

                        {chosen && (
                            <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-[#006400]">
                                <strong>Assessment target:</strong> {chosen.commodity} — {chosen.label}
                                {chosen.barangay && ` — ${chosen.barangay}`} — {chosen.size.value} {chosen.size.unit}
                            </p>
                        )}
                    </Section>

                    {/* The harvest question only makes sense for a crop. */}
                    {(data.scope_type === 'farmer' || data.scope_type === 'parcel') && (
                    <Section
                        icon={Sprout}
                        title="Which harvest is this about?"
                        tagalogTitle="Aling anihan ito?"
                        subtitle="Choose your most recently completed cropping season."
                        tagalogSubtitle="Piliin ang pinakahuling natapos ninyong anihan."
                    >
                        {seasons.length === 0 ? (
                            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                                <p>
                                    No completed cropping season is recorded for your farm yet. You can still
                                    answer the questions below — ask the Agriculture Office to record your
                                    harvest so your financial result can be included.
                                </p>
                                <p className="mt-1 italic text-amber-700">
                                    Wala pang natatapos na anihan na nakatala para sa inyong sakahan. Maaari pa
                                    rin ninyong sagutan ang mga tanong sa ibaba — ipatala ang inyong ani sa
                                    Agriculture Office upang maisama ang inyong kita.
                                </p>
                            </div>
                        ) : (
                            <>
                                <select
                                    value={data.crop_season_id}
                                    onChange={(e) => pickSeason(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">Select a season… / Pumili ng anihan…</option>
                                    {seasons.map((s) => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                </select>
                                {errors.crop_season_id && (
                                    <p className="mt-1 text-xs font-medium text-red-600">{errors.crop_season_id}</p>
                                )}

                                {/* Questions 10 and 11 of the instrument, answered from
                                    what the office already recorded rather than asked again. */}
                                {season && (
                                    <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-green-50/60 p-4 sm:grid-cols-3">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Production cost · Gastos</p>
                                            <p className="mt-0.5 font-semibold text-gray-900">{peso(season.production_cost)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Income · Kita</p>
                                            <p className="mt-0.5 font-semibold text-gray-900">{peso(season.total_income)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Net · Netong kita</p>
                                            <p className={`mt-0.5 font-semibold ${season.outcome === 'loss' ? 'text-red-600' : 'text-[#006400]'}`}>
                                                {season.net_farm_income == null
                                                    ? 'Wala pang tala'
                                                    : `${peso(season.net_farm_income)} · ${
                                                        season.outcome === 'loss' ? 'Palugi'
                                                            : season.outcome === 'break_even' ? 'Break-even' : 'Profitable'}`}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </Section>
                    )}

                    <Section
                        icon={CloudRain}
                        title="Climate and weather experience"
                        tagalogTitle="Karanasan sa klima at panahon"
                        subtitle="Please answer based on your farming experience during the past three (3) years."
                        tagalogSubtitle="Sagutin batay sa inyong karanasan sa pagsasaka nitong nakaraang tatlong (3) taon."
                    >
                        <Question
                            number="1"
                            label="What climate- or weather-related events have affected your farm?"
                            tagalog="Anong mga pangyayaring may kinalaman sa panahon o klima ang nakaapekto sa inyong sakahan?"
                            hint="Choose all that apply."
                            tagalogHint="Piliin lahat ng naaangkop."
                            error={errors.climate_events}
                        >
                            <MultiChoice options={CLIMATE_EVENTS} values={data.climate_events} onChange={(v) => setData('climate_events', v)} />
                        </Question>
                        <Question
                            number="2"
                            label="How often has your farm experienced flooding?"
                            tagalog="Gaano kadalas binaha ang inyong sakahan?"
                            error={errors.flood_frequency}
                        >
                            <Choice options={FREQUENCIES} value={data.flood_frequency} onChange={(v) => setData('flood_frequency', v)} />
                        </Question>
                        <Question
                            number="3"
                            label="How often has your farm experienced drought or prolonged dry periods?"
                            tagalog="Gaano kadalas nakaranas ng tagtuyot o matagal na tag-araw ang inyong sakahan?"
                            error={errors.drought_frequency}
                        >
                            <Choice options={FREQUENCIES} value={data.drought_frequency} onChange={(v) => setData('drought_frequency', v)} />
                        </Question>
                        <Question
                            number="4"
                            label="How often has extreme heat affected your production?"
                            tagalog="Gaano kadalas nakaapekto ang sobrang init sa inyong ani?"
                            error={errors.heat_frequency}
                        >
                            <Choice options={FREQUENCIES} value={data.heat_frequency} onChange={(v) => setData('heat_frequency', v)} />
                        </Question>
                        <Question
                            number="5"
                            label="How often have strong winds, typhoons or severe storms affected your production?"
                            tagalog="Gaano kadalas nakaapekto ang malakas na hangin, bagyo o unos sa inyong ani?"
                            error={errors.storm_frequency}
                        >
                            <Choice options={FREQUENCIES} value={data.storm_frequency} onChange={(v) => setData('storm_frequency', v)} />
                        </Question>
                    </Section>

                    <Section
                        icon={TrendingDown}
                        title="Effects on agricultural production"
                        tagalogTitle="Epekto sa ani at produksyon"
                    >
                        <Question
                            number="6"
                            label="What was the most severe effect on your production?"
                            tagalog="Ano ang pinakamalubhang epekto sa inyong ani?"
                            error={errors.worst_effect}
                        >
                            <Choice options={EFFECTS} value={data.worst_effect} onChange={(v) => setData('worst_effect', v)} />
                        </Question>
                        <Question
                            number="7"
                            label="What types of agricultural losses have you experienced?"
                            tagalog="Anong mga uri ng pagkalugi sa sakahan ang naranasan ninyo?"
                            hint="Choose all that apply."
                            tagalogHint="Piliin lahat ng naaangkop."
                            error={errors.loss_types}
                        >
                            <MultiChoice options={optionsFor('loss_types', LOSS_TYPES)} values={data.loss_types} onChange={(v) => setData('loss_types', v)} />
                        </Question>
                        <Question
                            number="8"
                            label="Have these events caused you financial loss?"
                            tagalog="Nagdulot ba ito ng pagkalugi sa inyong pera?"
                            error={errors.had_financial_loss}
                        >
                            <Choice options={YES_NO_UNSURE} value={data.had_financial_loss} onChange={(v) => setData('had_financial_loss', v)} />
                            {data.had_financial_loss === 'yes' && (
                                <div className="mt-3">
                                    <p className="text-xs text-gray-600">Estimated loss from the most recent occurrence</p>
                                    <p className="mb-1 text-xs italic text-gray-400">Tantiyang halagang nawala sa pinakahuling pangyayari</p>
                                    <Peso value={data.estimated_loss_amount} onChange={(v) => setData('estimated_loss_amount', v)} error={errors.estimated_loss_amount} />
                                </div>
                            )}
                        </Question>
                        <Question
                            number="9"
                            label="Have these problems increased your production expenses?"
                            tagalog="Nadagdagan ba ang inyong gastos sa pagsasaka dahil dito?"
                            error={errors.had_cost_increase}
                        >
                            <Choice options={YES_NO_UNSURE} value={data.had_cost_increase} onChange={(v) => setData('had_cost_increase', v)} />
                            {data.had_cost_increase === 'yes' && (
                                <div className="mt-3">
                                    <p className="text-xs text-gray-600">Estimated additional cost from the most recent occurrence</p>
                                    <p className="mb-1 text-xs italic text-gray-400">Tantiyang dagdag na gastos sa pinakahuling pangyayari</p>
                                    <Peso value={data.estimated_extra_cost} onChange={(v) => setData('estimated_extra_cost', v)} error={errors.estimated_extra_cost} />
                                </div>
                            )}
                        </Question>
                        {/* A cropping season is not a unit of livestock keeping
                            or of pond operation, so those scopes are not asked. */}
                        {asks('season_comparison') && (
                            <Question
                                number="12"
                                label="Compared with your previous season, how did the most recent one perform financially?"
                                tagalog="Kumpara sa nakaraang anihan, kumusta ang kita ng pinakahuling anihan?"
                                error={errors.season_comparison}
                            >
                                <Choice options={SEASON_COMPARISONS} value={data.season_comparison} onChange={(v) => setData('season_comparison', v)} />
                            </Question>
                        )}
                    </Section>

                    <Section
                        icon={Sprout}
                        title="Climate adaptation practices"
                        tagalogTitle="Mga paraan ng pag-angkop sa klima"
                    >
                        <Question
                            number="13"
                            label="What practices do you use to reduce climate-related risks?"
                            tagalog="Anong mga paraan ang ginagawa ninyo para mabawasan ang panganib mula sa klima?"
                            hint="Choose all that apply."
                            tagalogHint="Piliin lahat ng naaangkop."
                            error={errors.adaptation_practices}
                        >
                            <MultiChoice options={optionsFor('adaptation_practices', ADAPTATION_PRACTICES)} values={data.adaptation_practices} onChange={(v) => setData('adaptation_practices', v)} />
                        </Question>
                        <Question
                            number="14"
                            label="How effective are these practices?"
                            tagalog="Gaano kabisa ang mga paraang ito?"
                            error={errors.adaptation_effectiveness}
                        >
                            <Choice options={EFFECTIVENESS} value={data.adaptation_effectiveness} onChange={(v) => setData('adaptation_effectiveness', v)} />
                        </Question>
                        <Question
                            number="15"
                            label="What mainly stops you from doing more?"
                            tagalog="Ano ang pangunahing humahadlang sa inyo para makagawa pa ng iba?"
                            error={errors.adaptation_barrier}
                        >
                            <Choice options={BARRIERS} value={data.adaptation_barrier} onChange={(v) => setData('adaptation_barrier', v)} />
                        </Question>
                    </Section>

                    <Section
                        icon={HandHeart}
                        title="Climate-related agricultural assistance"
                        tagalogTitle="Tulong sa sakahan kaugnay ng klima"
                    >
                        <Question
                            number="16"
                            label="Have you received climate-related agricultural assistance in the past three years?"
                            tagalog="Nakatanggap ba kayo ng tulong sa sakahan kaugnay ng klima nitong nakaraang tatlong taon?"
                            error={errors.received_assistance}
                        >
                            <Choice options={YES_NO_UNSURE} value={data.received_assistance} onChange={(v) => setData('received_assistance', v)} />
                        </Question>
                        {data.received_assistance === 'yes' && (
                            <>
                                <Question
                                    number="17"
                                    label="What type of assistance did you receive?"
                                    tagalog="Anong uri ng tulong ang natanggap ninyo?"
                                    hint="Choose all that apply."
                                    tagalogHint="Piliin lahat ng naaangkop."
                                    error={errors.assistance_types}
                                >
                                    <MultiChoice options={ASSISTANCE_TYPES} values={data.assistance_types} onChange={(v) => setData('assistance_types', v)} exclusive={null} />
                                </Question>
                                <Question
                                    number="18"
                                    label="How helpful was it?"
                                    tagalog="Gaano ito nakatulong sa inyo?"
                                    error={errors.assistance_helpfulness}
                                >
                                    <Choice options={HELPFULNESS} value={data.assistance_helpfulness} onChange={(v) => setData('assistance_helpfulness', v)} />
                                </Question>
                            </>
                        )}
                    </Section>

                    <Section
                        icon={AlertTriangle}
                        title="Your own expectation"
                        tagalogTitle="Ang inyong sariling inaasahan"
                        subtitle="This records what you expect. It is kept separate from the system's own assessment."
                        tagalogSubtitle="Ito ang inyong sariling palagay. Hiwalay ito sa sariling pagtatasa ng sistema."
                    >
                        <Question
                            number="19"
                            label="How likely is your farm to experience financial loss next season?"
                            tagalog="Gaano kalaki ang tsansang malugi ang inyong sakahan sa susunod na anihan?"
                            error={errors.perceived_risk}
                        >
                            <Choice options={PERCEIVED_RISKS} value={data.perceived_risk} onChange={(v) => setData('perceived_risk', v)} />
                        </Question>
                        <Question
                            number="20"
                            label="What could most cause a financial loss next season?"
                            tagalog="Ano ang pinakamalamang na magdulot ng pagkalugi sa susunod na anihan?"
                            hint={`Choose up to ${MAX_FACTORS}. ${data.anticipated_factors.length}/${MAX_FACTORS} selected.`}
                            tagalogHint={`Pumili ng hanggang ${MAX_FACTORS}. ${data.anticipated_factors.length}/${MAX_FACTORS} ang napili.`}
                            error={errors.anticipated_factors}
                        >
                            <MultiChoice options={optionsFor('anticipated_factors', ANTICIPATED_FACTORS)} values={data.anticipated_factors} onChange={(v) => setData('anticipated_factors', v)} max={MAX_FACTORS} exclusive={null} />
                        </Question>
                    </Section>

                    <div className="flex items-center justify-end gap-3">
                        <Link href={'/farmer/dashboard'} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                            Cancel <span className="text-gray-400">/ Kanselahin</span>
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#006400] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
                        >
                            {processing
                                ? 'Saving… / Sinasave…'
                                : <>Submit assessment <span className="font-normal text-white/75">/ Ipasa</span></>}
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
