import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { User, MapPin, Phone, Mail, Calendar, Map, Users, Award, Download, TreePine, Fish, Beef, Egg } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '@/Components/ui/DataTable';
import Tabs from '@/Components/ui/Tabs';
import MapViewer from '@/Components/ui/MapViewer';
import Badge from '@/Components/ui/Badge';
import Modal from '@/Components/ui/Modal';
import Card from '@/Components/ui/Card';
import Skeleton from '@/Components/ui/Skeleton';
import TreeCropForm from '@/Components/AgriAssets/TreeCropForm';
import FishpondForm from '@/Components/AgriAssets/FishpondForm';
import LivestockForm from '@/Components/AgriAssets/LivestockForm';
import { usePermissions } from '@/hooks/usePermissions';

export default function FarmerShow({ farmer }) {
  const { can } = usePermissions();
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assetModal, setAssetModal] = useState({ open: false, type: null, record: null });

  const parcelsData = (farmer.parcels || []).map(p => ({
    id: p.id,
    parcel_number: p.parcel_number || '—',
    barangay: p.barangay,
    area: `${p.total_area_ha} ha`,
    type: p.farm_type?.type_name || '—',
    ownership: p.ownership_type || '—',
  }));

  const livestockData = (farmer.livestock || []).map(l => ({
    id: l.id,
    type: l.livestock_type?.type_name || '—',
    breed: l.breed || '—',
    count: l.count,
    purpose: l.purpose || '—',
    health: l.health_status || 'Good',
  }));

  const parcelsColumns = [
    { header: 'Parcel #', accessorKey: 'parcel_number' },
    { header: 'Barangay', accessorKey: 'barangay' },
    { header: 'Area', accessorKey: 'area' },
    { header: 'Type', accessorKey: 'type' },
    { header: 'Ownership', accessorKey: 'ownership' },
  ];

  const livestockColumns = [
    { header: 'Type', accessorKey: 'type' },
    { header: 'Breed', accessorKey: 'breed' },
    { header: 'Count', accessorKey: 'count' },
    { header: 'Purpose', accessorKey: 'purpose' },
    { header: 'Health', accessorKey: 'health' },
  ];

  const handleDelete = () => {
    if (confirm('Delete this farmer and all associated data?')) {
      setLoading(true);
      router.delete(`/admin/farmers/${farmer.id}`, {
        onSuccess: () => {
          toast.success('Farmer deleted successfully');
          router.visit('/admin/farmers');
        },
        onError: () => setLoading(false),
      });
    }
  };

  // Mock geojson - backend will provide real
  const mockGeoJSON = {
    type: 'FeatureCollection',
    features: parcelsData.slice(0, 3).map((p, i) => ({
      type: 'Feature',
      properties: p,
      geometry: {
        type: 'Polygon',
        coordinates: [[ [121 + i*0.01, 14.6 + i*0.01], [121 + i*0.01, 14.6 + i*0.02], [121 + i*0.02, 14.6 + i*0.02], [121 + i*0.02, 14.6 + i*0.01] ]]
      }
    }))
  };

  return (
    <AdminLayout title={`Farmer Profile: ${farmer.last_name}, ${farmer.first_name}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Header */}
        <Card title="">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
            <div className="flex-shrink-0">
              {farmer.photo_path ? (
                <img 
                  src={`/storage/${farmer.photo_path}`} 
                  alt="Profile"
                  className="w-32 h-32 lg:w-40 lg:h-40 rounded-3xl object-cover ring-4 ring-green-200 shadow-2xl hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-32 h-32 lg:w-40 lg:h-40 bg-gradient-to-br from-green-400 to-emerald-500 rounded-3xl flex items-center justify-center text-4xl shadow-2xl">
                  👨‍🌾
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                {farmer.last_name}, {farmer.first_name} {farmer.middle_name}
              </h1>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="green">RSBSA: {farmer.rsbsa_no || 'N/A'}</Badge>
                {farmer.pwd && <Badge variant="blue">PWD</Badge>}
                {farmer.is_4ps && <Badge variant="purple">4Ps Beneficiary</Badge>}
                {farmer.is_indigenous && <Badge variant="orange">Indigenous People</Badge>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{farmer.barangay}, {farmer.city_municipality}</span>
                </div>
                {farmer.mobile_no && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>{farmer.mobile_no}</span>
                  </div>
                )}
                {farmer.email && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <Mail className="h-4 w-4 text-purple-600" />
                    <span>{farmer.email}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {farmer.qr_code_path && (
                <button 
                  onClick={() => setShowQR(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 text-sm"
                  title="View QR Code"
                >
                  <Download className="h-4 w-4" />
                  QR Code
                </button>
              )}
              {can('edit farmers') && (
                <Link 
                  href={`/admin/farmers/${farmer.id}/edit`}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 text-sm"
                >
                  <User className="h-4 w-4" />
                  Edit Profile
                </Link>
              )}
              {can('delete farmers') && (
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 text-sm disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Main Tabs */}
        <Tabs
          tabs={[
            {
              id: 'profile',
              label: (
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </span>
              ),
              content: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Personal Information
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div><span className="font-medium">Sex:</span> {farmer.sex || '—'}</div>
                      <div><span className="font-medium">Civil Status:</span> {farmer.civil_status || '—'}</div>
                      {farmer.birthdate && <div><span className="font-medium">Birthdate:</span> {farmer.birthdate}</div>}
                      {farmer.organization_name && <div><span className="font-medium">Organization:</span> {farmer.organization_name}</div>}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Farm Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <div>
                        <div className="text-2xl font-bold text-green-600">{farmer.parcels?.length || 0}</div>
                        <div className="text-xs text-gray-500">Parcels</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{farmer.livestock?.reduce((sum, l) => sum + l.count, 0) || 0}</div>
                        <div className="text-xs text-gray-500">Livestock Head</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            },
            {
              id: 'parcels',
              label: (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Parcels ({parcelsData.length})
                </span>
              ),
              content: <DataTable columns={parcelsColumns} data={parcelsData} filename={`farmer-${farmer.id}-parcels`} />
            },
            {
              id: 'map',
              label: (
                <span className="flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Farm Map
                </span>
              ),
              content: (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="h-[500px]">
                    <MapViewer geojson={mockGeoJSON} />
                  </div>
                  <div className="space-y-4">
                    <Card title="Map Legend">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 p-3 bg-green-100 rounded-xl">
                          <div className="w-8 h-8 bg-green-500 rounded opacity-70"></div>
                          <span className="text-sm">Rice Fields</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-amber-100 rounded-xl">
                          <div className="w-8 h-8 bg-amber-500 rounded opacity-70"></div>
                          <span className="text-sm">Corn/Other</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )
            },
            {
              id: 'livestock',
              label: (
                <span className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Livestock ({livestockData.length})
                </span>
              ),
              content: <DataTable columns={livestockColumns} data={livestockData} filename={`farmer-${farmer.id}-livestock`} />
            },
            {
              id: 'tree-crops',
              label: (
                <span className="flex items-center gap-2">
                  <TreePine className="h-4 w-4" />
                  Tree Crops ({(farmer.tree_crops || []).length})
                </span>
              ),
              content: (
                <div className="space-y-4">
                  {can('create inventory') && (
                    <button
                      onClick={() => setAssetModal({ open: true, type: 'tree', record: null })}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      + Add Tree Crop
                    </button>
                  )}
                  <DataTable
                    columns={[
                      { header: 'Crop Type', accessorKey: 'crop_type' },
                      { header: 'Quantity/Trees', accessorKey: 'quantity', cell: (row) => row.quantity || '—' },
                      { header: 'Area (ha)', accessorKey: 'area_hectares', cell: (row) => row.area_hectares || '—' },
                      ...(can('edit inventory') || can('delete inventory') ? [{
                        header: 'Actions',
                        cell: (row) => (
                          <div className="flex gap-2">
                            {can('edit inventory') && (
                              <button
                                onClick={() => setAssetModal({ open: true, type: 'tree', record: row })}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Edit
                              </button>
                            )}
                            {can('delete inventory') && (
                              <button
                                onClick={() => {
                                  if (confirm('Delete this record?')) {
                                    router.delete(`/admin/tree-crops/${row.id}`, {
                                      preserveState: true,
                                      preserveScroll: true,
                                      onSuccess: () => toast.success('Deleted successfully')
                                    });
                                  }
                                }}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )
                      }] : [])
                    ]}
                    data={farmer.tree_crops || []}
                    filename={`farmer-${farmer.id}-tree-crops`}
                  />
                </div>
              )
            },
            {
              id: 'fishponds',
              label: (
                <span className="flex items-center gap-2">
                  <Fish className="h-4 w-4" />
                  Fishponds ({(farmer.fishponds || []).length})
                </span>
              ),
              content: (
                <div className="space-y-4">
                  {can('create inventory') && (
                    <button
                      onClick={() => setAssetModal({ open: true, type: 'fishpond', record: null })}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      + Add Fishpond
                    </button>
                  )}
                  <DataTable
                    columns={[
                      { header: 'Species', accessorKey: 'species' },
                      { header: 'Area (ha)', accessorKey: 'area_hectares' },
                      ...(can('edit inventory') || can('delete inventory') ? [{
                        header: 'Actions',
                        cell: (row) => (
                          <div className="flex gap-2">
                            {can('edit inventory') && (
                              <button
                                onClick={() => setAssetModal({ open: true, type: 'fishpond', record: row })}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Edit
                              </button>
                            )}
                            {can('delete inventory') && (
                              <button
                                onClick={() => {
                                  if (confirm('Delete this record?')) {
                                    router.delete(`/admin/fishponds/${row.id}`, {
                                      preserveState: true,
                                      preserveScroll: true,
                                      onSuccess: () => toast.success('Deleted successfully')
                                    });
                                  }
                                }}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )
                      }] : [])
                    ]}
                    data={farmer.fishponds || []}
                    filename={`farmer-${farmer.id}-fishponds`}
                  />
                </div>
              )
            },
            {
              id: 'ruminants',
              label: (
                <span className="flex items-center gap-2">
                  <Beef className="h-4 w-4" />
                  Ruminants ({(farmer.large_ruminants || []).length + (farmer.small_ruminants || []).length})
                </span>
              ),
              content: (
                <div className="space-y-6">
                  <Card title="Large Ruminants (Cattle, Carabao)">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'large-ruminant', record: null })}
                        className="mb-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        + Add Large Ruminant
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Type', accessorKey: 'animal_type' },
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: (row) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: (row) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'large-ruminant', record: row })}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      router.delete(`/admin/large-ruminants/${row.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                        onSuccess: () => toast.success('Deleted')
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.large_ruminants || []}
                    />
                  </Card>

                  <Card title="Small Ruminants (Goat, Sheep)">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'small-ruminant', record: null })}
                        className="mb-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        + Add Small Ruminant
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Type', accessorKey: 'animal_type' },
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: (row) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: (row) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'small-ruminant', record: row })}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      router.delete(`/admin/small-ruminants/${row.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                        onSuccess: () => toast.success('Deleted')
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.small_ruminants || []}
                    />
                  </Card>
                </div>
              )
            },
            {
              id: 'swine-poultry',
              label: (
                <span className="flex items-center gap-2">
                  <Egg className="h-4 w-4" />
                  Swine & Poultry
                </span>
              ),
              content: (
                <div className="space-y-6">
                  <Card title="Native Pigs">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'native-pig', record: null })}
                        className="mb-4 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                      >
                        + Add Native Pig
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: (row) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: (row) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'native-pig', record: row })}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      router.delete(`/admin/native-pigs/${row.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                        onSuccess: () => toast.success('Deleted')
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.native_pigs || []}
                    />
                  </Card>

                  <Card title="Swine Hybrid">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'swine-hybrid', record: null })}
                        className="mb-4 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                      >
                        + Add Swine Hybrid
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Variety', accessorKey: 'variety' },
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: (row) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: (row) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'swine-hybrid', record: row })}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      router.delete(`/admin/swine-hybrid/${row.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                        onSuccess: () => toast.success('Deleted')
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.swine_hybrid || []}
                    />
                  </Card>

                  <Card title="Poultry">
                    {can('create inventory') && (
                      <button
                        onClick={() => setAssetModal({ open: true, type: 'poultry', record: null })}
                        className="mb-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        + Add Poultry
                      </button>
                    )}
                    <DataTable
                      columns={[
                        { header: 'Bird Type', accessorKey: 'bird_type' },
                        { header: 'Male', accessorKey: 'male_count' },
                        { header: 'Female', accessorKey: 'female_count' },
                        { header: 'Total', accessorKey: 'total_heads' },
                        { header: 'Large Raiser', cell: (row) => row.is_large_raiser ? '✓' : '—' },
                        ...(can('edit inventory') || can('delete inventory') ? [{
                          header: 'Actions',
                          cell: (row) => (
                            <div className="flex gap-2">
                              {can('edit inventory') && (
                                <button
                                  onClick={() => setAssetModal({ open: true, type: 'poultry', record: row })}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('delete inventory') && (
                                <button
                                onClick={() => {
                                  if (confirm('Delete?')) {
                                    router.delete(`/admin/poultry/${row.id}`, {
                                      preserveState: true,
                                      preserveScroll: true,
                                      onSuccess: () => toast.success('Deleted')
                                    });
                                  }
                                }}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Delete
                              </button>
                            )}
                            </div>
                          )
                        }] : [])
                      ]}
                      data={farmer.poultry || []}
                    />
                  </Card>
                </div>
              )
            },
          ]}
        />

        {/* QR Modal */}
        <Modal isOpen={showQR} onClose={() => setShowQR(false)} title="Farmer QR Code">
          {farmer.qr_code_path && (
            <div className="flex flex-col items-center gap-4 p-8">
              <img src={`/storage/${farmer.qr_code_path}`} alt="QR" className="w-64 h-64 shadow-2xl" />
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Scan to view profile</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `/storage/${farmer.qr_code_path}`;
                      link.download = `farmer-${farmer.id}-qr.svg`;
                      link.click();
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Download SVG
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Agricultural Assets Modal */}
        <Modal
          isOpen={assetModal.open}
          onClose={() => setAssetModal({ open: false, type: null, record: null })}
          title={`${assetModal.record ? 'Edit' : 'Add'} ${assetModal.type?.replace('-', ' ').toUpperCase()}`}
        >
          {assetModal.type === 'tree' && (
            <TreeCropForm
              farmerId={farmer.id}
              crop={assetModal.record}
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'fishpond' && (
            <FishpondForm
              farmerId={farmer.id}
              fishpond={assetModal.record}
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'large-ruminant' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="large"
              endpoint="/admin/large-ruminants"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'small-ruminant' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="small"
              endpoint="/admin/small-ruminants"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'native-pig' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="native"
              endpoint="/admin/native-pigs"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'swine-hybrid' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="swine"
              endpoint="/admin/swine-hybrid"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
          {assetModal.type === 'poultry' && (
            <LivestockForm
              farmerId={farmer.id}
              record={assetModal.record}
              type="poultry"
              endpoint="/admin/poultry"
              onClose={() => setAssetModal({ open: false, type: null, record: null })}
            />
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
}

