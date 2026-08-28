import PublicFormShell from '@/Layouts/PublicFormShell';
import { Link } from '@inertiajs/react';
import { CheckCircle2, MapPin, FileText, ShieldCheck } from 'lucide-react';

export default function RegistrationSubmitted({ referenceCode, fullName, email }) {
    return (
        <PublicFormShell title="Registration Submitted">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                    <CheckCircle2 className="mx-auto h-16 w-16 text-green-600 mb-4" />
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Registration submitted</h1>
                    <p className="text-gray-600 mb-6">
                        Thank you, {fullName}. Your registration has been received but is
                        <strong> not yet verified</strong>.
                    </p>

                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6">
                        <p className="text-sm text-green-800 uppercase font-semibold mb-1">Your reference number</p>
                        <p className="text-2xl font-bold tracking-wide text-green-900">{referenceCode}</p>
                        <p className="text-sm text-green-800 mt-2">
                            Write this down. Staff will ask for it at the Agriculture Office.
                        </p>
                    </div>

                    <div className="text-left space-y-4 mb-8">
                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-700">
                                Visit the <strong>LGU Agriculture Office, Tumauini, Isabela</strong>.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-700">
                                Bring your valid ID and supporting documents so staff can compare them with this submission.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-700">
                                Once approved, your account <strong>{email}</strong> is activated and you can log in to your dashboard.
                                Logging in before approval will show an "account not yet active" message.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                        <Link
                            href="/"
                            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                        >
                            Back to home
                        </Link>
                        <Link
                            href="/login"
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-md"
                        >
                            Go to login
                        </Link>
                    </div>
                </div>
            </div>
        </PublicFormShell>
    );
}
