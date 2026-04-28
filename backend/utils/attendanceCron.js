// utils/attendanceCron.js
const cron = require('node-cron');
const db = require('../config/database');

const jalankanCronAbsensi = () => {
    // Jadwal berjalan: Menit ke-0, Jam ke-18, Setiap hari, Bulan apa saja, Hari Senin(1) - Jumat(5)
    // Format: '0 18 * * 1-5'
    cron.schedule('0 18 * * 1-5', async () => {
        console.log('[CRON] Menjalankan pengecekan absensi otomatis pada 18:00...');
        const connection = await db.getConnection();

        try {
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const hariIni = namaHari[new Date().getDay()];

            await connection.beginTransaction();

            // 1. Tandai "Tidak Hadir" untuk yang sama sekali belum tap hari ini
            // Menggunakan query INSERT ... SELECT agar sangat cepat
            const [insertBolos] = await connection.query(`
                INSERT INTO attendances (user_id, shift_id, tanggal, status)
                SELECT s.user_id, s.shift_id, CURDATE(), 'Tidak Hadir'
                FROM schedules s
                LEFT JOIN attendances a ON s.user_id = a.user_id AND a.tanggal = CURDATE()
                WHERE s.hari_piket = ? AND a.id IS NULL
            `, [hariIni]);

            // 2. (Opsional) Auto-checkout untuk yang lupa tap keluar (masih 'Sedang Piket')
            // Diubah menjadi 'Tidak Hadir' karena tidak menyelesaikan piket sesuai SOP
            const [updateLupaKeluar] = await connection.query(`
                UPDATE attendances 
                SET status = 'Tidak Hadir', durasi_menit = 0, waktu_keluar = NOW()
                WHERE tanggal = CURDATE() AND status = 'Sedang Piket'
            `);

            await connection.commit();
            console.log(`[CRON] Sukses. ${insertBolos.affectedRows} anggota ditandai Tidak Hadir (Bolos). ${updateLupaKeluar.affectedRows} anggota lupa tap keluar.`);

        } catch (error) {
            await connection.rollback();
            console.error('[CRON] Terjadi kesalahan saat update absensi:', error);
        } finally {
            connection.release();
        }
    });
};

module.exports = jalankanCronAbsensi;