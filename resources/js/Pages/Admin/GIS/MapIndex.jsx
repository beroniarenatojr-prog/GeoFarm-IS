import { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { router } from '@inertiajs/react';
import { MapContainer, TileLayer, FeatureGroup, GeoJSON, useMap } from 'react-leaflet';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

// Fix Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Drawing control component
function DrawControl({ selectedParcel, onSave, canEdit, canDelete }) {
    const map = useMap();
    const drawnItemsRef = useRef(new L.FeatureGroup());

    useEffect(() => {
        const drawnItems = drawnItemsRef.current;
        map.addLayer(drawnItems);

        if (canEdit) {
            const drawControl = new L.Control.Draw({
                edit: {
                    featureGroup: drawnItems,
                },
                draw: {
                    polygon: {
                        allowIntersection: false,
                        drawError: {
                            color: '#e74c3c',
                            message: '<strong>Error:</strong> Shape edges cannot cross!',
                        },
                        shapeOptions: {
                            color: '#3b82f6',
                            fillOpacity: 0.3,
                        },
                    },
                    polyline: false,
                    rectangle: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                },
            });

            map.addControl(drawControl);

            // Handle draw created
            map.on(L.Draw.Event.CREATED, (e) => {
                if (!selectedParcel) {
                    toast.error('Please select a parcel first');
                    return;
                }

                const layer = e.layer;
                const geoJSON = layer.toGeoJSON();
                drawnItems.addLayer(layer);

                onSave(selectedParcel, geoJSON.geometry);
            });

            // Handle draw edited
            map.on(L.Draw.Event.EDITED, (e) => {
                const layers = e.layers;
                layers.eachLayer((layer) => {
                    const geoJSON = layer.toGeoJSON();
                    const parcelId = layer.feature?.properties?.id;
                    if (parcelId) {
                        onSave(parcelId, geoJSON.geometry);
                    }
                });
            });

            // Handle draw deleted
            map.on(L.Draw.Event.DELETED, (e) => {
                const layers = e.layers;
                layers.eachLayer((layer) => {
                    const parcelId = layer.feature?.properties?.id;
                    if (parcelId) {
                        router.delete(`/admin/gis/parcels/${parcelId}/geometry`, {
                            preserveState: true,
                            preserveScroll: true,
                            onSuccess: () => toast.success('Boundary deleted!'),
                            onError: () => toast.error('Failed to delete boundary'),
                        });
                    }
                });
            });

            return () => {
                map.removeControl(drawControl);
                map.off(L.Draw.Event.CREATED);
                map.off(L.Draw.Event.EDITED);
                map.off(L.Draw.Event.DELETED);
            };
        }
    }, [map, selectedParcel, onSave, canEdit, canDelete]);

    return null;
}

export default function MapIndex({ parcels }) {
    const { can } = usePermissions();
    const [selectedParcel, setSelectedParcel] = useState('');
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Default center (Tumauini, Isabela coordinates)
    const center = [17.2677, 121.8069];

    useEffect(() => {
        loadParcels();
    }, []);

    const loadParcels = () => {
        fetch('/admin/gis/parcels-geojson')
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error('Error loading parcels:', err));
    };

    const handleSave = (parcelId, geometry) => {
        setLoading(true);
        router.post(
            `/admin/gis/parcels/${parcelId}/geometry`,
            { geojson: JSON.stringify(geometry) },
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Farm boundary saved!');
                    loadParcels();
                },
                onError: () => toast.error('Failed to save boundary'),
                onFinish: () => setLoading(false),
            }
        );
    };

    const onEachFeature = (feature, layer) => {
        if (feature.properties) {
            const { parcel_number, farmer_name, barangay, area_ha } = feature.properties;
            layer.bindPopup(`
                <div class="p-2">
                    <h3 class="font-bold text-sm mb-1">Parcel: ${parcel_number}</h3>
                    <p class="text-xs"><strong>Farmer:</strong> ${farmer_name}</p>
                    <p class="text-xs"><strong>Barangay:</strong> ${barangay}</p>
                    <p class="text-xs"><strong>Area:</strong> ${area_ha} ha</p>
                </div>
            `);
        }
    };

    const canEdit = can('edit parcels');
    const canDelete = can('delete parcels');

    return (
        <AdminLayout title="🗺️ GIS Farm Mapping">
            <div className="bg-white rounded-xl shadow-sm p-6">
                {/* Controls */}
                <div className="mb-4 flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Parcel to Draw Boundary
                        </label>
                        <select
                            value={selectedParcel}
                            onChange={(e) => setSelectedParcel(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            disabled={!canEdit}
                        >
                            <option value="">-- Select a parcel --</option>
                            {parcels.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.parcel_number || `Parcel #${p.id}`} - {p.farmer?.first_name} {p.farmer?.last_name} ({p.barangay})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="text-sm text-gray-600">
                        {canEdit ? (
                            <p>✏️ Draw mode enabled - Select a parcel and use the polygon tool</p>
                        ) : (
                            <p>👁️ View-only mode</p>
                        )}
                    </div>
                </div>

                {/* Map */}
                <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                    <MapContainer
                        center={center}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <DrawControl
                            selectedParcel={selectedParcel}
                            onSave={handleSave}
                            canEdit={canEdit}
                            canDelete={canDelete}
                        />

                        {geoJsonData && (
                            <GeoJSON
                                key={JSON.stringify(geoJsonData)}
                                data={geoJsonData}
                                onEachFeature={onEachFeature}
                                style={{
                                    color: '#10b981',
                                    weight: 2,
                                    fillOpacity: 0.3,
                                }}
                            />
                        )}
                    </MapContainer>
                </div>

                {/* Legend */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-sm mb-2">Map Legend</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500 opacity-30 border-2 border-green-500"></div>
                            <span>Existing farm boundaries</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-500 opacity-30 border-2 border-blue-500"></div>
                            <span>New boundary (being drawn)</span>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm">
                    <h3 className="font-semibold mb-2">📍 How to use:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-700">
                        <li>Select a parcel from the dropdown above</li>
                        <li>Click the polygon tool (⬟) on the map</li>
                        <li>Click on the map to add points for the farm boundary</li>
                        <li>Double-click or click the first point to complete the polygon</li>
                        <li>The boundary will be saved automatically</li>
                        <li>Click on existing boundaries to see parcel information</li>
                        {canEdit && <li>Use the edit tool (✏️) to modify existing boundaries</li>}
                        {canDelete && <li>Use the delete tool (🗑️) to remove boundaries</li>}
                    </ol>
                </div>
            </div>
        </AdminLayout>
    );
}
