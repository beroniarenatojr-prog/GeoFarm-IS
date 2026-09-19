import { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import ModalShell from '@/Components/ui/ModalShell';
import FarmerPicker from '@/Components/ui/FarmerPicker';

/**
 * Open an intervention with no farm analysis behind it.
 *
 * An additional entry path, not a replacement. Staff who already know what
 * needs doing — a fuel subsidy round, a scheduled visit — should not have to
 * manufacture an analysis in order to record it. Everything the analysis path
 * guarantees is untouched: this form cannot supply a factor_key or an
 * assessment, so the record carries neither, and that absence is exactly what
 * marks it "Manual" wherever it appears.
 *
 * Barangay is never typed here. It belongs to the farmer and to the parcel,
 * and is shown from whichever is selected — a second copy would be a value
 * free to disagree with the registry.
 */
function Field({ label, required = false, hint, error, children }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export default function ManualInterventionModal({ types = {}, onClose }) {
  const { data, setData, post, processing, errors, reset } = useForm({
    source: 'manual',
    farmer_id: '',
    farm_parcel_id: '',
    title: '',
    type: '',
    reason: '',
    priority: 'medium',
    target_date: '',
    notes: '',
  });

  const [parcels, setParcels] = useState([]);
  const [loadingParcels, setLoadingParcels] = useState(false);

  /*
   * The chosen farmer's own parcels.
   *
   * The server refuses a parcel belonging to someone else, so this list is
   * here to stop staff being offered a wrong choice at all — it is not the
   * check itself.
   */
  const loadParcels = (farmerId) => {
    setData((current) => ({ ...current, farmer_id: farmerId, farm_parcel_id: '' }));
    setParcels([]);

    if (!farmerId) return;

    setLoadingParcels(true);
    fetch(`/admin/farmers/${farmerId}/parcel-options`, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setParcels(Array.isArray(rows) ? rows : []))
      .catch(() => setParcels([]))
      .finally(() => setLoadingParcels(false));
  };

  const submit = (event) => {
    event.preventDefault();
    post('/admin/interventions', {
      preserveScroll: true,
      onSuccess: () => { reset(); onClose(); },
    });
  };

  const selected = parcels.find((p) => String(p.id) === String(data.farm_parcel_id));

  return (
    <ModalShell open onClose={onClose} title="New manual intervention">
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          For work the office has decided on directly. If this follows a farm
          analysis, open it from that analysis instead, so the finding stays
          linked to the action taken.
        </p>

        <Field label="Farmer" required error={errors.farmer_id}>
          <FarmerPicker
            value={data.farmer_id}
            onChange={loadParcels}
            label={null}
          />
        </Field>

        <Field
          label="Parcel"
          hint="Leave blank for farmer-level work, such as a fuel subsidy."
          error={errors.farm_parcel_id}
        >
          <select
            value={data.farm_parcel_id}
            onChange={(e) => setData('farm_parcel_id', e.target.value)}
            disabled={!data.farmer_id || loadingParcels}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
          >
            <option value="">
              {!data.farmer_id ? 'Select a farmer first'
                : loadingParcels ? 'Loading parcels…'
                  : parcels.length === 0 ? 'This farmer has no parcels on record'
                    : 'Farmer-level (no particular parcel)'}
            </option>
            {parcels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.parcel_number || `Parcel #${p.id}`}
                {p.barangay ? ` — ${p.barangay}` : ''}
                {p.commodity ? ` — ${p.commodity}` : ''}
              </option>
            ))}
          </select>
        </Field>

        {selected?.barangay && (
          <p className="flex items-center gap-1.5 text-xs text-gray-600">
            <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            Barangay <strong>{selected.barangay}</strong>, taken from the selected parcel.
          </p>
        )}

        <Field label="Intervention name" required error={errors.title}>
          <input
            type="text"
            value={data.title}
            onChange={(e) => setData('title', e.target.value)}
            placeholder="e.g. Agricultural Fuel Support Program 2026"
            maxLength={150}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind of action" required error={errors.type}>
            <select
              value={data.type}
              onChange={(e) => setData('type', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {Object.entries(types).map(([key, meta]) => (
                <option key={key} value={key}>{meta?.label ?? key}</option>
              ))}
            </select>
          </Field>

          <Field label="Priority" error={errors.priority}>
            <select
              value={data.priority}
              onChange={(e) => setData('priority', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
        </div>

        <Field label="Reason" required hint="Why the office is opening this." error={errors.reason}>
          <input
            type="text"
            value={data.reason}
            onChange={(e) => setData('reason', e.target.value)}
            placeholder="e.g. Qualified farmer under the fuel subsidy programme"
            maxLength={255}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target date" hint="Set from priority if left blank." error={errors.target_date}>
            <input
              type="date"
              value={data.target_date}
              onChange={(e) => setData('target_date', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Planned action / notes" error={errors.notes}>
            <input
              type="text"
              value={data.notes}
              onChange={(e) => setData('notes', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={processing || !data.farmer_id}
            className="rounded-lg bg-[#006400] px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
          >
            {processing ? 'Opening…' : 'Open intervention'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
