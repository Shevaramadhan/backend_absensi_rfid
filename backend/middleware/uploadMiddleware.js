const multer = require('multer');
const path = require('path');

// Atur penyimpanan file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/bukti'); // Pastikan folder ini sudah dibuat
    },
    filename: function (req, file, cb) {
        // Format nama file: timestamp-namaAsli.jpg
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

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
    limits: { fileSize: 2 * 1024 * 1024 }, // Maksimal ukuran 2MB
    fileFilter: fileFilter
});

module.exports = upload;