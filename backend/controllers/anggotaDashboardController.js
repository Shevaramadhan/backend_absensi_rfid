const db = require('../config/database');

const getDashboardAnggota = async (req, res) => {
    // Ambil ID user dari token JWT yang sudah di-decode oleh middleware
    const userId = req.user.id;
    const filterBulan = req.query.bulan || new Date().getMonth() + 1;
    const filterTahun = req.query.tahun || new Date().getFullYear();

    const connection = await db.getConnection();
    try {
        const [hasilStats, hasilRiwayat] = await Promise.all([
            // 1. Query Statistik Pribadi Bulan Ini
            connection.query(`
                SELECT 
                    COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir,
                    COUNT(IF(status = 'Izin', 1, NULL)) AS total_izin,
                    COUNT(IF(status = 'Tidak Hadir', 1, NULL)) AS total_tidak_hadir,
                    COALESCE(SUM(durasi_menit), 0) AS total_durasi_menit
                FROM attendances
                WHERE user_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?
            `, [userId, filterBulan, filterTahun]),

            // 2. Query Riwayat Kehadiran Pribadi (Tabel)
            connection.query(`
                SELECT 
                    a.tanggal, 
                    sh.nama_shift, 
                    sh.jam_mulai,
                    sh.jam_selesai,
                    a.waktu_masuk, 
                    a.waktu_keluar, 
                    a.durasi_menit, 
                    a.status
                FROM attendances a
                JOIN shifts sh ON a.shift_id = sh.id
                WHERE a.user_id = ? AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
                ORDER BY a.tanggal DESC
            `, [userId, filterBulan, filterTahun])
        ]);

        res.status(200).json({
            status: 'success',
            message: 'Dashboard anggota berhasil dimuat.',
            data: {
                statistik: hasilStats[0][0],
                riwayat_kehadiran: hasilRiwayat[0]
            }
        });

    } catch (error) {
        console.error('Error Dashboard Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat dashboard pribadi.' });
    } finally {
        connection.release();
    }
};

module.exports = { getDashboardAnggota };