import AdminLayout from '@/Layouts/AdminLayout';
import { useState } from 'react';
import { Calculator, TrendingUp, Sprout, Package, Info } from 'lucide-react';
import Card from '@/Components/ui/Card';
import ConfidenceBadge from '@/Components/ui/ConfidenceBadge';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function CropEstimatorIndex({ farmers, crops, barangays = [] }) {
  const [formData, setFormData] = useState({
    farmer_id: '',
    barangay: '',
    crop_id: '',
    area_hectares: '',
    planting_date: '',
    season: '',
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
                <label htmlFor="farmer_id" className="block text-sm font-medium mb-2">Farmer</label>
                <select
                  id="farmer_id"
                  name="farmer_id"
                  value={formData.farmer_id}
                  onChange={e => setFormData({...formData, farmer_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Any Farmer (Planning)</option>
                  {farmers.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Uses the farmer's own history when they have 3+ recorded harvests.
                </p>
              </div>

              <div>
                <label htmlFor="barangay" className="block text-sm font-medium mb-2">Barangay</label>
                <select
                  id="barangay"
                  name="barangay"
                  value={formData.barangay}
                  onChange={e => setFormData({...formData, barangay: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Whole municipality</option>
                  {barangays.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Narrows the history to one barangay — similar soil and climate.
                </p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Planting Date</label>
                <input
                  type="date"
                  value={formData.planting_date}
                  onChange={e => setFormData({...formData, planting_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Enter to estimate harvest date and assess risks</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Season </label>
                <select
                  value={formData.season}
                  onChange={e => setFormData({...formData, season: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Season</option>
                  <option value="dry">Dry Season</option>
                  <option value="wet">Wet Season</option>
                </select>
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
          <>
            {/* How much history this forecast rests on. Shown before the numbers
                so a thin estimate is never mistaken for a confident one. */}
            <div className={`rounded-xl border-2 p-4 ${
              results.confidence === 'none' ? 'bg-gray-50 border-gray-300' :
              results.confidence === 'low' ? 'bg-amber-50 border-amber-300' :
              results.confidence === 'moderate' ? 'bg-blue-50 border-blue-300' :
              'bg-green-50 border-green-300'
            }`}>
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-bold text-gray-900">Forecast reliability</p>
                    <ConfidenceBadge level={results.confidence} dataPoints={results.data_points} />
                  </div>
                  <p className="text-sm text-gray-700">{results.explanation}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Yield/Ha (median)</p>
                  <p className="text-2xl font-bold">
                    {results.yield_per_ha === null ? 'No data' : `${results.yield_per_ha} kg`}
                  </p>
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
                  <p className="text-2xl font-bold">
                    {results.total_yield_kg === null ? 'No data' : `${results.total_yield_kg} kg`}
                  </p>
                  {results.range_kg && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      likely {results.range_kg.low}–{results.range_kg.high} kg
                    </p>
                  )}
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

          {/* Harvest Date & Risk Assessment */}
          {results.planting_date && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Crop Timeline">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium">Planting Date:</span>
                    <span className="font-bold">{new Date(results.planting_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium">Estimated Harvest:</span>
                    <span className="font-bold">{new Date(results.estimated_harvest_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Days to Harvest:</span>
                    <span className="font-bold">{results.avg_days_to_harvest} days</span>
                  </div>
                </div>
              </Card>

              {results.risk_assessment && (
                <Card title="Risk Assessment">
                  <div className={`p-4 rounded-lg mb-3 ${
                    results.risk_assessment.level === 'high' ? 'bg-red-50 border border-red-200' :
                    results.risk_assessment.level === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-green-50 border border-green-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        results.risk_assessment.level === 'high' ? 'bg-red-600 text-white' :
                        results.risk_assessment.level === 'medium' ? 'bg-yellow-600 text-white' :
                        'bg-green-600 text-white'
                      }`}>
                        {results.risk_assessment.level} Risk
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm mb-3">
                      {results.risk_assessment.risks.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium">Recommendation:</p>
                      <p className="text-sm text-gray-700 mt-1">{results.risk_assessment.recommendation}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Best Planting Months */}
          {results.best_planting_months && results.best_planting_months.length > 0 && (
            <Card title="Best Planting Months (Based on Historical Data)">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {results.best_planting_months.map((month, i) => (
                  <div key={i} className="p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-green-700">{month.month_name}</span>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">#{i + 1}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Avg Yield: <span className="font-bold">{month.avg_yield} kg/ha</span></div>
                      <div>Based on {month.count} records</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          </>
        )}

        {results && results.seasonal_data && results.seasonal_data.length > 0 && (
          <Card title="Historical Data">
            <p className="text-sm text-gray-600 mb-4">
              Based on {results.data_points} historical record{results.data_points === 1 ? '' : 's'}
              {results.trend?.direction && results.trend.direction !== 'unknown' && (
                <span> · yield trend is <strong>{results.trend.direction}</strong></span>
              )}
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
