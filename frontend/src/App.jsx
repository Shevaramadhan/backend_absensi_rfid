import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AdminLayout from './components/layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRanking from './pages/admin/AdminRanking';
import AdminAnggota from './pages/admin/AdminAnggota';
import AdminTambahAnggota from './pages/admin/AdminTambahAnggota';
import AdminEditAnggota from './pages/admin/AdminEditAnggota';
import AdminLaporan from './pages/admin/AdminLaporan';
import AdminPengajuan from './pages/admin/AdminPengajuan';
import AdminJadwal from './pages/admin/AdminJadwal';

import AnggotaLayout from './components/layouts/AnggotaLayout';
import AnggotaDashboard from './pages/anggota/AnggotaDashboard';
import AnggotaJadwal from './pages/anggota/AnggotaJadwal';
import AnggotaIzin from './pages/anggota/AnggotaIzin';
import AnggotaGantiJadwal from './pages/anggota/AnggotaGantiJadwal';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* ADMIN ROUTES */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="ranking" element={<AdminRanking />} />
        <Route path="anggota" element={<AdminAnggota />} />
        <Route path="anggota/tambah" element={<AdminTambahAnggota />} />
        <Route path="anggota/edit/:id" element={<AdminEditAnggota />} />
        <Route path="laporan" element={<AdminLaporan />} />
        <Route path="pengajuan" element={<AdminPengajuan />} />
        <Route path="jadwal" element={<AdminJadwal />} />
      </Route>

      {/* ANGGOTA ROUTES */}
      <Route path="/anggota" element={<AnggotaLayout />}>
        <Route path="dashboard" element={<AnggotaDashboard />} />
        <Route path="jadwal" element={<AnggotaJadwal />} />
        <Route path="izin" element={<AnggotaIzin />} />
        <Route path="ganti-jadwal" element={<AnggotaGantiJadwal />} />
      </Route>
      
      {/* 404 Route */}
      <Route path="*" element={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <h1 className="text-3xl font-bold text-slate-800">404 - Halaman Tidak Ditemukan</h1>
        </div>
      } />
    </Routes>
  );
};

export default App;
