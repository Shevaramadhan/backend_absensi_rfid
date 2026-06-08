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
 *     summary: Login untuk mendapatkan token akses (Admin atau Anggota)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               login:
 *                 type: string
 *                 example: admin
 *                 description: NIM atau Email pengguna
 *               password:
 *                 type: string
 *                 example: admin123
 *                 description: Password pengguna
 *     responses:
 *       200:
 *         description: Login berhasil, mengembalikan token JWT
 *       400:
 *         description: NIM/Email dan password wajib diisi
 *       401:
 *         description: Password salah atau akun tidak ditemukan
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Kirim link reset password ke email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: budi@email.com
 *                 description: Email yang terdaftar
 *     responses:
 *       200:
 *         description: Link reset dikirim ke email (jika terdaftar)
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password menggunakan token dari email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token reset dari link email
 *               password_baru:
 *                 type: string
 *                 example: password123
 *               konfirmasi_password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Password berhasil direset
 *       400:
 *         description: Token tidak valid atau sudah expired
 */
router.post('/reset-password', authController.resetPassword);

module.exports = router;