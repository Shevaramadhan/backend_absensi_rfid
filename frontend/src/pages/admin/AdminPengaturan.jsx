import React, { useState, useEffect } from 'react';
import { Settings, Lock, Calendar, Power, Loader2, Plus, Trash2 } from 'lucide-react';
import api from '../../utils/api';

const AdminPengaturan = () => {
  // Maintenance State
  const [maintenance, setMaintenance] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);

  // Change Password State
  const [passwordForm, setPasswordForm] = useState({
    password_lama: '',
    password_baru: '',
    konfirmasi_password: ''
  });
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [pwdMessage, setPwdMessage] = useState({ type: '', text: '' });

  // Holidays State
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ tanggal: '', keterangan: '' });

  useEffect(() => {
    fetchSystemStatus();
    fetchHolidays();
  }, []);

  // --- MAINTENANCE API ---
  const fetchSystemStatus = async () => {
    try {
      const response = await api.get('/api/admin/system/status');
      setMaintenance(response.data?.maintenance_mode || false);
    } catch (err) {
      console.error('Gagal memuat status sistem', err);
    }
  };

  const handleToggleMaintenance = async () => {
    try {
      setLoadingMaintenance(true);
      const newState = !maintenance;
      await api.put('/api/admin/system/maintenance', { aktif: newState });
      setMaintenance(newState);
      alert(newState ? 'Sistem sekarang dalam mode Maintenance!' : 'Sistem kembali normal.');
    } catch (err) {
      alert('Gagal mengubah status maintenance');
    } finally {
      setLoadingMaintenance(false);
    }
  };

  // --- PASSWORD API ---
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.password_baru !== passwordForm.konfirmasi_password) {
      setPwdMessage({ type: 'error', text: 'Konfirmasi password tidak cocok!' });
      return;
    }

    try {
      setLoadingPassword(true);
      setPwdMessage({ type: '', text: '' });
      await api.put('/api/admin/change-password', passwordForm);
      setPwdMessage({ type: 'success', text: 'Password berhasil diubah!' });
      setPasswordForm({ password_lama: '', password_baru: '', konfirmasi_password: '' });
    } catch (err) {
      setPwdMessage({ type: 'error', text: err.response?.data?.message || 'Gagal mengubah password' });
    } finally {
      setLoadingPassword(false);
    }
  };

  // --- HOLIDAYS API ---
  const fetchHolidays = async () => {
    try {
      setLoadingHolidays(true);
      const response = await api.get('/api/admin/holidays');
      setHolidays(response.data?.data || []);
    } catch (err) {
      console.error('Gagal memuat data hari libur', err);
    } finally {
      setLoadingHolidays(false);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.tanggal || !newHoliday.keterangan) return;

    try {
      await api.post('/api/admin/holidays', newHoliday);
      setNewHoliday({ tanggal: '', keterangan: '' });
      fetchHolidays();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menambah hari libur');
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Yakin ingin menghapus hari libur ini?')) return;
    try {
      await api.delete(`/api/admin/holidays/${id}`);
      fetchHolidays();
    } catch (err) {
      alert('Gagal menghapus hari libur');
    }
  };

  return (
    <div className="font-['Poppins']">
      {/* HEADER */}
      <div className="mb-8 md:mb-10 text-center md:text-left">
        <h1 className="text-2xl md:text-4xl font-bold text-black flex items-center justify-center md:justify-start gap-3">
          <Settings className="text-[#004AB9]" size={32} />
          Pengaturan Sistem
        </h1>
        <p className="text-sm text-gray-500 mt-2">Kelola hari libur, maintenance, dan keamanan akun</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* KOLOM KIRI */}
        <div className="space-y-8">
          
          {/* CARD MAINTENANCE MODE */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-xl ${maintenance ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                <Power size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Maintenance Mode</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Matikan akses absensi sementara waktu. Jika aktif, anggota tidak bisa melakukan scan absen atau login.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
              <span className={`font-medium ${maintenance ? 'text-red-600' : 'text-green-600'}`}>
                Status: {maintenance ? 'Sistem Mati (Maintenance)' : 'Sistem Aktif Normal'}
              </span>
              <button 
                onClick={handleToggleMaintenance}
                disabled={loadingMaintenance}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${maintenance ? 'bg-red-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${maintenance ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* CARD GANTI PASSWORD */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Lock size={20} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Ganti Password Admin</h2>
            </div>
            
            {pwdMessage.text && (
              <div className={`p-3 rounded-lg text-sm mb-4 ${pwdMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {pwdMessage.text}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Password Lama</label>
                <input 
                  type="password" 
                  required
                  value={passwordForm.password_lama}
                  onChange={(e) => setPasswordForm({...passwordForm, password_lama: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Password Baru</label>
                <input 
                  type="password" 
                  required
                  value={passwordForm.password_baru}
                  onChange={(e) => setPasswordForm({...passwordForm, password_baru: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Konfirmasi Password Baru</label>
                <input 
                  type="password" 
                  required
                  value={passwordForm.konfirmasi_password}
                  onChange={(e) => setPasswordForm({...passwordForm, konfirmasi_password: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <button 
                type="submit" 
                disabled={loadingPassword}
                className="w-full bg-[#004AB9] hover:bg-[#003a94] text-white py-2 rounded-lg font-medium transition-colors"
              >
                {loadingPassword ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </form>
          </div>

        </div>

        {/* KOLOM KANAN: HARI LIBUR */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <Calendar size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Manajemen Hari Libur</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Tambahkan tanggal merah atau hari libur agar anggota yang tidak hadir pada hari tersebut tidak dihitung Alpa/Tidak Hadir.
          </p>

          {/* Form Tambah Libur */}
          <form onSubmit={handleAddHoliday} className="flex gap-2 mb-6">
            <input 
              type="date" 
              required
              value={newHoliday.tanggal}
              onChange={(e) => setNewHoliday({...newHoliday, tanggal: e.target.value})}
              className="flex-shrink-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            />
            <input 
              type="text" 
              required
              placeholder="Keterangan (Cth: Idul Fitri)"
              value={newHoliday.keterangan}
              onChange={(e) => setNewHoliday({...newHoliday, keterangan: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            />
            <button 
              type="submit" 
              className="bg-[#d69f36] hover:bg-[#c28e2e] text-white p-2 rounded-lg transition-colors flex-shrink-0"
            >
              <Plus size={20} />
            </button>
          </form>

          {/* Tabel Libur */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600 w-[120px]">Tanggal</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Keterangan</th>
                  <th className="px-4 py-3 font-medium text-gray-600 w-[80px] text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingHolidays ? (
                  <tr>
                    <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400 mb-2" />
                      Memuat data...
                    </td>
                  </tr>
                ) : holidays.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                      Belum ada hari libur yang ditambahkan.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {new Date(h.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {h.keterangan}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AdminPengaturan;
