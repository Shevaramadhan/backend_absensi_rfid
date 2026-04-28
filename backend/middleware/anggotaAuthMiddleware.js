const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyAnggota = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Token tidak ditemukan atau format salah.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Cek apakah role adalah Anggota
        if (decoded.role !== 'Anggota') {
            return res.status(403).json({ status: 'error', message: 'Akses ditolak. Endpoint ini khusus Anggota.' });
        }

        // Simpan data user (termasuk ID) ke request untuk dipakai di controller
        req.user = decoded;
        next();

    } catch (error) {
        return res.status(401).json({ status: 'error', message: 'Token tidak valid atau kedaluwarsa.' });
    }
};

module.exports = { verifyAnggota };