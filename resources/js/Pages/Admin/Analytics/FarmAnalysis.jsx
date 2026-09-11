import AdminLayout from '@/Layouts/AdminLayout';
import FarmAnalysisReport from '@/Components/Analytics/FarmAnalysisReport';

/**
 * The office's view of one farm.
 *
 * A shell around the shared report, so the farmer's own copy on the portal and
 * this one cannot drift apart. Two renderings of the same analysis that
 * disagreed in front of the same farmer would be worse than having only one.
 */
export default function FarmAnalysis(props) {
    return (
        <AdminLayout title="Farm Analysis">
            <FarmAnalysisReport {...props} audience="office" />
        </AdminLayout>
    );
}
