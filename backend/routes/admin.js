const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('../middleware/authMiddleware');

// Import semua controller yang sudah dipisah
const dashboardController = require('../controllers/adminDashboardController');
const anggotaController = require('../controllers/adminAnggotaController');
const laporanController = require('../controllers/adminLaporanController');


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
 *           enum: [harian, bulanan, tahunan]
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
 *               id_rfid:
 *                 type: string
 *                 example: RFID-002
 *               divisi:
 *                 type: string
 *                 example: Programming
 *               sub_divisi:
 *                 type: string
 *                 example: Web
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
 *       - in: query
 *         name: tahun
 *         schema:
 *           type: integer
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

module.exports = router;