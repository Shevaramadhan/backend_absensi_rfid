
const bcrypt = require('bcrypt');
const db = require('../config/database');


// Fungsi Memuat Dashboard
const getDashboard = async (req, res) => {
    // Tangkap filter grafik dari query URL, default ke 'harian'
    const filterGrafik = req.query.filter || 'harian';
    const connection = await db.getConnection();

    try {
        // Deteksi hari ini
        const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const hariIni = namaHari[new Date().getDay()];
        
        // Cek apakah hari ini adalah hari kerja (Senin - Jumat)
        const isHariKerja = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].includes(hariIni);

        // 1. Siapkan Query Grafik Dinamis
        let queryGrafik = '';
        if (filterGrafik === 'harian') {
            queryGrafik = `
                SELECT DATE_FORMAT(tanggal, '%d %b') AS label, COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir
                FROM attendances 
                WHERE MONTH(tanggal) = MONTH(CURDATE()) AND YEAR(tanggal) = YEAR(CURDATE()) 
                GROUP BY tanggal, DATE_FORMAT(tanggal, '%d %b')
                ORDER BY tanggal ASC
            `;
        } else if (filterGrafik === 'bulanan') {
            queryGrafik = `
                SELECT MONTHNAME(tanggal) AS label, COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir
                FROM attendances 
                WHERE YEAR(tanggal) = YEAR(CURDATE()) 
                GROUP BY MONTH(tanggal), MONTHNAME(tanggal)
                ORDER BY MONTH(tanggal) ASC
            `;
        } else if (filterGrafik === 'tahunan') {
            queryGrafik = `
                SELECT YEAR(tanggal) AS label, COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir
                FROM attendances 
                GROUP BY YEAR(tanggal) 
                ORDER BY YEAR(tanggal) ASC
            `;
        }

        // 2. Eksekusi Query Grafik & Total Keseluruhan (Berjalan setiap hari termasuk libur)
        const [hasilGrafik] = await connection.query(queryGrafik);
        const [totalSemua] = await connection.query("SELECT COUNT(*) AS total_hadir_semua FROM attendances WHERE status = 'Hadir'");

        // Nilai default untuk data_total dan tabel_ringkasan jika hari libur
        let dataTotal = {
            total_hadir_semua: totalSemua[0].total_hadir_semua,
            hadir_hari_ini: 0,
            sedang_piket: 0,
            belum_atau_tidak_hadir: 0
        };
        let tabelRingkasan = [];

        // 3. Jika hari Senin-Jumat, ambil data harian jadwal piket
        if (isHariKerja) {
            const [hasilStats, hasilTabel] = await Promise.all([
                // Query A: Statistik hari ini
                connection.query(`
                    SELECT 
                        COUNT(IF(a.status = 'Hadir', 1, NULL)) AS hadir_hari_ini,
                        COUNT(IF(a.status = 'Sedang Piket', 1, NULL)) AS sedang_piket,
                        COUNT(IF(a.id IS NULL OR a.status = 'Tidak Hadir', 1, NULL)) AS belum_atau_tidak_hadir
                    FROM schedules s
                    LEFT JOIN attendances a ON s.user_id = a.user_id AND a.tanggal = CURDATE()
                    WHERE s.hari_piket = ?
                `, [hariIni]),
                
                // Query B: Tabel Ringkasan
                connection.query(`
                    SELECT 
                        u.nim,
                        u.nama, 
                        sh.nama_shift, 
                        sh.jam_mulai,
                        sh.jam_selesai,
                        COALESCE(a.status, 'Belum Hadir') AS status_kehadiran
                    FROM schedules s
                    JOIN users u ON s.user_id = u.id
                    JOIN shifts sh ON s.shift_id = sh.id
                    LEFT JOIN attendances a ON s.user_id = a.user_id AND a.tanggal = CURDATE()
                    WHERE s.hari_piket = ?
                    ORDER BY sh.jam_mulai ASC
                `, [hariIni])
            ]);

            // Gabungkan hasil statistik hari ini dengan objek dataTotal
            dataTotal = { ...dataTotal, ...hasilStats[0][0] };
            tabelRingkasan = hasilTabel[0];
        }

        // 4. Kirim Respons
        res.status(200).json({
            status: 'success',
            message: isHariKerja ? 'Data dashboard berhasil dimuat.' : 'Hari ini libur piket (Akhir Pekan).',
            data: { 
                data_total: dataTotal, 
                tabel_ringkasan: tabelRingkasan, 
                grafik_kehadiran: hasilGrafik 
            }
        });
        
    } catch (error) {
        console.error('Error Dashboard:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat dashboard.' });
    } finally {
        connection.release();
    }
};

// Fungsi Mengambil Daftar Pengajuan
const getPengajuan = async (req, res) => {
    try {
        const [pengajuan] = await db.query(`
            SELECT p.*, u.nama, u.nim, s.nama_shift 
            FROM permissions p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN shifts s ON p.shift_id = s.id
            WHERE p.status_approval = 'Pending'
        `);
        res.status(200).json({ status: 'success', data: pengajuan });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal mengambil data pengajuan.' });
    }
};

// Fungsi Validasi Pengajuan
const validasiPengajuan = async (req, res) => {
    const { status_approval } = req.body;
    if (!['Approved', 'Rejected'].includes(status_approval)) {
        return res.status(400).json({ status: 'error', message: 'Status tidak valid.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [cekPengajuan] = await connection.query('SELECT * FROM permissions WHERE id = ?', [req.params.id]);
        if (cekPengajuan.length === 0) throw new Error('Not Found');
        
        await connection.query('UPDATE permissions SET status_approval = ? WHERE id = ?', [status_approval, req.params.id]);
        
        if (status_approval === 'Approved' && cekPengajuan[0].tipe_pengajuan === 'Izin') {
            await connection.query(
                `INSERT INTO attendances (user_id, shift_id, tanggal, status) VALUES (?, ?, ?, 'Izin')
                 ON DUPLICATE KEY UPDATE status = 'Izin'`, 
                [cekPengajuan[0].user_id, cekPengajuan[0].shift_id || 1, cekPengajuan[0].tanggal_pengajuan]
            );
        }

        await connection.commit();
        res.status(200).json({ status: 'success', message: `Pengajuan di-${status_approval}.` });
    } catch (error) {
        await connection.rollback();
        res.status(error.message === 'Not Found' ? 404 : 500).json({ status: 'error', message: 'Terjadi kesalahan sistem.' });
    } finally {
        connection.release();
    }
};
// Fungsi Memuat Peringkat Anggota (Ranking)
const getRanking = async (req, res) => {
    // Tangkap filter bulan dan tahun dari query URL, default ke bulan dan tahun saat ini
    const filterBulan = req.query.bulan || new Date().getMonth() + 1;
    const filterTahun = req.query.tahun || new Date().getFullYear();

    const connection = await db.getConnection();
    try {
        // Gunakan LEFT JOIN agar anggota yang belum pernah absen tetap masuk daftar dengan durasi 0
        // Filter di dalam klausa ON memastikan kita hanya menjumlahkan data bulan & tahun yang dipilih
        const queryRanking = `
            SELECT 
                u.nama, 
                u.nim, 
                COALESCE(SUM(a.durasi_menit), 0) AS total_durasi_menit,
                COUNT(a.id) AS total_kehadiran
            FROM users u
            LEFT JOIN attendances a ON u.id = a.user_id 
                AND a.status = 'Hadir' 
                AND MONTH(a.tanggal) = ? 
                AND YEAR(a.tanggal) = ?
            WHERE u.role = 'Anggota'
            GROUP BY u.id
            ORDER BY total_durasi_menit DESC, total_kehadiran DESC
        `;

        const [ranking] = await connection.query(queryRanking, [filterBulan, filterTahun]);

        res.status(200).json({
            status: 'success',
            message: `Data peringkat anggota bulan ${filterBulan} tahun ${filterTahun} berhasil dimuat.`,
            data: ranking
        });

    } catch (error) {
        console.error('Error Ranking:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat data peringkat.' });
    } finally {
        connection.release();
    }
};

// Ekspor semua fungsi agar bisa digunakan di router
module.exports = {
    getDashboard,
    getPengajuan,
    validasiPengajuan,
    getRanking
};