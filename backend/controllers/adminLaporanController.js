const db = require('../config/database');
const bcrypt = require('bcrypt'); 

// Fungsi Memuat Laporan Absensi
const getLaporan = async (req, res) => {
    // Tangkap filter bulan dan tahun dari URL. Jika kosong, gunakan bulan & tahun saat ini
    const filterBulan = req.query.bulan || new Date().getMonth() + 1;
    const filterTahun = req.query.tahun || new Date().getFullYear();

    const connection = await db.getConnection();
    try {
        // Jalankan 2 query secara paralel untuk performa
        const [hasilTotal, hasilTabel] = await Promise.all([
            // Query 1: Menghitung Data Total
            connection.query(`
                SELECT 
                    COUNT(*) AS total_records,
                    COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir,
                    COUNT(IF(status = 'Izin', 1, NULL)) AS total_izin,
                    COUNT(IF(status = 'Tidak Hadir', 1, NULL)) AS total_tidak_hadir
                FROM attendances
                WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
            `, [filterBulan, filterTahun]),

            // Query 2: Mengambil Data Tabel Rekapan Absensi
            connection.query(`
                SELECT 
                    a.id,
                    u.nama, 
                    u.nim, 
                    sh.nama_shift, 
                    a.tanggal, 
                    a.waktu_masuk, 
                    a.waktu_keluar, 
                    a.durasi_menit, 
                    a.status
                FROM attendances a
                JOIN users u ON a.user_id = u.id
                JOIN shifts sh ON a.shift_id = sh.id
                WHERE MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
                ORDER BY a.tanggal DESC, a.waktu_masuk ASC
            `, [filterBulan, filterTahun])
        ]);

        res.status(200).json({
            status: 'success',
            message: `Data laporan bulan ${filterBulan} tahun ${filterTahun} berhasil dimuat.`,
            data: {
                data_total: hasilTotal[0][0], // Mengambil objek baris pertama
                tabel_rekapan: hasilTabel[0]  // Mengambil array of objects
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