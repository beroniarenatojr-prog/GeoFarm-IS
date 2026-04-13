import { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';

export default function FarmInventoryIndex({ farmers, selectedFarmer, inventory, selectedFarmerId }) {
    const [activeTab, setActiveTab] = useState('crops');
    const isAllFarmers = selectedFarmerId === 'all' || !selectedFarmerId;

    function selectFarmer(e) {
        router.get('/admin/farm-inventory', { farmer_id: e.target.value }, { preserveState: true });
    }

    function exportInventory() {
        if (!selectedFarmer) return;
        window.location.href = `/admin/farm-inventory/${selectedFarmer.id}/export`;
    }

    return (
        <AdminLayout title="Farm Inventory">
            {/* Farmer Selection */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Farmer:</label>
                    <select
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={selectedFarmerId || 'all'}
                        onChange={selectFarmer}
                    >
                        <option value="all">📊 All Farmers (Aggregated)</option>
                        <option disabled>──────────</option>
                        {farmers.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                    </select>
                    {selectedFarmer && (
                        <button
                            onClick={exportInventory}
                            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800 whitespace-nowrap"
                        >
                            📊 Export to Excel
                        </button>
                    )}
                </div>
            </div>

            {inventory ? (
                <>
                    {/* Farmer Info or All Farmers Header */}
                    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                        {isAllFarmers ? (
                            <>
                                <h2 className="text-lg font-semibold text-gray-800">
                                    📊 All Farmers - Aggregated Inventory
                                </h2>
                                <p className="text-sm text-gray-600">
                                    Showing total inventory across all registered farmers
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-lg font-semibold text-gray-800">
                                    {selectedFarmer.first_name} {selectedFarmer.last_name}
                                </h2>
                                <p className="text-sm text-gray-600">RSBSA: {selectedFarmer.rsbsa_no}</p>
                            </>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-xl shadow-sm mb-6">
                        <div className="border-b flex">
                            {[
                                ['crops', '🌾 Crops'],
                                ['trees', '🌳 Tree Crops & Fishponds'],
                                ['livestock', '🐄 Livestock & Poultry']
                            ].map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                                        activeTab === key
                                            ? 'text-green-700 border-b-2 border-green-700'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            {activeTab === 'crops' && <CropsTab inventory={inventory} isAggregated={isAllFarmers} />}
                            {activeTab === 'trees' && <TreesTab inventory={inventory} isAggregated={isAllFarmers} />}
                            {activeTab === 'livestock' && <LivestockTab inventory={inventory} isAggregated={isAllFarmers} />}
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
                    Select a farmer above to view their farm inventory.
                </div>
            )}
        </AdminLayout>
    );
}

function CropsTab({ inventory }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">Crop Areas</h3>
                <button className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                    + Add Crop Season
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Crop</th>
                            <th className="px-4 py-3">Season</th>
                            <th className="px-4 py-3">Year</th>
                            <th className="px-4 py-3">Area (ha)</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.crops.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                                    No crop records yet.
                                </td>
                            </tr>
                        ) : (
                            inventory.crops.map((crop, i) => (
                                <tr key={i} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3">{crop.crop?.crop_name ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                            crop.season === 'dry' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {crop.season}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{crop.cropping_year}</td>
                                    <td className="px-4 py-3 font-medium">{crop.total_area}</td>
                                    <td className="px-4 py-3">
                                        <button className="text-green-600 hover:underline text-xs mr-2">Edit</button>
                                        <button className="text-red-500 hover:underline text-xs">Delete</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {inventory.crops.length > 0 && (
                        <tfoot className="bg-gray-50 font-semibold">
                            <tr>
                                <td colSpan="3" className="px-4 py-3 text-right">Total Area:</td>
                                <td className="px-4 py-3 text-green-700">{inventory.total_crop_area} ha</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}

function TreesTab({ inventory }) {
    return (
        <div className="space-y-6">
            {/* Tree Crops */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-700">Tree Crops</h3>
                    <button className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                        + Add Tree Crop
                    </button>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Crop Type</th>
                            <th className="px-4 py-3">Quantity / Area</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.tree_crops.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-4 py-8 text-center text-gray-400">No tree crops yet.</td>
                            </tr>
                        ) : (
                            inventory.tree_crops.map(tree => (
                                <tr key={tree.id} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3">{tree.crop_type}</td>
                                    <td className="px-4 py-3">
                                        {tree.quantity ? `${tree.quantity} trees` : `${tree.area_hectares} ha`}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button className="text-green-600 hover:underline text-xs mr-2">Edit</button>
                                        <button className="text-red-500 hover:underline text-xs">Delete</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Fishponds */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-700">Fishponds</h3>
                    <button className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                        + Add Fishpond
                    </button>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Species</th>
                            <th className="px-4 py-3">Area (ha)</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.fishponds.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-4 py-8 text-center text-gray-400">No fishponds yet.</td>
                            </tr>
                        ) : (
                            inventory.fishponds.map(pond => (
                                <tr key={pond.id} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3">{pond.species}</td>
                                    <td className="px-4 py-3">{pond.area_hectares}</td>
                                    <td className="px-4 py-3">
                                        <button className="text-green-600 hover:underline text-xs mr-2">Edit</button>
                                        <button className="text-red-500 hover:underline text-xs">Delete</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function LivestockTab({ inventory, isAggregated }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">Livestock & Poultry</h3>
                {!isAggregated && (
                    <button className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                        + Add Livestock/Poultry
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Male</th>
                            <th className="px-4 py-3">Female</th>
                            <th className="px-4 py-3">Total</th>
                            {isAggregated && <th className="px-4 py-3">Farmers</th>}
                            {!isAggregated && <th className="px-4 py-3">Status</th>}
                            {!isAggregated && <th className="px-4 py-3">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.livestock.length === 0 ? (
                            <tr>
                                <td colSpan={isAggregated ? "6" : "7"} className="px-4 py-8 text-center text-gray-400">
                                    No livestock or poultry records yet.
                                </td>
                            </tr>
                        ) : (
                            inventory.livestock.map((animal, idx) => (
                                <tr key={isAggregated ? idx : `${animal.table}-${animal.id}`} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium">{animal.type}</td>
                                    <td className="px-4 py-3 text-gray-600">{animal.category}</td>
                                    <td className="px-4 py-3">{animal.male}</td>
                                    <td className="px-4 py-3">{animal.female}</td>
                                    <td className="px-4 py-3 font-semibold">{animal.total}</td>
                                    {isAggregated && (
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                {animal.farmer_count} farmers
                                            </span>
                                        </td>
                                    )}
                                    {!isAggregated && (
                                        <>
                                            <td className="px-4 py-3">
                                                {animal.is_large_raiser && (
                                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                                        Large Raiser
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button className="text-green-600 hover:underline text-xs mr-2">Edit</button>
                                                <button className="text-red-500 hover:underline text-xs">Delete</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
