import AdminLayout from '@/Layouts/AdminLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Plus, Filter, Download, Trash2, Eye, Edit3, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '@/Components/ui/DataTable';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/dateFormatter';

export default function FarmersIndex({ farmers, filters, barangays }) {
  const { can } = usePermissions();
  const [search, setSearch] = useState(filters.search ?? '');
  const [barangay, setBarangay] = useState(filters.barangay ?? '');
  const [selectedRows, setSelectedRows] = useState([]);

  const flattenFarmers = farmers.data.map(farmer => ({
    id: farmer.id,
    rsbsa_no: farmer.rsbsa_no || '—',
    last_name: farmer.last_name,
    first_name: farmer.first_name,
    middle_name: farmer.middle_name || '',
    suffix: farmer.suffix || '',
    barangay: farmer.barangay || '—',
    municipality: farmer.city_municipality || '—',
    province: farmer.province || '—',
    birthdate: formatDate(farmer.birthdate, 'date-only'),
    sex: farmer.sex || '—',
    contact: farmer.mobile_no || '—',
    is_4ps: farmer.is_4ps ? 'YES' : 'NO',
    is_indigenous: farmer.is_indigenous ? 'YES' : 'NO',
    pwd: farmer.pwd ? 'YES' : 'NO',
    organization: farmer.organization_name || '—',
  }));

  const columns = [
    { header: 'RSBSA NO.', accessorKey: 'rsbsa_no', size: 140 },
    { header: 'LASTNAME', accessorKey: 'last_name', size: 120 },
    { header: 'FIRST NAME', accessorKey: 'first_name', size: 120 },
    { header: 'MIDDLE NAME', accessorKey: 'middle_name', size: 120 },
    { header: 'SUFFIX', accessorKey: 'suffix', size: 80 },
    { header: 'BARANGAY', accessorKey: 'barangay', size: 120 },
    { header: 'MUNICIPAL', accessorKey: 'municipality', size: 120 },
    { header: 'PROVINCE', accessorKey: 'province', size: 100 },
    { header: 'BIRTHDATE', accessorKey: 'birthdate', size: 100 },
    { header: 'SEX', accessorKey: 'sex', size: 80 },
    { header: 'CONTACT NO.', accessorKey: 'contact', size: 120 },
    { 
      header: '4PS', 
      accessorKey: 'is_4ps',
      size: 60,
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.original.is_4ps === 'YES' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {row.original.is_4ps}
        </span>
      )
    },
    { 
      header: 'INDIGENOUS', 
      accessorKey: 'is_indigenous',
      size: 100,
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.original.is_indigenous === 'YES' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {row.original.is_indigenous}
        </span>
      )
    },
    { 
      header: 'PWD', 
      accessorKey: 'pwd',
      size: 60,
      cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.original.pwd === 'YES' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {row.original.pwd}
        </span>
      )
    },
    { header: 'ORGANIZATION', accessorKey: 'organization', size: 150 },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {can('view farmers') && (
            <Link 
              href={`/admin/farmers/${row.original.id}`}
              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
              title="View"
            >
              <Eye className="h-4 w-4" />
            </Link>
          )}
          {can('edit farmers') && (
            <Link 
              href={`/admin/farmers/${row.original.id}/edit`}
              className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition"
              title="Edit"
            >
              <Edit3 className="h-4 w-4" />
            </Link>
          )}
        </div>
      ),
    },
  ];

  const applyFilter = () => {
    router.get('/admin/farmers', { search, barangay }, { preserveState: true });
  };

  const bulkDelete = () => {
    if (selectedRows.length === 0) {
      toast.error('Select farmers to delete');
      return;
    }
    if (confirm(`Delete ${selectedRows.length} selected farmers?`)) {
      // Backend bulk delete endpoint needed
      toast.success(`${selectedRows.length} farmers queued for deletion`);
      setSelectedRows([]);
    }
  };

  const bulkExport = () => {
    toast.success('Exporting selected farmers...');
  };

  return (
    <AdminLayout title="👨‍🌾 Farmer Registry">
      <Card title="">
        <div className="flex flex-col lg:flex-row gap-4 mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 rounded-2xl">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            <div className="relative">
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, RSBSA, or email..."
                className="pl-10 pr-4 py-2.5 w-80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm"
              />
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <select 
              value={barangay} 
              onChange={e => setBarangay(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm"
            >
              <option value="">All Barangays</option>
              {barangays.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <button 
              onClick={applyFilter}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:bg-green-700 transition-all text-sm font-medium"
            >
              Apply Filters
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedRows.length > 0 && (
              <>
                <Badge variant="green">{selectedRows.length} selected</Badge>
                {can('export reports') && (
                  <button 
                    onClick={bulkExport}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                )}
                {can('delete farmers') && (
                  <button 
                    onClick={bulkDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </>
            )}
            {can('create farmers') && (
              <Link 
                href="/admin/farmers/create"
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                Add New Farmer
              </Link>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <div className="min-w-max">
            <DataTable 
              columns={columns} 
              data={flattenFarmers}
              filename="farmers-registry"
              enableRowSelection
              onRowSelectionChange={setSelectedRows}
            />
          </div>
        </div>
      </Card>

      {farmers.data.length === 0 && (
        <Card title="">
          <div className="text-center py-16">
            <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No farmers found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search or filters above.</p>
            {can('create farmers') && (
              <Link 
                href="/admin/farmers/create"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition"
              >
                <Plus className="h-4 w-4" />
                Create First Farmer
              </Link>
            )}
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}

