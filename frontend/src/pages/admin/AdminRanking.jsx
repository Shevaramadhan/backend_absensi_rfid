import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../utils/api';

const AdminRanking = () => {
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const bulanSekarang = new Date().toLocaleString('id-ID', { month: 'long' });

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/admin/ranking');
        const data = response.data?.data || response.data || [];
        setRankingData(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal mengambil data ranking');
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;
  }

  const top3 = rankingData.slice(0, 3);
  const rank1 = top3[0]?.nama || 'Belum Ada';
  const rank2 = top3[1]?.nama || 'Belum Ada';
  const rank3 = top3[2]?.nama || 'Belum Ada';

  return (
    <div className="font-['Poppins']">
      
      {/* HEADER */}
      <div className="mb-8 md:mb-12 text-center md:text-left">
        <p className="text-sm md:text-lg font-medium text-black">Welcome to Absensi Neo Telemetri, Admin</p>
        <h1 className="text-2xl md:text-4xl font-bold text-black mt-2">Ranking Di Bulan {bulanSekarang}</h1>
        <p className="text-xs md:text-sm text-gray-400 mt-1">Peringkat Anggota Berdasarkan Durasi Piket</p>
      </div>

      {/* PODIUM VISUAL (Scrollable di HP) */}
      <div className="w-full overflow-x-auto pb-4">
        <div className="flex justify-center items-end h-[220px] mb-0 relative z-0 min-w-[700px]">
        {/* Step Kiri 1 */}
        <div className="w-12 h-4 bg-[#3B82F6]"></div>
        {/* Step Kiri 2 */}
        <div className="w-12 h-8 bg-[#3B82F6]"></div>
        
        {/* Podium Rank 2 (Kiri) */}
        <div className="w-56 h-32 bg-[#3B82F6] flex justify-center pt-6">
          <span className="text-white font-bold text-lg text-center px-4 line-clamp-2">{rank2}</span>
        </div>
        
        {/* Podium Rank 1 (Tengah) */}
        <div className="w-64 h-48 bg-[#3B82F6] flex justify-center pt-6">
          <span className="text-white font-bold text-lg text-center px-4 line-clamp-2">{rank1}</span>
        </div>
        
        {/* Podium Rank 3 (Kanan) */}
        <div className="w-56 h-32 bg-[#3B82F6] flex justify-center pt-6">
          <span className="text-white font-bold text-lg text-center px-4 line-clamp-2">{rank3}</span>
        </div>
        
        {/* Step Kanan 1 */}
        <div className="w-12 h-8 bg-[#3B82F6]"></div>
        {/* Step Kanan 2 */}
        <div className="w-12 h-4 bg-[#3B82F6]"></div>
        </div>
      </div>

      {/* TABEL RANKING */}
      <div className="bg-white rounded-3xl p-4 md:p-8 shadow-md border border-gray-100 relative z-10 md:-mt-1">
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="bg-[#d69f36] text-white">
                <th className="py-4 px-4 font-medium">Rank</th>
                <th className="py-4 px-4 font-medium">Nama</th>
                <th className="py-4 px-4 font-medium">SN</th>
                <th className="py-4 px-4 font-medium">ID RFID</th>
                <th className="py-4 px-4 font-medium">Total Piket</th>
              </tr>
            </thead>
            <tbody>
              {rankingData.length === 0 ? (
                <tr><td colSpan="5" className="py-8 text-gray-400">Belum ada data ranking</td></tr>
              ) : (
                rankingData.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 last:border-0">
                    <td className="py-5 px-4 font-bold text-black">{index + 1}</td>
                    <td className="py-5 px-4 font-bold text-black">{row.nama}</td>
                    <td className="py-5 px-4 text-gray-400">{row.sn || 'SN'}</td>
                    <td className="py-5 px-4 text-gray-400">{row.id_rfid || 'ID RFID'}</td>
                    <td className="py-5 px-4 text-gray-400">{row.total_piket || row.total_durasi || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRanking;
