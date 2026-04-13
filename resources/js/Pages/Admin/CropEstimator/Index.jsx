import AdminLayout from '@/Layouts/AdminLayout';
import { useState } from 'react';
import { Calculator, TrendingUp, Sprout, Package } from 'lucide-react';
import Card from '@/Components/ui/Card';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function CropEstimatorIndex({ farmers, crops }) {
  const [formData, setFormData] = useState({
    farmer_id: '',
    crop_id: '',
    area_hectares: '',
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEstimate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post('/admin/crop-estimator/estimate', formData);
      setResults(response.data);
    } catch (error) {
      toast.error('Failed to calculate estimate');
    } finally {
      setLoading(false);
    }
  };

  const selectedCrop = crops.find(c => c.id == formData.crop_id);

  return (
    <AdminLayout title="Crop Yield Estimator">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card title="Planning Tool">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="h-8 w-8 text-green-600" />
            <div>
              <h2 className="text-2xl font-bold">Crop Yield Estimator</h2>
              <p className="text-gray-600">Estimate yields and input requirements based on historical data</p>
            </div>
          </div>

          <form onSubmit={handleEstimate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Farmer</label>
                <select
                  value={formData.farmer_id}
                  onChange={e => setFormData({...formData, farmer_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Any Farmer (Planning)</option>
                  {farmers.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Crop *</label>
                <select
                  value={formData.crop_id}
                  onChange={e => setFormData({...formData, crop_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select Crop</option>
                  {crops.map(c => (
                    <option key={c.id} value={c.id}>{c.crop_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Area (Hectares) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.area_hectares}
                  onChange={e => setFormData({...formData, area_hectares: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
            </div>

            {selectedCrop && (
              <div className="p-4 bg-blue-50 rounded-lg text-sm">
                <p className="font-medium mb-1">Crop Configuration:</p>
                <div className="grid grid-cols-2 gap-2 text-gray-700">
                  <div>Seeding Rate: {selectedCrop.seeding_rate_kg_per_ha || 'Not set'} kg/ha</div>
                  <div>Fertilizer Rate: {selectedCrop.fertilizer_bags_per_ha || 'Not set'} bags/ha</div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Calculating...' : 'Calculate Estimate'}
            </button>
          </form>
        </Card>

        {results && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Yield/Ha</p>
                  <p className="text-2xl font-bold">{results.avg_yield_per_ha} kg</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Est. Total Yield</p>
                  <p className="text-2xl font-bold">{results.estimated_total_yield_kg} kg</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Sprout className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Seeds Needed</p>
                  <p className="text-2xl font-bold">{results.recommended_seeds_kg} kg</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fertilizer</p>
                  <p className="text-2xl font-bold">{results.recommended_fertilizer_bags} bags</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {results && results.seasonal_data && results.seasonal_data.length > 0 && (
          <Card title="Historical Data">
            <p className="text-sm text-gray-600 mb-4">
              Based on {results.data_points} historical records
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Season</th>
                    <th className="px-4 py-2 text-left">Year</th>
                    <th className="px-4 py-2 text-right">Avg Yield (kg/ha)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.seasonal_data.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2 capitalize">{row.season}</td>
                      <td className="px-4 py-2">{row.cropping_year}</td>
                      <td className="px-4 py-2 text-right font-medium">{parseFloat(row.avg_yield).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
