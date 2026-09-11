import FarmAnalysisReport from '@/Components/Analytics/FarmAnalysisReport';

/**
 * The farmer's own copy of their farm analysis.
 *
 * The same report the office reads, rendered on the portal's own ground rather
 * than inside the admin shell. Sharing the component is the point: two
 * renderings that disagreed about the same farm, in front of the farmer whose
 * farm it is, would be worse than having only one.
 *
 * The audience flag changes wording and hides the office's own controls — it
 * never changes a level, a factor or a figure.
 */
export default function FarmerAnalysis(props) {
    return (
        <div className="min-h-screen bg-[#FAF8F3]">
            <FarmAnalysisReport
                {...props}
                audience="farmer"
                backHref="/farmer/dashboard"
                backLabel="Back to my dashboard"
            />
        </div>
    );
}
