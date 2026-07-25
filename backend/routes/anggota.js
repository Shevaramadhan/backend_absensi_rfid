const express = require('express');
const router = express.Router();
const { verifyAnggota } = require('../middleware/anggotaAuthMiddleware');
const dashboardController = require('../controllers/anggotaDashboardController');
const { upload, compressImage } = require('../middleware/uploadMiddleware');
const PengajuanController = require('../controllers/anggotaPengajuanController');
const authController = require('../controllers/authControllers');
const exportController = require('../controllers/exportController');
const jadwalController = require('../controllers/adminJadwalController');

/**
 * @swagger
 * tags:
 *   name: Anggota
 *   description: Fitur khusus untuk role Anggota (Wajib Token Anggota)
 */
// Terapkan middleware khusus anggota
router.use(verifyAnggota);

// Endpoint: GET /api/anggota/dashboard
/**
 * @swagger
 * /api/anggota/dashboard:
 *   get:
 *     summary: Memuat data dashboard pribadi anggota (Statistik, Riwayat & Ranking)
 *     tags: [Anggota]
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
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: [ganjil, genap]
 *         description: "Filter ranking per semester: ganjil (Ags-Des) atau genap (Jan-Jun)"
 *     responses:
 *       200:
 *         description: Dashboard anggota berhasil dimuat (termasuk ranking)
 */
router.get('/dashboard', dashboardController.getDashboardAnggota);

// Rute Buat Pengajuan (upload.single('bukti_foto')

/**
 * @swagger
 * /api/anggota/pengajuan:
 *   post:
 *     summary: Membuat pengajuan Izin atau Ganti Jadwal (Mendukung Upload Foto)
 *     tags: [Anggota]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               tipe_pengajuan:
 *                 type: string
 *                 enum: [Izin, Ganti Jadwal]
 *               tanggal_pengajuan:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-15"
 *               alasan:
 *                 type: string
 *                 example: "Sakit demam"
 *               shift_id:
 *                 type: integer
 *                 description: ID shift pengganti (isi jika Ganti Jadwal)
 *               bukti_foto:
 *                 type: string
 *                 format: binary
 *                 description: Upload file gambar (JPG/PNG) sebagai bukti
 *     responses:
 *       201:
 *         description: Pengajuan berhasil dikirim
 *       400:
 *         description: Input tidak lengkap atau tidak ada foto bukti
 */ 
router.post('/pengajuan', upload.single('bukti_foto'), compressImage, PengajuanController.buatPengajuan);

// Endpoint: GET /api/anggota/pengajuan
/**
 * @swagger
 * /api/anggota/pengajuan:
 *   get:
 *     summary: Mengambil daftar pengajuan Izin/Ganti Jadwal milik sendiri
 *     tags: [Anggota]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar pengajuan berhasil dimuat
 *       500:
 *         description: Terjadi kesalahan pada server
 */
router.get('/pengajuan', PengajuanController.getPengajuanAnggota);
// MENU: GANTI PASSWORD ANGGOTA
// ==========================================
/**
 * @swagger
 * /api/anggota/change-password:
 *   put:
 *     summary: Ganti password anggota (wajib login)
 *     tags: [Anggota]
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
// MENU: MELIHAT JADWAL PIKET (GRID)
// ==========================================
/**
 * @swagger
 * /api/anggota/jadwal:
 *   get:
 *     summary: Melihat seluruh matriks jadwal piket (untuk mencari pengganti)
 *     tags: [Anggota]
 *     security:
 *       - bearerAuth: []
 */
router.get('/jadwal', jadwalController.getSemuaJadwal);


// ==========================================
// MENU: UPLOAD BUKTI HADIR
// ==========================================
/**
 * @swagger
 * /api/anggota/attendance/{id}/bukti:
 *   post:
 *     summary: Upload foto bukti hadir untuk kehadiran tertentu
 *     tags: [Anggota]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID attendance
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               bukti_foto:
 *                 type: string
 *                 format: binary
 *                 description: File foto bukti kehadiran (JPG/PNG, maks 2MB)
 *     responses:
 *       200:
 *         description: Bukti hadir berhasil diunggah
 *       400:
 *         description: File tidak diunggah atau status tidak valid
 *       404:
 *         description: Data kehadiran tidak ditemukan
 */
router.post('/attendance/:id/bukti', upload.single('bukti_foto'), compressImage, dashboardController.uploadBuktiHadir);

/**
 * @swagger
 * /api/anggota/laporan/export:
 *   get:
 *     summary: Export rekap kehadiran pribadi ke PDF atau Excel
 *     tags: [Anggota]
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
 *         name: bulan
 *         schema:
 *           type: integer
 *         description: Bulan (1-12, default bulan ini)
 *       - in: query
 *         name: tahun
 *         schema:
 *           type: integer
 *         description: Tahun (default tahun ini)
 *     responses:
 *       200:
 *         description: File rekap berhasil di-download
 */
router.get('/laporan/export', exportController.exportLaporanAnggota);

module.exports = router;