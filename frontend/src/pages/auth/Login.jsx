import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import api from '../../utils/api';

const Login = () => {
  const navigate = useNavigate();
  // Karena API meminta login (bisa username/email) dan field di Figma tulisannya "Email"
  const [formData, setFormData] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/api/auth/login', formData);
      
      // Mengatasi perbedaan format response antara local (response.data.user) dan production (response.data.data.user)
      const token = response.data.data?.token || response.data.token;
      const user = response.data.data?.user || response.data.user;
      
      if (!user) {
        throw new Error('Data user tidak ditemukan dari server');
      }

      const role = user.role;
      
      localStorage.setItem('token', token);
      localStorage.setItem('role', role);
      localStorage.setItem('user', JSON.stringify(user));

      if (role === 'Admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/anggota/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Terjadi kesalahan saat login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden font-['Poppins']">
      
      {/* --- DEKORASI LINGKARAN (BACKGROUND) --- */}
      {/* Merah Kiri Atas */}
      <div className="absolute top-[-49px] left-[135px] w-[226px] h-[226px] rounded-full border-[36px] border-[#E63C25]" />
      {/* Kuning Kiri Tengah */}
      <div className="absolute top-[164px] left-[44px] w-[83px] h-[83px] rounded-full border-[13px] border-[#E8B221]" />
      {/* Biru Kiri Bawah */}
      <div className="absolute top-[294px] left-[-347px] w-[559px] h-[559px] rounded-full border-[89px] border-[#1D94C5]" />
      
      {/* Pink Kanan Atas */}
      <div className="absolute top-[-135px] left-[1184px] w-[452px] h-[452px] rounded-full border-[72px] border-[#E61568]" />
      {/* Biru Kanan Tengah */}
      <div className="absolute top-[353px] left-[1308px] w-[97px] h-[97px] rounded-full border-[15px] border-[#1F95C7]" />
      {/* Hijau Kanan Bawah */}
      <div className="absolute top-[728px] left-[914px] w-[367px] h-[367px] rounded-full border-[58px] border-[#0E773D]" />
      {/* Kuning Bawah */}
      <div className="absolute top-[926px] left-[711px] w-[153px] h-[153px] rounded-full border-[24px] border-[#E8B221]" />
      {/* --------------------------------------- */}

      {/* MAIN CARD CONTAINER */}
      <div className="relative z-10 flex w-full max-w-[1132px] h-[632px] shadow-[5px_5px_10px_rgba(0,0,0,0.25)] rounded-[25px] overflow-hidden bg-white">
        
        {/* KOLOM KIRI (BIRU) */}
        <div className="w-[537px] h-full bg-[#004AB9] flex flex-col items-center justify-center p-12 text-white relative">
          
          {/* LOGO ASLI */}
          <img 
            src="/6. Lambang white.png" 
            alt="Logo Neo Telemetri" 
            className="w-[375px] h-[95px] object-contain mb-8"
            onError={(e) => {
              // Fallback jika file gambar belum dimasukkan
              e.target.style.display = 'none';
              document.getElementById('fallback-logo').style.display = 'block';
            }}
          />
          
          {/* FALLBACK TEKS (Hanya muncul jika gambar gagal diload) */}
          <div id="fallback-logo" className="text-center hidden mb-8">
            <h1 className="text-4xl font-bold italic border-b-2 border-white pb-1 mb-2">NEO TELEMETRI</h1>
            <p className="text-xs uppercase tracking-widest font-light">IT FOR THE FUTURE</p>
          </div>

          <div className="text-center">
            <h1 className="text-[26px] font-medium leading-[39px]">NEO TELEMETRI</h1>
            <p className="text-[20px] font-medium leading-[30px]">IT FOR THE FUTURE</p>
          </div>
        </div>

        {/* KOLOM KANAN (PUTIH) */}
        <div className="w-[595px] h-full bg-white px-16 flex flex-col justify-center">
          <h2 className="text-[48px] leading-[72px] font-semibold text-black mb-1 whitespace-nowrap">SISTEM ABSENSI</h2>
          <p className="text-[20px] font-medium text-[#707070] mb-10">Login untuk melanjutkan</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-[10px] border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[22px] font-medium text-black mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-[15px] flex items-center pointer-events-none">
                  <Mail className="h-[26px] w-[26px] text-[#959595]" />
                </div>
                <input
                  type="text"
                  name="login"
                  required
                  value={formData.login}
                  onChange={handleChange}
                  className="block w-full pl-12 pr-4 h-[56px] border border-[#707070] rounded-[10px] focus:outline-none focus:ring-1 focus:ring-[#004AB9] focus:border-[#004AB9] text-[20px] text-[#707070] bg-transparent"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label className="block text-[22px] font-medium text-black mb-2 mt-6">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-[15px] flex items-center pointer-events-none">
                  <Lock className="h-[26px] w-[26px] text-[#959595]" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-12 pr-4 h-[56px] border border-[#707070] rounded-[10px] focus:outline-none focus:ring-1 focus:ring-[#004AB9] focus:border-[#004AB9] text-[20px] text-[#707070] bg-transparent"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <Link to="/forgot-password" className="text-[16px] text-[#004AB9] hover:underline font-medium">Lupa Password?</Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center h-[71px] border border-transparent rounded-[10px] shadow-sm text-[24px] font-medium text-white bg-[#004AB9] hover:bg-[#003882] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#004AB9] disabled:opacity-50 transition-colors mt-12"
            >
              {isLoading ? 'Memproses...' : 'Log in'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;
