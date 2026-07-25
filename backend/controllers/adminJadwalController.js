const db = require('../config/database');

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

// ── GET /api/admin/jadwal/rekomendasi — Memuat Daftar Anggota untuk Ditugaskan ──
// Sementara sebelum ada ML, memunculkan semua anggota, dan ditandai (disabled) jika sudah piket di hari yang sama
const getRekomendasi = async (req, res) => {
    const { hari, shift_id } = req.query;

    if (!hari || !shift_id) {
        return res.status(400).json({ status: 'error', message: 'Parameter hari dan shift_id wajib diisi.' });
    }

    try {
        // Ambil semua pengguna, dan cek apakah mereka punya jadwal di 'hari' tersebut
        const [anggota] = await db.query(`
            SELECT 
                u.id AS user_id, 
                u.nama, 
                u.nim, 
                u.sn,
                IF(s.id IS NOT NULL, 1, 0) AS is_terjadwal_hari_ini,
                s.shift_id AS jadwal_bentrok_shift_id
            FROM users u
            LEFT JOIN schedules s ON u.id = s.user_id AND s.hari_piket = ?
            WHERE u.role = 'Anggota'
            ORDER BY is_terjadwal_hari_ini ASC, u.nama ASC
        `, [hari]);

        // Transformasi hasil query menjadi format yang sesuai dengan UI 'Rekomendasi'
        const rekomendasi = anggota.map(a => ({
            user_id: a.user_id,
            nama: a.nama,
            sn: a.sn,
            status: a.is_terjadwal_hari_ini ? (a.jadwal_bentrok_shift_id == shift_id ? 'Sudah Terjadwal di Shift Ini' : 'Sudah Terjadwal di Shift Lain Hari Ini') : 'Belum Terjadwal',
            bisa_ditugaskan: a.is_terjadwal_hari_ini === 0
        }));

        res.status(200).json({ 
            status: 'success', 
            message: `Rekomendasi sementara untuk ${hari} Shift ${shift_id}`,
            data: rekomendasi 
        });
    } catch (error) {
        console.error('Error Get Rekomendasi:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat daftar rekomendasi.' });
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
