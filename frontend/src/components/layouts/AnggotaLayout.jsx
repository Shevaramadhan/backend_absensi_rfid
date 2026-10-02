import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, CalendarRange, Clock, LogOut, Menu } from 'lucide-react';
import api from '../../utils/api';

const AnggotaLayout = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/anggota/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Jadwal Saya', path: '/anggota/jadwal', icon: <Calendar size={20} /> },
    { name: 'Pengajuan', path: '/anggota/izin', icon: <Clock size={20} /> },
  ];

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

        {/* LOGOUT BUTTON */}
        <div className="p-4 pb-6 mt-auto">
          <button 
            onClick={handleLogout}
            title={!isSidebarOpen ? 'Logout' : ''}
            className={`flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} text-white/80 hover:text-white transition-all w-full`}
          >
            <div className="flex-shrink-0"><LogOut size={20} /></div>
            {isSidebarOpen && <span className="font-medium whitespace-nowrap">Logout</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 ${isSidebarOpen ? 'ml-[280px]' : 'ml-[80px]'} p-10 min-h-screen relative transition-all duration-300`}>
        <Outlet />
      </main>

    </div>
  );
};

export default AnggotaLayout;
