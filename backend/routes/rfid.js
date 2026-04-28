const express = require('express');
const router = express.Router();
const rfidController = require('../controllers/rfidController');

// Route POST /api/rfid/tap
/**
 * @swagger
 * /api/rfid/tap:
 *   post:
 *     summary: Melakukan Tap Masuk atau Tap Keluar menggunakan kartu RFID
 *     tags: [RFID Hardware]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rfid_tag:
 *                 type: string
 *                 example: "RFID-002"
 *     responses:
 *       200:
 *         description: Tap berhasil (Masuk/Keluar)
 *       400:
 *         description: Durasi piket belum mencapai 60 menit atau sudah absen
 *       404:
 *         description: Kartu RFID tidak terdaftar
 */
router.post('/tap', rfidController.tapKartu);

module.exports = router;