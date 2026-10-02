import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart2, 
  Users, 
  FileText, 
  FileSignature, 
  CalendarDays, 
  LogOut,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Menu
} from 'lucide-react';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [anggotaOpen, setAnggotaOpen] = useState(location.pathname.includes('/admin/anggota'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Ranking', path: '/admin/ranking', icon: <BarChart2 size={20} /> },
    { name: 'Laporan', path: '/admin/laporan', icon: <FileText size={20} /> },
    { name: 'Pengajuan', path: '/admin/pengajuan', icon: <FileSignature size={20} /> },
    { name: 'Jadwal Piket', path: '/admin/jadwal', icon: <CalendarDays size={20} /> },
  ];

  const isAnggotaActive = location.pathname.includes('/admin/anggota');

  return (
    <div className="flex min-h-screen bg-[#F5F7FB] font-['Poppins']">
      
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div className={`${isSidebarOpen ? 'w-[280px] translate-x-0' : 'w-[280px] -translate-x-full md:w-[80px] md:translate-x-0'} bg-[#004AB9] flex flex-col justify-between shadow-xl fixed h-screen z-30 transition-all duration-300`}>
        
        <div>
          {/* TOGGLE BUTTON */}
          <div className={`hidden md:flex items-center ${isSidebarOpen ? 'justify-end' : 'justify-center'} p-4`}>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
              <Menu size={24} />
            </button>
          </div>
          
          {/* MOBILE LOGO HEADER (visible only on mobile) */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-white/20">
            <span className="text-white font-bold text-lg">NEO TELEMETRI</span>
            <button onClick={() => setIsSidebarOpen(false)} className="text-white hover:bg-white/20 p-1 rounded-lg">
              <ChevronRight size={24} />
            </button>
          </div>

          {/* LOGO */}
          {isSidebarOpen ? (
            <div className="flex flex-col items-center justify-center pb-6 border-b border-white/20">
              <img 
                src="/6. Lambang white.png" 
                alt="Logo" 
                className="w-[180px] object-contain mb-3"
                onError={(e) => {
                  e.target.style.display = 'none';
                  document.getElementById('sidebar-logo-text').style.display = 'block';
                }}
              />
              <div id="sidebar-logo-text" className="hidden text-white text-center">
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

          {/* MENU ITEMS */}
          <nav className="mt-4 px-3 space-y-2">
            {/* Dashboard & Ranking */}
            {navItems.slice(0, 2).map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                title={!isSidebarOpen ? item.name : ''}
                className={({ isActive }) =>
                  `flex items-center ${isSidebarOpen ? 'gap-4 px-4' : 'justify-center px-0'} py-3 rounded-[10px] transition-all ${
                    isActive 
                      ? 'bg-[#002D7A] text-white font-medium' 
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <div className="flex-shrink-0">{item.icon}</div>
                {isSidebarOpen && <span className="text-[15px] whitespace-nowrap">{item.name}</span>}
              </NavLink>
            ))}

            {/* ANGGOTA (with submenu) */}
            <div>
              <button
                onClick={() => {
                  if (!isSidebarOpen) setIsSidebarOpen(true);
                  setAnggotaOpen(!anggotaOpen);
                }}
                title={!isSidebarOpen ? 'Anggota' : ''}
                className={`flex items-center ${isSidebarOpen ? 'justify-between px-4' : 'justify-center px-0'} w-full py-3 rounded-[10px] transition-all ${
                  isAnggotaActive
                    ? 'bg-[#002D7A] text-white font-medium'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className={`flex items-center ${isSidebarOpen ? 'gap-4' : ''}`}>
                  <div className="flex-shrink-0"><Users size={20} /></div>
                  {isSidebarOpen && <span className="text-[15px] whitespace-nowrap">Anggota</span>}
                </div>
                {isSidebarOpen && (anggotaOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
              </button>
              {isSidebarOpen && anggotaOpen && (
                <div className="ml-8 mt-1 space-y-1">
                  <NavLink
                    to="/admin/anggota"
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2 rounded-[8px] text-sm transition-colors ${
                        isActive
                          ? 'bg-[#002D7A] text-white font-medium'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Users size={16} />
                    <span className="whitespace-nowrap">Daftar Anggota</span>
                  </NavLink>
                  <NavLink
                    to="/admin/anggota/tambah"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2 rounded-[8px] text-sm transition-colors ${
                        isActive
                          ? 'bg-[#002D7A] text-white font-medium'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <UserPlus size={16} />
                    <span className="whitespace-nowrap">Tambah Anggota</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* Laporan, Pengajuan, Jadwal Piket */}
            {navItems.slice(2).map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                title={!isSidebarOpen ? item.name : ''}
                className={({ isActive }) =>
                  `flex items-center ${isSidebarOpen ? 'gap-4 px-4' : 'justify-center px-0'} py-3 rounded-[10px] transition-all ${
                    isActive 
                      ? 'bg-[#002D7A] text-white font-medium' 
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <div className="flex-shrink-0">{item.icon}</div>
                {isSidebarOpen && <span className="text-[15px] whitespace-nowrap">{item.name}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* LOGOUT */}
        <div className="p-3 border-t border-white/20">
          <button 
            onClick={handleLogout}
            title={!isSidebarOpen ? 'Log out' : ''}
            className={`flex items-center ${isSidebarOpen ? 'gap-4 px-4' : 'justify-center px-0'} py-3 w-full text-white/80 hover:bg-white/10 hover:text-white rounded-[10px] transition-all`}
          >
            <div className="flex-shrink-0"><LogOut size={20} /></div>
            {isSidebarOpen && <span className="text-[15px] whitespace-nowrap">Log out</span>}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className={`flex-1 flex flex-col min-h-screen w-full transition-all duration-300 ${isSidebarOpen ? 'md:ml-[280px]' : 'md:ml-[80px]'}`}>
        
        {/* MOBILE TOP BAR */}
        <div className="md:hidden bg-white shadow-sm px-4 py-3 flex items-center gap-4 sticky top-0 z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600 hover:text-black">
            <Menu size={24} />
          </button>
          <span className="font-bold text-lg text-black">Admin Panel</span>
        </div>

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      
    </div>
  );
};

export default AdminLayout;
