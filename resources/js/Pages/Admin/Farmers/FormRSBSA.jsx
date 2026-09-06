import AdminLayout from '@/Layouts/AdminLayout';
import PublicFormShell from '@/Layouts/PublicFormShell';
import { useForm, router } from '@inertiajs/react';
import { User, MapPin, Users, Briefcase, Map, Image as ImageIcon, FileCheck, ChevronLeft, ChevronRight, Check, Info, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { formatRsbsa, formatMobile, RSBSA_MASK, MOBILE_MASK } from '@/utils/registryFormats';

export default function FormRSBSA({ farmer, farmTypes, publicMode = false }) {
    const isEdit = !!farmer;
    const [currentStep, setCurrentStep] = useState(1);
    const [photoPreview, setPhotoPreview] = useState(farmer?.photo_url || null);
    const [idProofPreview, setIdProofPreview] = useState(farmer?.id_proof_url || null);
    const [consentChecked, setConsentChecked] = useState(false); // Consent checkbox state
    
    const { data, setData, processing, errors } = useForm({
        // Step 1: Personal Information
        rsbsa_no: farmer?.rsbsa_no || '',
        sex: farmer?.sex || '',
        first_name: farmer?.first_name || '',
        last_name: farmer?.last_name || '',
        middle_name: farmer?.middle_name || '',
        suffix: farmer?.suffix || '',
        birthdate: farmer?.birthdate || '',
        birth_city_municipality: farmer?.birth_city_municipality || '',
        birth_province: farmer?.birth_province || '',
        mother_first_name: farmer?.mother_first_name || '',
        mother_middle_name: farmer?.mother_middle_name || '',
        mother_last_name: farmer?.mother_last_name || '',
        civil_status: farmer?.civil_status || '',
        spouse_first_name: farmer?.spouse_first_name || '',
        spouse_middle_name: farmer?.spouse_middle_name || '',
        spouse_last_name: farmer?.spouse_last_name || '',
        spouse_ext_name: farmer?.spouse_ext_name || '',
        // Starts empty: a farmer with no children should see no rows, not one
        // blank row inviting them to invent an entry.
        children: farmer?.children?.map(c => ({
            name: c.name || '',
            sex: c.sex || '',
            birthdate: c.birthdate ? String(c.birthdate).slice(0, 10) : '',
        })) || [],
        religion: farmer?.religion || '',
        highest_education: farmer?.highest_education || '',
        mobile_no: farmer?.mobile_no || '',
        email: farmer?.email || '',
        valid_id_type: farmer?.valid_id_type || '',
        id_number: farmer?.id_number || '',
        
        // Step 2: Address - Permanent
        house_lot_number: farmer?.house_lot_number || '',
        street_sitio: farmer?.street_sitio || '',
        barangay: farmer?.barangay || '',
        city_municipality: farmer?.city_municipality || 'Tumauini',
        province: farmer?.province || 'Isabela',
        region: farmer?.region || 'Region II — Cagayan Valley',
        
        // Provincial Address (if permanent is in NCR)
        provincial_house_lot: farmer?.provincial_house_lot || '',
        provincial_street_sitio: farmer?.provincial_street_sitio || '',
        provincial_barangay: farmer?.provincial_barangay || '',
        provincial_city_municipality: farmer?.provincial_city_municipality || '',
        provincial_province: farmer?.provincial_province || '',
        provincial_region: farmer?.provincial_region || '',
        
        // Step 3: Classification
        is_indigenous: farmer?.is_indigenous || false,
        indigenous_community: farmer?.indigenous_community || '',
        pwd: farmer?.pwd || false,
        is_4ps: farmer?.is_4ps || false,
        organization_name: farmer?.organization_name || '',
        organization_name_2: farmer?.organization_name_2 || '',
        organization_name_3: farmer?.organization_name_3 || '',
        
        // Step 4: Livelihood
        livelihood_type: farmer?.livelihood_type || 'Farmer',
        
        // Step 5: Farm Parcels
        parcels: farmer?.parcels || [{
            barangay: '',
            city_municipality: 'Tumauini',
            province: 'Isabela',
            total_area_ha: '',
            cropping_schedule: '',
            commodity: '',
            no_of_heads_trees: '',
            farm_type_id: '',
            is_organic: false,
            within_ancestral: false,
            arb: false,
            ownership_type: 'Registered Owner',
            land_owner_name: '',
            proof_of_ownership: '',
        }],
        
        // Step 6: Documents
        photo: null,
        id_proof: null,

        // Account credentials (public self-registration only)
        email_account: '',
        password: '',
        password_confirmation: '',
    });

    const steps = [
        { number: 1, title: 'Personal', subtitle: 'Info', icon: User },
        { number: 2, title: 'Address', subtitle: '', icon: MapPin },
        { number: 3, title: 'Classi‑', subtitle: 'fication', icon: Users },
        { number: 4, title: 'Livelihood', subtitle: '', icon: Briefcase },
        { number: 5, title: 'Farm', subtitle: 'Parcels', icon: Map },
        { number: 6, title: 'Photo', subtitle: '& ID', icon: ImageIcon },
        { number: 7, title: 'Review', subtitle: '& Submit', icon: FileCheck },
    ];

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setData('photo', file);
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleIdProofChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setData('id_proof', file);
            const reader = new FileReader();
            reader.onloadend = () => setIdProofPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const addParcel = () => {
        setData('parcels', [...data.parcels, {
            barangay: '',
            city_municipality: 'Tumauini',
            province: 'Isabela',
            total_area_ha: '',
            cropping_schedule: '',
            commodity: '',
            no_of_heads_trees: '',
            farm_type_id: '',
            is_organic: false,
            within_ancestral: false,
            arb: false,
            ownership_type: 'Registered Owner',
            land_owner_name: '',
            proof_of_ownership: '',
        }]);
    };

    const addChild = () => {
        setData('children', [...data.children, { name: '', sex: '', birthdate: '' }]);
    };

    const removeChild = (index) => {
        setData('children', data.children.filter((_, i) => i !== index));
    };

    const updateChild = (index, field, value) => {
        setData('children', data.children.map(
            (child, i) => (i === index ? { ...child, [field]: value } : child)
        ));
    };

    /**
     * Only a married farmer is asked for a spouse. Switching away clears the
     * name so a leftover value cannot sit on a record marked Single - the
     * field is hidden at that point, so nobody would ever see it to correct it.
     */
    const setCivilStatus = (status) => {
        setData(prev => ({
            ...prev,
            civil_status: status,
            ...(status === 'Married' ? {} : {
                spouse_first_name: '',
                spouse_middle_name: '',
                spouse_last_name: '',
                spouse_ext_name: '',
            }),
        }));
    };

    const removeParcel = (index) => {
        const newParcels = data.parcels.filter((_, i) => i !== index);
        setData('parcels', newParcels);
    };

    const updateParcel = (index, field, value) => {
        const newParcels = [...data.parcels];
        newParcels[index][field] = value;
        setData('parcels', newParcels);
    };

    // A parcel row counts as declared once it has a location or an area.
    // Untouched blank rows are ignored so they never reach the database.
    const declaredParcels = data.parcels.filter(
        parcel => parcel.barangay?.trim() || String(parcel.total_area_ha ?? '').trim()
    );

    const validateStep = (step) => {
        switch (step) {
            case 1:
                // Only validate the absolute minimum: name and sex
                // Check for non-empty strings (trim to handle spaces)
                const step1Valid = 
                    data.first_name?.trim().length > 0 && 
                    data.last_name?.trim().length > 0 &&
                    data.sex?.trim().length > 0;
                
                if (!step1Valid) {
                    console.log('Step 1 validation failed. Missing:', {
                        first_name: data.first_name || 'MISSING',
                        last_name: data.last_name || 'MISSING',
                        sex: data.sex || 'MISSING',
                    });
                }
                
                return step1Valid;
            case 2:
                // Step 2: Allow to continue even without address (all optional now)
                return true;
            case 3:
            case 4:
            case 5:
            case 6:
                return true; // All these steps are flexible
            case 7:
                // The review step carries no fields of its own — the consent
                // box is checked separately, and only for a new registration.
                return true;
            default:
                return false;
        }
    };

    const nextStep = () => {
        // Debug: Log the current form data
        console.log('Current form data:', {
            first_name: data.first_name,
            last_name: data.last_name,
            sex: data.sex,
            livelihood_type: data.livelihood_type
        });
        
        if (validateStep(currentStep)) {
            // Special navigation logic for Step 4 (Livelihood)
            if (currentStep === 4) {
                if (data.livelihood_type === 'Farmer') {
                    // FARMER → proceed to PART 3 (Step 5 - Farm Parcels)
                    setCurrentStep(5);
                } else if (data.livelihood_type === 'Farm Worker' || data.livelihood_type === 'Fisher') {
                    // FARM WORKER or FISHER → skip to Step 6 (Photo & ID), then to Step 7
                    setCurrentStep(6);
                    toast.info('Farm Workers and Fishers: Please request a certification from the City/Municipal Agriculture Office');
                } else if (data.livelihood_type === 'Agri-Youth') {
                    // AGRI-YOUTH → skip to Step 6 (Photo & ID), then to Step 7
                    setCurrentStep(6);
                    toast.info('Agri-Youth: Proceeding to Photo & ID section');
                } else {
                    setCurrentStep(prev => Math.min(prev + 1, 7));
                }
            } else {
                // Normal progression for other steps
                setCurrentStep(prev => Math.min(prev + 1, 7));
            }
        } else {
            toast.error('Please fill in all required fields: First Name, Last Name, and Sex');
        }
    };

    const prevStep = () => {
        // Special back navigation from Step 7
        if (currentStep === 7) {
            // Always go back to Step 6 (Photo & ID)
            setCurrentStep(6);
        } else if (currentStep === 6) {
            // Check how we got here
            if (data.livelihood_type === 'Farmer') {
                // Came from Farm Parcels (Step 5), go back to Step 5
                setCurrentStep(5);
            } else {
                // Skipped Farm Parcels, go back to Step 4 (Livelihood)
                setCurrentStep(4);
            }
        } else {
            setCurrentStep(prev => Math.max(prev - 1, 1));
        }
    };

    /**
     * Builds the payload and sends it.
     *
     * Kept separate from the guards below so an edit can be saved from
     * whichever step the user happens to be on: correcting one phone number
     * should not mean clicking through seven pages of a form that is already
     * filled in.
     */
    const send = () => {
        const formData = new FormData();

        // Credential fields are handled separately below, never as farmer columns
        const credentialKeys = ['email_account', 'password', 'password_confirmation'];

        // Add all farmer fields
        Object.keys(data).forEach(key => {
            if (key === 'parcels' || key === 'children' || key === 'photo' || key === 'id_proof') return;
            if (credentialKeys.includes(key)) return;
            
            if (data[key] !== null && data[key] !== undefined) {
                if (typeof data[key] === 'boolean') {
                    formData.append(key, data[key] ? '1' : '0');
                } else {
                    formData.append(key, data[key]);
                }
            }
        });

        if (publicMode) {
            // The account email is what the farmer logs in with.
            formData.set('email', data.email_account);
            formData.append('password', data.password);
            formData.append('password_confirmation', data.password_confirmation);
        }

        // Only a FARMER declares farm parcels (Part 3). Other livelihood types
        // skip that step, so nothing is sent for them.
        formData.append('parcels', JSON.stringify(data.livelihood_type === 'Farmer' ? declaredParcels : []));

        // Sent whole every time, including when empty: the server replaces the
        // stored list with this one, which is how removing a child sticks.
        formData.append('children', JSON.stringify(data.children.filter(c => c.name?.trim())));

        // Add files
        if (data.photo instanceof File) {
            formData.append('photo', data.photo);
        }
        if (data.id_proof instanceof File) {
            formData.append('id_proof', data.id_proof);
        }

        if (publicMode) {
            router.post('/farmer-registration', formData, {
                onError: () => toast.error('Please review the highlighted fields and try again'),
            });
        } else if (isEdit) {
            formData.append('_method', 'PUT');
            router.post(`/admin/farmers/${farmer.id}`, formData, {
                onError: () => toast.error('Failed to update farmer'),
            });
        } else {
            router.post('/admin/farmers', formData, {
                onError: () => toast.error('Failed to register farmer'),
            });
        }
    };

    /**
     * The full run through the wizard: everything must be filled in and the
     * consent box ticked before a NEW record is created.
     */
    const submit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (currentStep !== 7) {
            toast.error('Please complete all steps before submitting');
            return;
        }

        if (!consentChecked) {
            toast.error('Please check the consent checkbox to agree to the terms before submitting');
            return;
        }

        // Public self-registration also needs login credentials.
        if (publicMode) {
            if (!data.email_account?.trim() || !data.password) {
                toast.error('Please provide an email and password for your account');
                return;
            }
            if (data.password !== data.password_confirmation) {
                toast.error('Passwords do not match');
                return;
            }
        }

        send();
    };

    /**
     * Saving an existing record from any step.
     *
     * The consent declaration belongs to first registration — the farmer has
     * already signed it — so it is not asked for again. The step the user is
     * on is validated so an obviously wrong field is caught before the round
     * trip; the rest of the record is untouched and already valid.
     */
    const saveEdit = () => {
        if (!validateStep(currentStep)) return;
        send();
    };

    // Public self-registration renders without the admin shell.
    const Shell = publicMode ? PublicFormShell : AdminLayout;

    return (
        <Shell title={publicMode ? 'Farmer Registration' : (isEdit ? 'Edit Farmer' : 'Add New Farmer')}>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {publicMode ? 'Register as a farmer' : (isEdit ? 'Edit Farmer' : 'Register a new farmer')}
                    </h1>
                    <p className="text-gray-600 mb-3">
                        Each part of the RSBSA form is its own step. Fill one part, then continue to the next.
                    </p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                        <Info className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-green-800">
                            Every field is labeled in English with its Filipino translation <span className="italic">(sa Filipino)</span> so farmers can fill this out themselves, in person or online.
                        </p>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => {
                            const Icon = step.icon;
                            const isCompleted = currentStep > step.number;
                            const isCurrent = currentStep === step.number;
                            
                            return (
                                <div key={step.number} className="flex-1 flex items-center">
                                    <div className="flex flex-col items-center flex-shrink-0 w-20">
                                        <div className={`
                                            w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 transition-all duration-300
                                            ${isCompleted ? 'bg-green-500 border-green-500' : ''}
                                            ${isCurrent ? 'bg-green-600 border-green-600 shadow-lg' : ''}
                                            ${!isCompleted && !isCurrent ? 'bg-white border-gray-300' : ''}
                                        `}>
                                            {isCompleted ? (
                                                <Check className="h-6 w-6 text-white" />
                                            ) : (
                                                <>
                                                    <span className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                                                        {step.number}
                                                    </span>
                                                    <Icon className={`h-4 w-4 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />
                                                </>
                                            )}
                                        </div>
                                        <div className="mt-2 text-center">
                                            <p className={`text-xs font-semibold leading-tight ${isCurrent ? 'text-green-600' : 'text-gray-500'}`}>
                                                {step.title}<br />{step.subtitle}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {index < steps.length - 1 && (
                                        <div className={`
                                            flex-1 h-0.5 mx-2 transition-all duration-300
                                            ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}
                                        `} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <form onSubmit={submit}>
                    {/* Step Content */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-6">
                        {/* STEP 1: Personal Information */}
                        {currentStep === 1 && (
                            <div className="p-8">
                                <div className="border-l-4 border-green-500 pl-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Part 1 — Personal Information <span className="text-gray-500 text-lg">(Impormasyong Personal)</span></h2>
                                    <p className="text-gray-600 mt-1">Basic identity details as they appear on official records</p>
                                </div>

                                <div className="space-y-6">
                                    {/* RSBSA No & Sex */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                RSBSA No. <span className="text-gray-500 font-normal">if already registered</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.rsbsa_no}
                                                // Hyphens are inserted as they type, so the clerk
                                                // enters digits and cannot mis-punctuate it.
                                                onChange={e => setData('rsbsa_no', formatRsbsa(e.target.value, {
                                                    deleting: e.nativeEvent?.inputType?.startsWith('delete'),
                                                }))}
                                                placeholder={RSBSA_MASK}
                                                inputMode="numeric"
                                                maxLength={RSBSA_MASK.length}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Sex <span className="text-gray-500">(Kasarian)</span> <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={data.sex}
                                                onChange={e => setData('sex', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            >
                                                <option value="">Select / Pumili</option>
                                                <option value="Male">Male (Lalaki)</option>
                                                <option value="Female">Female (Babae)</option>
                                            </select>
                                            {errors.sex && <p className="mt-1 text-sm text-red-600">{errors.sex}</p>}
                                        </div>
                                    </div>

                                    {/* Name Fields */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                First Name <span className="text-gray-500">(Pangalan)</span> <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.first_name}
                                                onChange={e => setData('first_name', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Last Name <span className="text-gray-500">(Apelyido)</span> <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.last_name}
                                                onChange={e => setData('last_name', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Middle Name <span className="text-gray-500">(Gitnang Pangalan)</span> <span className="text-gray-400 text-xs">optional</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.middle_name}
                                                onChange={e => setData('middle_name', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Extension Name <span className="text-gray-500">(Ekstensyon ng Pangalan)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.suffix}
                                                onChange={e => setData('suffix', e.target.value)}
                                                placeholder="Jr., Sr., III"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Birth Details */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            Birth & Family Details <span className="text-gray-500 text-base">(Kapanganakan at Pamilya)</span>
                                        </h3>
                                        <div className="grid grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Date of Birth <span className="text-gray-500">(Petsa ng Kapanganakan)</span> <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    value={data.birthdate}
                                                    onChange={e => setData('birthdate', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Place of Birth — City/Municipality <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={data.birth_city_municipality}
                                                    onChange={e => setData('birth_city_municipality', e.target.value)}
                                                    placeholder="Lugar ng Kapanganakan"
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Province <span className="text-gray-500">(Lalawigan)</span> <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={data.birth_province}
                                                    onChange={e => setData('birth_province', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mother's Name */}
                                    <div className="grid grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Mother's Maiden Name — First <span className="text-gray-500">(Pangalan ng Ina)</span> <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.mother_first_name}
                                                onChange={e => setData('mother_first_name', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Middle <span className="text-gray-400 text-xs">optional</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.mother_middle_name}
                                                onChange={e => setData('mother_middle_name', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Surname <span className="text-gray-500">(Apelyido ng Ina)</span> <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.mother_last_name}
                                                onChange={e => setData('mother_last_name', e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Civil Status & Religion */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            Civil Status & Religion <span className="text-gray-500 text-base">(Katayuang Sibil at Relihiyon)</span>
                                        </h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                                    Civil Status <span className="text-gray-500">(Katayuang Sibil)</span> <span className="text-red-500">*</span>
                                                </label>
                                                <div className="space-y-2">
                                                    {['Single', 'Married', 'Widowed', 'Separated'].map((status, idx) => (
                                                        <label key={status} className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                value={status}
                                                                checked={data.civil_status === status}
                                                                onChange={e => setCivilStatus(e.target.value)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">
                                                                {status} ({['Walang Asawa', 'Kasal', 'Balo', 'Hiwalay'][idx]})
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>

                                                {data.civil_status === 'Married' && (
                                                    <div className="mt-4">
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                                            Name of Spouse <span className="text-gray-500">(Pangalan ng Asawa)</span>
                                                        </label>
                                                        {/* Four columns, matching the captions ruled across the
                                                            printed form: FIRST NAME / MIDDLE NAME / SURNAME / EXT NAME. */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {[
                                                                ['spouse_first_name',  'First Name',  'Pangalan'],
                                                                ['spouse_middle_name', 'Middle Name', 'Gitnang Pangalan'],
                                                                ['spouse_last_name',   'Surname',     'Apelyido'],
                                                                ['spouse_ext_name',    'Ext. Name',   'Jr., Sr., III'],
                                                            ].map(([field, label, hint]) => (
                                                                <div key={field}>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        {label} <span className="text-gray-400">({hint})</span>
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={data[field]}
                                                                        onChange={e => setData(field, e.target.value)}
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                                    />
                                                                    {errors[field] && (
                                                                        <p className="text-red-500 text-xs mt-1">{errors[field]}</p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                                    Religion <span className="text-gray-500">(Relihiyon)</span> <span className="text-red-500">*</span>
                                                </label>
                                                <div className="space-y-2">
                                                    {[
                                                        { value: 'Christianity', label: 'Christianity' },
                                                        { value: 'Islam', label: 'Islam' },
                                                        { value: 'Others', label: 'Others (Iba pa)' },
                                                        { value: 'None', label: 'None (Wala)' }
                                                    ].map(religion => (
                                                        <label key={religion.value} className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                value={religion.value}
                                                                checked={data.religion === religion.value}
                                                                onChange={e => setData('religion', e.target.value)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">{religion.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Children */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                            Children <span className="text-gray-500 text-base">(Mga Anak)</span>
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Sons and daughters. Leave blank if none. The birthday is optional if the birth certificate is not on hand.
                                        </p>

                                        {data.children.length > 0 && (
                                            <div className="space-y-3 mb-4">
                                                {data.children.map((child, index) => (
                                                    <div key={index} className="flex items-end gap-3">
                                                        <div className="flex-1">
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                Full Name <span className="text-gray-400">(Buong Pangalan)</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={child.name}
                                                                onChange={e => updateChild(index, 'name', e.target.value)}
                                                                placeholder="Full name"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                            />
                                                        </div>
                                                        <div className="w-36">
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                Sex <span className="text-gray-400">(Kasarian)</span>
                                                            </label>
                                                            <select
                                                                value={child.sex}
                                                                onChange={e => updateChild(index, 'sex', e.target.value)}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                            >
                                                                <option value="">—</option>
                                                                <option value="Male">Male (Lalaki)</option>
                                                                <option value="Female">Female (Babae)</option>
                                                            </select>
                                                        </div>
                                                        <div className="w-48">
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                Birthday <span className="text-gray-400">(Kaarawan)</span>
                                                            </label>
                                                            <input
                                                                type="date"
                                                                value={child.birthdate}
                                                                onChange={e => updateChild(index, 'birthdate', e.target.value)}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeChild(index)}
                                                            aria-label={`Remove child ${index + 1}`}
                                                            className="p-2 mb-0.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                        >
                                                            <X className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={addChild}
                                            className="flex items-center gap-2 px-4 py-2 text-green-600 border-2 border-dashed border-green-300 rounded-lg hover:bg-green-50 transition font-medium"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Child <span className="text-gray-500">(Magdagdag ng Anak)</span>
                                        </button>
                                    </div>

                                    {/* Education */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                            Highest Formal Education <span className="text-gray-500 text-base">(Pinakamataas na Antas ng Pinag-aralan)</span>
                                        </h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                'Pre-school', 'Elementary', 'Junior High (K-12)', 
                                                'Senior High (K-12)', 'High School (non K-12)', 'Vocational',
                                                'College', 'Post-graduate', 'None (Wala)'
                                            ].map(edu => (
                                                <label key={edu} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        value={edu}
                                                        checked={data.highest_education === edu}
                                                        onChange={e => setData('highest_education', e.target.value)}
                                                        className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                    />
                                                    <span className="text-sm">{edu}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Contact & ID */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            Contact & Identification <span className="text-gray-500 text-base">(Pakikipag-ugnayan at Pagkakakilanlan)</span>
                                        </h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Mobile No. <span className="text-gray-500">(Numero ng Cellphone)</span> <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={data.mobile_no}
                                                    onChange={e => setData('mobile_no', formatMobile(e.target.value))}
                                                    placeholder={MOBILE_MASK}
                                                    inputMode="numeric"
                                                    maxLength={MOBILE_MASK.length}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Email <span className="text-gray-400 text-xs">optional</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    value={data.email}
                                                    onChange={e => setData('email', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Valid ID Type <span className="text-gray-500">(Uri ng Valid ID)</span> <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    value={data.valid_id_type}
                                                    onChange={e => setData('valid_id_type', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                >
                                                    <option value="">Select ID type</option>
                                                    <option value="PhilID">PhilID / National ID</option>
                                                    <option value="Driver's License">Driver's License</option>
                                                    <option value="Passport">Passport</option>
                                                    <option value="Voter's ID">Voter's ID</option>
                                                    <option value="4Ps ID">4Ps ID</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    ID / Document Number <span className="text-gray-500">(Numero ng ID)</span> <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={data.id_number}
                                                    onChange={e => setData('id_number', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Address - Will continue in next message due to length */}

                        {/* STEP 2: Address */}
                        {currentStep === 2 && (
                            <div className="p-8">
                                <div className="border-l-4 border-green-500 pl-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Address <span className="text-gray-500 text-lg">(Tirahan)</span></h2>
                                    <p className="text-gray-600 mt-1">Where this farmer's household is officially located</p>
                                </div>

                                <div className="space-y-8">
                                    {/* PERMANENT ADDRESS */}
                                    <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 uppercase">
                                            Permanent Address <span className="text-gray-500 font-normal">(Permanenteng Tirahan)</span>
                                        </h3>
                                        
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        House/Lot/Bldg No. / Purok <span className="text-gray-400 text-xs">optional</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.house_lot_number}
                                                        onChange={e => setData('house_lot_number', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Street / Sitio / Subdivision <span className="text-gray-400 text-xs">optional</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.street_sitio}
                                                        onChange={e => setData('street_sitio', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Barangay <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.barangay}
                                                        onChange={e => setData('barangay', e.target.value)}
                                                        placeholder="e.g. San Pablo"
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        City / Municipality <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.city_municipality}
                                                        onChange={e => setData('city_municipality', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Province <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.province}
                                                        onChange={e => setData('province', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Region <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        value={data.region}
                                                        onChange={e => setData('region', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    >
                                                        <option value="">Select region</option>
                                                        <option value="Region II — Cagayan Valley">Region II — Cagayan Valley</option>
                                                        <option value="Region I — Ilocos Region">Region I — Ilocos Region</option>
                                                        <option value="NCR">NCR</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PROVINCIAL ADDRESS (Only if Permanent Address is in NCR) */}
                                    <div className="border-2 border-green-200 rounded-xl p-6 bg-green-50">
                                        <div className="mb-4">
                                            <h3 className="text-lg font-bold text-gray-900 uppercase">
                                                Provincial Address <span className="text-gray-500 font-normal">(Tirahan sa Labas ng NCR)</span>
                                            </h3>
                                            <p className="text-sm text-green-700 mt-2">
                                                <span className="font-semibold">Answer only if declared permanent address is in NCR</span> <span className="italic">(Sagutan lamang kung ang permanenteng tirahan ay sa NCR)</span>
                                            </p>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        House/Lot/Bldg No. / Purok
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.provincial_house_lot}
                                                        onChange={e => setData('provincial_house_lot', e.target.value)}
                                                        disabled={data.region !== 'NCR'}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Street / Sitio / Subdivision
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.provincial_street_sitio}
                                                        onChange={e => setData('provincial_street_sitio', e.target.value)}
                                                        disabled={data.region !== 'NCR'}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Barangay
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.provincial_barangay}
                                                        onChange={e => setData('provincial_barangay', e.target.value)}
                                                        disabled={data.region !== 'NCR'}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        City / Municipality
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.provincial_city_municipality}
                                                        onChange={e => setData('provincial_city_municipality', e.target.value)}
                                                        disabled={data.region !== 'NCR'}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Province
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.provincial_province}
                                                        onChange={e => setData('provincial_province', e.target.value)}
                                                        disabled={data.region !== 'NCR'}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Region
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.provincial_region}
                                                        onChange={e => setData('provincial_region', e.target.value)}
                                                        disabled={data.region !== 'NCR'}
                                                        placeholder={data.region === 'NCR' ? 'e.g. Region III' : 'Only for NCR residents'}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Classification */}
                        {currentStep === 3 && (
                            <div className="p-8">
                                <div className="border-l-4 border-green-500 pl-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Background & Classification <span className="text-gray-500 text-lg">(Karagdagang Impormasyon)</span></h2>
                                    <p className="text-gray-600 mt-1">Helps route the right assistance programs to this farmer</p>
                                </div>

                                <div className="space-y-6">
                                    {/* Indigenous */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-1">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Indigenous Cultural Community / IP? <span className="text-gray-500">(Katutubo?)</span>
                                                </label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            checked={data.is_indigenous === true}
                                                            onChange={() => setData('is_indigenous', true)}
                                                            className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                        />
                                                        <span className="text-sm">Yes / Oo</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            checked={data.is_indigenous === false}
                                                            onChange={() => setData('is_indigenous', false)}
                                                            className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                        />
                                                        <span className="text-sm">No / Hindi</span>
                                                    </label>
                                                </div>
                                            </div>
                                            {data.is_indigenous && (
                                                <div className="flex-1">
                                                    <input
                                                        type="text"
                                                        value={data.indigenous_community}
                                                        onChange={e => setData('indigenous_community', e.target.value)}
                                                        placeholder="Specify community"
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* PWD */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Person with Disability? <span className="text-gray-500">(May Kapansanan?)</span>
                                        </label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={data.pwd === true}
                                                    onChange={() => setData('pwd', true)}
                                                    className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                />
                                                <span className="text-sm">Yes / Oo</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={data.pwd === false}
                                                    onChange={() => setData('pwd', false)}
                                                    className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                />
                                                <span className="text-sm">No / Hindi</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* 4Ps */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            4Ps Beneficiary? <span className="text-gray-500">(Benepisyaryo ng 4Ps?)</span>
                                        </label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={data.is_4ps === true}
                                                    onChange={() => setData('is_4ps', true)}
                                                    className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                />
                                                <span className="text-sm">Yes / Oo</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={data.is_4ps === false}
                                                    onChange={() => setData('is_4ps', false)}
                                                    className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                />
                                                <span className="text-sm">No / Hindi</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Organizations */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                            Membership <span className="text-gray-500 text-base">(Pagiging Kasapi)</span> — Association, Cooperative, or Organization
                                        </h3>
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={data.organization_name}
                                                onChange={e => setData('organization_name', e.target.value)}
                                                placeholder="1 optional"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                            <input
                                                type="text"
                                                value={data.organization_name_2}
                                                onChange={e => setData('organization_name_2', e.target.value)}
                                                placeholder="2 optional"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                            <input
                                                type="text"
                                                value={data.organization_name_3}
                                                onChange={e => setData('organization_name_3', e.target.value)}
                                                placeholder="3 optional"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: Livelihood */}
                        {currentStep === 4 && (
                            <div className="p-8">
                                <div className="border-l-4 border-green-500 pl-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 uppercase">Part 2: Livelihood Profile</h2>
                                    <p className="text-gray-600 mt-1">Check the appropriate box <span className="italic">(Lagyan ng tsek ang naaangkop)</span></p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { value: 'Farmer', label: 'FARMER', tagalog: '(MAGSASAKA)', icon: '🌾', note: 'If you are a FARMER, proceed to PART 3', nextStep: 'Step 5: Farm Parcels', color: 'green' },
                                        { value: 'Farm Worker', label: 'FARM WORKER', tagalog: '(MANGGAGAWA SA SAKAHAN)', icon: '👨‍🌾', note: 'If you are a FARM WORKER or FISHER, kindly request a CERTIFICATION', nextStep: 'Skip to Step 7', color: 'blue' },
                                        { value: 'Fisher', label: 'FISHER', tagalog: '(MANGINGISDA)', icon: '🎣', note: 'If you are a FARM WORKER or FISHER, kindly request a CERTIFICATION', nextStep: 'Skip to Step 7', color: 'blue' },
                                        { value: 'Agri-Youth', label: 'AGRI-YOUTH', tagalog: '', icon: '👨‍🎓', note: 'If you are an AGRI-YOUTH proceed to PART 4', nextStep: 'Skip to Step 7', color: 'purple' },
                                    ].map(livelihood => (
                                        <div
                                            key={livelihood.value}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log('Clicked livelihood:', livelihood.value);
                                                setData('livelihood_type', livelihood.value);
                                            }}
                                            className={`
                                                flex items-start gap-4 p-6 border-2 rounded-xl cursor-pointer transition-all
                                                ${data.livelihood_type === livelihood.value 
                                                    ? 'border-green-500 bg-green-50' 
                                                    : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center justify-center w-5 h-5 mt-1">
                                                {data.livelihood_type === livelihood.value ? (
                                                    <Check className="h-5 w-5 text-green-600" />
                                                ) : (
                                                    <div className="h-5 w-5 border-2 border-gray-400 rounded"></div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-3xl mb-2">{livelihood.icon}</div>
                                                <p className="font-bold text-gray-900">{livelihood.label}</p>
                                                <p className="text-sm font-semibold text-gray-600 mb-2">{livelihood.tagalog}</p>
                                                <p className="text-xs text-gray-500 italic leading-relaxed mb-2">{livelihood.note}</p>
                                                <div className={`inline-block px-2 py-1 rounded text-xs font-semibold bg-${livelihood.color}-100 text-${livelihood.color}-700 border border-${livelihood.color}-300`}>
                                                    → {livelihood.nextStep}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800">
                                        <span className="font-semibold">Note:</span> If you are a <span className="font-semibold">FARM WORKER</span> or <span className="font-semibold">FISHER</span>, kindly request a <span className="font-semibold uppercase">Certification as Farm Worker/Fisher</span> from the City/Municipal Agriculture Office <span className="italic">(Mag-request ng SERTIPIKASYON BILANG MANGGAGAWA SA SAKAHAN/MANGINGISDA mula sa City/Municipal Agriculture Office)</span>.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* STEP 5: Farm Parcels - Continue in next append */}

                        {/* STEP 5: Farm Parcels */}
                        {currentStep === 5 && (
                            <div className="p-8">
                                <div className="border-l-4 border-green-500 pl-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Part 3 — Farm Parcel Information <span className="text-gray-500 text-lg">(Impormasyon ng Sakahan)</span></h2>
                                    <p className="text-gray-600 mt-1">A farmer may declare multiple parcels</p>
                                </div>

                                <div className="space-y-6">
                                    {data.parcels.map((parcel, index) => (
                                        <div key={index} className="border-2 border-gray-200 rounded-xl p-6 relative">
                                            {/* Parcel Header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-bold text-gray-900">
                                                    {index + 1} Farm Parcel <span className="text-gray-500">(Sakahan)</span>
                                                </h3>
                                                {data.parcels.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeParcel(index)}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-lg transition"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        Remove
                                                    </button>
                                                )}
                                            </div>

                                            {/* Farm Location */}
                                            <div className="grid grid-cols-3 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Farm Location — Barangay <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={parcel.barangay}
                                                        onChange={e => updateParcel(index, 'barangay', e.target.value)}
                                                        placeholder="Lokasyon ng Sakahan"
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        City / Municipality <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={parcel.city_municipality}
                                                        onChange={e => updateParcel(index, 'city_municipality', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Province <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={parcel.province}
                                                        onChange={e => updateParcel(index, 'province', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>

                                            {/* Area & Crop Details */}
                                            <div className="grid grid-cols-4 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Total Area (Ha) <span className="text-gray-500">(Sukat)</span> <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={parcel.total_area_ha}
                                                        onChange={e => updateParcel(index, 'total_area_ha', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Cropping Schedule <span className="text-gray-500">(Iskedyul ng Tanim)</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={parcel.cropping_schedule}
                                                        onChange={e => updateParcel(index, 'cropping_schedule', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Commodity <span className="text-gray-500">(Produkto)</span> <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={parcel.commodity}
                                                        onChange={e => updateParcel(index, 'commodity', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        No. of Heads/Trees <span className="text-gray-400 text-xs">if applicable</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={parcel.no_of_heads_trees}
                                                        onChange={e => updateParcel(index, 'no_of_heads_trees', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>

                                            {/* Farm Type & Organic */}
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Farm Type <span className="text-gray-500">(Uri ng Sakahan)</span> <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        value={parcel.farm_type_id}
                                                        onChange={e => updateParcel(index, 'farm_type_id', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    >
                                                        <option value="">Select</option>
                                                        <option value="1">1 — Irrigated</option>
                                                        <option value="2">2 — Rainfed Upland</option>
                                                        <option value="3">3 — Rainfed Lowland</option>
                                                        <option value="4">4 — Urban/Peri-Urban</option>
                                                        <option value="N/A">N/A</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Organic Agriculture? <span className="text-gray-500">(Organiko?)</span>
                                                    </label>
                                                    <div className="flex gap-4 mt-2">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={parcel.is_organic === true}
                                                                onChange={() => updateParcel(index, 'is_organic', true)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">Yes / Oo</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={parcel.is_organic === false}
                                                                onChange={() => updateParcel(index, 'is_organic', false)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">No / Hindi</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Ancestral Domain & ARB */}
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Within Ancestral Domain? <span className="text-gray-500">(Ancestral Domain?)</span>
                                                    </label>
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={parcel.within_ancestral === true}
                                                                onChange={() => updateParcel(index, 'within_ancestral', true)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">Yes</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={parcel.within_ancestral === false}
                                                                onChange={() => updateParcel(index, 'within_ancestral', false)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">No</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Agrarian Reform Beneficiary? <span className="text-gray-500">(ARB?)</span>
                                                    </label>
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={parcel.arb === true}
                                                                onChange={() => updateParcel(index, 'arb', true)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">Yes</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={parcel.arb === false}
                                                                onChange={() => updateParcel(index, 'arb', false)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">No</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Ownership */}
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                                    Ownership / Tenure <span className="text-gray-500">(Pagmamay-ari)</span>
                                                </label>
                                                <div className="grid grid-cols-4 gap-3">
                                                    {['Registered Owner', 'Tenant', 'Lessee', 'Others'].map(type => (
                                                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                value={type}
                                                                checked={parcel.ownership_type === type}
                                                                onChange={e => updateParcel(index, 'ownership_type', e.target.value)}
                                                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm">
                                                                {type === 'Registered Owner' && 'Registered Owner (May-ari)'}
                                                                {type === 'Tenant' && 'Tenant (Kasama)'}
                                                                {type === 'Lessee' && 'Lessee (Umuupa)'}
                                                                {type === 'Others' && 'Others (Iba pa)'}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Land Owner & Proof */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Land Owner's Name <span className="text-gray-500">(Pangalan ng May-ari)</span> 
                                                        <span className="text-gray-400 text-xs"> if not registered owner</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={parcel.land_owner_name}
                                                        onChange={e => updateParcel(index, 'land_owner_name', e.target.value)}
                                                        disabled={parcel.ownership_type === 'Registered Owner'}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Proof of Land Ownership <span className="text-gray-500">(Patunay ng Pagmamay-ari)</span> <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        value={parcel.proof_of_ownership}
                                                        onChange={e => updateParcel(index, 'proof_of_ownership', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    >
                                                        <option value="">Select document</option>
                                                        <option value="Tax Declaration">Tax Declaration</option>
                                                        <option value="Certificate of Title">Certificate of Title</option>
                                                        <option value="CLOA">CLOA</option>
                                                        <option value="Homestead / Free Patent">Homestead / Free Patent</option>
                                                        <option value="Tenancy / Lease Agreement">Tenancy / Lease Agreement</option>
                                                        <option value="Others">Others</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Parcel Button */}
                                    <button
                                        type="button"
                                        onClick={addParcel}
                                        className="flex items-center gap-2 px-6 py-3 text-green-600 border-2 border-dashed border-green-300 rounded-lg hover:bg-green-50 transition font-medium w-full justify-center"
                                    >
                                        <Plus className="h-5 w-5" />
                                        Add Another Parcel <span className="text-gray-500">(Magdagdag ng Sakahan)</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Continue with Step 6 & 7 in next append */}

                        {/* STEP 6: Photo & ID */}
                        {currentStep === 6 && (
                            <div className="p-8">
                                <div className="border-l-4 border-green-500 pl-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Photo & Supporting Documents <span className="text-gray-500 text-lg">(Larawan at Dokumento)</span></h2>
                                    <p className="text-gray-600 mt-1">2x2 ID photo (taken within 6 months) and proof of identity</p>
                                </div>

                                <div className="space-y-6">
                                    {/* 2x2 Photo */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <ImageIcon className="h-5 w-5 text-gray-600" />
                                            <label className="block text-sm font-semibold text-gray-700">
                                                2x2 ID Photo <span className="text-gray-500">(Larawang 2x2)</span>
                                            </label>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-3">JPG or PNG, up to 5MB — taken within 6 months</p>
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50 hover:bg-gray-100 transition">
                                            {photoPreview ? (
                                                <div className="flex items-center gap-6">
                                                    <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300" />
                                                    <div>
                                                        <p className="font-semibold text-gray-900 mb-2">Photo uploaded successfully</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => document.getElementById('photo-input').click()}
                                                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                                        >
                                                            Change Photo
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <div className="flex justify-center mb-3">
                                                        <div className="bg-white p-4 rounded-full">
                                                            <ImageIcon className="h-10 w-10 text-gray-400" />
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => document.getElementById('photo-input').click()}
                                                        className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                                    >
                                                        Browse File
                                                    </button>
                                                </div>
                                            )}
                                            <input
                                                id="photo-input"
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePhotoChange}
                                                className="hidden"
                                            />
                                        </div>
                                    </div>

                                    {/* ID Proof */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <FileCheck className="h-5 w-5 text-gray-600" />
                                            <label className="block text-sm font-semibold text-gray-700">
                                                Proof of ID / Land Ownership <span className="text-gray-500">(Patunay ng Pagkakakilanlan o Lupa)</span>
                                            </label>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-3">PDF, JPG or PNG — scanned copy for verification</p>
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50 hover:bg-gray-100 transition">
                                            {idProofPreview ? (
                                                <div className="flex items-center gap-6">
                                                    <div className="w-32 h-32 bg-white rounded-lg border-2 border-gray-300 flex items-center justify-center">
                                                        <FileCheck className="h-16 w-16 text-green-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 mb-2">Document uploaded successfully</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => document.getElementById('id-proof-input').click()}
                                                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                                        >
                                                            Change Document
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <div className="flex justify-center mb-3">
                                                        <div className="bg-white p-4 rounded-full">
                                                            <FileCheck className="h-10 w-10 text-gray-400" />
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => document.getElementById('id-proof-input').click()}
                                                        className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                                    >
                                                        Browse File
                                                    </button>
                                                </div>
                                            )}
                                            <input
                                                id="id-proof-input"
                                                type="file"
                                                accept="image/*,application/pdf"
                                                onChange={handleIdProofChange}
                                                className="hidden"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 7: Review & Submit */}
                        {currentStep === 7 && (
                            <div className="p-8">
                                <div className="border-l-4 border-green-500 pl-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Part 4 — Consent Form and Data Privacy Notice</h2>
                                    <p className="text-gray-600 mt-1">Review your information and provide consent</p>
                                </div>

                                <div className="space-y-6">
                                    {/* Summary Card */}
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">Registration Summary</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-600 mb-1">Full Name <span className="text-gray-500">(Buong Pangalan)</span></p>
                                                <p className="font-semibold text-gray-900">
                                                    {data.first_name || data.last_name || data.middle_name
                                                        ? `${data.first_name} ${data.middle_name} ${data.last_name} ${data.suffix}`.trim()
                                                        : 'Not yet filled in'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 mb-1">Sex / Civil Status</p>
                                                <p className="font-semibold text-gray-900">
                                                    {data.sex && data.civil_status ? `${data.sex} / ${data.civil_status}` : (data.sex || 'Not yet filled in')}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 mb-1">Barangay</p>
                                                <p className="font-semibold text-gray-900">{data.barangay || 'Not yet filled in'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 mb-1">Livelihood <span className="text-gray-500">(Hanapbuhay)</span></p>
                                                <p className="font-semibold text-gray-900">{data.livelihood_type}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 mb-1">Farm Parcels Declared</p>
                                                <p className="font-semibold text-gray-900">
                                                    {data.livelihood_type === 'Farmer'
                                                        ? `${declaredParcels.length} parcel${declaredParcels.length !== 1 ? 's' : ''}`
                                                        : 'Not applicable for this livelihood'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 mb-1">2x2 Photo</p>
                                                <p className="font-semibold text-gray-900">{photoPreview ? '✓ Uploaded' : 'Not uploaded'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Consent Form */}
                                    <div className="border-2 border-gray-800 rounded-lg p-6 bg-gray-50">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 uppercase">Consent Form and Data Privacy Notice</h3>
                                        
                                        <div className="space-y-4 text-sm text-gray-700 leading-relaxed mb-6">
                                            <p className="text-justify">
                                                I hereby declare that all information indicated in this form are true, correct, and complete, and that they may be used by the Department of Agriculture for the purposes of registration to the RSBSA and other legitimate interests of the Department pursuant to its mandates. I am fully aware that I can be held liable for any misdeclaration or intentional omission made herein pursuant to applicable laws and regulations.
                                            </p>
                                            <p className="text-justify">
                                                Furthermore, I hereby give consent to the Department of Agriculture to conduct validation activities on my declared farm parcels through the RSBSA Georeferencing Activity.
                                            </p>
                                        </div>

                                        {/* Signature Section */}
                                        <div className="grid grid-cols-2 gap-6 mb-6">
                                            <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                                                <p className="text-xs text-gray-600 uppercase mb-2">Date</p>
                                                <p className="font-semibold text-gray-900">
                                                    {new Date().toLocaleDateString('en-US', { 
                                                        year: 'numeric', 
                                                        month: 'long', 
                                                        day: 'numeric' 
                                                    })}
                                                </p>
                                            </div>
                                            <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                                                <p className="text-xs text-gray-600 uppercase mb-2">Printed Name of Registrant</p>
                                                <p className="font-semibold text-gray-900">
                                                    {data.first_name || data.last_name 
                                                        ? `${data.first_name} ${data.middle_name} ${data.last_name} ${data.suffix}`.trim()
                                                        : 'Name not entered'
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-t-2 border-gray-300 pt-4">
                                            <p className="text-xs text-gray-600 uppercase mb-3">Verified True and Correct By:</p>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="text-center">
                                                    <div className="h-16 border-b-2 border-gray-400 mb-2"></div>
                                                    <p className="text-xs text-gray-600">Barangay Chairperson / ICC/IPs Leader / Elder (IPO) / Ulama Veterinarian / Livestock / Agri District Officer (Supervisor) / C/MAFO (ARBs)</p>
                                                </div>
                                                <div className="text-center">
                                                    <div className="h-16 border-b-2 border-gray-400 mb-2"></div>
                                                    <p className="text-xs text-gray-600">Signature Above Printed Name / Date<br/>City/Municipal Agri-Fishery Council (C/MAFC) Chairperson</p>
                                                </div>
                                                <div className="text-center">
                                                    <div className="h-16 border-b-2 border-gray-400 mb-2"></div>
                                                    <p className="text-xs text-gray-600">Signature Above Printed Name / Date<br/>City/Municipal Agriculturist (C/MA)</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Data Privacy Notice */}
                                    <div className="border-2 border-green-600 rounded-lg p-6 bg-green-50">
                                        <h3 className="text-lg font-bold text-green-900 mb-3 uppercase">Data Privacy Notice</h3>
                                        <div className="text-xs text-green-900 leading-relaxed space-y-2">
                                            <p className="text-justify">
                                                The Department of Agriculture (DA) commits to uphold your rights to privacy as a data subject under the Data Privacy Act of 2012 (DPA). In this regard, the DA shall strictly implement controls and measures compliant to the DPA, its IRR, and the Circulars issued by the National Privacy Commission (NPC).
                                            </p>
                                            <p className="text-justify">
                                                The processing of personal information collected through this form shall be for the purpose of registration of farmers, fisherfolk and farm workers to the RSBSA and other related legitimate interests of the DA. All RSBSA-related personal data shall be used in the making, reporting, and other processes pursuant to DA's mandate to deliver agricultural programs and initiatives beneficial to RSBSA-registered farmers, fisherfolk and farmworkers and for other purposes authorized by law and with your consent.
                                            </p>
                                            <p className="text-justify">
                                                As further measure of information, objection to processing, claim for rectification, claim for compensation for harm caused by the misuse, and the option to file a complaint with the NPC for violation of privacy rights.
                                            </p>
                                            <p className="font-semibold mt-3">
                                                For any data privacy-related concerns, you may contact the Data Privacy Officer at <span className="text-green-700">dpo@da.gov.ph</span>.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Important Notice */}
                                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                                        <p className="text-sm text-yellow-900 font-semibold text-center">
                                            ⚠️ THIS OFFICIAL RSBSA ENROLLMENT FORM IS NOT FOR SALE
                                        </p>
                                    </div>

                                    {/* Account credentials - public self-registration only */}
                                    {publicMode && (
                                        <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
                                            <h3 className="text-lg font-bold text-gray-900 mb-1">Create your account</h3>
                                            <p className="text-sm text-gray-600 mb-4">
                                                You will use these details to log in once staff verifies your registration at the Agriculture Office.
                                                <span className="italic"> (Gagamitin ito para makapasok sa sistema kapag na-verify na ng staff ang inyong rehistrasyon.)</span>
                                            </p>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="col-span-2">
                                                    <label htmlFor="email_account" className="block text-sm font-medium text-gray-700 mb-2">
                                                        Email Address <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        id="email_account"
                                                        name="email_account"
                                                        type="email"
                                                        autoComplete="email"
                                                        value={data.email_account}
                                                        onChange={e => setData('email_account', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                                                </div>

                                                <div>
                                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                                        Password <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        id="password"
                                                        name="password"
                                                        type="password"
                                                        autoComplete="new-password"
                                                        value={data.password}
                                                        onChange={e => setData('password', e.target.value)}
                                                        placeholder="At least 8 characters"
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                                                </div>

                                                <div>
                                                    <label htmlFor="password_confirmation" className="block text-sm font-medium text-gray-700 mb-2">
                                                        Confirm Password <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        id="password_confirmation"
                                                        name="password_confirmation"
                                                        type="password"
                                                        autoComplete="new-password"
                                                        value={data.password_confirmation}
                                                        onChange={e => setData('password_confirmation', e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* What happens next - public self-registration only */}
                                    {publicMode && (
                                        <div className="border-2 border-amber-400 rounded-lg p-6 bg-amber-50">
                                            <h3 className="text-lg font-bold text-amber-900 mb-3">What happens after you submit</h3>
                                            <ol className="text-sm text-amber-900 space-y-2 list-decimal list-inside">
                                                <li>You receive a reference number for this submission.</li>
                                                <li>Visit the <strong>LGU Agriculture Office, Tumauini</strong> and bring your valid ID and supporting documents.</li>
                                                <li>Staff compares your documents against this online submission.</li>
                                                <li>Once approved, your account is activated and you can log in to your dashboard.</li>
                                            </ol>
                                            <p className="text-sm text-amber-800 italic mt-3">
                                                Ang inyong rehistrasyon ay hindi pa opisyal hangga't hindi na-verify ng staff sa Agriculture Office.
                                            </p>
                                        </div>
                                    )}

                                    {/* Consent Checkbox - REQUIRED before submitting */}
                                    <div className="border-2 border-green-600 rounded-lg p-6 bg-green-50">
                                        <div 
                                            className="flex items-start gap-4 cursor-pointer"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setConsentChecked(!consentChecked);
                                            }}
                                        >
                                            <div className={`
                                                flex-shrink-0 w-6 h-6 mt-1 rounded border-2 flex items-center justify-center
                                                ${consentChecked 
                                                    ? 'bg-green-600 border-green-600' 
                                                    : 'bg-white border-gray-400 hover:border-green-500'
                                                }
                                            `}>
                                                {consentChecked && <Check className="h-4 w-4 text-white" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-green-900 mb-2">
                                                    I AGREE TO THE TERMS AND CONDITIONS <span className="text-red-500">*</span>
                                                </p>
                                                <p className="text-sm text-green-800">
                                                    By checking this box, I hereby declare that all information indicated in this form is true, correct, and complete. I give my consent to the Department of Agriculture and LGU Tumauini to process my personal data for RSBSA registration and related purposes pursuant to the Data Privacy Act of 2012.
                                                </p>
                                                <p className="text-sm text-green-800 italic mt-2">
                                                    (Sa pag-check ng kahon na ito, isinasaad ko na totoo, tama, at kumpleto ang lahat ng impormasyong nakasaad sa form na ito. Binibigyan ko ng pahintulot ang DA at LGU Tumauini na iproseso ang aking personal na datos para sa rehistrasyon sa RSBSA.)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation Footer */}
                    <div className="bg-gray-50 px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={prevStep}
                            disabled={currentStep === 1}
                            className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </button>

                        <div className="text-center">
                            <p className="text-sm font-semibold text-gray-900">
                                Step {currentStep} of {steps.length} — {steps[currentStep - 1].title} {steps[currentStep - 1].subtitle}
                            </p>
                        </div>

                        {currentStep < 7 ? (
                            <div className="flex items-center gap-2">
                                {/* Editing an existing record can be saved from
                                    any step — the rest of the form is already
                                    filled in, so walking to step 7 to correct
                                    one field is wasted clicks. */}
                                {isEdit && !publicMode && (
                                    <button
                                        type="button"
                                        onClick={saveEdit}
                                        disabled={processing}
                                        title="Save your changes and return to the registry"
                                        className="flex items-center gap-2 px-6 py-3 border-2 border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Check className="h-4 w-4" />
                                        {processing ? 'Saving…' : 'Save changes'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-md"
                                >
                                    Continue to {steps[currentStep]?.title}
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        ) : isEdit && !publicMode ? (
                            // The consent declaration belongs to first
                            // registration; this farmer has already signed it,
                            // so an edit is not asked to agree to it again.
                            <button
                                type="button"
                                onClick={saveEdit}
                                disabled={processing}
                                className="flex items-center gap-2 px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 transition font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="h-5 w-5" />
                                {processing ? 'Saving…' : 'Save changes'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!consentChecked) {
                                        toast.error('Please check the consent checkbox to agree to the terms');
                                        return;
                                    }
                                    submit(e);
                                }}
                                disabled={processing || !consentChecked}
                                className={`flex items-center gap-2 px-8 py-3 rounded-lg transition font-medium shadow-lg ${
                                    consentChecked
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                } disabled:opacity-50`}
                            >
                                <Check className="h-5 w-5" />
                                {publicMode ? 'Submit Registration' : 'Save Farmer'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </Shell>
    );
}
