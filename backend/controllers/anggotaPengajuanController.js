const db = require('../config/database');
const { kirimEmail } = require('../config/mailer');

// ── POST /api/anggota/pengajuan — Buat Pengajuan Izin/Ganti Jadwal ──
const buatPengajuan = async (req, res) => {
    const { id: userId, nama: namaUser } = req.user;
    const { tipe_pengajuan, tanggal_pengajuan, tanggal_pengganti, alasan } = req.body;
    
    // Pembersihan input
    let shift_id = req.body.shift_id === '0' || !req.body.shift_id ? null : req.body.shift_id;
    let shift_awal_id = req.body.shift_awal_id === '0' || !req.body.shift_awal_id ? null : req.body.shift_awal_id;
    const bukti_foto = req.file?.filename || null;

    // Early Returns (Validasi)
    if (!tipe_pengajuan || !tanggal_pengajuan || !alasan) {
        return res.status(400).json({ status: 'error', message: 'Tipe pengajuan, tanggal, dan alasan wajib diisi.' });
    }

    if (tipe_pengajuan === 'Izin' && !bukti_foto) {
        return res.status(400).json({ status: 'error', message: 'Pengajuan Izin wajib menyertakan bukti foto.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.query(
            `INSERT INTO permissions 
             (user_id, shift_id, shift_awal_id, tipe_pengajuan, tanggal_pengajuan, tanggal_pengganti, alasan, bukti_foto, status_approval) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [userId, shift_id, shift_awal_id, tipe_pengajuan, tanggal_pengajuan, tanggal_pengganti || null, alasan, bukti_foto]
        );

        res.status(201).json({ status: 'success', message: 'Pengajuan berhasil dikirim dan menunggu validasi Admin.' });

        // Async Background Task: Kirim notifikasi email ke Admin tanpa memblokir response HTTP
        kirimNotifikasiAdmin(namaUser, tipe_pengajuan, tanggal_pengajuan, alasan, connection);

    } catch (error) {
        console.error('Error Buat Pengajuan:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mengirim pengajuan.' });
    } finally {
        connection.release();
    }
};

// ── HELPER: Kirim Notifikasi Email ke Admin ──
const kirimNotifikasiAdmin = async (namaUser, tipe_pengajuan, tanggal_pengajuan, alasan, connection) => {
    try {
        const [admins] = await connection.query("SELECT email FROM users WHERE role = 'Admin' AND email IS NOT NULL");
        if (!admins.length) return;

        const emailAdmins = admins.map(a => a.email).join(',');
        const subject = `Pengajuan Baru: ${tipe_pengajuan} dari ${namaUser}`;
        const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
                <h2 style="color: #333;">📩 Pengajuan Baru Masuk</h2>
                <p><strong>Nama:</strong> ${namaUser}</p>
                <p><strong>Tipe:</strong> ${tipe_pengajuan}</p>
                <p><strong>Tanggal:</strong> ${tanggal_pengajuan}</p>
                <p><strong>Alasan:</strong> ${alasan}</p>
                <p style="color: #999; font-size: 12px; margin-top: 20px;">Sistem Absensi RFID</p>
            </div>`;
            
        await kirimEmail(emailAdmins, subject, htmlBody);
    } catch (err) {
        console.warn('[EMAIL] Gagal kirim notif pengajuan:', err.message);
    }
};

// ── GET /api/anggota/pengajuan — Ambil Daftar Pengajuan Pribadi ──
const getPengajuanAnggota = async (req, res) => {
    const userId = req.user.id;
    try {
        const [pengajuan] = await db.query(`
            SELECT p.*, s.nama_shift AS shift_tujuan, sa.nama_shift AS shift_asal
            FROM permissions p
            LEFT JOIN shifts s ON p.shift_id = s.id
            LEFT JOIN shifts sa ON p.shift_awal_id = sa.id
            WHERE p.user_id = ?
            ORDER BY p.id DESC
        `, [userId]);

        res.status(200).json({ status: 'success', data: pengajuan });
    } catch (error) {
        console.error('Error Get Pengajuan Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mengambil data pengajuan.' });
    }
};

module.exports = { buatPengajuan, getPengajuanAnggota };