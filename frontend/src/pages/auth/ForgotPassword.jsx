import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../../utils/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await api.post('/api/auth/forgot-password', { email });
      setMessage(res.data.message || 'Link reset password telah dikirim ke email Anda.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim link reset password.');
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
        <Link to="/login" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 mb-6 transition-colors w-fit">
          <ArrowLeft size={20} />
          <span className="font-medium text-sm">Kembali ke Login</span>
        </Link>
        
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Lupa Password?</h2>
        <p className="text-gray-500 mb-8 text-sm">Masukkan email Anda yang terdaftar. Kami akan mengirimkan tautan untuk mereset password Anda.</p>

        {message && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 text-sm font-medium rounded-xl border border-green-200">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-12 pr-4 h-14 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004AB9] focus:border-[#004AB9] text-gray-700 bg-gray-50"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full flex justify-center items-center h-14 border border-transparent rounded-xl text-lg font-medium text-white bg-[#004AB9] hover:bg-[#003882] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#004AB9] disabled:opacity-50 transition-colors shadow-md"
          >
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : 'Kirim Link Reset'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
