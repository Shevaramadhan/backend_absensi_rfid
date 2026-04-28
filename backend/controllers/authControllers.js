// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
require('dotenv').config();

const login = async (req, res) => {
    const { nim, password } = req.body;

    if (!nim || !password) {
        return res.status(400).json({ status: 'error', message: 'NIM dan password wajib diisi.' });
    }

    try {
        // Query disesuaikan agar bisa mencari semua role (Admin maupun Anggota)
        const [users] = await db.query('SELECT * FROM users WHERE nim = ?', [nim]);
        
        if (users.length === 0) {
            return res.status(401).json({ status: 'error', message: 'NIM tidak terdaftar.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Password salah.' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, nama: user.nama },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            status: 'success',
            message: `Login berhasil sebagai ${user.role}.`,
            data: {
                token: token,
                user: { id: user.id, nama: user.nama, nim: user.nim, role: user.role }
            }
        });

    } catch (error) {
        console.error('Error login:', error);
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
    }
};

module.exports = { login };