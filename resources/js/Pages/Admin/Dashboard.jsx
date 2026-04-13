import AdminLayout from '@/Layouts/AdminLayout';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import Card from '@/Components/ui/Card';
import { Users, MapPin, Award, TrendingUp, Activity } from 'lucide-react';

function MetricCard({ label, value, change, color = 'green', icon: Icon }) {
  const colors = { 
    green: 'from-green-400 to-emerald-500', 
    blue: 'from-blue-400 to-indigo-500', 
    orange: 'from-orange-400 to-amber-500',
    purple: 'from-purple-400 to-violet-500'
  };
  return (
    <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl bg-gradient-to-br ${colors[color]} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value ?? 0}</p>
          {change !== undefined && (
            <p className={`text-sm font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change}%
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard({ metrics, charts }) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const farmersData = (charts?.farmers_per_month ?? []).map(r => ({ month: months[r.month - 1], count: r.count }));
  const cropData = (charts?.crop_production ?? []).map(r => ({ name: r.cropping_year, yield: r.total_yield }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <AdminLayout title="🌾 Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          label="Total Farmers" 
          value={metrics?.total_farmers} 
          change={12}
          color="green"
          icon={Users}
        />
        <MetricCard 
          label="Farm Parcels" 
          value={metrics?.total_parcels} 
          change={8}
          color="blue"
          icon={MapPin}
        />
        <MetricCard 
          label="Livestock Heads" 
          value={metrics?.total_livestock} 
          change={-2}
          color="purple"
          icon={Award}
        />
        <MetricCard 
          label="Recent Aid" 
          value={metrics?.recent_distributions?.length} 
          change={25}
          color="orange"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Card title="📈 Farmers by Month (2024)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={farmersData}>
              <defs>
                <linearGradient id="farmersColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} fontSize={14} />
              <YAxis axisLine={false} tickLine={false} tickMargin={10} fontSize={14} />
              <Tooltip />
              <Bar dataKey="count" fill="url(#farmersColor)" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="🌾 Crop Yield Trends">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cropData}>
              <defs>
                <linearGradient id="cropColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} fontSize={14} />
              <YAxis axisLine={false} tickLine={false} tickMargin={10} fontSize={14} />
              <Tooltip />
              <Line type="monotone" dataKey="yield" stroke="url(#cropColor)" strokeWidth={4} dot={{ fill: '#f59e0b', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="📋 Recent Assistance Distributions">
          <div className="space-y-3">
            {(metrics?.recent_distributions ?? []).slice(0,5).map(d => (
              <div key={d.id} className="flex gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">{d.farmer?.first_name} {d.farmer?.last_name}</p>
                  <p className="text-sm text-gray-500">{d.assistance?.program_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-gray-900 dark:text-white">{d.distribution_date}</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    d.status === 'claimed' ? 'bg-green-100 text-green-800' :
                    d.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
            {(metrics?.recent_distributions ?? []).length === 0 && (
              <div className="text-center py-12">
                <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No recent distributions</p>
              </div>
            )}
          </div>
        </Card>

        <Card title="📊 Aid Distribution Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[{ name: 'Rice Subsidy', value: 40 }, { name: 'Fertilizer', value: 25 }, { name: 'Seeds', value: 20 }, { name: 'Livestock', value: 15 }]}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {COLORS.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="🔥 Quick Stats">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
              <span className="text-sm font-medium text-gray-600">Active Crop Seasons</span>
              <span className="text-2xl font-bold text-green-600">12</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
              <span className="text-sm font-medium text-gray-600">Pending Claims</span>
              <span className="text-2xl font-bold text-blue-600">8</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl">
              <span className="text-sm font-medium text-gray-600">Avg Yield/ha</span>
              <span className="text-2xl font-bold text-orange-600">4.2 tons</span>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

