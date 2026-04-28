const express = require('express');
const router = express.Router();
const authController = require('../controllers/authControllers');

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Autentikasi dan Login Sistem
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login untuk mendapatkan token akses (Khusus Admin)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nim:
 *                 type: string
 *                 example: admin
 *                 description: NIM atau Username Admin
 *               password:
 *                 type: string
 *                 example: admin123
 *                 description: Password Admin
 *     responses:
 *       200:
 *         description: Login berhasil, mengembalikan token JWT
 *       400:
 *         description: NIM dan password wajib diisi
 *       401:
 *         description: Password salah atau akun tidak ditemukan
 */
router.post('/login', authController.login);

module.exports = router;