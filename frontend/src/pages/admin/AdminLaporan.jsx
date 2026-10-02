import React, { useState, useEffect } from 'react';
import { Search, Download, Loader2, Eye } from 'lucide-react';
import api from '../../utils/api';

const AdminLaporan = () => {
  const [laporanData, setLaporanData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dariTanggal, setDariTanggal] = useState('');
  const [sampaiTanggal, setSampaiTanggal] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    // Set default ke awal bulan sampai hari ini
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const formatToYMD = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const strFirst = formatToYMD(firstDay);
    const strToday = formatToYMD(today);

    setDariTanggal(strFirst);
    setSampaiTanggal(strToday);
    
    // Auto load data bulan ini
    loadData(strFirst, strToday);
  }, []);

  const loadData = async (dari, sampai) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/admin/laporan?dari_tanggal=${dari}&sampai_tanggal=${sampai}`);
      setLaporanData(response.data?.data || response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengambil data laporan');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!dariTanggal || !sampaiTanggal) {
      setError('Silakan pilih rentang tanggal terlebih dahulu.');
      return;
    }
    loadData(dariTanggal, sampaiTanggal);
  };

  const handleExport = async (format) => {
    try {
      const response = await api.get(
        `/api/admin/laporan/export?dari_tanggal=${dariTanggal}&sampai_tanggal=${sampaiTanggal}&format=${format}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `laporan_absensi.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShowExportMenu(false);
    } catch (err) {
      alert('Gagal mengekspor laporan');
    }
  };

  const handleSyncSheets = async () => {
    try {
      if (!dariTanggal) {
        alert("Pilih tanggal terlebih dahulu!");
        return;
      }
      const month = new Date(dariTanggal).getMonth() + 1;
      const year = new Date(dariTanggal).getFullYear();
      
      alert('Memulai proses sinkronisasi ke Google Sheets... Mohon tunggu...');
      const response = await api.post(`/api/admin/sheets/sync?bulan=${month}&tahun=${year}`);
      alert(response.data?.message || 'Berhasil sinkronisasi ke Google Sheets!');
      setShowExportMenu(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal sinkronisasi ke Google Sheets');
    }
  };

  const stats = laporanData?.data_total || {};
  const records = laporanData?.tabel_rekapan || [];

  return (
    <div className="font-['Poppins']">
      
      {/* HEADER */}
      <div className="mb-6">
        <p className="text-lg font-medium text-black">Welcome to Absensi Neo Telemetri, Admin</p>
        <h1 className="text-4xl font-bold text-black mt-2">Laporan Absensi RFID NEO TELEMETRI</h1>
      </div>

      {/* FILTER + EXPORT */}
      <div className="flex justify-between items-end mb-6">
        <div className="flex items-end gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Dari Tanggal</label>
            <input type="date" value={dariTanggal} onChange={(e) => setDariTanggal(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-[10px] text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Sampai</label>
            <input type="date" value={sampaiTanggal} onChange={(e) => setSampaiTanggal(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-[10px] text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <button onClick={handlePreview} disabled={loading}
            className="px-6 py-2 bg-[#004AB9] hover:bg-[#003a94] text-white rounded-[10px] text-sm font-medium disabled:opacity-50">
            {loading ? 'Memuat...' : 'Preview'}
          </button>
        </div>

        <div className="relative">
          <button onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 bg-[#d69f36] hover:bg-[#c28e2e] text-white px-5 py-2 rounded-[10px] font-medium text-sm">
            <Download size={16} /> Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
              <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 text-gray-700">Export Excel</button>
              <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 text-gray-700 border-b border-gray-100">Export PDF</button>
              <button onClick={handleSyncSheets} className="w-full text-left px-4 py-3 text-sm text-[#004AB9] font-medium hover:bg-blue-50 bg-blue-50/30">
                ☁️ Sync Google Sheets
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}

      {/* STAT CARDS */}
      {laporanData && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-[#D1E6D3] rounded-[15px] p-5 shadow-sm">
            <h3 className="text-gray-700 font-medium text-sm mb-2">Total Records</h3>
            <span className="text-4xl font-bold text-gray-800">{stats.total_records || records.length || 0}</span>
            <span className="text-gray-500 text-xs block mt-1">All Time</span>
          </div>
          <div className="bg-[#B2DFB6] rounded-[15px] p-5 shadow-sm">
            <h3 className="text-gray-700 font-medium text-sm mb-2">Total Hadir</h3>
            <span className="text-4xl font-bold text-gray-800">{stats.total_hadir || 0}</span>
            <span className="text-gray-600 text-xs block mt-1">Persen</span>
          </div>
          <div className="bg-[#FFB347] rounded-[15px] p-5 shadow-sm">
            <h3 className="text-white font-medium text-sm mb-2">Total Izin</h3>
            <span className="text-4xl font-bold text-white">{stats.total_izin || 0}</span>
            <span className="text-white/80 text-xs block mt-1">Persen</span>
          </div>
          <div className="bg-[#FF6B6B] rounded-[15px] p-5 shadow-sm">
            <h3 className="text-white font-medium text-sm mb-2">Total Tidak Hadir</h3>
            <span className="text-4xl font-bold text-white">{stats.total_tidak_hadir || 0}</span>
            <span className="text-white/80 text-xs block mt-1">Persen</span>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-[15px] p-8 shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-black mb-6">Data Laporan Absensi</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="bg-[#d28b24] text-white">
                <th className="py-3 px-4 font-medium rounded-l-md">No</th>
                <th className="py-3 px-4 font-medium">Nama</th>
                <th className="py-3 px-4 font-medium">Hari / Tanggal</th>
                <th className="py-3 px-4 font-medium">Jam Datang</th>
                <th className="py-3 px-4 font-medium">Jam Pulang</th>
                <th className="py-3 px-4 font-medium">Durasi</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium rounded-r-md">Bukti</th>
              </tr>
            </thead>
            <tbody>
              {!laporanData ? (
                <tr><td colSpan="8" className="py-8 text-gray-400">Pilih rentang tanggal dan klik Preview untuk melihat data</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan="8" className="py-8 text-gray-400">Tidak ada data pada rentang tanggal ini</td></tr>
              ) : (
                records.map((row, index) => {
                  let statusColor = 'text-gray-500';
                  if (row.status === 'Selesai' || row.status === 'Hadir') statusColor = 'bg-green-100 text-green-700';
                  if (row.status === 'Tidak Hadir') statusColor = 'bg-red-100 text-red-700';
                  if (row.status === 'Izin') statusColor = 'bg-yellow-100 text-yellow-700';

                  const tanggalFormatted = row.tanggal ? new Date(row.tanggal).toLocaleDateString('id-ID', {
                    weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit'
                  }) : '-';

                  const formatTime = (timeStr) => {
                    if (!timeStr) return '-';
                    if (timeStr.includes('T')) {
                      return new Date(timeStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                    return timeStr.substring(0, 5);
                  };

                  return (
                    <tr key={index} className="border-b border-gray-100 last:border-0">
                      <td className="py-4 px-4 text-black">{index + 1}</td>
                      <td className="py-4 px-4 font-medium text-black">{row.nama}</td>
                      <td className="py-4 px-4 text-gray-500">{tanggalFormatted}</td>
                      <td className="py-4 px-4 text-gray-500">{formatTime(row.waktu_masuk || row.jam_datang)}</td>
                      <td className="py-4 px-4 text-gray-500">{formatTime(row.waktu_keluar || row.jam_pulang)}</td>
                      <td className="py-4 px-4 text-gray-500">{row.durasi_menit ? `${row.durasi_menit} mnt` : row.durasi || '-'}</td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-md text-xs font-medium ${statusColor}`}>{row.status || '-'}</span>
                      </td>
                      <td className="py-4 px-4 text-sm">
                        {row.bukti ? (
                          <a href={`${import.meta.env.VITE_API_URL || ''}/uploads/bukti/${row.bukti}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-medium">
                            Lihat File
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminLaporan;
