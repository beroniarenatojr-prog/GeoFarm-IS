import { useState } from 'react';
import { useForm, Link } from '@inertiajs/react';
import { CloudRain, TrendingDown, Sprout, HandHeart, AlertTriangle, ChevronLeft, ChevronRight, Check } from 'lucide-react';

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

const FREQUENCIES = [
    ['never', 'Never'],
    ['rarely', 'Rarely'],
    ['sometimes', 'Sometimes'],
    ['frequently', 'Frequently'],
    ['very_frequently', 'Very frequently'],
];

const CLIMATE_EVENTS = [
    ['heavy_rainfall', 'Heavy rainfall'],
    ['flooding', 'Flooding'],
    ['drought', 'Drought or prolonged dry periods'],
    ['extreme_heat', 'Extreme heat'],
    ['strong_winds', 'Strong winds or typhoons'],
    ['unpredictable_rainfall', 'Unusual or unpredictable rainfall'],
    ['other', 'Other'],
    ['none', 'None'],
];

const EFFECTS = [
    ['no_significant_effect', 'No significant effect'],
    ['slight', 'Slight reduction or damage'],
    ['moderate', 'Moderate reduction or damage'],
    ['severe', 'Severe reduction or damage'],
    ['total_loss', 'Total crop or livestock loss'],
];

const LOSS_TYPES = [
    ['reduced_yield', 'Reduced crop yield'],
    ['crop_damage', 'Crop damage'],
    ['total_crop_loss', 'Total crop loss'],
    ['livestock_death', 'Livestock death'],
    ['livestock_illness', 'Livestock illness or reduced productivity'],
    ['delayed_planting', 'Delayed planting'],
    ['delayed_harvesting', 'Delayed harvesting'],
    ['additional_expenses', 'Additional production expenses'],
    ['lost_income', 'Loss of expected income'],
    ['other', 'Other'],
    ['none', 'None'],
];

const YES_NO_UNSURE = [['yes', 'Yes'], ['no', 'No'], ['not_sure', 'Not sure']];

const SEASON_COMPARISONS = [
    ['much_better', 'Significantly improved'],
    ['better', 'Improved'],
    ['about_the_same', 'About the same'],
    ['worse', 'Declined'],
    ['much_worse', 'Significantly declined'],
    ['not_sure', 'Not sure'],
];

const ADAPTATION_PRACTICES = [
    ['change_planting_schedule', 'Change planting schedule'],
    ['change_harvesting_schedule', 'Change harvesting schedule'],
    ['drought_tolerant_varieties', 'Drought-tolerant varieties'],
    ['flood_tolerant_varieties', 'Flood-tolerant or climate-resilient varieties'],
    ['improve_drainage', 'Improve drainage'],
    ['use_irrigation', 'Use irrigation'],
    ['diversify_crops', 'Diversify crops'],
    ['adjust_fertilizer', 'Adjust fertilizer application'],
    ['crop_protection', 'Crop protection measures'],
    ['farm_infrastructure', 'Improve farm infrastructure'],
    ['livestock_shelter', 'Shelter or protection for livestock'],
    ['crop_insurance', 'Agricultural insurance'],
    ['other', 'Other'],
    ['none', 'None'],
];

const EFFECTIVENESS = [
    ['very_effective', 'Very effective'],
    ['effective', 'Effective'],
    ['moderately_effective', 'Moderately effective'],
    ['slightly_effective', 'Slightly effective'],
    ['not_effective', 'Not effective'],
    ['not_applicable', 'Not applicable'],
];

const BARRIERS = [
    ['no_money', 'Lack of financial resources'],
    ['no_knowledge', 'Lack of technical knowledge'],
    ['no_equipment', 'Lack of access to equipment or materials'],
    ['no_water', 'Lack of water or irrigation'],
    ['no_government_support', 'Lack of government assistance'],
    ['not_available_locally', 'Not available in my area'],
    ['not_needed', 'I do not consider them necessary'],
    ['other', 'Other'],
    ['not_applicable', 'Not applicable'],
];

const ASSISTANCE_TYPES = [
    ['seeds', 'Seeds or planting materials'],
    ['fertilizer', 'Fertilizer'],
    ['irrigation', 'Irrigation support'],
    ['crop_protection', 'Crop protection materials'],
    ['financial', 'Financial assistance'],
    ['livestock', 'Livestock assistance'],
    ['training', 'Technical or training assistance'],
    ['disaster_recovery', 'Disaster recovery assistance'],
    ['other', 'Other'],
];

const HELPFULNESS = [
    ['very_helpful', 'Very helpful'],
    ['helpful', 'Helpful'],
    ['moderately_helpful', 'Moderately helpful'],
    ['slightly_helpful', 'Slightly helpful'],
    ['not_helpful', 'Not helpful'],
    ['not_applicable', 'Not applicable'],
];

const PERCEIVED_RISKS = [
    ['very_unlikely', 'Very unlikely'],
    ['unlikely', 'Unlikely'],
    ['moderately_likely', 'Moderately likely'],
    ['likely', 'Likely'],
    ['very_likely', 'Very likely'],
    ['not_sure', 'Not sure'],
];

const ANTICIPATED_FACTORS = [
    ['seed_cost', 'High cost of seeds or planting materials'],
    ['fertilizer_cost', 'High fertilizer costs'],
    ['pesticide_cost', 'High pesticide or chemical costs'],
    ['labour_cost', 'High labour costs'],
    ['transport_cost', 'High transportation costs'],
    ['low_price', 'Low selling price'],
    ['low_yield', 'Low crop yield'],
    ['flooding', 'Flooding'],
    ['drought', 'Drought'],
    ['extreme_heat', 'Extreme heat'],
    ['typhoon', 'Typhoon or strong winds'],
    ['pests_disease', 'Pest or disease problems'],
    ['no_irrigation', 'Lack of irrigation or water'],
    ['no_capital', 'Lack of capital'],
    ['other', 'Other'],
];

const MAX_FACTORS = 3;
const EXCLUSIVE = 'none';

// ── Field components ─────────────────────────────────────────────────────────

function Section({ icon: Icon, title, subtitle, children }) {
    return (
        <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start gap-3 border-b border-green-100 pb-4">
                <span className="rounded-xl bg-green-50 p-2 text-[#006400]"><Icon className="h-5 w-5" /></span>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
                </div>
            </div>
            <div className="space-y-6">{children}</div>
        </section>
    );
}

function Question({ number, label, hint, error, children }) {
    return (
        <div>
            <p className="text-sm font-semibold text-gray-900">
                <span className="mr-1.5 text-[#006400]">{number}.</span>{label}
            </p>
            {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
            <div className="mt-2">{children}</div>
            {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
        </div>
    );
}

/** One answer from a list. */
function Choice({ options, value, onChange }) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map(([key, text]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(value === key ? '' : key)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        value === key
                            ? 'border-[#006400] bg-[#006400] text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'
                    }`}
                >
                    {text}
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
            {options.map(([key, text]) => {
                const on = values.includes(key);
                const blocked = !on && atLimit && key !== exclusive;

                return (
                    <button
                        key={key}
                        type="button"
                        disabled={blocked}
                        onClick={() => toggle(key)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            on
                                ? 'border-[#006400] bg-[#006400] text-white'
                                : blocked
                                    ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'
                        }`}
                    >
                        {on && <Check className="mr-1 inline h-3.5 w-3.5" />}{text}
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

export default function RiskAssessment({ farmer, seasons = [], latest }) {
    const { data, setData, post, processing, errors } = useForm({
        farm_parcel_id: '',
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
                    {/* Which cropping this is about — and the money already on file */}
                    <Section
                        icon={Sprout}
                        title="Which harvest is this about?"
                        subtitle="Choose your most recently completed cropping season."
                    >
                        {seasons.length === 0 ? (
                            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                                No completed cropping season is recorded for your farm yet. You can still
                                answer the questions below — ask the Agriculture Office to record your
                                harvest so your financial result can be included.
                            </p>
                        ) : (
                            <>
                                <select
                                    value={data.crop_season_id}
                                    onChange={(e) => pickSeason(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">Select a season…</option>
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
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Production cost</p>
                                            <p className="mt-0.5 font-semibold text-gray-900">{peso(season.production_cost)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Income</p>
                                            <p className="mt-0.5 font-semibold text-gray-900">{peso(season.total_income)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Net</p>
                                            <p className={`mt-0.5 font-semibold ${season.outcome === 'loss' ? 'text-red-600' : 'text-[#006400]'}`}>
                                                {season.net_farm_income == null
                                                    ? 'Not yet recorded'
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

                    <Section
                        icon={CloudRain}
                        title="Climate and weather experience"
                        subtitle="Please answer based on your farming experience during the past three (3) years."
                    >
                        <Question number="1" label="What climate- or weather-related events have affected your farm?" hint="Choose all that apply." error={errors.climate_events}>
                            <MultiChoice options={CLIMATE_EVENTS} values={data.climate_events} onChange={(v) => setData('climate_events', v)} />
                        </Question>
                        <Question number="2" label="How often has your farm experienced flooding?" error={errors.flood_frequency}>
                            <Choice options={FREQUENCIES} value={data.flood_frequency} onChange={(v) => setData('flood_frequency', v)} />
                        </Question>
                        <Question number="3" label="How often has your farm experienced drought or prolonged dry periods?" error={errors.drought_frequency}>
                            <Choice options={FREQUENCIES} value={data.drought_frequency} onChange={(v) => setData('drought_frequency', v)} />
                        </Question>
                        <Question number="4" label="How often has extreme heat affected your production?" error={errors.heat_frequency}>
                            <Choice options={FREQUENCIES} value={data.heat_frequency} onChange={(v) => setData('heat_frequency', v)} />
                        </Question>
                        <Question number="5" label="How often have strong winds, typhoons or severe storms affected your production?" error={errors.storm_frequency}>
                            <Choice options={FREQUENCIES} value={data.storm_frequency} onChange={(v) => setData('storm_frequency', v)} />
                        </Question>
                    </Section>

                    <Section icon={TrendingDown} title="Effects on agricultural production">
                        <Question number="6" label="What was the most severe effect on your production?" error={errors.worst_effect}>
                            <Choice options={EFFECTS} value={data.worst_effect} onChange={(v) => setData('worst_effect', v)} />
                        </Question>
                        <Question number="7" label="What types of agricultural losses have you experienced?" hint="Choose all that apply." error={errors.loss_types}>
                            <MultiChoice options={LOSS_TYPES} values={data.loss_types} onChange={(v) => setData('loss_types', v)} />
                        </Question>
                        <Question number="8" label="Have these events caused you financial loss?" error={errors.had_financial_loss}>
                            <Choice options={YES_NO_UNSURE} value={data.had_financial_loss} onChange={(v) => setData('had_financial_loss', v)} />
                            {data.had_financial_loss === 'yes' && (
                                <div className="mt-3">
                                    <p className="mb-1 text-xs text-gray-600">Estimated loss from the most recent occurrence</p>
                                    <Peso value={data.estimated_loss_amount} onChange={(v) => setData('estimated_loss_amount', v)} error={errors.estimated_loss_amount} />
                                </div>
                            )}
                        </Question>
                        <Question number="9" label="Have these problems increased your production expenses?" error={errors.had_cost_increase}>
                            <Choice options={YES_NO_UNSURE} value={data.had_cost_increase} onChange={(v) => setData('had_cost_increase', v)} />
                            {data.had_cost_increase === 'yes' && (
                                <div className="mt-3">
                                    <p className="mb-1 text-xs text-gray-600">Estimated additional cost from the most recent occurrence</p>
                                    <Peso value={data.estimated_extra_cost} onChange={(v) => setData('estimated_extra_cost', v)} error={errors.estimated_extra_cost} />
                                </div>
                            )}
                        </Question>
                        <Question number="12" label="Compared with your previous season, how did the most recent one perform financially?" error={errors.season_comparison}>
                            <Choice options={SEASON_COMPARISONS} value={data.season_comparison} onChange={(v) => setData('season_comparison', v)} />
                        </Question>
                    </Section>

                    <Section icon={Sprout} title="Climate adaptation practices">
                        <Question number="13" label="What practices do you use to reduce climate-related risks?" hint="Choose all that apply." error={errors.adaptation_practices}>
                            <MultiChoice options={ADAPTATION_PRACTICES} values={data.adaptation_practices} onChange={(v) => setData('adaptation_practices', v)} />
                        </Question>
                        <Question number="14" label="How effective are these practices?" error={errors.adaptation_effectiveness}>
                            <Choice options={EFFECTIVENESS} value={data.adaptation_effectiveness} onChange={(v) => setData('adaptation_effectiveness', v)} />
                        </Question>
                        <Question number="15" label="What mainly stops you from doing more?" error={errors.adaptation_barrier}>
                            <Choice options={BARRIERS} value={data.adaptation_barrier} onChange={(v) => setData('adaptation_barrier', v)} />
                        </Question>
                    </Section>

                    <Section icon={HandHeart} title="Climate-related agricultural assistance">
                        <Question number="16" label="Have you received climate-related agricultural assistance in the past three years?" error={errors.received_assistance}>
                            <Choice options={YES_NO_UNSURE} value={data.received_assistance} onChange={(v) => setData('received_assistance', v)} />
                        </Question>
                        {data.received_assistance === 'yes' && (
                            <>
                                <Question number="17" label="What type of assistance did you receive?" hint="Choose all that apply." error={errors.assistance_types}>
                                    <MultiChoice options={ASSISTANCE_TYPES} values={data.assistance_types} onChange={(v) => setData('assistance_types', v)} exclusive={null} />
                                </Question>
                                <Question number="18" label="How helpful was it?" error={errors.assistance_helpfulness}>
                                    <Choice options={HELPFULNESS} value={data.assistance_helpfulness} onChange={(v) => setData('assistance_helpfulness', v)} />
                                </Question>
                            </>
                        )}
                    </Section>

                    <Section
                        icon={AlertTriangle}
                        title="Your own expectation"
                        subtitle="This records what you expect. It is kept separate from the system's own assessment."
                    >
                        <Question number="19" label="How likely is your farm to experience financial loss next season?" error={errors.perceived_risk}>
                            <Choice options={PERCEIVED_RISKS} value={data.perceived_risk} onChange={(v) => setData('perceived_risk', v)} />
                        </Question>
                        <Question
                            number="20"
                            label="What could most cause a financial loss next season?"
                            hint={`Choose up to ${MAX_FACTORS}. ${data.anticipated_factors.length}/${MAX_FACTORS} selected.`}
                            error={errors.anticipated_factors}
                        >
                            <MultiChoice options={ANTICIPATED_FACTORS} values={data.anticipated_factors} onChange={(v) => setData('anticipated_factors', v)} max={MAX_FACTORS} exclusive={null} />
                        </Question>
                    </Section>

                    <div className="flex items-center justify-end gap-3">
                        <Link href={'/farmer/dashboard'} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#006400] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
                        >
                            {processing ? 'Saving…' : 'Submit assessment'}
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
