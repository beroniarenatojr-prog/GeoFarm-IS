/**
 * Declarative field definitions for the Farm Assets categories.
 *
 * Keys match FarmAssetController's registry, and the field names match its
 * validation rules — those two lists have to agree, so keeping this one table
 * is easier to check than nine separate forms.
 *
 * Cropping seasons are the exception: they live in crop_seasons, which has no
 * farmer_id of its own — a season belongs to a parcel, and the parcel to the
 * farmer. So that category declares its own `endpoint` (Seasonal Tracking's
 * routes, which already validate yields and input costs) and an `ownerField`,
 * telling the modal to send parcel_id rather than farmer_id.
 */

const HEALTH = [
    ['healthy', 'Healthy'],
    ['sick', 'Sick'],
    ['treated', 'Treated'],
    ['vaccinated', 'Vaccinated'],
];

/** Every animal table carries the same husbandry fields. */
const animalFields = (purposeOptions) => [
    { name: 'male_count', label: 'Male count', type: 'number', min: 0, required: true },
    { name: 'female_count', label: 'Female count', type: 'number', min: 0, required: true },
    { name: 'purpose', label: 'Purpose', type: 'datalist', options: purposeOptions },
    { name: 'health_status', label: 'Health status', type: 'select', options: HEALTH, required: true },
    { name: 'last_vaccination', label: 'Last vaccination', type: 'date' },
    { name: 'notes', label: 'Notes', type: 'textarea', span: true },
];

const animalDefaults = {
    male_count: '', female_count: '', purpose: '',
    health_status: 'healthy', last_vaccination: '', notes: '',
};

export const ASSET_FORMS = {
    // Handled by CropSeasonController, not FarmAssetController — see the note
    // at the top of this file.
    crops: {
        label: 'cropping season',
        title: 'Cropping season',
        endpoint: '/admin/seasonal',
        ownerField: 'parcel_id',
        fields: [
            { name: 'parcel_id', label: 'Parcel', type: 'parcel', required: true,
              hint: 'A season is planted on a parcel; that is how it reaches the farmer.' },
            { name: 'crop_id', label: 'Crop', type: 'select', required: true, options: [] },
            { name: 'season', label: 'Season', type: 'select', required: true,
              options: [['dry', 'Dry'], ['wet', 'Wet']] },
            { name: 'cropping_year', label: 'Year', type: 'number', min: 2000, max: 2100, required: true },
            { name: 'area_planted_ha', label: 'Area planted (ha)', type: 'number', step: '0.01', min: 0 },
            { name: 'planting_date', label: 'Planting date', type: 'date' },
            { name: 'harvest_date', label: 'Harvest date', type: 'date' },
            { name: 'yield_kg', label: 'Yield (kg)', type: 'number', step: '0.01', min: 0,
              hint: 'Leave blank until the crop is actually harvested.' },
        ],
        defaults: {
            parcel_id: '', crop_id: '', season: 'dry', cropping_year: new Date().getFullYear(),
            area_planted_ha: '', planting_date: '', harvest_date: '', yield_kg: '',
        },
    },

    'tree-crops': {
        label: 'tree crop',
        title: 'Tree crop',
        fields: [
            { name: 'crop_type', label: 'Crop type', type: 'select', required: true,
              options: ['Coconut', 'Mango', 'Banana', 'Cacao', 'Pineapple'] },
            { name: 'quantity', label: 'Number of trees', type: 'number', min: 0, required: true },
            { name: 'area_hectares', label: 'Area (ha)', type: 'number', step: '0.01', min: 0,
              hint: 'Mainly for pineapple, which is planted by area rather than counted.' },
            { name: 'age_years', label: 'Age (years)', type: 'number', min: 0 },
            { name: 'status', label: 'Status', type: 'select', required: true,
              options: [['bearing', 'Bearing'], ['non_bearing', 'Non-bearing']],
              hint: 'Non-bearing trees are excluded from harvest projections.' },
            { name: 'parcel_id', label: 'Parcel', type: 'parcel' },
            { name: 'notes', label: 'Notes', type: 'textarea', span: true },
        ],
        defaults: { crop_type: 'Coconut', quantity: '', area_hectares: '', age_years: '',
                    status: 'bearing', parcel_id: '', notes: '' },
    },

    'large-ruminants': {
        label: 'large ruminant',
        title: 'Large ruminant',
        fields: [
            { name: 'animal_type', label: 'Animal', type: 'select', required: true, options: ['Cattle', 'Carabao'] },
            ...animalFields(['Draft', 'Dairy', 'Meat', 'Breeding']),
        ],
        defaults: { animal_type: 'Cattle', ...animalDefaults },
    },

    'small-ruminants': {
        label: 'small ruminant',
        title: 'Small ruminant',
        fields: [
            { name: 'animal_type', label: 'Animal', type: 'select', required: true, options: ['Goat', 'Sheep'] },
            ...animalFields(['Meat', 'Dairy', 'Breeding']),
        ],
        defaults: { animal_type: 'Goat', ...animalDefaults },
    },

    'native-pigs': {
        label: 'native pig',
        title: 'Native pigs',
        fields: animalFields(['Meat', 'Breeding']),
        defaults: { ...animalDefaults },
    },

    'swine-hybrid': {
        label: 'hybrid swine',
        title: 'Hybrid swine',
        fields: [
            { name: 'variety', label: 'Variety', type: 'select', required: true, options: ['White', 'Brown'] },
            ...animalFields(['Meat', 'Breeding', 'Fattening']),
        ],
        defaults: { variety: 'White', ...animalDefaults },
    },

    poultry: {
        label: 'poultry',
        title: 'Poultry',
        fields: [
            { name: 'bird_type', label: 'Bird', type: 'select', required: true,
              options: ['Chicken', 'Ducks', 'Goose', 'Turkey'] },
            { name: 'breed', label: 'Breed', type: 'datalist', options: ['Layer', 'Broiler', 'Native', 'Dual-purpose'] },
            ...animalFields(['Eggs', 'Meat', 'Breeding']),
        ],
        defaults: { bird_type: 'Chicken', breed: '', ...animalDefaults },
    },

    fishponds: {
        label: 'fishpond',
        title: 'Fishpond',
        fields: [
            { name: 'pond_type', label: 'Pond type', type: 'select', required: true,
              options: [['freshwater', 'Freshwater'], ['brackish', 'Brackish']] },
            { name: 'species', label: 'Species', type: 'select', required: true,
              options: ['Tilapia', 'Hito', 'Bangus'] },
            { name: 'area_hectares', label: 'Area (ha)', type: 'number', step: '0.01', min: 0, required: true },
            { name: 'stocking_density', label: 'Stocking density', type: 'number', step: '0.01', min: 0,
              hint: 'Fish per square metre.' },
            { name: 'estimated_population', label: 'Estimated population', type: 'number', min: 0,
              hint: 'Leave blank to estimate it from area × density.' },
            { name: 'harvest_cycle_months', label: 'Harvest cycle (months)', type: 'number', min: 1 },
            { name: 'last_harvest', label: 'Last harvest', type: 'date' },
            { name: 'next_harvest', label: 'Next harvest', type: 'date' },
            { name: 'notes', label: 'Notes', type: 'textarea', span: true },
        ],
        defaults: { pond_type: 'freshwater', species: 'Tilapia', area_hectares: '', stocking_density: '',
                    estimated_population: '', harvest_cycle_months: '', last_harvest: '', next_harvest: '', notes: '' },
    },

    machinery: {
        label: 'machinery',
        title: 'Farm machinery',
        fields: [
            { name: 'machinery_type', label: 'Machinery type', type: 'datalist', required: true,
              options: ['Hand Tractor', 'Four-Wheel Tractor', 'Thresher', 'Rice Mill', 'Corn Mill',
                        'Harvester', 'Water Pump', 'Sprayer', 'Dryer', 'Shredder', 'Other'] },
            { name: 'brand', label: 'Brand', type: 'datalist',
              options: ['Kubota', 'Yanmar', 'Honda', 'John Deere', 'Iseki', 'Briggs & Stratton'] },
            { name: 'model', label: 'Model', type: 'text' },
            { name: 'serial_number', label: 'Serial number', type: 'text' },
            { name: 'engine_number', label: 'Engine number', type: 'text' },
            { name: 'year_acquired', label: 'Year acquired', type: 'number', min: 1900, max: new Date().getFullYear() + 1 },
            { name: 'acquisition_type', label: 'Acquired by', type: 'select', required: true,
              options: [['purchased', 'Purchase'], ['donated', 'Donation'], ['loaned', 'Loan'], ['inherited', 'Inheritance']] },
            { name: 'status', label: 'Status', type: 'select', required: true,
              options: [['active', 'Active'], ['for_repair', 'For repair'], ['decommissioned', 'Decommissioned']] },
            { name: 'notes', label: 'Notes', type: 'textarea', span: true },
        ],
        defaults: { machinery_type: '', brand: '', model: '', serial_number: '', engine_number: '',
                    year_acquired: '', acquisition_type: 'purchased', status: 'active', notes: '' },
    },
};

/** Normalise an option to [value, label]. */
export const optionPair = (o) => (Array.isArray(o) ? o : [o, o]);
