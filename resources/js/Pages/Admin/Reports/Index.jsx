import AdminLayout from '@/Layouts/AdminLayout';

function ReportCard({ title, description, links }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-1">{title}</h3>
            <p className="text-sm text-gray-400 mb-4">{description}</p>
            <div className="flex gap-2">
                {links.map(({ label, href }) => (
                    <a key={label} href={href} target="_blank"
                        className="bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-800">
                        {label}
                    </a>
                ))}
            </div>
        </div>
    );
}

export default function ReportsIndex() {
    return (
        <AdminLayout title="Reports & Export">
            <div className="grid grid-cols-2 gap-5">
                <ReportCard
                    title="Farmer Demographics"
                    description="Breakdown of farmers by barangay and sex."
                    links={[
                        { label: 'Download PDF', href: '/admin/reports/farmer-demographics?format=pdf' },
                        { label: 'View JSON', href: '/admin/reports/farmer-demographics' },
                    ]} />
                <ReportCard
                    title="Crop Production"
                    description="Total area planted and yield per crop per season."
                    links={[
                        { label: 'Download PDF', href: '/admin/reports/crop-production?format=pdf' },
                    ]} />
                <ReportCard
                    title="Livestock Inventory"
                    description="Total livestock count by type."
                    links={[
                        { label: 'Download PDF', href: '/admin/reports/livestock?format=pdf' },
                    ]} />
                <ReportCard
                    title="Assistance Distribution Summary"
                    description="All distributions with farmer details and amounts."
                    links={[
                        { label: 'Download PDF', href: '/admin/reports/assistance?format=pdf' },
                    ]} />
                <ReportCard
                    title="Agricultural Assets"
                    description="Tree crops, fishponds, ruminants, swine, and poultry by barangay."
                    links={[
                        { label: 'Download PDF', href: '/admin/reports/agricultural-assets?format=pdf' },
                        { label: 'View JSON', href: '/admin/reports/agricultural-assets' },
                    ]} />
            </div>
        </AdminLayout>
    );
}
