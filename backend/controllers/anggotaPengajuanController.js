const db = require('../config/database');

const buatPengajuan = async (req, res) => {
    // req.user didapat dari token JWT middleware
    const userId = req.user.id; 
    let { tipe_pengajuan, tanggal_pengajuan, alasan, shift_id } = req.body;
    
    // req.file didapat dari multer jika ada file yang diunggah
    const bukti_foto = req.file ? req.file.filename : null;

    if (!tipe_pengajuan || !tanggal_pengajuan || !alasan) {
        return res.status(400).json({ status: 'error', message: 'Tipe pengajuan, tanggal, dan alasan wajib diisi.' });
    }

    // Validasi jika izin wajib menyertakan foto
    if (tipe_pengajuan === 'Izin' && !bukti_foto) {
        return res.status(400).json({ status: 'error', message: 'Pengajuan Izin wajib menyertakan bukti foto.' });
    }

    // PERBAIKAN: Tangani nilai "0", 0, atau kosong agar menjadi null
    if (!shift_id || shift_id === '0' || shift_id === 0 || shift_id === '') {
        shift_id = null;
    }

    const connection = await db.getConnection();
    try {
        await connection.query(
            `INSERT INTO permissions (user_id, shift_id, tipe_pengajuan, tanggal_pengajuan, alasan, bukti_foto, status_approval) 
             VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
            [userId, shift_id, tipe_pengajuan, tanggal_pengajuan, alasan, bukti_foto]
        );

        res.status(201).json({ status: 'success', message: 'Pengajuan berhasil dikirim dan menunggu validasi Admin.' });

    } catch (error) {
        console.error('Error Buat Pengajuan:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mengirim pengajuan.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { buatPengajuan };