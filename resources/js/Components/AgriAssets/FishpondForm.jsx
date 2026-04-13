import { useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';

export default function FishpondForm({ farmerId, fishpond = null, onClose }) {
  const { data, setData, post, put, processing, errors } = useForm({
    farmer_id: farmerId,
    species: fishpond?.species || 'Tilapia',
    area_hectares: fishpond?.area_hectares || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const method = fishpond ? put : post;
    const url = fishpond ? `/admin/fishponds/${fishpond.id}` : '/admin/fishponds';
    
    method(url, {
      onSuccess: () => {
        toast.success(`Fishpond ${fishpond ? 'updated' : 'added'} successfully`);
        onClose();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Species</label>
        <select
          value={data.species}
          onChange={e => setData('species', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="Tilapia">Tilapia</option>
          <option value="Hito">Hito</option>
        </select>
        {errors.species && <p className="text-red-500 text-sm mt-1">{errors.species}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Area (Hectares)</label>
        <input
          type="number"
          step="0.01"
          value={data.area_hectares}
          onChange={e => setData('area_hectares', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
          min="0"
        />
        {errors.area_hectares && <p className="text-red-500 text-sm mt-1">{errors.area_hectares}</p>}
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={processing}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {processing ? 'Saving...' : fishpond ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}
