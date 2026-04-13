import AdminLayout from '@/Layouts/AdminLayout';
import { useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export default function ParcelForm({ parcel, farmers, farmTypes, geojson }) {
    const isEdit = !!parcel;
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const drawnLayer = useRef(null);
    const [mapReady, setMapReady] = useState(false);

    const { data, setData, post, put, processing, errors } = useForm({
        farmer_id:         parcel?.farmer_id ?? '',
        parcel_number:     parcel?.parcel_number ?? '',
        location_address:  parcel?.location_address ?? '',
        barangay:          parcel?.barangay ?? '',
        city_municipality: parcel?.city_municipality ?? '',
        province:          parcel?.province ?? '',
        total_area_ha:     parcel?.total_area_ha ?? '',
        farm_type_id:      parcel?.farm_type_id ?? '',
        ownership_type:    parcel?.ownership_type ?? '',
        land_owner_name:   parcel?.land_owner_name ?? '',
        within_ancestral:  parcel?.within_ancestral ?? false,
        arb:               parcel?.arb ?? false,
        geojson:           geojson ?? '',
    });

    useEffect(() => {
        // Dynamically import Leaflet to avoid SSR issues
        import('leaflet').then(L => {
            import('leaflet/dist/leaflet.css');
            if (mapInstance.current) return;

            const map = L.map(mapRef.current).setView([17.0, 121.8], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            mapInstance.current = map;

            // Load existing geometry
            if (geojson) {
                const layer = L.geoJSON(JSON.parse(geojson)).addTo(map);
                drawnLayer.current = layer;
                map.fitBounds(layer.getBounds());
            }

            // Simple click-to-draw polygon (use leaflet-draw in production)
            let points = [];
            let tempLayer = null;

            map.on('click', e => {
                points.push([e.latlng.lat, e.latlng.lng]);
                if (tempLayer) map.removeLayer(tempLayer);
                if (points.length >= 3) {
                    tempLayer = L.polygon(points, { color: 'green' }).addTo(map);
                    const gj = tempLayer.toGeoJSON();
                    setData('geojson', JSON.stringify(gj.geometry));
                }
            });

            map.on('dblclick', () => { points = []; if (tempLayer) map.removeLayer(tempLayer); });
            setMapReady(true);
        });
    }, []);

    const submit = e => {
        e.preventDefault();
        isEdit ? put(`/admin/parcels/${parcel.id}`) : post('/admin/parcels');
    };

    return (
        <AdminLayout title={isEdit ? 'Edit Parcel' : 'Add Farm Parcel'}>
            <form onSubmit={submit} className="space-y-6 max-w-4xl">
                <div className="bg-white rounded-xl shadow-sm p-6 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Farmer</label>
                        <select value={data.farmer_id} onChange={e => setData('farmer_id', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="">Select farmer</option>
                            {farmers.map(f => (
                                <option key={f.id} value={f.id}>{f.last_name}, {f.first_name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Farm Type</label>
                        <select value={data.farm_type_id} onChange={e => setData('farm_type_id', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="">Select type</option>
                            {farmTypes.map(t => <option key={t.id} value={t.id}>{t.type_name}</option>)}
                        </select>
                    </div>
                    {[
                        ['Parcel Number', 'parcel_number'],
                        ['Total Area (ha)', 'total_area_ha', 'number'],
                        ['Barangay', 'barangay'],
                        ['City/Municipality', 'city_municipality'],
                        ['Province', 'province'],
                        ['Land Owner Name', 'land_owner_name'],
                    ].map(([label, key, type = 'text']) => (
                        <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                            <input type={type} value={data[key]} onChange={e => setData(key, e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                    ))}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Type</label>
                        <select value={data.ownership_type} onChange={e => setData('ownership_type', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                            <option value="">Select</option>
                            {['Registered Owner','Lessee','Tenant','Other'].map(o => <option key={o}>{o}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-6 items-center">
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={data.within_ancestral} onChange={e => setData('within_ancestral', e.target.checked)} />
                            Within Ancestral Domain
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={data.arb} onChange={e => setData('arb', e.target.checked)} />
                            ARB
                        </label>
                    </div>
                </div>

                {/* Map */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <h3 className="font-semibold text-gray-700 mb-2">Draw Parcel Boundary</h3>
                    <p className="text-xs text-gray-400 mb-3">Click on the map to draw polygon points. Double-click to reset.</p>
                    <div ref={mapRef} className="w-full h-80 rounded-lg border z-0" />
                    {data.geojson && (
                        <p className="text-xs text-green-600 mt-2">✓ Geometry captured</p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button type="submit" disabled={processing}
                        className="bg-green-700 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-800">
                        {processing ? 'Saving...' : isEdit ? 'Update Parcel' : 'Add Parcel'}
                    </button>
                    <a href="/admin/parcels" className="px-6 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</a>
                </div>
            </form>
        </AdminLayout>
    );
}
