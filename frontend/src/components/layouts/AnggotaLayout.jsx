import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, CalendarRange, Clock, LogOut, Menu, Settings, X, Loader2 } from 'lucide-react';
import api from '../../utils/api';

const AnggotaLayout = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Modal Password State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdData, setPwdData] = useState({ password_lama: '', password_baru: '', konfirmasi_password: '' });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/anggota/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Jadwal Saya', path: '/anggota/jadwal', icon: <Calendar size={20} /> },
    { name: 'Izin Piket', path: '/anggota/izin', icon: <Clock size={20} /> },
    { name: 'Ganti Jadwal', path: '/anggota/ganti-jadwal', icon: <CalendarRange size={20} /> },
  ];

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdData.password_baru !== pwdData.konfirmasi_password) {
      return alert('Konfirmasi password baru tidak cocok!');
    }
    setPwdLoading(true);
    try {
      await api.put('/api/anggota/change-password', pwdData);
      alert('Password berhasil diubah!');
      setIsPasswordModalOpen(false);
      setPwdData({ password_lama: '', password_baru: '', konfirmasi_password: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah password');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-['Poppins']">
      
      {/* SIDEBAR */}
      <aside className={`${isSidebarOpen ? 'w-[280px]' : 'w-[80px]'} bg-[#004AB9] text-white flex flex-col shadow-xl fixed h-full z-20 transition-all duration-300`}>
        
        {/* TOGGLE BUTTON */}
        <div className={`flex items-center ${isSidebarOpen ? 'justify-end' : 'justify-center'} p-4`}>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
            <Menu size={24} />
          </button>
        </div>

        {/* LOGO AREA */}
        {isSidebarOpen ? (
          <div className="flex flex-col items-center justify-center pb-6 border-b border-white/20">
            <img 
              src="/6. Lambang white.png" 
              alt="Logo" 
              className="w-[180px] object-contain mb-3"
              onError={(e) => {
                e.target.style.display = 'none';
                document.getElementById('sidebar-logo-text-anggota').style.display = 'block';
              }}
            />
            <div id="sidebar-logo-text-anggota" className="hidden text-white text-center">
              <h1 className="text-xl font-bold italic">NEO TELEMETRI</h1>
            </div>
            <p className="text-white/80 text-[10px] font-light tracking-[0.1em]">SISTEM ABSENSI</p>
            <p className="text-white/60 text-[8px] uppercase tracking-widest mt-1">PENGURUS NEO TELEMETRI 2026</p>
          </div>
        ) : (
          <div className="flex justify-center pb-6 border-b border-white/20">
            <img 
              src="/6. Lambang white.png" 
              alt="Logo" 
              className="w-10 object-contain"
              title="Neo Telemetri"
            />
          </div>
        )}

        {/* NAVIGATION */}
        <nav className="flex-1 px-3 py-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={!isSidebarOpen ? item.name : ''}
              className={({ isActive }) => 
                `flex items-center ${isSidebarOpen ? 'gap-4 px-4' : 'justify-center px-0'} py-3 rounded-[10px] transition-all duration-200 ${
                  isActive 
                  ? 'bg-[#002D7A] text-white font-medium' 
                  : 'text-white/80 hover:bg-white/10 hover:text-white font-medium'
                }`
              }
            >
              <div className="flex-shrink-0">{item.icon}</div>
              {isSidebarOpen && <span className="text-[15px] whitespace-nowrap">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* BOTTOM BUTTONS */}
        <div className="p-4 pb-6 mt-auto space-y-2 border-t border-white/10 pt-4">
          <button 
            onClick={() => setIsPasswordModalOpen(true)}
            title={!isSidebarOpen ? 'Ganti Password' : ''}
            className={`flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} py-2 text-white/80 hover:text-white transition-all w-full`}
          >
            <div className="flex-shrink-0"><Settings size={20} /></div>
            {isSidebarOpen && <span className="font-medium whitespace-nowrap text-sm">Ganti Password</span>}
          </button>
          <button 
            onClick={handleLogout}
            title={!isSidebarOpen ? 'Logout' : ''}
            className={`flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} py-2 text-red-300 hover:text-red-100 transition-all w-full`}
          >
            <div className="flex-shrink-0"><LogOut size={20} /></div>
            {isSidebarOpen && <span className="font-medium whitespace-nowrap text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 ${isSidebarOpen ? 'ml-[280px]' : 'ml-[80px]'} p-10 min-h-screen relative transition-all duration-300`}>
        <Outlet />
      </main>

      {/* MODAL GANTI PASSWORD */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Ganti Password</h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
                <input 
                  type="password" required 
                  value={pwdData.password_lama}
                  onChange={e => setPwdData({...pwdData, password_lama: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AB9] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <input 
                  type="password" required minLength="6"
                  value={pwdData.password_baru}
                  onChange={e => setPwdData({...pwdData, password_baru: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AB9] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                <input 
                  type="password" required minLength="6"
                  value={pwdData.konfirmasi_password}
                  onChange={e => setPwdData({...pwdData, konfirmasi_password: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AB9] focus:outline-none"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Batal</button>
                <button type="submit" disabled={pwdLoading} className="flex items-center gap-2 px-5 py-2 text-white bg-[#004AB9] hover:bg-blue-800 rounded-lg font-medium">
                  {pwdLoading && <Loader2 size={16} className="animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AnggotaLayout;
