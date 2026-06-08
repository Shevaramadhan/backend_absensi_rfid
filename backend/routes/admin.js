const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('../middleware/authMiddleware');

// Import semua controller yang sudah dipisah
const dashboardController = require('../controllers/adminDashboardController');
const anggotaController = require('../controllers/adminAnggotaController');
const laporanController = require('../controllers/adminLaporanController');
const authController = require('../controllers/authControllers');
const systemController = require('../controllers/systemController');
const sheetsController = require('../controllers/adminSheetsController');
const exportController = require('../controllers/exportController');


/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Manajemen sistem oleh Administrator (Wajib Token)
 */

// Middleware untuk semua route admin
router.use(verifyAdmin);

// ==========================================
// MENU: DASHBOARD
// ==========================================
/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Memuat data dashboard (Statistik, Tabel, Grafik)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [harian, mingguan, bulanan]
 *           default: harian
 *         description: Filter tampilan grafik kehadiran
 *     responses:
 *       200:
 *         description: Data dashboard berhasil dimuat
 */
router.get('/dashboard', dashboardController.getDashboard);

// ==========================================
// MENU: MANAJEMEN ANGGOTA
// ==========================================
/**
 * @swagger
 * /api/admin/anggota:
 *   get:
 *     summary: Melihat daftar seluruh anggota
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar anggota berhasil dimuat
 *
 *   post:
 *     summary: Menambahkan anggota baru beserta jadwal piket
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama:
 *                 type: string
 *                 example: Budi Santoso
 *               nim:
 *                 type: string
 *                 example: 210511002
 *               email:
 *                 type: string
 *                 example: budi@email.com
 *               id_rfid:
 *                 type: string
 *                 example: RFID-002
 *               jadwal_piket:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     hari:
 *                       type: string
 *                       example: Senin
 *                     shift_id:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       201:
 *         description: Anggota berhasil ditambahkan
 */
router.get('/anggota', anggotaController.getAnggota);
router.post('/anggota', anggotaController.tambahAnggota);

/**
 * @swagger
 * /api/admin/anggota/{id}:
 *   get:
 *     summary: Mengambil detail 1 anggota beserta jadwal piket (untuk form Edit)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID Anggota
 *     responses:
 *       200:
 *         description: Detail anggota berhasil dimuat
 *       404:
 *         description: Anggota tidak ditemukan
 */
router.get('/anggota/:id', anggotaController.getAnggotaById);

/**
 * @swagger
 * /api/admin/anggota/{id}:
 *   put:
 *     summary: Mengedit data anggota
 *     description: Endpoint untuk mengedit data anggota beserta jadwal piket
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID Anggota
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama:
 *                 type: string
 *                 example: "Andi Pratama Update"
 *               nim:
 *                 type: string
 *                 example: "210511002"
 *               email:
 *                 type: string
 *                 example: "andi@email.com"
 *               id_rfid:
 *                 type: string
 *                 example: "RFID-002"
 *               jadwal_piket:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     hari:
 *                       type: string
 *                       example: "Senin"
 *                     shift_id:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       200:
 *         description: Data anggota berhasil diperbarui
 *       400:
 *         description: Data tidak valid
 *       404:
 *         description: Anggota tidak ditemukan
 *       500:
 *         description: Server error
 */
router.put('/anggota/:id', anggotaController.editAnggota);
router.delete('/anggota/:id', anggotaController.hapusAnggota);

// ==========================================
// MENU: LAPORAN
// ==========================================
/**
 * @swagger
 * /api/admin/laporan:
 *   get:
 *     summary: Memuat laporan rekapan absensi
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         schema:
 *           type: integer
 *         description: Filter bulan (1-12)
 *       - in: query
 *         name: tahun
 *         schema:
 *           type: integer
 *         description: Filter tahun (contoh 2026)
 *     responses:
 *       200:
 *         description: Laporan berhasil dimuat
 */
router.get('/laporan', laporanController.getLaporan);

// ==========================================
// MENU: RANKING
// ==========================================
/**
 * @swagger
 * /api/admin/ranking:
 *   get:
 *     summary: Memuat peringkat anggota berdasarkan durasi piket
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         schema:
 *           type: integer
 *         description: Filter bulan (1-12). Diabaikan jika semester diisi
 *       - in: query
 *         name: tahun
 *         schema:
 *           type: integer
 *         description: Tahun filter (default tahun ini)
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: [ganjil, genap]
 *         description: "Filter per semester: ganjil (Ags-Des) atau genap (Jan-Jun)"
 *     responses:
 *       200:
 *         description: Data peringkat berhasil dimuat
 */
router.get('/ranking', dashboardController.getRanking);

// ==========================================
// MENU: PENGAJUAN
// ==========================================
/**
 * @swagger
 * /api/admin/pengajuan:
 *   get:
 *     summary: Melihat daftar pengajuan izin/jadwal yang berstatus Pending
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data pengajuan berhasil dimuat
 */
router.get('/pengajuan', dashboardController.getPengajuan);
/**
 * @swagger
 * /api/admin/pengajuan/{id}/validasi:
 *   put:
 *     summary: Memvalidasi pengajuan (Setuju/Tolak)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status_approval:
 *                 type: string
 *                 enum: [Approved, Rejected]
 *     responses:
 *       200:
 *         description: Pengajuan berhasil divalidasi
 */
router.put('/pengajuan/:id/validasi', dashboardController.validasiPengajuan);

// ==========================================
// MENU: GANTI PASSWORD
// ==========================================
/**
 * @swagger
 * /api/admin/change-password:
 *   put:
 *     summary: Ganti password admin (wajib login)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password_lama:
 *                 type: string
 *               password_baru:
 *                 type: string
 *               konfirmasi_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       401:
 *         description: Password lama salah
 */
router.put('/change-password', authController.changePassword);

// ==========================================
// MENU: SISTEM & HARI LIBUR
// ==========================================
/**
 * @swagger
 * /api/admin/system/status:
 *   get:
 *     summary: Cek status sistem (maintenance mode)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status sistem berhasil dimuat
 */
router.get('/system/status', systemController.getSystemStatus);

/**
 * @swagger
 * /api/admin/system/maintenance:
 *   put:
 *     summary: Toggle maintenance mode (matikan/aktifkan sistem)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               aktif:
 *                 type: boolean
 *                 example: true
 *                 description: true = matikan sistem, false = aktifkan
 *               pesan:
 *                 type: string
 *                 example: "Sistem sedang maintenance"
 *                 description: Pesan maintenance (opsional)
 *     responses:
 *       200:
 *         description: Status maintenance berhasil diubah
 */
router.put('/system/maintenance', systemController.toggleMaintenance);

/**
 * @swagger
 * /api/admin/holidays:
 *   get:
 *     summary: Melihat daftar hari libur
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data hari libur berhasil dimuat
 */
router.get('/holidays', systemController.getHolidays);

/**
 * @swagger
 * /api/admin/holidays:
 *   post:
 *     summary: Tambah hari libur baru
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tanggal:
 *                 type: string
 *                 format: date
 *                 example: "2026-06-01"
 *               keterangan:
 *                 type: string
 *                 example: "Hari Lahir Pancasila"
 *     responses:
 *       201:
 *         description: Hari libur berhasil ditambahkan
 *       409:
 *         description: Tanggal sudah terdaftar
 */
router.post('/holidays', systemController.tambahHoliday);

/**
 * @swagger
 * /api/admin/holidays/{id}:
 *   delete:
 *     summary: Hapus hari libur
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Hari libur berhasil dihapus
 *       404:
 *         description: Hari libur tidak ditemukan
 */
router.delete('/holidays/:id', systemController.hapusHoliday);

// ==========================================
// MENU: GOOGLE SPREADSHEET
// ==========================================
/**
 * @swagger
 * /api/admin/sheets/status:
 *   get:
 *     summary: Cek status koneksi ke Google Spreadsheet
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status koneksi Sheets
 */
router.get('/sheets/status', sheetsController.getStatusSheets);

/**
 * @swagger
 * /api/admin/sheets/sync:
 *   post:
 *     summary: Sync data rekap absensi ke Google Spreadsheet (per bulan)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bulan
 *         schema:
 *           type: integer
 *         description: Bulan yang akan di-sync (1-12). Default bulan ini.
 *       - in: query
 *         name: tahun
 *         schema:
 *           type: integer
 *         description: Tahun yang akan di-sync. Default tahun ini.
 *     responses:
 *       200:
 *         description: Data berhasil disinkronkan ke Spreadsheet
 *       503:
 *         description: Google Sheets belum dikonfigurasi
 */
router.post('/sheets/sync', sheetsController.syncAbsensiKeSheets);

// ==========================================
// MENU: EXPORT LAPORAN
// ==========================================
/**
 * @swagger
 * /api/admin/laporan/export:
 *   get:
 *     summary: Export laporan absensi ke PDF atau Excel
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [excel, pdf]
 *         description: Format export (default excel)
 *       - in: query
 *         name: dari_tanggal
 *         schema:
 *           type: string
 *         description: Tanggal mulai (YYYY-MM-DD) — gunakan ini ATAU bulan+tahun
 *       - in: query
 *         name: sampai_tanggal
 *         schema:
 *           type: string
 *         description: Tanggal selesai (YYYY-MM-DD)
 *       - in: query
 *         name: bulan
 *         schema:
 *           type: integer
 *         description: Bulan (1-12), alternatif dari range tanggal
 *       - in: query
 *         name: tahun
 *         schema:
 *           type: integer
 *         description: Tahun (misal 2026)
 *     responses:
 *       200:
 *         description: File berhasil di-download
 *       500:
 *         description: Gagal export
 */
router.get('/laporan/export', exportController.exportLaporanAdmin);

module.exports = router;