const bcrypt = require('bcrypt');
const db = require('../config/database');
const { kirimEmail } = require('../config/mailer');

// ── GET /api/admin/dashboard — Menampilkan Statistik Dashboard ──
const getDashboard = async (req, res) => {
    const filterGrafik = req.query.filter || 'harian';
    const hariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
    const isHariKerja = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].includes(hariIni);

    let queryGrafik = '';
    if (filterGrafik === 'harian') {
        queryGrafik = `SELECT DATE_FORMAT(tanggal, '%d %b') AS label, COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir FROM attendances WHERE MONTH(tanggal) = MONTH(CURDATE()) AND YEAR(tanggal) = YEAR(CURDATE()) GROUP BY tanggal, DATE_FORMAT(tanggal, '%d %b') ORDER BY tanggal ASC`;
    } else if (filterGrafik === 'mingguan') {
        queryGrafik = `SELECT CONCAT('Minggu ', WEEK(tanggal, 1) - WEEK(DATE_SUB(CURDATE(), INTERVAL DAYOFMONTH(CURDATE())-1 DAY), 1) + 1) AS label, COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir FROM attendances WHERE MONTH(tanggal) = MONTH(CURDATE()) AND YEAR(tanggal) = YEAR(CURDATE()) GROUP BY WEEK(tanggal, 1) ORDER BY WEEK(tanggal, 1) ASC`;
    } else {
        queryGrafik = `SELECT MONTHNAME(tanggal) AS label, COUNT(IF(status = 'Hadir', 1, NULL)) AS total_hadir FROM attendances WHERE YEAR(tanggal) = YEAR(CURDATE()) GROUP BY MONTH(tanggal), MONTHNAME(tanggal) ORDER BY MONTH(tanggal) ASC`;
    }

    try {
        const [[hasilGrafik], [[totalSemua]]] = await Promise.all([
            db.query(queryGrafik),
            db.query("SELECT COUNT(*) AS total_hadir_semua FROM attendances WHERE status = 'Hadir'")
        ]);

        let dataTotal = { total_hadir_semua: totalSemua.total_hadir_semua, hadir_hari_ini: 0, sedang_piket: 0, belum_atau_tidak_hadir: 0 };
        let tabelRingkasan = [];

        if (isHariKerja) {
            const [[[stats]], [tabel]] = await Promise.all([
                db.query(`SELECT COUNT(IF(a.status = 'Hadir', 1, NULL)) AS hadir_hari_ini, COUNT(IF(a.status = 'Sedang Piket', 1, NULL)) AS sedang_piket, COUNT(IF(a.id IS NULL OR a.status = 'Tidak Hadir', 1, NULL)) AS belum_atau_tidak_hadir FROM schedules s LEFT JOIN attendances a ON s.user_id = a.user_id AND a.tanggal = CURDATE() WHERE s.hari_piket = ?`, [hariIni]),
                db.query(`SELECT u.nim, u.nama, sh.nama_shift, sh.jam_mulai, sh.jam_selesai, COALESCE(a.status, 'Belum Hadir') AS status_kehadiran, a.waktu_masuk, a.waktu_keluar, a.durasi_menit, a.tanggal FROM schedules s JOIN users u ON s.user_id = u.id JOIN shifts sh ON s.shift_id = sh.id LEFT JOIN attendances a ON s.user_id = a.user_id AND a.tanggal = CURDATE() WHERE s.hari_piket = ? ORDER BY sh.jam_mulai ASC`, [hariIni])
            ]);
            dataTotal = { ...dataTotal, ...stats };
            tabelRingkasan = tabel;
        }

        res.status(200).json({
            status: 'success',
            message: isHariKerja ? 'Data dashboard berhasil dimuat.' : 'Hari ini libur piket (Akhir Pekan).',
            data: { data_total: dataTotal, tabel_ringkasan: tabelRingkasan, grafik_kehadiran: hasilGrafik }
        });
    } catch (error) {
        console.error('Error Dashboard:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat dashboard.' });
    }
};

// ── GET /api/admin/pengajuan — Ambil Daftar Pengajuan ──
const getPengajuan = async (req, res) => {
    const statusFilter = req.query.status || 'Semua';
    const searchParam = `%${req.query.search || ''}%`;
    const whereStatus = statusFilter !== 'Semua' ? 'AND p.status_approval = ?' : '';
    const params = statusFilter !== 'Semua' ? [searchParam, searchParam, statusFilter] : [searchParam, searchParam];

    try {
        const [pengajuan] = await db.query(
            `SELECT p.*, u.nama, u.nim, s.nama_shift AS shift_tujuan, sa.nama_shift AS shift_asal
             FROM permissions p JOIN users u ON p.user_id = u.id LEFT JOIN shifts s ON p.shift_id = s.id LEFT JOIN shifts sa ON p.shift_awal_id = sa.id
             WHERE (u.nama LIKE ? OR u.nim LIKE ?) ${whereStatus} ORDER BY p.id DESC`, params
        );
        res.status(200).json({ status: 'success', filter: statusFilter, total: pengajuan.length, data: pengajuan });
    } catch (error) {
        console.error('Error Get Pengajuan:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mengambil data pengajuan.' });
    }
};

// ── PUT /api/admin/pengajuan/:id/validasi — Validasi Approve/Reject ──
const validasiPengajuan = async (req, res) => {
    const { status_approval } = req.body;
    if (!['Approved', 'Rejected'].includes(status_approval)) return res.status(400).json({ status: 'error', message: 'Status tidak valid.' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[pengajuan]] = await connection.query('SELECT * FROM permissions WHERE id = ?', [req.params.id]);
        if (!pengajuan) throw new Error('Not Found');
        
        await connection.query('UPDATE permissions SET status_approval = ? WHERE id = ?', [status_approval, req.params.id]);
        
        if (status_approval === 'Approved') {
            if (pengajuan.tipe_pengajuan === 'Izin') {
                await connection.query(`INSERT INTO attendances (user_id, shift_id, tanggal, status) VALUES (?, ?, ?, 'Izin') ON DUPLICATE KEY UPDATE status = 'Izin'`, [pengajuan.user_id, pengajuan.shift_id || 1, pengajuan.tanggal_pengajuan]);
            } else if (pengajuan.tipe_pengajuan === 'Ganti Jadwal' && pengajuan.shift_awal_id && pengajuan.tanggal_pengganti && pengajuan.shift_id) {
                await connection.query(
                    `INSERT INTO schedule_swaps (permission_id, user_id, tanggal_absen_asli, shift_awal_id, tanggal_pengganti, shift_tujuan_id, status) VALUES (?, ?, ?, ?, ?, ?, 'Belum Dilaksanakan')`, 
                    [req.params.id, pengajuan.user_id, pengajuan.tanggal_pengajuan, pengajuan.shift_awal_id, pengajuan.tanggal_pengganti, pengajuan.shift_id]
                );
            }
        }

        await connection.commit();

        const [[anggota]] = await connection.query('SELECT nama, email FROM users WHERE id = ?', [pengajuan.user_id]);
        if (anggota?.email) kirimEmailValidasi(anggota.email, anggota.nama, pengajuan, status_approval);

        res.status(200).json({ status: 'success', message: `Pengajuan di-${status_approval}.` });
    } catch (error) {
        await connection.rollback();
        res.status(error.message === 'Not Found' ? 404 : 500).json({ status: 'error', message: 'Terjadi kesalahan sistem.' });
    } finally {
        connection.release();
    }
};

// ── GET /api/admin/ranking — Muat Peringkat Anggota ──
const getRanking = async (req, res) => {
    const filterBulan = req.query.bulan || new Date().getMonth() + 1;
    const filterTahun = req.query.tahun || new Date().getFullYear();
    const filterSemester = req.query.semester || null;

    let rankingFilter = 'AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?';
    let rankingParams = [filterBulan, filterTahun];
    let rankingLabel = `Bulan ${filterBulan} Tahun ${filterTahun}`;

    if (filterSemester === 'ganjil') {
        rankingFilter = 'AND MONTH(a.tanggal) BETWEEN 8 AND 12 AND YEAR(a.tanggal) = ?';
        rankingParams = [filterTahun];
        rankingLabel = `Semester Ganjil (Ags-Des) ${filterTahun}`;
    } else if (filterSemester === 'genap') {
        rankingFilter = 'AND MONTH(a.tanggal) BETWEEN 1 AND 6 AND YEAR(a.tanggal) = ?';
        rankingParams = [filterTahun];
        rankingLabel = `Semester Genap (Jan-Jun) ${filterTahun}`;
    }

    try {
        const [ranking] = await db.query(`
            SELECT u.nama, u.nim, u.rfid_tag, COALESCE(SUM(a.durasi_menit), 0) AS total_durasi_menit, COUNT(a.id) AS total_kehadiran
            FROM users u LEFT JOIN attendances a ON u.id = a.user_id AND a.status = 'Hadir' ${rankingFilter}
            WHERE u.role = 'Anggota' GROUP BY u.id ORDER BY total_durasi_menit DESC, total_kehadiran DESC
        `, rankingParams);

        res.status(200).json({ status: 'success', message: `Data peringkat anggota ${rankingLabel} berhasil dimuat.`, filter: rankingLabel, data: ranking });
    } catch (error) {
        console.error('Error Ranking:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat data peringkat.' });
    }
};

// ── HELPER: Template Email Validasi Pengajuan ──
const kirimEmailValidasi = async (email, nama, pengajuan, status_approval) => {
    const statusLabel = status_approval === 'Approved' ? '✅ Disetujui' : '❌ Ditolak';
    const statusColor = status_approval === 'Approved' ? '#27ae60' : '#e74c3c';
    
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
            <h2 style="color: #333;">Hasil Validasi Pengajuan</h2>
            <p>Halo <strong>${nama}</strong>,</p>
            <p>Pengajuan <strong>${pengajuan.tipe_pengajuan}</strong> kamu telah divalidasi oleh Admin.</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
                <p><strong>Tipe:</strong> ${pengajuan.tipe_pengajuan}</p>
                <p><strong>Tanggal:</strong> ${pengajuan.tanggal_pengajuan}</p>
                <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusLabel}</span></p>
            </div>
        </div>`;
    
    try {
        await kirimEmail(email, `Pengajuan ${pengajuan.tipe_pengajuan} Kamu: ${status_approval}`, htmlBody);
    } catch (err) {
        console.warn('[EMAIL] Gagal kirim notif validasi:', err.message);
    }
};

module.exports = { getDashboard, getPengajuan, validasiPengajuan, getRanking };