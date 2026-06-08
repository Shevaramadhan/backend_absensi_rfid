const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { kirimEmail } = require('../config/mailer');
require('dotenv').config();

// ── POST /api/auth/login — Autentikasi Pengguna ──
const login = async (req, res) => {
    const { login: loginInput, password } = req.body;

    if (!loginInput || !password) {
        return res.status(400).json({ status: 'error', message: 'NIM/Email dan password wajib diisi.' });
    }

    try {
        const [[user]] = await db.query('SELECT * FROM users WHERE nim = ? OR email = ?', [loginInput, loginInput]);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'NIM/Email tidak terdaftar.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Password salah.' });
        }

        const token = jwt.sign({ id: user.id, role: user.role, nama: user.nama }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({
            status: 'success',
            message: `Login berhasil sebagai ${user.role}.`,
            data: {
                token,
                user: { id: user.id, nama: user.nama, nim: user.nim, email: user.email, role: user.role }
            }
        });
    } catch (error) {
        console.error('Error login:', error);
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
    }
};

// ── PUT /api/auth/change-password — Ganti Password ──
const changePassword = async (req, res) => {
    const userId = req.user.id;
    const { password_lama, password_baru, konfirmasi_password } = req.body;

    if (!password_lama || !password_baru || !konfirmasi_password) {
        return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi.' });
    }
    if (password_baru !== konfirmasi_password) {
        return res.status(400).json({ status: 'error', message: 'Password baru dan konfirmasi tidak cocok.' });
    }
    if (password_baru.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Password baru minimal 6 karakter.' });
    }

    try {
        const [[user]] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });

        const isMatch = await bcrypt.compare(password_lama, user.password);
        if (!isMatch) return res.status(401).json({ status: 'error', message: 'Password lama salah.' });

        const hashedPassword = await bcrypt.hash(password_baru, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        res.status(200).json({ status: 'success', message: 'Password berhasil diubah.' });
    } catch (error) {
        console.error('Error Change Password:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mengubah password.' });
    }
};

// ── POST /api/auth/forgot-password — Kirim Link Reset Password ──
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'Email wajib diisi.' });

    try {
        const [[user]] = await db.query('SELECT id, nama FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(200).json({ status: 'success', message: 'Jika email terdaftar, link reset akan dikirim.' });
        }

        await db.query('DELETE FROM password_resets WHERE user_id = ?', [user.id]);

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

        await db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, hashedToken, expiresAt]);

        // Background Task: Kirim email tanpa blokir response
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        kirimEmailResetPassword(email, user.nama, resetUrl);

        res.status(200).json({ status: 'success', message: 'Link reset password telah dikirim ke email kamu.' });
    } catch (error) {
        console.error('Error Forgot Password:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memproses lupa password.' });
    }
};

// ── POST /api/auth/reset-password — Set Password Baru via Token ──
const resetPassword = async (req, res) => {
    const { token, password_baru, konfirmasi_password } = req.body;

    if (!token || !password_baru || !konfirmasi_password) {
        return res.status(400).json({ status: 'error', message: 'Token, password baru, dan konfirmasi wajib diisi.' });
    }
    if (password_baru !== konfirmasi_password) {
        return res.status(400).json({ status: 'error', message: 'Password baru dan konfirmasi tidak cocok.' });
    }
    if (password_baru.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Password baru minimal 6 karakter.' });
    }

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const [[resetData]] = await db.query('SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()', [hashedToken]);
        if (!resetData) return res.status(400).json({ status: 'error', message: 'Token tidak valid atau sudah kedaluwarsa.' });

        const hashedPassword = await bcrypt.hash(password_baru, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetData.user_id]);
        await db.query('DELETE FROM password_resets WHERE user_id = ?', [resetData.user_id]);

        res.status(200).json({ status: 'success', message: 'Password berhasil direset. Silakan login dengan password baru.' });
    } catch (error) {
        console.error('Error Reset Password:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mereset password.' });
    }
};

// ── HELPER: Template Email Reset Password ──
const kirimEmailResetPassword = async (email, namaUser, resetUrl) => {
    const subject = 'Reset Password — Absensi Neo Telemetri';
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
            <h2 style="color: #333;">Reset Password</h2>
            <p>Halo <strong>${namaUser}</strong>,</p>
            <p>Kami menerima permintaan untuk mereset password akun kamu. Klik tombol di bawah ini:</p>
            <div style="margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 14px;">Link berlaku selama 15 menit.</p>
        </div>`;
    
    try {
        await kirimEmail(email, subject, htmlBody);
    } catch (err) {
        console.warn('[EMAIL] Gagal kirim email reset password:', err.message);
    }
};

module.exports = { login, changePassword, forgotPassword, resetPassword };