import React, { useState, useEffect } from 'react';
import { Lock, Search, Users, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterGrafik, setFilterGrafik] = useState('harian');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/admin/dashboard?filter=${filterGrafik}`);
        setDashboardData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal mengambil data dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [filterGrafik]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        {error}
      </div>
    );
  }

  // Sesuaikan dengan format response dari backend production aaPanel
  const { 
    data_total = {}, 
    tabel_ringkasan = [], 
    grafik_kehadiran = [] 
  } = dashboardData?.data || dashboardData || {};

  // Parse grafik dari backend ke format recharts
  const chartData = grafik_kehadiran.map(item => ({
    name: item.label,
    hadir: item.total_hadir,
    tidakHadir: 0 // Mock for now, you can update backend to send real absences
  }));

  const recentAttendance = tabel_ringkasan.map((row, index) => {
    let statusColor = 'text-gray-500';
    if (row.status_kehadiran === 'Hadir') statusColor = 'bg-green-100 text-green-700';
    if (row.status_kehadiran === 'Tidak Hadir') statusColor = 'bg-red-100 text-red-700';
    if (row.status_kehadiran === 'Sedang Piket') statusColor = 'bg-yellow-100 text-yellow-700';

    return {
      id: index,
      nama: row.nama,
      tanggal: row.tanggal ? row.tanggal.substring(0, 10) : '-',
      mulai: row.jam_mulai ? row.jam_mulai.substring(0, 5) : '-',
      selesai: row.jam_selesai ? row.jam_selesai.substring(0, 5) : '-',
      durasi: row.durasi_menit ? `${row.durasi_menit} mnt` : '-',
      status: row.status_kehadiran,
      statusColor
    };
  });

  return (
    <div className="font-['Poppins']">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
        <div>
          <p className="text-lg font-medium text-black">Welcome to Absensi Neo Telemetri, Admin</p>
          <h1 className="text-3xl md:text-4xl font-bold text-black mt-2">Dashboard</h1>
        </div>
        <button className="flex items-center justify-center gap-2 bg-[#d69f36] hover:bg-[#c28e2e] text-white px-6 py-3 rounded-lg font-medium shadow-sm transition-colors w-full md:w-auto">
          <Lock size={20} />
          <span>Tutup Periode Jadwal</span>
        </button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        
        {/* Card 1: Hadir Hari Ini */}
        <div className="bg-[#aed8a9] rounded-[15px] p-6 shadow-sm border border-[#9bc896]">
          <h3 className="text-white font-medium text-lg mb-6 drop-shadow-sm">Hadir Hari Ini</h3>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#8bc485] flex items-center justify-center opacity-80">
                <Users className="text-[#3b7336]" size={24} />
              </div>
              <span className="text-5xl font-bold text-white drop-shadow-sm">{data_total.hadir_hari_ini || 0}</span>
            </div>
            <span className="text-white mb-1 drop-shadow-sm">orang</span>
          </div>
        </div>

        {/* Card 2: Sedang Piket */}
        <div className="bg-[#e4cd86] rounded-[15px] p-6 shadow-sm border border-[#d3be78]">
          <h3 className="text-white font-medium text-lg mb-6 drop-shadow-sm">Sedang Piket</h3>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#d6bc68] flex items-center justify-center opacity-80" />
              <span className="text-5xl font-bold text-white drop-shadow-sm">{data_total.sedang_piket || 0}</span>
            </div>
            <span className="text-white mb-1 drop-shadow-sm">orang</span>
          </div>
        </div>

        {/* Card 3: Tidak Piket Hari Ini */}
        <div className="bg-[#ff6464] rounded-[15px] p-6 shadow-sm border border-[#eb5555]">
          <h3 className="text-white font-medium text-lg mb-6 drop-shadow-sm">Tidak Piket Hari Ini</h3>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#e85353] flex items-center justify-center opacity-80">
                <Users className="text-[#8c2222]" size={24} />
              </div>
              <span className="text-5xl font-bold text-white drop-shadow-sm">{data_total.belum_atau_tidak_hadir || 0}</span>
            </div>
            <span className="text-white mb-1 drop-shadow-sm">orang</span>
          </div>
        </div>
      </div>

      {/* CHART SECTION */}
      <div className="bg-white rounded-[15px] p-4 md:p-8 shadow-sm border border-gray-100 mb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-black">Grafik Kehadiran (Senin - Jumat)</h2>
          <div className="flex flex-wrap gap-4 md:gap-6 text-sm">
            <button 
              onClick={() => setFilterGrafik('harian')}
              className={filterGrafik === 'harian' ? "text-black font-medium border-b-2 border-black pb-1" : "text-gray-400 font-medium pb-1"}
            >Hari Ini</button>
            <button 
              onClick={() => setFilterGrafik('mingguan')}
              className={filterGrafik === 'mingguan' ? "text-black font-medium border-b-2 border-black pb-1" : "text-gray-400 font-medium pb-1"}
            >Mingguan</button>
            <button 
              onClick={() => setFilterGrafik('bulanan')}
              className={filterGrafik === 'bulanan' ? "text-black font-medium border-b-2 border-black pb-1" : "text-gray-400 font-medium pb-1"}
            >Bulan</button>
          </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={true} tickLine={false} tick={{fill: '#000', fontSize: 14}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#000', fontSize: 14}} dx={-10} domain={[0, 40]} ticks={[0, 10, 20, 30, 40]} />
              <Tooltip />
              <Line type="monotone" dataKey="hadir" name="Hadir" stroke="#3B82F6" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="tidakHadir" name="Tidak Hadir" stroke="#EF4444" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-8 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-[#3B82F6]"></div>
            <span className="text-sm font-medium">Hadir</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-[#EF4444]"></div>
            <span className="text-sm font-medium">Tidak Hadir</span>
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-[15px] p-4 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-black">Ringkasan Absensi Terbaru</h2>
          <div className="relative w-full md:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-[10px] text-sm focus:outline-none focus:border-blue-500 w-full md:w-[250px]"
              placeholder="Cari Nama / Tanggal / Status"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="bg-[#d28b24] text-white">
                <th className="py-3 px-4 font-medium rounded-l-md">Nama</th>
                <th className="py-3 px-4 font-medium">Tanggal</th>
                <th className="py-3 px-4 font-medium">Mulai</th>
                <th className="py-3 px-4 font-medium">Selesai</th>
                <th className="py-3 px-4 font-medium">Durasi</th>
                <th className="py-3 px-4 font-medium rounded-r-md">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAttendance.map((row, index) => (
                <tr key={row.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-4 px-4 font-medium text-black">{row.nama}</td>
                  <td className="py-4 px-4 text-gray-500">{row.tanggal}</td>
                  <td className="py-4 px-4 text-gray-500">{row.mulai}</td>
                  <td className="py-4 px-4 text-gray-500">{row.selesai}</td>
                  <td className="py-4 px-4 text-gray-500">{row.durasi}</td>
                  <td className="py-4 px-4">
                    {row.status !== 'Status' ? (
                      <span className={`px-3 py-1 rounded-md text-sm font-medium ${row.statusColor}`}>
                        {row.status}
                      </span>
                    ) : (
                      <span className={row.statusColor}>{row.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
          <p className="text-xs md:text-sm text-gray-500 text-center">Menampilkan 1 sampai 5 dari 10 Data</p>
          <div className="flex border border-gray-300 rounded-md overflow-hidden text-xs md:text-sm">
            <button className="px-2 md:px-3 py-1 bg-white hover:bg-gray-50 text-gray-500 border-r border-gray-300 flex items-center">&lt; <span className="hidden md:inline ml-1">Sebelumnya</span></button>
            <button className="px-2 md:px-3 py-1 bg-white hover:bg-gray-50 text-black border-r border-gray-300">1</button>
            <button className="px-2 md:px-3 py-1 bg-white hover:bg-gray-50 text-black border-r border-gray-300">2</button>
            <button className="px-2 md:px-3 py-1 bg-white hover:bg-gray-50 text-black flex items-center"><span className="hidden md:inline mr-1">Selanjutnya</span> &gt;</button>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default AdminDashboard;
