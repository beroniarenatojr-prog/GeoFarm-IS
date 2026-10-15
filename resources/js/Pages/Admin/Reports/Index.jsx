import { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import ModalShell from '@/Components/ui/ModalShell';
import {
    Eye, Download, Printer, Users, Sprout, Beef, HandCoins, Trees, Loader2,
} from 'lucide-react';

/**
 * Reports & Export.
 *
 * Every report is previewed before it is downloaded. The preview is the same
 * Blade view DomPDF renders, served as HTML — not a second rendering of the
 * figures in React, which would eventually disagree with the file about what is
 * in it. These go to the DA, so "what you saw is what you sent" matters more
 * than the convenience of a hand-built preview table.
 *
 * It is framed rather than injected: each report template is a complete HTML
 * document whose CSS targets bare `table`, `th` and `td`, so dropping it into
 * this page would restyle the entire dashboard.
 */

const REPORTS = [
    {
        key: 'farmer-demographics',
        title: 'Farmer Demographics',
        description: 'Breakdown of farmers by barangay and sex.',
        icon: Users,
        path: '/admin/reports/farmer-demographics',
    },
    {
        key: 'crop-production',
        title: 'Crop Production',
        description: 'Total area planted and yield per crop per season.',
        icon: Sprout,
        path: '/admin/reports/crop-production',
    },
    {
        key: 'livestock',
        title: 'Livestock Inventory',
        description: 'Total livestock count by type.',
        icon: Beef,
        path: '/admin/reports/livestock',
    },
    {
        key: 'assistance',
        title: 'Assistance Distribution Summary',
        description: 'All distributions with farmer details and amounts.',
        icon: HandCoins,
        path: '/admin/reports/assistance',
    },
    {
        key: 'agricultural-assets',
        title: 'Agricultural Assets',
        description: 'Tree crops, fishponds, ruminants, swine, and poultry by barangay.',
        icon: Trees,
        path: '/admin/reports/agricultural-assets',
    },
];

export default function ReportsIndex() {
    const [preview, setPreview] = useState(null);

    return (
        <AdminLayout title="Reports & Export">
            <p className="mb-5 text-sm text-gray-500">
                Open a report to check it before you download. Figures come straight from the
                registry at the moment you open it.
            </p>

            {/* One column on a phone. Two side-by-side cards at 360px wide left
                every description clipped mid-sentence. */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {REPORTS.map((report) => (
                    <ReportCard
                        key={report.key}
                        report={report}
                        onView={() => setPreview(report)}
                    />
                ))}
            </div>

            {preview && (
                <PreviewModal report={preview} onClose={() => setPreview(null)} />
            )}
        </AdminLayout>
    );
}

function ReportCard({ report, onView }) {
    const { title, description, icon: Icon, path } = report;

    return (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50">
                    <Icon className="h-5 w-5 text-[#006400]" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-800">{title}</h3>
                    <p className="mt-0.5 text-sm text-gray-500">{description}</p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onView}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#006400] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#004d00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006400]"
                >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    View report
                </button>

                {/*
                    Still here for anyone who already knows what this report
                    says and just wants the file. The preview is the way in, not
                    a toll gate.
                */}
                <a
                    href={`${path}?format=pdf`}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006400]"
                >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    PDF
                </a>
            </div>
        </div>
    );
}

/**
 * The report itself, in a frame.
 *
 * The iframe loads the same authenticated route the download uses with
 * format=html, so the session cookie goes with it and the server applies the
 * same permission check. Nothing about the report is reconstructed here.
 */
function PreviewModal({ report, onClose }) {
    const [loading, setLoading] = useState(true);

    const previewUrl = `${report.path}?format=html`;

    return (
        <ModalShell
            open
            onClose={onClose}
            title={report.title}
            size="2xl"
            /*
                No padding — the frame fills the body, and padding would show as
                a white margin around a document that has its own. overflow-hidden
                because the iframe scrolls internally: without it the modal body
                puts a second scrollbar around the first.
            */
            bodyClass="p-0 overflow-hidden"
            footer={(
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Close
                    </button>

                    {/*
                        Printing the frame rather than the page. window.print()
                        on the modal would print the dashboard behind it; the
                        frame holds the report's own print stylesheet.
                    */}
                    <button
                        type="button"
                        onClick={() => {
                            const frame = document.getElementById('report-preview-frame');
                            frame?.contentWindow?.focus();
                            frame?.contentWindow?.print();
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print
                    </button>

                    <a
                        href={`${report.path}?format=pdf`}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#006400] px-4 py-2 text-sm font-medium text-white hover:bg-[#004d00]"
                    >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download PDF
                    </a>
                </>
            )}
        >
            <div className="relative h-[70vh] bg-gray-100">
                {loading && (
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white"
                        role="status"
                    >
                        <Loader2 className="h-6 w-6 animate-spin text-[#006400]" aria-hidden="true" />
                        <p className="text-sm text-gray-500">Building the report…</p>
                    </div>
                )}

                <iframe
                    id="report-preview-frame"
                    src={previewUrl}
                    title={`${report.title} preview`}
                    onLoad={() => setLoading(false)}
                    className="h-full w-full border-0 bg-white"
                />
            </div>
        </ModalShell>
    );
}
