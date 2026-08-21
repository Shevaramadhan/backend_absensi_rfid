const db = require('../config/database');
const { runPythonScript } = require('../utils/pythonRunner');

// ── GET /api/admin/jadwal — Menampilkan Grid Jadwal Piket ──
// Endpoint ini memuntahkan jadwal seluruh anggota untuk diisi ke dalam Grid (Senin-Jumat, Shift 1-4)
const getSemuaJadwal = async (req, res) => {
    try {
        const [schedules] = await db.query(`
            SELECT 
                s.id AS schedule_id,
                u.id AS user_id,
                u.nama,
                u.nim,
                u.sn,
                s.hari_piket,
                sh.id AS shift_id,
                sh.nama_shift,
                sh.jam_mulai,
                sh.jam_selesai
            FROM schedules s
            JOIN users u ON s.user_id = u.id
            JOIN shifts sh ON s.shift_id = sh.id
            ORDER BY FIELD(s.hari_piket, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'), sh.jam_mulai ASC
        `);

        // Format data agar mudah dibaca Frontend
        // Bentuk akhir: { "Senin": { "1": [anggota1, anggota2], "2": [] }, "Selasa": ... }
        const gridJadwal = {};
        ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].forEach(hari => {
            gridJadwal[hari] = { "1": [], "2": [], "3": [], "4": [] };
        });

        schedules.forEach(row => {
            if (gridJadwal[row.hari_piket] && gridJadwal[row.hari_piket][row.shift_id]) {
                gridJadwal[row.hari_piket][row.shift_id].push({
                    schedule_id: row.schedule_id,
                    user_id: row.user_id,
                    nama: row.nama,
                    nim: row.nim,
                    sn: row.sn
                });
            }
        });

        res.status(200).json({ status: 'success', data: gridJadwal, raw_data: schedules });
    } catch (error) {
        console.error('Error Get Semua Jadwal:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat jadwal piket.' });
    }
};

// ── GET /api/admin/jadwal/rekomendasi — Memuat Daftar Anggota (ML SPK) ──
const getRekomendasi = async (req, res) => {
    const { hari, shift_id } = req.query;

    if (!hari || !shift_id) {
        return res.status(400).json({ status: 'error', message: 'Parameter hari dan shift_id wajib diisi.' });
    }

    try {
        // 1. Ambil Data Dasar
        const [users] = await db.query("SELECT id, nama, sn, jenis_kelamin FROM users WHERE role='Anggota'");
        const [schedules] = await db.query("SELECT user_id, hari_piket, shift_id FROM schedules");
        
        let courses = [];
        let kriteria = [];
        try {
            [courses] = await db.query("SELECT user_id, hari, sks, jam_mulai, jam_selesai FROM member_courses");
            [kriteria] = await db.query("SELECT kode, tipe, bobot FROM kriteria");
        } catch (e) {
            console.log('Tabel ML belum dipatch. Menggunakan data kosong.');
        }

        // 2. Susun JSON untuk Python
        const members = users.map(u => {
            const memberSchedules = schedules.filter(s => s.user_id === u.id);
            const memberCourses = courses.filter(c => c.user_id === u.id);

            const jadwal = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map(h => {
                const dayCourses = memberCourses.filter(c => c.hari === h);
                const totalSks = dayCourses.reduce((sum, c) => sum + (c.sks || 0), 0);
                const kelasKrs = dayCourses.map(c => ({
                    jamMulai: c.jam_mulai,
                    jamSelesai: c.jam_selesai
                }));

                const getShiftStatus = (sId) => memberSchedules.some(s => s.hari_piket === h && s.shift_id === sId) ? 'piket' : 'kosong';

                return {
                    hari: h,
                    sks: totalSks,
                    kelas_krs: kelasKrs,
                    shift1: getShiftStatus(1),
                    shift2: getShiftStatus(2),
                    shift3: getShiftStatus(3),
                    shift4: getShiftStatus(4)
                };
            });

            return { id: u.id, nama: u.nama, jenis_kelamin: u.jenis_kelamin || 'L', jadwal };
        });

        const inputData = { members, kriteria };

        // 3. Panggil Skrip Python secara Native (Child Process)
        const hasilPython = await runPythonScript('spkController.py', [hari, shift_id, JSON.stringify(inputData)]);

        // 4. Format Output untuk Frontend
        // Jika anggota tidak aktif (sks 0 dan piket 0), Python akan me-skip mereka.
        const rekomendasi = hasilPython.map(r => {
            const originalUser = users.find(u => u.id === r.anggotaId);
            return {
                user_id: r.anggotaId,
                nama: r.nama,
                sn: originalUser ? originalUser.sn : "-",
                status: `Direkomendasikan (Skor: ${r.v})`,
                bisa_ditugaskan: true
            };
        });

        res.status(200).json({ 
            status: 'success', 
            message: `Rekomendasi AI untuk ${hari} Shift ${shift_id} berhasil dimuat.`,
            data: rekomendasi 
        });

    } catch (error) {
        console.error('Error Get Rekomendasi ML:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat daftar rekomendasi AI.' });
    }
};

// ── POST /api/admin/jadwal — Menugaskan (Assign) Jadwal Baru ──
const tambahJadwal = async (req, res) => {
    const { user_id, hari_piket, shift_id } = req.body;

    if (!user_id || !hari_piket || !shift_id) {
        return res.status(400).json({ status: 'error', message: 'user_id, hari_piket, dan shift_id wajib diisi.' });
    }

    try {
        // Cek apakah sudah ada (mencegah duplikat)
        const [[cek]] = await db.query('SELECT id FROM schedules WHERE user_id = ? AND hari_piket = ? AND shift_id = ?', [user_id, hari_piket, shift_id]);
        if (cek) {
            return res.status(400).json({ status: 'error', message: 'Anggota tersebut sudah ditugaskan pada jadwal ini.' });
        }

        // Insert ke database
        await db.query('INSERT INTO schedules (user_id, shift_id, hari_piket) VALUES (?, ?, ?)', [user_id, shift_id, hari_piket]);
        
        res.status(201).json({ status: 'success', message: 'Jadwal berhasil ditambahkan.' });
    } catch (error) {
        console.error('Error Tambah Jadwal:', error);
        res.status(500).json({ status: 'error', message: 'Gagal menambahkan jadwal piket.' });
    }
};

// ── DELETE /api/admin/jadwal/:id — Menghapus (Remove) Penugasan Jadwal ──
const hapusJadwal = async (req, res) => {
    const scheduleId = req.params.id;

    try {
        const [hasil] = await db.query('DELETE FROM schedules WHERE id = ?', [scheduleId]);
        
        if (hasil.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'Data jadwal tidak ditemukan.' });
        }

        res.status(200).json({ status: 'success', message: 'Jadwal piket berhasil dihapus.' });
    } catch (error) {
        console.error('Error Hapus Jadwal:', error);
        res.status(500).json({ status: 'error', message: 'Gagal menghapus jadwal piket.' });
    }
};

module.exports = {
    getSemuaJadwal,
    getRekomendasi,
    tambahJadwal,
    hapusJadwal
};
