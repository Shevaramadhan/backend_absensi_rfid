const db = require('../config/database');

// Helper: tentukan range bulan berdasarkan semester
const getSemesterRange = (semester) => {
    if (semester === 'ganjil') return { bulanAwal: 8, bulanAkhir: 12, label: 'Ganjil (Ags-Des)' };
    if (semester === 'genap') return { bulanAwal: 1, bulanAkhir: 6, label: 'Genap (Jan-Jun)' };
    return null;
};

const getDashboardAnggota = async (req, res) => {
    // Ambil ID user dari token JWT yang sudah di-decode oleh middleware
    const userId = req.user.id;
    const filterBulan = req.query.bulan || new Date().getMonth() + 1;
    const filterTahun = req.query.tahun || new Date().getFullYear();
    const filterSemester = req.query.semester || null; // 'ganjil' | 'genap' | null

    // Tentukan filter ranking: semester atau bulanan
    let rankingFilter = '';
    let rankingParams = [];
    let rankingLabel = '';

    if (filterSemester) {
        const sem = getSemesterRange(filterSemester);
        if (sem) {
            rankingFilter = 'AND MONTH(a.tanggal) BETWEEN ? AND ? AND YEAR(a.tanggal) = ?';
            rankingParams = [sem.bulanAwal, sem.bulanAkhir, filterTahun];
            rankingLabel = `Semester ${sem.label} ${filterTahun}`;
        }
    }
    
    if (!rankingLabel) {
        rankingFilter = 'AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?';
        rankingParams = [filterBulan, filterTahun];
        rankingLabel = `Bulan ${filterBulan} Tahun ${filterTahun}`;
    }

    const connection = await db.getConnection();
    try {
        const [hasilStats, hasilRiwayat, hasilRanking] = await Promise.all([
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
                    a.status,
                    a.bukti_foto
                FROM attendances a
                JOIN shifts sh ON a.shift_id = sh.id
                WHERE a.user_id = ? AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
                ORDER BY a.tanggal DESC
            `, [userId, filterBulan, filterTahun]),

            // 3. Query Ranking (dinamis: per-bulan atau per-semester)
            connection.query(`
                SELECT 
                    u.id,
                    u.nama, 
                    u.nim, 
                    COALESCE(SUM(a.durasi_menit), 0) AS total_durasi_menit,
                    COUNT(a.id) AS total_kehadiran
                FROM users u
                LEFT JOIN attendances a ON u.id = a.user_id 
                    AND a.status = 'Hadir' 
                    ${rankingFilter}
                WHERE u.role = 'Anggota'
                GROUP BY u.id
                ORDER BY total_durasi_menit DESC, total_kehadiran DESC
            `, rankingParams)
        ]);

        // Proses ranking: cari posisi user dan ambil top 10
        const semuaRanking = hasilRanking[0];
        const posisiUser = semuaRanking.findIndex(r => r.id === userId) + 1;
        const top10 = semuaRanking.slice(0, 10).map((r, index) => ({
            peringkat: index + 1,
            nama: r.nama,
            nim: r.nim,
            total_durasi_menit: r.total_durasi_menit,
            total_kehadiran: r.total_kehadiran,
            is_me: r.id === userId // Tandai apakah ini user yang sedang login
        }));

        res.status(200).json({
            status: 'success',
            message: 'Dashboard anggota berhasil dimuat.',
            data: {
                statistik: hasilStats[0][0],
                riwayat_kehadiran: hasilRiwayat[0],
                ranking: {
                    filter: rankingLabel,
                    posisi_saya: posisiUser || null,
                    total_anggota: semuaRanking.length,
                    top_10: top10
                }
            }
        });

    } catch (error) {
        console.error('Error Dashboard Anggota:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat dashboard pribadi.' });
    } finally {
        connection.release();
    }
};

// ==========================================
// UPLOAD BUKTI HADIR
// ==========================================
const uploadBuktiHadir = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params; // ID attendance
    const bukti_foto = req.file ? req.file.filename : null;

    if (!bukti_foto) {
        return res.status(400).json({ status: 'error', message: 'File foto bukti wajib diunggah.' });
    }

    try {
        // Pastikan attendance milik user yang login dan statusnya Hadir/Sedang Piket
        const [attendance] = await db.query(
            `SELECT id, status, bukti_foto FROM attendances 
             WHERE id = ? AND user_id = ?`,
            [id, userId]
        );

        if (attendance.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Data kehadiran tidak ditemukan.' });
        }

        if (!['Hadir', 'Sedang Piket'].includes(attendance[0].status)) {
            return res.status(400).json({ status: 'error', message: 'Bukti hanya bisa diunggah untuk status Hadir atau Sedang Piket.' });
        }

        // Update bukti foto
        await db.query(
            'UPDATE attendances SET bukti_foto = ? WHERE id = ?',
            [bukti_foto, id]
        );

        res.status(200).json({ 
            status: 'success', 
            message: 'Bukti hadir berhasil diunggah.',
            data: { bukti_foto } 
        });

    } catch (error) {
        console.error('Error Upload Bukti Hadir:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mengunggah bukti hadir.' });
    }
};

module.exports = { getDashboardAnggota, uploadBuktiHadir };