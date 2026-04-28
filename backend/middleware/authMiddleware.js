const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyAdmin = (req, res, next) => {
    // 1. Ambil token dari header 'Authorization'
    const authHeader = req.headers.authorization;

    // Pastikan header ada dan menggunakan format 'Bearer <token>'
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            status: 'error', 
            message: 'Akses ditolak. Token tidak ditemukan atau format salah.' 
        });
    }

    // Pisahkan kata 'Bearer' dan ambil tokennya 
    const token = authHeader.split(' ')[1];

    try {
        // 2. Verifikasi token menggunakan Secret Key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Cek apakah role pengguna di dalam token adalah Admin
        if (decoded.role !== 'Admin') {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Akses ditolak. Anda bukan Admin.' 
            });
        }

        // 4. Simpan data hasil decode (id, role, nama) ke object request (req)
        // Agar bisa digunakan oleh endpoint tujuan jika diperlukan
        req.user = decoded;

        // 5. Lanjut ke fungsi endpoint tujuan
        next();

    } catch (error) {
        // Jika token kedaluwarsa atau diubah secara ilegal, akan masuk ke sini
        return res.status(401).json({ 
            status: 'error', 
            message: 'Token tidak valid atau sudah kedaluwarsa.' 
        });
    }
};

module.exports = { verifyAdmin };