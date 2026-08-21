import { Link, router } from '@inertiajs/react';
import { Leaf, MapPin, Users, TrendingUp, LogOut, Home, FileText, Sprout } from 'lucide-react';

export default function FarmerDashboard({ auth, farmer, stats }) {
    const handleLogout = () => {
        router.post('/logout');
    };

    return (
        <div className="min-h-screen bg-[#FAF8F3]">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <div className="bg-[#006400] p-2 rounded-lg">
                                <Leaf className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-[#006400]">GeoFarm-IS</h1>
                                <p className="text-xs text-gray-600">Farmer Portal</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold text-gray-900">{auth.user.name}</p>
                                <p className="text-xs text-gray-600">{auth.user.email}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <div className="bg-gradient-to-r from-[#006400] to-[#228B22] rounded-2xl p-8 mb-8 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Welcome back, {farmer.first_name}!</h1>
                            <p className="text-white/90 text-lg">
                                RSBSA: {farmer.rsbsa_no} • Barangay: {farmer.barangay}
                            </p>
                        </div>
                        <Home className="h-16 w-16 text-white/20" />
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-blue-100 p-3 rounded-lg">
                                <MapPin className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">{stats.parcels}</h3>
                        <p className="text-gray-600 text-sm">Farm Parcels</p>
                        <p className="text-xs text-gray-500 mt-1">{stats.total_area.toFixed(2)} hectares total</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-green-100 p-3 rounded-lg">
                                <Sprout className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">{stats.livestock}</h3>
                        <p className="text-gray-600 text-sm">Livestock Records</p>
                        <p className="text-xs text-gray-500 mt-1">Active inventory</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-purple-100 p-3 rounded-lg">
                                <FileText className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">{stats.assistance}</h3>
                        <p className="text-gray-600 text-sm">Assistance Received</p>
                        <p className="text-xs text-gray-500 mt-1">Total programs</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-orange-100 p-3 rounded-lg">
                                <TrendingUp className="h-6 w-6 text-orange-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">Active</h3>
                        <p className="text-gray-600 text-sm">Account Status</p>
                        <p className="text-xs text-gray-500 mt-1">Registered farmer</p>
                    </div>
                </div>

                {/* Profile Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Personal Information</h2>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-600">Full Name</p>
                                <p className="font-semibold text-gray-900">{farmer.full_name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">RSBSA Number</p>
                                <p className="font-semibold text-gray-900">{farmer.rsbsa_no}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Birthdate</p>
                                <p className="font-semibold text-gray-900">
                                    {farmer.birthdate ? new Date(farmer.birthdate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    }) : 'N/A'}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Sex</p>
                                    <p className="font-semibold text-gray-900">{farmer.sex || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Civil Status</p>
                                    <p className="font-semibold text-gray-900">{farmer.civil_status || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Contact & Location</h2>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-600">Email</p>
                                <p className="font-semibold text-gray-900">{farmer.email || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Mobile Number</p>
                                <p className="font-semibold text-gray-900">{farmer.mobile_no || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Address</p>
                                <p className="font-semibold text-gray-900">
                                    {farmer.barangay}, {farmer.city_municipality}, {farmer.province}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Farm Parcels */}
                {farmer.parcels && farmer.parcels.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 mb-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">My Farm Parcels</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parcel #</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barangay</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farm Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area (ha)</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ownership</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {farmer.parcels.map((parcel) => (
                                        <tr key={parcel.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{parcel.parcel_no}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{parcel.barangay}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{parcel.farm_type?.name || 'N/A'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{parcel.total_area}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{parcel.ownership_type}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Assistance Programs */}
                {farmer.distributions && farmer.distributions.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Assistance Received</h2>
                        <div className="space-y-3">
                            {farmer.distributions.map((dist) => (
                                <div key={dist.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-gray-900">{dist.program?.name || 'N/A'}</p>
                                        <p className="text-sm text-gray-600">
                                            {dist.program?.type} • Received: {new Date(dist.distribution_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-[#006400]">₱{parseFloat(dist.amount).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>&copy; 2026 GeoFarm-IS. All rights reserved.</p>
                    <p className="mt-1">LGU Agriculture Office, Tumauini, Isabela</p>
                </div>
            </div>
        </div>
    );
}
