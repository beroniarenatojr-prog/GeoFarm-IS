import AdminLayout from '@/Layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
import { User, Phone, MapPin, UserCheck, Image, CheckCircle2, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { formatRsbsa, formatMobile, RSBSA_MASK, MOBILE_MASK } from '@/utils/registryFormats';

export default function FarmerForm({ farmer }) {
    const isEdit = !!farmer;
    const [currentStep, setCurrentStep] = useState(1);
    const [photoPreview, setPhotoPreview] = useState(farmer?.photo_url || null);
    
    const { data, setData, processing, errors } = useForm({
        rsbsa_no: farmer?.rsbsa_no || '',
        first_name: farmer?.first_name || '',
        last_name: farmer?.last_name || '',
        middle_name: farmer?.middle_name || '',
        suffix: farmer?.suffix || '',
        birthdate: farmer?.birthdate || '',
        sex: farmer?.sex || '',
        civil_status: farmer?.civil_status || '',
        mobile_no: farmer?.mobile_no || '',
        email: farmer?.email || '',
        barangay: farmer?.barangay || '',
        city_municipality: farmer?.city_municipality || 'Tumauini',
        province: farmer?.province || 'Isabela',
        pwd: farmer?.pwd || false,
        is_4ps: farmer?.is_4ps || false,
        is_indigenous: farmer?.is_indigenous || false,
        organization_name: farmer?.organization_name || '',
        photo: null,
    });

    const steps = [
        { number: 1, title: 'Personal Details', icon: User, description: 'Basic information' },
        { number: 2, title: 'Contact & Address', icon: MapPin, description: 'Location and contact' },
        { number: 3, title: 'Classification', icon: UserCheck, description: 'Beneficiary status' },
        { number: 4, title: 'Photo & Review', icon: Image, description: 'Final verification' },
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

    const validateStep = (step) => {
        switch (step) {
            case 1:
                return data.first_name && data.last_name && data.birthdate && data.sex && data.civil_status;
            case 2:
                return data.mobile_no && data.barangay && data.city_municipality && data.province;
            case 3:
                return true; // Classification is optional
            case 4:
                return true; // Photo is optional
            default:
                return false;
        }
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 4));
        } else {
            toast.error('Please fill in all required fields');
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const submit = (e) => {
        e.preventDefault();
        
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
                if (key === 'photo' && data[key] instanceof File) {
                    formData.append(key, data[key]);
                } else if (typeof data[key] === 'boolean') {
                    formData.append(key, data[key] ? '1' : '0');
                } else {
                    formData.append(key, data[key]);
                }
            }
        });

        if (isEdit) {
            formData.append('_method', 'PUT');
            router.post(`/admin/farmers/${farmer.id}`, formData, {
                onError: () => toast.error('Failed to update farmer'),
            });
        } else {
            router.post('/admin/farmers', formData, {
                onError: () => toast.error('Failed to add farmer'),
            });
        }
    };

    return (
        <AdminLayout title={isEdit ? 'Edit Farmer' : 'Add New Farmer'}>
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {isEdit ? 'Edit Farmer' : 'Farmer Registration'}
                    </h1>
                    <p className="text-gray-600">
                        Complete the registration process step by step
                    </p>
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
                                    {/* Step Circle */}
                                    <div className="flex flex-col items-center flex-shrink-0">
                                        <div className={`
                                            w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                            ${isCompleted ? 'bg-green-500 border-green-500' : ''}
                                            ${isCurrent ? 'bg-green-600 border-green-600 scale-110' : ''}
                                            ${!isCompleted && !isCurrent ? 'bg-white border-gray-300' : ''}
                                        `}>
                                            {isCompleted ? (
                                                <Check className="h-6 w-6 text-white" />
                                            ) : (
                                                <Icon className={`h-6 w-6 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />
                                            )}
                                        </div>
                                        <div className="mt-3 text-center">
                                            <p className={`text-sm font-semibold ${isCurrent ? 'text-green-600' : 'text-gray-500'}`}>
                                                {step.title}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Connector Line */}
                                    {index < steps.length - 1 && (
                                        <div className={`
                                            flex-1 h-0.5 mx-4 transition-all duration-300
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
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6">
                        {/* Step 1: Personal Details */}
                        {currentStep === 1 && (
                            <div className="p-8">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Personal Details</h2>
                                    <p className="text-gray-600">Enter the farmer's basic information</p>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                RSBSA Number <span className="text-red-500">*</span>
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
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                            {errors.rsbsa_no && <p className="mt-1 text-sm text-red-600">{errors.rsbsa_no}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                First Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.first_name}
                                                onChange={e => setData('first_name', e.target.value)}
                                                placeholder="Juan"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                            {errors.first_name && <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Last Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.last_name}
                                                onChange={e => setData('last_name', e.target.value)}
                                                placeholder="Dela Cruz"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                            {errors.last_name && <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Middle Name
                                            </label>
                                            <input
                                                type="text"
                                                value={data.middle_name}
                                                onChange={e => setData('middle_name', e.target.value)}
                                                placeholder="Santos"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Suffix <span className="text-gray-400 text-xs">(optional)</span>
                                            </label>
                                            <select
                                                value={data.suffix}
                                                onChange={e => setData('suffix', e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            >
                                                <option value="">None</option>
                                                <option value="Jr.">Jr.</option>
                                                <option value="Sr.">Sr.</option>
                                                <option value="II">II</option>
                                                <option value="III">III</option>
                                                <option value="IV">IV</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Date of Birth <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={data.birthdate}
                                                onChange={e => setData('birthdate', e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                            {errors.birthdate && <p className="mt-1 text-sm text-red-600">{errors.birthdate}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Sex <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={data.sex}
                                                onChange={e => setData('sex', e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            >
                                                <option value="">Select</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                            {errors.sex && <p className="mt-1 text-sm text-red-600">{errors.sex}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Civil Status <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={data.civil_status}
                                                onChange={e => setData('civil_status', e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            >
                                                <option value="">Select</option>
                                                <option value="Single">Single</option>
                                                <option value="Married">Married</option>
                                                <option value="Widowed">Widowed</option>
                                                <option value="Separated">Separated</option>
                                                <option value="Divorced">Divorced</option>
                                            </select>
                                            {errors.civil_status && <p className="mt-1 text-sm text-red-600">{errors.civil_status}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Contact & Address */}
                        {currentStep === 2 && (
                            <div className="p-8">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact & Address</h2>
                                    <p className="text-gray-600">How can we reach this farmer?</p>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Mobile Number <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                value={data.mobile_no}
                                                onChange={e => setData('mobile_no', formatMobile(e.target.value))}
                                                placeholder={MOBILE_MASK}
                                                inputMode="numeric"
                                                maxLength={MOBILE_MASK.length}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                            {errors.mobile_no && <p className="mt-1 text-sm text-red-600">{errors.mobile_no}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Email Address <span className="text-gray-400 text-xs">(optional)</span>
                                            </label>
                                            <input
                                                type="email"
                                                value={data.email}
                                                onChange={e => setData('email', e.target.value)}
                                                placeholder="name@example.com"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Barangay <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.barangay}
                                                onChange={e => setData('barangay', e.target.value)}
                                                placeholder="e.g. San Pablo"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                            {errors.barangay && <p className="mt-1 text-sm text-red-600">{errors.barangay}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                City / Municipality <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.city_municipality}
                                                onChange={e => setData('city_municipality', e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                Province <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.province}
                                                onChange={e => setData('province', e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Classification */}
                        {currentStep === 3 && (
                            <div className="p-8">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Beneficiary Classification</h2>
                                    <p className="text-gray-600">Select all that apply to help route assistance programs</p>
                                </div>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                                            Special Classifications
                                        </label>
                                        <div className="space-y-3">
                                            <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 transition">
                                                <input
                                                    type="checkbox"
                                                    checked={data.pwd}
                                                    onChange={e => setData('pwd', e.target.checked)}
                                                    className="mt-1 h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                                />
                                                <div>
                                                    <p className="font-semibold text-gray-900">Person with Disability (PWD)</p>
                                                    <p className="text-sm text-gray-600">Has physical, mental, or sensory impairment</p>
                                                </div>
                                            </label>

                                            <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 transition">
                                                <input
                                                    type="checkbox"
                                                    checked={data.is_4ps}
                                                    onChange={e => setData('is_4ps', e.target.checked)}
                                                    className="mt-1 h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                                />
                                                <div>
                                                    <p className="font-semibold text-gray-900">4Ps Beneficiary</p>
                                                    <p className="text-sm text-gray-600">Pantawid Pamilyang Pilipino Program member</p>
                                                </div>
                                            </label>

                                            <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 transition">
                                                <input
                                                    type="checkbox"
                                                    checked={data.is_indigenous}
                                                    onChange={e => setData('is_indigenous', e.target.checked)}
                                                    className="mt-1 h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                                />
                                                <div>
                                                    <p className="font-semibold text-gray-900">Indigenous People</p>
                                                    <p className="text-sm text-gray-600">Member of an indigenous cultural community</p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Organization / Cooperative / Association <span className="text-gray-400 text-xs">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={data.organization_name}
                                            onChange={e => setData('organization_name', e.target.value)}
                                            placeholder="e.g. Tumauini Farmers' Cooperative"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">If the farmer belongs to any farming organization</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Photo & Review */}
                        {currentStep === 4 && (
                            <div className="p-8">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Photo & Final Review</h2>
                                    <p className="text-gray-600">Upload a photo and verify all information</p>
                                </div>
                                
                                <div className="space-y-8">
                                    {/* Photo Upload */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                                            Farmer Photo <span className="text-gray-400 text-xs">(optional)</span>
                                        </label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50 hover:bg-gray-100 transition">
                                            {photoPreview ? (
                                                <div className="flex items-center gap-6">
                                                    <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300" />
                                                    <div>
                                                        <p className="font-semibold text-gray-900 mb-2">Photo uploaded successfully</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => document.getElementById('photo-input').click()}
                                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                                        >
                                                            Change Photo
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <div className="flex justify-center mb-3">
                                                        <div className="bg-white p-4 rounded-full">
                                                            <Image className="h-10 w-10 text-gray-400" />
                                                        </div>
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-900 mb-1">Click to upload photo</p>
                                                    <p className="text-xs text-gray-500 mb-4">JPG or PNG, max 5MB</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => document.getElementById('photo-input').click()}
                                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                                    >
                                                        Browse Files
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

                                    {/* Review Summary */}
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">Registration Summary</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">FULL NAME</p>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {data.first_name} {data.middle_name} {data.last_name} {data.suffix}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">RSBSA NUMBER</p>
                                                <p className="text-sm font-medium text-gray-900">{data.rsbsa_no || 'Not provided'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">DATE OF BIRTH</p>
                                                <p className="text-sm font-medium text-gray-900">{data.birthdate}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">SEX & CIVIL STATUS</p>
                                                <p className="text-sm font-medium text-gray-900">{data.sex} • {data.civil_status}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">MOBILE NUMBER</p>
                                                <p className="text-sm font-medium text-gray-900">{data.mobile_no}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">EMAIL</p>
                                                <p className="text-sm font-medium text-gray-900">{data.email || 'Not provided'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs font-semibold text-gray-500 mb-1">ADDRESS</p>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {data.barangay}, {data.city_municipality}, {data.province}
                                                </p>
                                            </div>
                                            {(data.pwd || data.is_4ps || data.is_indigenous) && (
                                                <div className="col-span-2">
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">CLASSIFICATIONS</p>
                                                    <div className="flex gap-2">
                                                        {data.pwd && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">PWD</span>}
                                                        {data.is_4ps && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">4Ps</span>}
                                                        {data.is_indigenous && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Indigenous</span>}
                                                    </div>
                                                </div>
                                            )}
                                            {data.organization_name && (
                                                <div className="col-span-2">
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">ORGANIZATION</p>
                                                    <p className="text-sm font-medium text-gray-900">{data.organization_name}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation Footer */}
                    <div className="flex items-center justify-between bg-gray-50 px-6 py-4 rounded-xl border border-gray-200">
                        <button
                            type="button"
                            onClick={prevStep}
                            disabled={currentStep === 1}
                            className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </button>

                        <div className="text-sm text-gray-600">
                            Step {currentStep} of {steps.length}
                        </div>

                        {currentStep < 4 ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={processing}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                {isEdit ? 'Update Farmer' : 'Save Farmer'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
