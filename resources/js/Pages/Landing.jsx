import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    MapPin, Leaf, Users, TrendingUp, FileText, Shield, Database, BarChart3,
    Map, Sprout, ChevronRight, ChevronDown, UserPlus, Building2, LayoutDashboard,
    Ruler, HandHeart,
} from 'lucide-react';
import Photo from '@/Components/Landing/Photo';
import { ABOUT_TUMAUINI, LANDING_PHOTOS } from '@/config/landingPhotos';

/* ------------------------------------------------------------------- hooks */

const prefersReducedMotion = () =>
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Adds .gf-in-view once the element scrolls into view, with an optional stagger. */
function useReveal(delayMs = 0) {
    const ref = useRef(null);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
            node.classList.add('gf-in-view');
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                node.style.animationDelay = `${delayMs}ms`;
                node.classList.add('gf-in-view');
                observer.unobserve(node);
            },
            { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [delayMs]);

    return ref;
}

/** Counts up to `target` the first time the element is seen. */
function useCountUp(target, duration = 1600) {
    const ref = useRef(null);
    const [value, setValue] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
            setValue(target);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                observer.unobserve(node);

                // rAF is suspended in a background tab, which would leave the
                // figure frozen at 0. Nobody is watching the animation there
                // anyway, so jump straight to the real number.
                if (document.hidden) {
                    setValue(target);
                    return;
                }

                const start = performance.now();
                const tick = (now) => {
                    const progress = Math.min((now - start) / duration, 1);
                    // ease-out cubic, so it decelerates into the final figure
                    setValue(target * (1 - Math.pow(1 - progress, 3)));
                    if (progress < 1) requestAnimationFrame(tick);
                };

                requestAnimationFrame(tick);
            },
            { threshold: 0.4 },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [target, duration]);

    return [ref, value];
}

/* ------------------------------------------------------------------ pieces */

function StatCounter({ icon: Icon, value, label, decimals = 0, suffix = '' }) {
    const [ref, current] = useCountUp(value);

    return (
        <div
            ref={ref}
            className="group text-center bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300"
        >
            <Icon className="h-6 w-6 text-[#90EE90] mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <div className="text-3xl sm:text-4xl font-bold text-white mb-1 drop-shadow-lg tabular-nums">
                {current.toLocaleString('en-PH', {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                })}
                {suffix}
            </div>
            <div className="text-sm text-white/80">{label}</div>
        </div>
    );
}

/**
 * @param variant  'text' rises further and faster; 'photo' is a shorter, slower
 *   move with a slight scale, because a photograph travelling as far as a
 *   paragraph reads as a layout glitch rather than as motion. 'line' draws a
 *   rule out from its left edge.
 */
function Reveal({ children, delay = 0, className = '', variant = 'text' }) {
    const ref = useReveal(delay);

    const motion = {
        text:  'gf-reveal',
        photo: 'gf-reveal-photo',
        line:  'gf-draw-line',
    }[variant] ?? 'gf-reveal';

    return (
        <div ref={ref} className={`${motion} ${className}`}>
            {children}
        </div>
    );
}

/* -------------------------------------------------------------------- page */

export default function Landing({ canLogin, stats, barangays = [] }) {
    const features = [
        { icon: Users, title: 'Farmer Registry', description: 'Complete RSBSA-aligned profiles with demographics, household details, and document records.' },
        { icon: Map, title: 'GIS Mapping', description: 'Draw and store exact parcel boundaries with GeoJSON for precise land visualization.' },
        { icon: Database, title: 'Farm Inventory', description: 'Track crops, livestock, poultry, tree crops, and fishponds in one place.' },
        { icon: Sprout, title: 'Seasonal Tracking', description: 'Monitor planting schedules, harvests, yields, and inputs across every cropping year.' },
        { icon: TrendingUp, title: 'Yield Forecasting', description: 'Statistical estimates from real harvest history, always shown with a confidence level.' },
        { icon: HandHeart, title: 'Assistance Programs', description: 'Record aid distribution by barangay and track exactly who received what.' },
        { icon: BarChart3, title: 'Reports & Analytics', description: 'Generate PDF reports on demographics, production, livestock, and assistance.' },
        { icon: Shield, title: 'Secure & Role-Based', description: 'Granular permissions and a full audit trail on every record that changes.' },
    ];

    const steps = [
        { icon: UserPlus, title: 'Register online', description: 'Fill in the RSBSA form from any phone or computer. It takes a few minutes and saves your place in the queue.' },
        { icon: Building2, title: 'Verify at the office', description: 'Bring your valid ID and documents to the Municipal Agriculture Office so staff can confirm your details.' },
        { icon: LayoutDashboard, title: 'Track everything', description: 'Once approved, sign in to see your parcels, livestock, and every assistance program you have received.' },
    ];

    return (
        <div className="min-h-screen bg-[#FAF8F3]">
            {/* ============================================================ hero */}
            <section className="relative overflow-hidden min-h-screen flex flex-col">
                {/* background photograph, slowly drifting */}
                <div className="absolute inset-0 overflow-hidden">
                    <img
                        src="/images/Tumauni LGU.jpg"
                        alt=""
                        className="w-full h-full object-cover gf-ken-burns"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-[#04240a]/95" />
                    {/* green cast so the photo sits inside the brand palette */}
                    <div className="absolute inset-0 bg-[#006400]/25 mix-blend-multiply" />
                </div>

                {/* drifting leaves */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                    {[
                        { left: '8%', top: '22%', size: 'h-8 w-8', delay: '0s', opacity: 'opacity-15' },
                        { left: '82%', top: '18%', size: 'h-10 w-10', delay: '1.4s', opacity: 'opacity-10' },
                        { left: '68%', top: '62%', size: 'h-6 w-6', delay: '2.6s', opacity: 'opacity-20' },
                        { left: '17%', top: '68%', size: 'h-7 w-7', delay: '3.8s', opacity: 'opacity-10' },
                    ].map((leaf, i) => (
                        <Leaf
                            key={i}
                            className={`absolute text-[#90EE90] gf-float ${leaf.size} ${leaf.opacity}`}
                            style={{ left: leaf.left, top: leaf.top, animationDelay: leaf.delay }}
                        />
                    ))}
                </div>

                {/* nav */}
                <nav className="relative z-50 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center gap-3">
                                <img
                                    src="/images/Logo.jpeg"
                                    alt="Seal of the Municipality of Tumauini, Isabela"
                                    className="h-10 w-10 flex-shrink-0 rounded-full bg-white object-contain p-0.5 ring-2 ring-white/40"
                                />
                                <div>
                                    <h1 className="text-xl font-bold text-white drop-shadow-md leading-tight">GeoFarm-IS</h1>
                                    <p className="text-xs text-white/80">Geographic Farm Information System</p>
                                </div>
                            </div>
                            {canLogin && (
                                <div className="flex items-center gap-3">
                                    <Link
                                        href="/farmer-registration"
                                        className="inline-flex items-center px-5 py-2.5 border-2 border-white/70 text-white rounded-xl hover:bg-white/15 hover:border-white transition-all duration-200 font-semibold text-sm"
                                    >
                                        Register
                                    </Link>
                                    <Link
                                        href="/login"
                                        className="group inline-flex items-center px-5 py-2.5 bg-white text-[#006400] rounded-xl hover:shadow-2xl transition-all duration-200 font-semibold text-sm shadow-lg"
                                    >
                                        Login
                                        <ChevronRight className="ml-1.5 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>

                {/* content */}
                <div className="relative z-10 flex-1 flex flex-col justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
                    <div className="text-center">
                        <Reveal>
                            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-2 rounded-full mb-8 border border-white/25">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#90EE90] opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#90EE90]" />
                                </span>
                                <MapPin className="h-4 w-4 text-white" />
                                <span className="text-sm font-medium text-white">LGU Agriculture Office · Tumauini, Isabela</span>
                            </div>
                        </Reveal>

                        <Reveal delay={120}>
                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-2xl tracking-tight leading-[1.05]">
                                Empowering Farmers
                                <span className="block bg-gradient-to-r from-[#90EE90] via-[#c8f7c8] to-[#90EE90] bg-clip-text text-transparent">
                                    Through Digital Innovation
                                </span>
                            </h1>
                        </Reveal>

                        <Reveal delay={240}>
                            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-10 drop-shadow-md leading-relaxed">
                                One place for farmer records, mapped farm parcels, harvest history, and
                                assistance programs — built for the {stats?.barangays ?? 46} barangays of Tumauini.
                            </p>
                        </Reveal>

                        <Reveal delay={360}>
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <Link
                                    href="/farmer-registration"
                                    className="group inline-flex items-center justify-center px-8 py-4 bg-white text-[#006400] rounded-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 font-bold text-lg shadow-xl"
                                >
                                    Register as a Farmer
                                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <a
                                    href="#how-it-works"
                                    className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur-md text-white border-2 border-white/40 rounded-xl hover:bg-white/20 hover:border-white/70 transition-all duration-200 font-bold text-lg"
                                >
                                    How It Works
                                </a>
                            </div>
                        </Reveal>
                    </div>

                    {/* live figures */}
                    <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        <StatCounter icon={MapPin} value={stats?.barangays ?? 0} label="Barangays Served" />
                        <StatCounter icon={Users} value={stats?.farmers ?? 0} label="Registered Farmers" />
                        <StatCounter icon={Ruler} value={stats?.hectares ?? 0} label="Hectares Mapped" decimals={2} />
                        <StatCounter icon={HandHeart} value={stats?.programs ?? 0} label="Assistance Programs" />
                    </div>
                </div>

                {/* scroll cue */}
                <a
                    href="#how-it-works"
                    className="relative z-10 mx-auto mb-8 text-white/50 hover:text-white transition-colors gf-bob"
                    aria-label="Scroll to how it works"
                >
                    <ChevronDown className="h-8 w-8" />
                </a>
            </section>

            {/* ================================================ barangay marquee */}
            {barangays.length > 0 && (
                <section className="bg-[#006400] py-5 overflow-hidden border-y-4 border-[#90EE90]/30">
                    <div className="flex items-center gap-4 mb-3 px-4 max-w-7xl mx-auto">
                        <Leaf className="h-5 w-5 text-[#90EE90] flex-shrink-0" />
                        <p className="text-sm font-semibold text-white/90 uppercase tracking-widest">
                            Serving all {barangays.length} barangays of Tumauini
                        </p>
                    </div>

                    <div className="gf-marquee-track relative flex overflow-hidden">
                        <div className="gf-marquee flex flex-shrink-0 items-center whitespace-nowrap">
                            {[...barangays, ...barangays].map((name, i) => (
                                <span key={i} className="inline-flex items-center text-white/70 text-sm font-medium px-5">
                                    {name}
                                    <span className="ml-5 h-1 w-1 rounded-full bg-[#90EE90]/60" />
                                </span>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ================================================ about the LGU */}
            <section id="about" className="py-24 bg-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                        {/* The photograph leads on desktop, because this band is
                            about the place rather than the software. Ordered
                            second on a phone so the heading arrives first. */}
                        <Reveal variant="photo" className="order-2 lg:order-1">
                            <div className="group relative">
                                <Photo
                                    photo={LANDING_PHOTOS.municipality}
                                    className="aspect-[4/3] rounded-3xl shadow-xl ring-1 ring-black/5"
                                />

                                {/* The municipal seal, overlapping the corner, so
                                    the band reads as the LGU's own page. */}
                                <img
                                    src="/images/Logo.jpeg"
                                    alt=""
                                    aria-hidden="true"
                                    className="absolute -right-4 -top-4 hidden h-20 w-20 rounded-full bg-white object-contain p-1 shadow-xl ring-1 ring-black/5 sm:block"
                                />
                            </div>
                        </Reveal>

                        <div className="order-1 lg:order-2">
                            <Reveal>
                                <span className="inline-block rounded-full bg-[#006400]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#006400]">
                                    {ABOUT_TUMAUINI.eyebrow}
                                </span>

                                <h2 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                                    {ABOUT_TUMAUINI.heading}
                                </h2>

                                <p className="mt-4 text-lg leading-relaxed text-gray-600">
                                    {ABOUT_TUMAUINI.lead}
                                </p>
                            </Reveal>

                            {/* A rule that draws itself in, rather than a static
                                divider sitting there before the text arrives. */}
                            <Reveal variant="line" delay={150}>
                                <div className="my-7 h-1 w-24 rounded-full bg-gradient-to-r from-[#006400] to-[#90EE90]" />
                            </Reveal>

                            {ABOUT_TUMAUINI.body.map((paragraph, i) => (
                                <Reveal key={i} delay={220 + i * 110}>
                                    <p className="mb-4 leading-relaxed text-gray-600">{paragraph}</p>
                                </Reveal>
                            ))}

                            {/*
                                Counted from the registry, so these are true by
                                construction rather than claimed. The figures the
                                office cannot verify — population, land area,
                                production rank — are deliberately absent.
                            */}
                            <Reveal delay={450}>
                                <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-gray-100 pt-8">
                                    {[
                                        { value: stats?.barangays ?? 0, label: 'Barangays served' },
                                        { value: stats?.farmers ?? 0, label: 'Farmers registered' },
                                        { value: stats?.programs ?? 0, label: 'Assistance programmes' },
                                    ].map((figure) => (
                                        <div key={figure.label}>
                                            <dt className="sr-only">{figure.label}</dt>
                                            <dd className="text-3xl font-bold tabular-nums text-[#006400]">
                                                {Number(figure.value).toLocaleString('en-PH')}
                                            </dd>
                                            <p className="mt-1 text-xs leading-snug text-gray-500">
                                                {figure.label}
                                            </p>
                                        </div>
                                    ))}
                                </dl>
                            </Reveal>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================================================== how it works */}
            <section id="how-it-works" className="py-24 bg-white relative overflow-hidden">
                {/* soft background bloom */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] bg-[#90EE90]/10 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                    <Reveal className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-[#006400]/10 text-[#006400] text-sm font-bold uppercase tracking-wider mb-4">
                            For Farmers
                        </span>
                        <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                            Three steps to get registered
                        </h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            No long queues to start. Begin online, finish at the office.
                        </p>
                    </Reveal>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        {/* connector line behind the cards on desktop */}
                        <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-[#006400]/20 via-[#006400]/40 to-[#006400]/20" />

                        {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <Reveal key={step.title} delay={i * 140}>
                                    <div className="relative text-center group">
                                        <div className="relative inline-flex items-center justify-center h-32 w-32 mb-6">
                                            <div className="absolute inset-0 bg-[#90EE90]/20 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500" />
                                            <div className="relative flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-[#006400] to-[#228B22] shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                                <Icon className="h-9 w-9 text-white" />
                                            </div>
                                            <span className="absolute top-1 right-3 flex items-center justify-center h-8 w-8 rounded-full bg-white border-2 border-[#006400] text-[#006400] font-bold text-sm shadow-md">
                                                {i + 1}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                                        <p className="text-gray-600 leading-relaxed max-w-xs mx-auto">{step.description}</p>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>

                    <Reveal delay={480} className="text-center mt-14">
                        <Link
                            href="/farmer-registration"
                            className="group inline-flex items-center px-8 py-4 bg-[#006400] text-white rounded-xl hover:bg-[#228B22] hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-200 font-bold text-lg shadow-lg"
                        >
                            Start your registration
                            <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </Reveal>
                </div>
            </section>

            {/* ======================================================== features */}
            <section id="features" className="py-24 bg-[#FAF8F3]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Reveal className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-[#006400]/10 text-[#006400] text-sm font-bold uppercase tracking-wider mb-4">
                            For the Agriculture Office
                        </span>
                        <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                            Everything in one system
                        </h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            From the first farmer record to the season's harvest forecast.
                        </p>
                    </Reveal>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, i) => {
                            const Icon = feature.icon;
                            return (
                                <Reveal key={feature.title} delay={(i % 4) * 100}>
                                    <div className="group relative h-full p-6 bg-white rounded-2xl border border-gray-200 hover:border-[#006400]/40 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden">
                                        <div className="absolute -top-12 -right-12 h-32 w-32 bg-[#90EE90]/0 group-hover:bg-[#90EE90]/25 rounded-full blur-2xl transition-colors duration-500" />

                                        <div className="relative">
                                            <div className="bg-gradient-to-br from-[#006400] to-[#228B22] w-12 h-12 rounded-xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                                                <Icon className="h-6 w-6 text-white" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                                            <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                                        </div>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ========================================================= benefits */}
            <section className="py-24 bg-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <Reveal>
                            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8 tracking-tight">
                                Why GeoFarm-IS?
                            </h2>
                            <div className="space-y-7">
                                {[
                                    { icon: Shield, title: 'Secure & accountable', text: 'Role-based access with a full audit trail, so every change to a farmer record is traceable.' },
                                    { icon: TrendingUp, title: 'Honest forecasting', text: 'Yield estimates always carry a confidence level and the number of harvests behind them — never a false precision.' },
                                    { icon: Map, title: 'Real parcel boundaries', text: 'GeoJSON-backed mapping means land area comes from the map, not from a guess.' },
                                    { icon: Database, title: 'One source of truth', text: 'Farmers, parcels, livestock, harvests, and assistance all linked in a single registry.' },
                                ].map((item, i) => {
                                    const Icon = item.icon;
                                    return (
                                        <Reveal key={item.title} delay={i * 110}>
                                            <div className="flex items-start gap-4 group">
                                                <div className="bg-gradient-to-br from-[#006400] to-[#228B22] p-2.5 rounded-xl flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                                                    <Icon className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 mb-1 text-lg">{item.title}</h3>
                                                    <p className="text-gray-600 leading-relaxed">{item.text}</p>
                                                </div>
                                            </div>
                                        </Reveal>
                                    );
                                })}
                            </div>
                        </Reveal>

                        <Reveal delay={200} variant="photo">
                            <div className="group">
                                {/* Its own positioning context, so the figure card
                                    below anchors to the PHOTO and not to the
                                    caption that follows it. */}
                                <div className="relative">
                                    {/*
                                        A photograph of the office, where a plain
                                        green square with a map pin used to be.
                                        The caption sits over the image rather
                                        than replacing it, so the claim is still
                                        made once the picture arrives.
                                    */}
                                    <Photo
                                        photo={LANDING_PHOTOS.office}
                                        className="aspect-square rounded-3xl shadow-2xl"
                                    >
                                        {/* Over a real photo only — over the blank
                                            it would fight the placeholder's own
                                            caption. */}
                                        {LANDING_PHOTOS.office.src && (
                                            <>
                                                <div className="absolute inset-0 bg-gradient-to-t from-[#04240a] via-[#04240a]/45 to-transparent" />
                                                <div className="absolute inset-x-0 bottom-0 p-8 text-white">
                                                    <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                                        Built for Tumauini
                                                    </h3>
                                                    <p className="mt-2 max-w-sm leading-relaxed text-white/85">
                                                        Designed around how the Municipal Agriculture Office
                                                        actually works — not adapted from somewhere else.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </Photo>

                                    {/* floating figure card */}
                                    <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-2xl p-5 border border-gray-100 hidden sm:block">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-[#006400]/10 p-2.5 rounded-xl">
                                                <Sprout className="h-6 w-6 text-[#006400]" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900 leading-none tabular-nums">
                                                    {Number(stats?.hectares ?? 0).toFixed(2)}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">hectares mapped</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/*
                                    With no photo yet the claim still needs
                                    making, so it sits underneath rather than
                                    over the top of the placeholder's own label.
                                    The margin clears the figure card, which
                                    hangs 24px below the image on sm and up.
                                */}
                                {!LANDING_PHOTOS.office.src && (
                                    <div className="mt-10 text-center sm:mt-14">
                                        <h3 className="text-2xl font-bold tracking-tight text-gray-900">
                                            Built for Tumauini
                                        </h3>
                                        <p className="mx-auto mt-2 max-w-sm leading-relaxed text-gray-600">
                                            Designed around how the Municipal Agriculture Office actually
                                            works — not adapted from somewhere else.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ======================================================== gallery */}
            <section id="activities" className="py-24 bg-[#FAF8F3] overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Reveal className="text-center">
                        <span className="inline-block rounded-full bg-[#006400]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#006400]">
                            In the field
                        </span>
                        <h2 className="mx-auto mt-5 max-w-2xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                            The office at work
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
                            Distributions, surveys, training and harvest across the barangays of Tumauini.
                        </p>
                    </Reveal>

                    {/*
                        Two columns on a phone rather than one: four stacked
                        landscape photographs turn this band into a long scroll
                        past nothing in particular.
                    */}
                    <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
                        {LANDING_PHOTOS.activities.map((photo, i) => (
                            <Reveal key={i} variant="photo" delay={i * 120}>
                                <figure className="group relative">
                                    <Photo
                                        photo={photo}
                                        className="aspect-[4/3] rounded-2xl shadow-md ring-1 ring-black/5"
                                    >
                                        {/* The caption belongs to the real photo
                                            only; the blank already names itself. */}
                                        {photo.src && (
                                            <>
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                                                <figcaption className="absolute inset-x-0 bottom-0 translate-y-2 p-4 text-sm font-medium text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                                                    {photo.label}
                                                </figcaption>
                                            </>
                                        )}
                                    </Photo>
                                </figure>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ============================================================== cta */}
            <section
                className="relative py-24 overflow-hidden"
                style={{
                    backgroundImage: [
                        'radial-gradient(circle at 15% 25%, rgba(144,238,144,0.18) 0%, transparent 45%)',
                        'radial-gradient(circle at 85% 75%, rgba(255,255,255,0.10) 0%, transparent 50%)',
                        'linear-gradient(135deg, #004d00 0%, #006400 55%, #228B22 100%)',
                    ].join(', '),
                }}
            >
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
                    <Reveal>
                        <Leaf className="h-12 w-12 text-[#90EE90] mx-auto mb-6" />
                        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 tracking-tight">
                            Ready to get started?
                        </h2>
                        <p className="text-xl text-white/85 mb-10 leading-relaxed">
                            Farmers can register online today. Office staff can sign in to manage the registry.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link
                                href="/farmer-registration"
                                className="group inline-flex items-center justify-center px-8 py-4 bg-white text-[#006400] rounded-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 font-bold text-lg shadow-xl"
                            >
                                Register as a Farmer
                                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            {canLogin && (
                                <Link
                                    href="/login"
                                    className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur-md text-white border-2 border-white/40 rounded-xl hover:bg-white/20 hover:border-white/70 transition-all duration-200 font-bold text-lg"
                                >
                                    Staff Login
                                </Link>
                            )}
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* =========================================================== footer */}
            <footer className="bg-[#04240a] py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-3">
                            {/* The footer carried a generic leaf while the nav
                                above it showed the LGU mark; both are the seal now. */}
                            <img
                                src="/images/Logo.jpeg"
                                alt="Seal of the Municipality of Tumauini, Isabela"
                                className="h-11 w-11 flex-shrink-0 rounded-full bg-white object-contain p-0.5 ring-2 ring-white/25"
                            />
                            <div>
                                <h3 className="font-bold text-white">GeoFarm-IS</h3>
                                <p className="text-xs text-white/60">LGU Agriculture Office, Tumauini, Isabela</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm">
                            <a href="#about" className="text-white/70 hover:text-[#90EE90] transition-colors">The Municipality</a>
                            <a href="#how-it-works" className="text-white/70 hover:text-[#90EE90] transition-colors">How It Works</a>
                            <a href="#features" className="text-white/70 hover:text-[#90EE90] transition-colors">Features</a>
                            <a href="#activities" className="text-white/70 hover:text-[#90EE90] transition-colors">In the Field</a>
                            <Link href="/login" className="text-white/70 hover:text-[#90EE90] transition-colors">Login</Link>
                        </div>

                        <div className="text-center md:text-right text-sm text-white/60">
                            <p>&copy; 2026 GeoFarm Information System</p>
                            <p className="text-xs mt-1 text-white/40">Version 1.0</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
