import { useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';

export default function LivestockForm({ farmerId, record = null, onClose, type, endpoint }) {
  const { data, setData, post, put, processing, errors } = useForm({
    farmer_id: farmerId,
    animal_type: record?.animal_type || (type === 'large' ? 'Cattle' : type === 'small' ? 'Goat' : ''),
    variety: record?.variety || 'White',
    bird_type: record?.bird_type || 'Chicken',
    male_count: record?.male_count || 0,
    female_count: record?.female_count || 0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const method = record ? put : post;
    const url = record ? `${endpoint}/${record.id}` : endpoint;
    
    method(url, {
      onSuccess: () => {
        toast.success(`Record ${record ? 'updated' : 'added'} successfully`);
        onClose();
      },
    });
  };

  const total = parseInt(data.male_count || 0) + parseInt(data.female_count || 0);
  const isLargeRaiser = total > 20;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {type === 'large' && (
        <div>
          <label className="block text-sm font-medium mb-1">Animal Type</label>
          <select
            value={data.animal_type}
            onChange={e => setData('animal_type', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="Cattle">Cattle</option>
            <option value="Carabao">Carabao</option>
          </select>
        </div>
      )}

      {type === 'small' && (
        <div>
          <label className="block text-sm font-medium mb-1">Animal Type</label>
          <select
            value={data.animal_type}
            onChange={e => setData('animal_type', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="Goat">Goat</option>
            <option value="Sheep">Sheep</option>
          </select>
        </div>
      )}

      {type === 'swine' && (
        <div>
          <label className="block text-sm font-medium mb-1">Variety</label>
          <select
            value={data.variety}
            onChange={e => setData('variety', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="White">White</option>
            <option value="Brown">Brown</option>
          </select>
        </div>
      )}

      {type === 'poultry' && (
        <div>
          <label className="block text-sm font-medium mb-1">Bird Type</label>
          <select
            value={data.bird_type}
            onChange={e => setData('bird_type', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="Chicken">Chicken</option>
            <option value="Ducks">Ducks</option>
            <option value="Goose">Goose</option>
            <option value="Turkey">Turkey</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Male Count</label>
          <input
            type="number"
            value={data.male_count}
            onChange={e => setData('male_count', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Female Count</label>
          <input
            type="number"
            value={data.female_count}
            onChange={e => setData('female_count', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            min="0"
          />
        </div>
      </div>

      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Total Heads:</span>
          <span className="font-bold">{total}</span>
        </div>
        {isLargeRaiser && (
          <div className="mt-2 px-3 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
            ✓ Large Raiser (&gt;20 heads)
          </div>
        )}
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
          {processing ? 'Saving...' : record ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}
