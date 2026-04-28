const express = require('express');
const router = express.Router();
const { verifyAnggota } = require('../middleware/anggotaAuthMiddleware');
const dashboardController = require('../controllers/anggotaDashboardController');
const upload = require('../middleware/uploadMiddleware');
const PengajuanController = require('../controllers/anggotaPengajuanController');

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
 *     summary: Memuat data dashboard pribadi anggota (Statistik & Riwayat)
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
 *     responses:
 *       200:
 *         description: Dashboard anggota berhasil dimuat
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
router.post('/pengajuan', upload.single('bukti_foto'), PengajuanController.buatPengajuan);

module.exports = router;