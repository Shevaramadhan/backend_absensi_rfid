// routes/shifts.js
// Route publik (tanpa auth) — dibutuhkan oleh form Admin & Anggota untuk isi dropdown shift
const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * @swagger
 * /api/shifts:
 *   get:
 *     summary: Mengambil daftar semua shift (public, tanpa autentikasi)
 *     tags: [Shifts]
 *     responses:
 *       200:
 *         description: Daftar shift berhasil dimuat
 */
router.get('/', async (req, res) => {
    try {
        const [shifts] = await db.query(
            'SELECT id, nama_shift, jam_mulai, jam_selesai FROM shifts ORDER BY jam_mulai ASC'
        );
        res.status(200).json({ status: 'success', data: shifts });
    } catch (error) {
        console.error('Error Get Shifts:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memuat data shift.' });
    }
});

module.exports = router;
