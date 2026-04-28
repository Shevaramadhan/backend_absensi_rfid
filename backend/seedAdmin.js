const bcrypt = require('bcrypt');
const db = require('./config/database');

const buatAdmin = async () => {
    try {
        // Enkripsi password 'admin123'
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Masukkan ke database
        const [result] = await db.query(
            `INSERT INTO users (nama, nim, rfid_tag, role, password) 
             VALUES (?, ?, ?, ?, ?)`,
            ['Administrator', 'admin', 'RFID-ADMIN', 'Admin', hashedPassword]
        );

        console.log('Akun Admin berhasil dibuat!');
        console.log('NIM: admin');
        console.log('Password: admin123');

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log('Akun Admin sudah ada di database.');
        } else {
            console.error('Gagal membuat admin:', error);
        }
    } finally {
        process.exit(); // Hentikan script setelah selesai
    }
};

buatAdmin();