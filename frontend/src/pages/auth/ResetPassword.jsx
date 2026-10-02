import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Loader2, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({ password_baru: '', konfirmasi_password: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Jika tidak ada token di URL, beri error
  useEffect(() => {
    if (!token) {
      setError('Token reset password tidak valid atau tidak ditemukan.');
    }
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password_baru !== formData.konfirmasi_password) {
      return setError('Password baru dan konfirmasi tidak cocok.');
    }
    
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await api.post('/api/auth/reset-password', {
        token,
        password_baru: formData.password_baru,
        konfirmasi_password: formData.konfirmasi_password
      });
      setMessage(res.data.message || 'Password berhasil direset. Silakan login kembali.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mereset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden font-['Poppins']">
      {/* Background Decorators */}
      <div className="absolute top-[-49px] left-[135px] w-[226px] h-[226px] rounded-full border-[36px] border-[#E63C25]" />
      <div className="absolute top-[164px] left-[44px] w-[83px] h-[83px] rounded-full border-[13px] border-[#E8B221]" />
      <div className="absolute top-[294px] left-[-347px] w-[559px] h-[559px] rounded-full border-[89px] border-[#1D94C5]" />
      <div className="absolute top-[-135px] left-[1184px] w-[452px] h-[452px] rounded-full border-[72px] border-[#E61568]" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
        
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Buat Password Baru</h2>
        <p className="text-gray-500 mb-8 text-sm">Silakan masukkan password baru Anda.</p>

        {message && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 text-sm font-medium rounded-xl border border-green-200">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-200">
            {error}
            {!token && (
               <Link to="/login" className="block mt-4 text-blue-600 underline">Kembali ke Login</Link>
            )}
          </div>
        )}

        {token && !message && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password Baru</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  name="password_baru"
                  required minLength="6"
                  value={formData.password_baru}
                  onChange={handleChange}
                  className="block w-full pl-12 pr-4 h-14 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004AB9] focus:border-[#004AB9] text-gray-700 bg-gray-50"
                  placeholder="Minimal 6 karakter"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Konfirmasi Password Baru</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  name="konfirmasi_password"
                  required minLength="6"
                  value={formData.konfirmasi_password}
                  onChange={handleChange}
                  className="block w-full pl-12 pr-4 h-14 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004AB9] focus:border-[#004AB9] text-gray-700 bg-gray-50"
                  placeholder="Ulangi password baru"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center h-14 border border-transparent rounded-xl text-lg font-medium text-white bg-[#004AB9] hover:bg-[#003882] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#004AB9] disabled:opacity-50 transition-colors shadow-md"
            >
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : 'Simpan Password Baru'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
