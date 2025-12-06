import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, DollarSign, Activity, Package } from 'lucide-react';

const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

export default function AnalyticsDashboard({ escrows = [] }) {
  const [stats, setStats] = useState({
    totalVolume: 0,
    totalEscrows: 0,
    activeEscrows: 0,
    completedEscrows: 0
  });

  const [platformData, setPlatformData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);

  useEffect(() => {
    if (!escrows.length) return;

    // Calculate basic stats
    const totalVolume = escrows.reduce((sum, e) => sum + (e.amount || 0), 0);
    const active = escrows.filter(e => ['held', 'approved'].includes(e.status)).length;
    const completed = escrows.filter(e => e.status === 'released').length;

    setStats({
      totalVolume,
      totalEscrows: escrows.length,
      activeEscrows: active,
      completedEscrows: completed
    });

    // Platform breakdown
    const platformMap = {};
    escrows.forEach(e => {
      const platform = e.platform || 'Unknown';
      if (!platformMap[platform]) {
        platformMap[platform] = { name: platform, count: 0, volume: 0 };
      }
      platformMap[platform].count++;
      platformMap[platform].volume += e.amount || 0;
    });
    setPlatformData(Object.values(platformMap));

    // Status distribution
    const statusMap = {};
    escrows.forEach(e => {
      const status = e.status || 'unknown';
      statusMap[status] = (statusMap[status] || 0) + 1;
    });
    setStatusData(
      Object.entries(statusMap).map(([name, value]) => ({ name, value }))
    );

    // Timeline (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayEscrows = escrows.filter(e => {
        const escrowDate = new Date(e.createdAt).toISOString().split('T')[0];
        return escrowDate === dateStr;
      });

      last7Days.push({
        date: dateStr,
        count: dayEscrows.length,
        volume: dayEscrows.reduce((sum, e) => sum + (e.amount || 0), 0)
      });
    }
    setTimelineData(last7Days);
  }, [escrows]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Volume</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                ${stats.totalVolume.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Escrows</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.totalEscrows}
              </p>
            </div>
            <Package className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Active</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.activeEscrows}
              </p>
            </div>
            <Activity className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Completed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.completedEscrows}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Breakdown */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Platform Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={platformData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {platformData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
            Last 7 Days Activity
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="count" stroke="#8b5cf6" name="Count" />
              <Line yAxisId="right" type="monotone" dataKey="volume" stroke="#10b981" name="Volume ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
