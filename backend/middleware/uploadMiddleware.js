const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

// Pastikan folder tujuan ada
const uploadDir = path.join(process.cwd(), 'public/uploads/bukti');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Gunakan memory storage agar file bisa dimanipulasi oleh sharp sebelum disimpan ke disk
const storage = multer.memoryStorage();

// Filter khusus file gambar
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Hanya diperbolehkan mengunggah file gambar (jpeg, jpg, png).'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Terima hingga 5MB untuk foto resolusi tinggi
    fileFilter: fileFilter
});

// Middleware kompresi gambar
const compressImage = async (req, res, next) => {
    if (!req.file) return next();

    try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + '.jpg'; // Paksa ekstensi ke .jpg
        const outputPath = path.join(uploadDir, filename);

        // Kompres menggunakan Sharp: Lebar max 800px, kualitas 60% (target size ~100kb)
        await sharp(req.file.buffer)
            .resize({ width: 800, withoutEnlargement: true })
            .jpeg({ quality: 60 })
            .toFile(outputPath);

        // Timpa req.file agar controller mengira ini file biasa yang berasal dari diskStorage
        req.file.filename = filename;
        req.file.path = outputPath;
        
        next();
    } catch (error) {
        console.error('Error Kompresi Gambar:', error);
        res.status(500).json({ status: 'error', message: 'Gagal memproses dan menyimpan gambar.' });
    }
};

module.exports = { upload, compressImage };