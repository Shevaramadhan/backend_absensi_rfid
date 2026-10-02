import React, { useState, useEffect } from 'react';
import { FileText, Trash2, Plus, Loader2 } from 'lucide-react';
import api from '../../utils/api';

const SHIFTS = [
  { id: 1, name: 'Shift 1', start: '08:00', end: '10:00' },
  { id: 2, name: 'Shift 2', start: '10:00', end: '12:00' },
  { id: 3, name: 'Shift 3', start: '12:00', end: '14:00' },
  { id: 4, name: 'Shift 4', start: '14:00', end: '16:00' },
];

const AnggotaJadwal = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState('Senin');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  
  // State KRS (Courses) per day
  const [krsData, setKrsData] = useState({
    Senin: [], Selasa: [], Rabu: [], Kamis: [], Jumat: []
  });

  const [pdfFile, setPdfFile] = useState(null);

  useEffect(() => {
    fetchKrs();
  }, []);

  const fetchKrs = async () => {
    try {
      const res = await api.get('/api/anggota/krs');
      const fetchedData = res.data.data;
      
      // Ensure all days exist
      const completeData = { Senin: [], Selasa: [], Rabu: [], Kamis: [], Jumat: [] };
      Object.keys(completeData).forEach(hari => {
        if (fetchedData[hari]) completeData[hari] = fetchedData[hari];
      });
      
      setKrsData(completeData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if two time ranges overlap
  const checkOverlap = (start1, end1, start2, end2) => {
    if (!start1 || !end1 || !start2 || !end2) return false;
    return (start1 < end2) && (start2 < end1);
  };

  const calculateShiftStatus = (hari, shift) => {
    const courses = krsData[hari];
    let isOverlap = false;
    for (const course of courses) {
      if (checkOverlap(course.start, course.end, shift.start, shift.end)) {
        isOverlap = true;
        break;
      }
    }
    return isOverlap ? 'Kegiatan' : 'Tersedia';
  };

  const handleAddMatkul = () => {
    const newCourse = { id: Date.now(), name: '', start: '08:00', end: '10:00' };
    setKrsData(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], newCourse]
    }));
  };

  const handleRemoveMatkul = (idToRemove) => {
    setKrsData(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(c => c.id !== idToRemove)
    }));
  };

  const handleChangeMatkul = (id, field, value) => {
    setKrsData(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/api/anggota/krs', { krsData });
      alert('Jadwal KRS berhasil disimpan! Data waktu luang Anda sekarang terhubung ke AI Admin.');
    } catch (error) {
      alert('Gagal menyimpan KRS: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFile(file);
    
    const formData = new FormData();
    formData.append('krs_pdf', file);

    try {
      setParsing(true);
      const res = await api.post('/api/anggota/krs/parse-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const parsedCourses = res.data.data;
      if (parsedCourses.length === 0) {
        alert('Tidak ada mata kuliah yang terdeteksi di PDF ini.');
        return;
      }

      // Merge parsed courses into current state
      setKrsData(prev => {
        const newData = { ...prev };
        parsedCourses.forEach((c, idx) => {
          const hari = c.hari;
          if (newData[hari]) {
            newData[hari].push({
              id: Date.now() + idx,
              name: c.matakuliah,
              sks: c.sks,
              start: c.jamMulai,
              end: c.jamSelesai
            });
          }
        });
        return newData;
      });
      alert(`Berhasil mengekstrak ${parsedCourses.length} mata kuliah dari PDF! Silakan periksa kembali jamnya.`);
    } catch (error) {
      alert('Gagal memproses PDF: ' + (error.response?.data?.message || error.message));
    } finally {
      setParsing(false);
      e.target.value = null;
    }
  };

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>;

  return (
    <div className="font-['Poppins']">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-xl font-medium text-black">Hello, {user.nama}!</h1>
        <h2 className="text-3xl font-bold text-black mt-2">Kelola Jadwal Piket & KRS</h2>
        <p className="text-gray-400 mt-1">Isi jadwal dan data KRS pada form yang disediakan.</p>
      </div>

      {/* UPLOAD PDF KRS */}
      <div className="bg-white rounded-[15px] p-6 shadow-sm border border-gray-100 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="text-black">
            <FileText size={40} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-black">Lampiran Bukti KRS (PDF)</h3>
            <p className="text-sm text-gray-400">Silakan unggah file KRS dalam format .pdf untuk validasi data.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className={`cursor-pointer px-5 py-2.5 rounded-lg text-sm font-medium transition-colors text-white ${parsing ? 'bg-gray-400' : 'bg-[#3B82F6] hover:bg-blue-600'}`}>
            {parsing ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Ekstrak AI...</span> : 'Choose file'}
            <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={parsing} />
          </label>
          <span className="text-gray-400 text-sm max-w-[200px] truncate" title={pdfFile ? pdfFile.name : 'No file chosen'}>
            {pdfFile ? pdfFile.name : 'No file chosen'}
          </span>
        </div>
      </div>

      {/* MAIN FORM AREA */}
      <div className="bg-white rounded-[15px] shadow-sm border border-gray-100 p-8 mb-8">
        
        {/* TABS */}
        <div className="flex gap-4 mb-8">
          {Object.keys(krsData).map(hari => (
            <button
              key={hari}
              onClick={() => setActiveTab(hari)}
              className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                activeTab === hari 
                  ? 'bg-[#3B82F6] text-white shadow-md' 
                  : 'bg-[#E0E7FF] text-black hover:bg-[#c7d2fe]'
              }`}
            >
              {hari}
            </button>
          ))}
        </div>

        {/* KELOLA MATKUL HARI INI */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-black">Daftar KRS {activeTab}</h3>
            <button 
              onClick={handleAddMatkul}
              className="bg-[#D97706] hover:bg-[#b45309] text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <Plus size={16} />
              Tambah Matkul
            </button>
          </div>

          <div className="space-y-4">
            {krsData[activeTab].length === 0 ? (
              <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                Tidak ada kelas pada hari {activeTab}.
              </div>
            ) : (
              krsData[activeTab].map((course) => (
                <div key={course.id} className="flex gap-4 items-center">
                  <input 
                    type="text" 
                    value={course.name}
                    onChange={(e) => handleChangeMatkul(course.id, 'name', e.target.value)}
                    placeholder="Nama Mata Kuliah"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-gray-700"
                  />
                  <input 
                    type="time" 
                    value={course.start}
                    onChange={(e) => handleChangeMatkul(course.id, 'start', e.target.value)}
                    className="w-32 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-gray-700"
                  />
                  <span className="text-gray-400 font-bold">-</span>
                  <input 
                    type="time" 
                    value={course.end}
                    onChange={(e) => handleChangeMatkul(course.id, 'end', e.target.value)}
                    className="w-32 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-gray-700"
                  />
                  <button 
                    onClick={() => handleRemoveMatkul(course.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-100"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* STATUS SHIFT PREVIEW */}
        <div className="border-t border-gray-100 pt-8">
          <h3 className="text-lg font-bold text-black mb-6">Status Waktu Luang (Shift)</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {SHIFTS.map(shift => {
              const status = calculateShiftStatus(activeTab, shift);
              const isAvailable = status === 'Tersedia';
              
              return (
                <div 
                  key={shift.id} 
                  className={`flex justify-between items-center p-4 rounded-xl border ${
                    isAvailable 
                      ? 'bg-[#dcfce7] border-[#bbf7d0] text-green-800' // Green
                      : 'bg-[#fee2e2] border-[#fecaca] text-red-800'  // Red
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-lg">{shift.name}</h4>
                    <p className={`text-sm ${isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                      {shift.start} - {shift.end}
                    </p>
                  </div>
                  <span className="text-sm font-medium opacity-80">{status}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* FOOTER BUTTONS */}
      <div className="flex justify-end gap-4 pb-10">
        <button 
          onClick={fetchKrs}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
        >
          Batal (Reset)
        </button>
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-8 py-2.5 rounded-lg text-white font-medium transition-colors shadow-sm ${saving ? 'bg-blue-400' : 'bg-[#3B82F6] hover:bg-blue-600'}`}
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>

    </div>
  );
};

export default AnggotaJadwal;
