import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Camera, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../utils/api';

const AnggotaDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [jadwalGrid, setJadwalGrid] = useState({});
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState('');
  const [filterGrafik, setFilterGrafik] = useState('harian');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const fileInputRef = useRef(null);

  const hariList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [dashRes, jadwalRes, shiftsRes] = await Promise.all([
        api.get('/api/anggota/dashboard'),
        api.get('/api/anggota/jadwal'),
        api.get('/api/shifts')
      ]);
      
      setData(dashRes.data.data);
      
      const rawJadwal = jadwalRes.data?.raw_data || [];
      const rawShifts = shiftsRes.data?.data || shiftsRes.data || [];
      setShifts(rawShifts);

      const grid = {};
      hariList.forEach(hari => {
        grid[hari] = {};
        rawShifts.forEach(shift => {
          grid[hari][shift.id] = [];
        });
      });
      
      rawJadwal.forEach(j => {
        const hari = j.hari_piket || j.hari;
        const shiftId = j.shift_id;
        if (grid[hari] && grid[hari][shiftId]) {
          grid[hari][shiftId].push({ ...j });
        }
      });
      setJadwalGrid(grid);

    } catch (err) {
      setError('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBukti = async (id, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('bukti_foto', file);

    try {
      await api.post(`/api/anggota/attendance/${id}/bukti`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Foto bukti kehadiran berhasil diunggah!');
      fetchDashboard(); // Refresh data
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengunggah foto bukti.');
    }
  };

  const handleKameraClick = () => {
    // Cari rekam kehadiran hari ini
    const today = new Date().toDateString();
    const todayRecord = data.riwayat_kehadiran.find(row => new Date(row.tanggal).toDateString() === today);

    if (!todayRecord) {
      return alert('Anda belum tap RFID hari ini. Silakan tap kartu di mesin terlebih dahulu!');
    }
    
    if (todayRecord.status !== 'Hadir' && todayRecord.status !== 'Sedang Piket') {
      return alert('Status Anda hari ini bukan "Hadir" atau "Sedang Piket". Bukti foto tidak diperlukan.');
    }

    // Jika aman, buka kamera/file picker
    fileInputRef.current.click();
  };

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>;
  if (error) return <div className="text-red-500 text-center">{error}</div>;
  if (!data) return null;

  // Chart Data preparation
  const chartData = (data.grafik_kehadiran || []).map(item => ({
    name: item.label,
    hadir: item.total_hadir,
    tidakHadir: item.total_tidak_hadir
  }));

  const totalHadir = chartData.reduce((acc, cur) => acc + cur.hadir, 0);
  const totalTidakHadir = chartData.reduce((acc, cur) => acc + cur.tidakHadir, 0);
  const pieData = [
    { name: 'Hadir', value: totalHadir },
    { name: 'Tidak Hadir', value: totalTidakHadir }
  ];
  const COLORS = ['#8bc485', '#e85353']; // Green and Red

  return (
    <div className="font-['Poppins'] space-y-8">
      
      {/* HEADER */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-800">Hello, {user.nama}!</h1>
          <h2 className="text-4xl font-bold text-black mt-2">Dashboard</h2>
          <p className="text-gray-400 mt-1">Table Rekap Kehadiran Piket</p>
        </div>
        <button 
          onClick={handleKameraClick}
          className="flex items-center gap-2 bg-[#d69f36] hover:bg-[#c28e2e] text-white px-6 py-3 rounded-lg font-medium shadow-sm transition-colors"
        >
          <Camera size={20} />
          <span>Aktifkan Kamera</span>
        </button>
        {/* Hidden File Input for Camera/File Upload */}
        <input 
          type="file" 
          accept="image/*" 
          capture="user"
          ref={fileInputRef} 
          className="hidden" 
          onChange={(e) => {
            const today = new Date().toDateString();
            const todayRecord = data.riwayat_kehadiran.find(row => new Date(row.tanggal).toDateString() === today);
            if (todayRecord && e.target.files[0]) {
              handleUploadBukti(todayRecord.id, e.target.files[0]);
            }
            // Reset input agar bisa jepret ulang jika butuh
            e.target.value = null;
          }}
        />
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#aed8a9] rounded-[15px] p-6 shadow-sm border border-[#9bc896]">
          <h3 className="text-white font-medium text-lg mb-6 drop-shadow-sm">Hadir Hari Ini</h3>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#8bc485] flex items-center justify-center opacity-80" />
              <span className="text-5xl font-bold text-white drop-shadow-sm">{data.statistik_hari_ini.hadir_hari_ini}</span>
            </div>
            <span className="text-white mb-1 drop-shadow-sm">orang</span>
          </div>
        </div>
        <div className="bg-[#e4cd86] rounded-[15px] p-6 shadow-sm border border-[#d3be78]">
          <h3 className="text-white font-medium text-lg mb-6 drop-shadow-sm">Sedang Piket</h3>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#d6bc68] flex items-center justify-center opacity-80" />
              <span className="text-5xl font-bold text-white drop-shadow-sm">{data.statistik_hari_ini.sedang_piket}</span>
            </div>
            <span className="text-white mb-1 drop-shadow-sm">orang</span>
          </div>
        </div>
        <div className="bg-[#ff6464] rounded-[15px] p-6 shadow-sm border border-[#eb5555]">
          <h3 className="text-white font-medium text-lg mb-6 drop-shadow-sm">Tidak Piket Hari Ini</h3>
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#e85353] flex items-center justify-center opacity-80" />
              <span className="text-5xl font-bold text-white drop-shadow-sm">{data.statistik_hari_ini.tidak_hadir_hari_ini}</span>
            </div>
            <span className="text-white mb-1 drop-shadow-sm">orang</span>
          </div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="flex gap-6">
        <div className="flex-[2] bg-white rounded-[15px] p-8 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-black">Grafik Kehadiran (Senin - Jumat)</h2>
            <div className="flex gap-4 text-sm">
              <button onClick={() => setFilterGrafik('harian')} className={filterGrafik === 'harian' ? "text-black font-bold border-b-2 border-black pb-1" : "text-gray-400 font-medium pb-1"}>Hari Ini</button>
              <button onClick={() => setFilterGrafik('mingguan')} className={filterGrafik === 'mingguan' ? "text-black font-bold border-b-2 border-black pb-1" : "text-gray-400 font-medium pb-1"}>Mingguan</button>
              <button onClick={() => setFilterGrafik('bulanan')} className={filterGrafik === 'bulanan' ? "text-black font-bold border-b-2 border-black pb-1" : "text-gray-400 font-medium pb-1"}>Bulan</button>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} tickLine={false} axisLine={true} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="hadir" name="Hadir" stroke="#3B82F6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="tidakHadir" name="Tidak Hadir" stroke="#EF4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2"><div className="w-4 h-1 bg-[#3B82F6]"></div><span className="text-xs font-medium">Hadir</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-1 bg-[#EF4444]"></div><span className="text-xs font-medium">Tidak Hadir</span></div>
          </div>
        </div>
        
        <div className="flex-1 bg-white rounded-[15px] p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center relative">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={0} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute right-8 top-8 flex flex-col gap-3">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#8bc485]"></div><span className="text-xs">Hadir</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#e85353]"></div><span className="text-xs">Tidak Hadir</span></div>
          </div>
        </div>
      </div>

      {/* MATRIX JADWAL */}
      <div className="bg-white rounded-[15px] p-8 shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-black mb-6">Jadwal Piket</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="bg-[#d28b24] text-white">
                <th className="py-3 px-4 font-medium rounded-l-md">Hari</th>
                {shifts.map(s => (
                  <th key={s.id} className="py-3 px-4 font-medium last:rounded-r-md">
                    {s.nama_shift}: ({s.jam_mulai?.substring(0,5)} - {s.jam_selesai?.substring(0,5)})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hariList.map(hari => (
                <tr key={hari} className="border-b border-gray-100 last:border-0">
                  <td className="py-4 px-4 font-bold text-black">{hari}</td>
                  {shifts.map(shift => {
                    const entries = jadwalGrid[hari]?.[shift.id] || [];
                    return (
                      <td key={shift.id} className="py-3 px-2 border-l border-gray-50 align-top">
                        {entries.length === 0 ? (
                          <span className="text-gray-300">-</span>
                        ) : (
                          <div className="space-y-1 mt-2">
                            {entries.map((entry, i) => (
                              <div key={i} className={`text-sm py-1 ${entry.user_id === user.id ? 'font-bold text-blue-600 underline' : 'text-black'}`}>
                                {entry.nama || entry.user_nama}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIWAYAT / REKAP TABLE */}
      <div className="bg-white rounded-[15px] p-8 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-black">Table Rekap Kehadiran Piket Anda</h2>
          <button 
            onClick={() => window.open('/api/anggota/laporan/export?format=pdf', '_blank')}
            className="flex items-center gap-2 bg-[#d69f36] hover:bg-[#c28e2e] text-white px-4 py-2 rounded-md font-medium transition-colors text-sm"
          >
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="bg-[#d28b24] text-white">
                <th className="py-3 px-4 font-medium rounded-l-md">No.</th>
                <th className="py-3 px-4 font-medium">Hari</th>
                <th className="py-3 px-4 font-medium">Tanggal</th>
                <th className="py-3 px-4 font-medium">Mulai</th>
                <th className="py-3 px-4 font-medium">Selesai</th>
                <th className="py-3 px-4 font-medium">Durasi</th>
                <th className="py-3 px-4 font-medium rounded-r-md">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.riwayat_kehadiran.length === 0 ? (
                <tr><td colSpan="7" className="py-8 text-center text-gray-400">Belum ada riwayat</td></tr>
              ) : (
                data.riwayat_kehadiran.map((row, i) => {
                  const dateObj = new Date(row.tanggal);
                  const hariLabel = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dateObj.getDay()];
                  let bgStatus = 'bg-gray-100 text-gray-700';
                  if (row.status === 'Hadir' || row.status === 'Piket') bgStatus = 'bg-[#8bc485] text-white';
                  else if (row.status === 'Tidak Hadir' || row.status === 'Tidak Piket') bgStatus = 'bg-[#e85353] text-white';
                  else if (row.status === 'Sedang Piket') bgStatus = 'bg-[#d6bc68] text-white';
                  else if (row.status === 'Izin') bgStatus = 'bg-blue-400 text-white';

                  return (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-4 px-4 font-bold text-black">{i + 1}</td>
                      <td className="py-4 px-4 font-bold text-black">{hariLabel}</td>
                      <td className="py-4 px-4 text-gray-500">{dateObj.toLocaleDateString('id-ID')}</td>
                      <td className="py-4 px-4 text-gray-500">{row.jam_mulai ? row.jam_mulai.substring(0,5) : '-'}</td>
                      <td className="py-4 px-4 text-gray-500">{row.jam_selesai ? row.jam_selesai.substring(0,5) : '-'}</td>
                      <td className="py-4 px-4 text-gray-500">{row.durasi_menit ? `${row.durasi_menit} mnt` : '-'}</td>
                      <td className="py-4 px-4">
                        <span className={`px-4 py-1 rounded-md text-xs font-medium ${bgStatus}`}>
                          {row.status === 'Hadir' ? 'Piket' : row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AnggotaDashboard;
