// controllers/rfidController.js
const db = require('../config/database');

const tapKartu = async (req, res) => {
    const { rfid_tag } = req.body;

    if (!rfid_tag) {
        return res.status(400).json({ status: 'error', message: 'RFID Tag wajib dikirim.' });
    }

    const connection = await db.getConnection();
    try {
        // Cek User
        const [users] = await connection.query('SELECT id, nama FROM users WHERE rfid_tag = ?', [rfid_tag]);
        if (users.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Kartu RFID tidak terdaftar.' });
        }
        const user = users[0];

        // Cek Absensi Aktif (Belum Tap Keluar)
        const [absensiAktif] = await connection.query(
            'SELECT id, waktu_masuk FROM attendances WHERE user_id = ? AND tanggal = CURDATE() AND waktu_keluar IS NULL',
            [user.id]
        );

        if (absensiAktif.length === 0) {
            // ==========================================
            // LOGIKA TAP MASUK
            // ==========================================
            
            // 1. Cek apakah sudah piket dan selesai hari ini
            const [absensiSelesai] = await connection.query(
                'SELECT id FROM attendances WHERE user_id = ? AND tanggal = CURDATE() AND status = "Hadir"',
                [user.id]
            );
            if (absensiSelesai.length > 0) {
                return res.status(400).json({ status: 'error', message: `Halo ${user.nama}, kamu sudah piket hari ini.` });
            }

            // 2. Cek jadwal hari ini beserta jam selesai shift-nya
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const hariIni = namaHari[new Date().getDay()];

            const [jadwal] = await connection.query(
                `SELECT s.shift_id, sh.jam_selesai 
                 FROM schedules s 
                 JOIN shifts sh ON s.shift_id = sh.id 
                 WHERE s.user_id = ? AND s.hari_piket = ?`,
                [user.id, hariIni]
            );

            if (jadwal.length === 0) {
                return res.status(403).json({ status: 'error', message: `Maaf ${user.nama}, tidak ada jadwal piket hari ini.` });
            }
            
            // 3. Validasi Waktu (Tolak jika sudah lewat jam selesai shift)
            const jamSekarang = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
            const jamSelesaiShift = jadwal[0].jam_selesai;

            if (jamSekarang > jamSelesaiShift) {
                return res.status(400).json({ 
                    status: 'error', 
                    message: `Akses ditolak, ${user.nama}. Batas shift Anda (hingga ${jamSelesaiShift}) telah lewat. Silakan ajukan Ganti Jadwal.` 
                });
            }

            // 4. Catat Tap Masuk
            await connection.query(
                'INSERT INTO attendances (user_id, shift_id, tanggal, status) VALUES (?, ?, CURDATE(), "Sedang Piket")',
                [user.id, jadwal[0].shift_id]
            );

            return res.status(200).json({ status: 'success', message: `Tap masuk berhasil. Selamat bertugas, ${user.nama}!` });

        } else {
            // ==========================================
            // LOGIKA TAP KELUAR
            // ==========================================
            const idAbsensi = absensiAktif[0].id;
            const waktuMasuk = new Date(absensiAktif[0].waktu_masuk);
            const waktuSekarang = new Date();
            const durasiMenit = Math.floor((waktuSekarang - waktuMasuk) / 60000);

            // Validasi durasi minimal 60 menit
            if (durasiMenit < 60) {
                return res.status(400).json({ 
                    status: 'error', 
                    message: `Tap ditolak. Durasi baru ${durasiMenit} menit. Minimal 60 menit.` 
                });
            }

            // Catat Tap Keluar
            await connection.query(
                'UPDATE attendances SET waktu_keluar = NOW(), durasi_menit = ?, status = "Hadir" WHERE id = ?',
                [durasiMenit, idAbsensi]
            );

            return res.status(200).json({ status: 'success', message: `Tap keluar berhasil. Terima kasih, ${user.nama}!` });
        }

    } catch (error) {
        console.error('Error RFID Tap:', error);
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
    } finally {
        connection.release();
    }
};

module.exports = { tapKartu };