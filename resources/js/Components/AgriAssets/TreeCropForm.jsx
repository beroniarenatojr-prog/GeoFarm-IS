import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import Modal from '@/Components/ui/Modal';
import toast from 'react-hot-toast';

export default function TreeCropForm({ farmerId, crop = null, onClose }) {
  const { data, setData, post, put, processing, errors } = useForm({
    farmer_id: farmerId,
    crop_type: crop?.crop_type || 'Mango',
    quantity: crop?.quantity || '',
    area_hectares: crop?.area_hectares || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const method = crop ? put : post;
    const url = crop ? `/admin/tree-crops/${crop.id}` : '/admin/tree-crops';
    
    method(url, {
      onSuccess: () => {
        toast.success(`Tree crop ${crop ? 'updated' : 'added'} successfully`);
        onClose();
      },
    });
  };

  const isPineapple = data.crop_type === 'Pineapple';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Crop Type</label>
        <select
          value={data.crop_type}
          onChange={e => setData('crop_type', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="Mango">Mango</option>
          <option value="Banana">Banana</option>
          <option value="Cacao">Cacao</option>
          <option value="Pineapple">Pineapple</option>
        </select>
        {errors.crop_type && <p className="text-red-500 text-sm mt-1">{errors.crop_type}</p>}
      </div>

      {!isPineapple ? (
        <div>
          <label className="block text-sm font-medium mb-1">Number of Trees</label>
          <input
            type="number"
            value={data.quantity}
            onChange={e => setData('quantity', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            min="0"
          />
          {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity}</p>}
        </div>
      ) : (
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
      )}

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
          {processing ? 'Saving...' : crop ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}
