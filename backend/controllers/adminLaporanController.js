const db = require('../config/database');
const bcrypt = require('bcrypt'); 

// Fungsi Memuat Laporan Absensi
// Mendukung 2 mode filter:
//   1. Range tanggal: ?dari_tanggal=2026-06-01&sampai_tanggal=2026-06-30
//   2. Per bulan: ?bulan=6&tahun=2026 (default: bulan & tahun saat ini)
const getLaporan = async (req, res) => {
    const { dari_tanggal, sampai_tanggal } = req.query;
    const filterBulan = req.query.bulan || new Date().getMonth() + 1;
    const filterTahun = req.query.tahun || new Date().getFullYear();

    // Tentukan kondisi WHERE dan params
    let whereClause = '';
    let params = [];
    let labelPeriode = '';

    if (dari_tanggal && sampai_tanggal) {
        // Mode range tanggal
        whereClause = 'WHERE a.tanggal BETWEEN ? AND ?';
        params = [dari_tanggal, sampai_tanggal];
        labelPeriode = `${dari_tanggal} s/d ${sampai_tanggal}`;
    } else {
        // Mode per bulan (default)
        whereClause = 'WHERE MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?';
        params = [filterBulan, filterTahun];
        labelPeriode = `Bulan ${filterBulan} Tahun ${filterTahun}`;
    }

    const connection = await db.getConnection();
    try {
        // Jalankan 2 query secara paralel untuk performa
        const [hasilTotal, hasilTabel] = await Promise.all([
            // Query 1: Menghitung Data Total
            connection.query(
                `SELECT 
                    COUNT(*) AS total_records,
                    COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir,
                    COUNT(IF(status = 'Izin', 1, NULL)) AS total_izin,
                    COUNT(IF(status = 'Tidak Hadir', 1, NULL)) AS total_tidak_hadir
                FROM attendances a
                ${whereClause}`,
                params
            ),

            // Query 2: Mengambil Data Tabel Rekapan Absensi
            connection.query(
                `SELECT 
                    a.id,
                    u.nama, 
                    u.nim, 
                    u.sn,
                    sh.nama_shift, 
                    a.tanggal, 
                    a.waktu_masuk, 
                    a.waktu_keluar, 
                    a.durasi_menit, 
                    a.status,
                    a.bukti_foto
                FROM attendances a
                JOIN users u ON a.user_id = u.id
                JOIN shifts sh ON a.shift_id = sh.id
                ${whereClause}
                ORDER BY a.tanggal DESC, a.waktu_masuk ASC`,
                params
            )
        ]);

        res.status(200).json({
            status: 'success',
            message: `Data laporan ${labelPeriode} berhasil dimuat.`,
            periode: labelPeriode,
            data: {
                data_total: hasilTotal[0][0],
                tabel_rekapan: hasilTabel[0]
            }
        });

    } catch (error) {
        console.error('Error Laporan:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat data laporan.' });
    } finally {
        connection.release();
    }
};

module.exports = {
    getLaporan
};