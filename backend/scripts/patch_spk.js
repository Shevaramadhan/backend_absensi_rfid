const db = require('../config/database');

async function runPatch() {
    try {
        console.log('Menjalankan patch database untuk fitur SPK...');

        // 1. Menambahkan kolom jenis_kelamin & file_krs ke tabel users (jika belum ada)
        console.log('Mengecek tabel users...');
        const [columns] = await db.query("SHOW COLUMNS FROM users");
        const hasJenisKelamin = columns.some(c => c.Field === 'jenis_kelamin');
        const hasFileKrs = columns.some(c => c.Field === 'file_krs');

        if (!hasJenisKelamin) {
            await db.query("ALTER TABLE users ADD COLUMN jenis_kelamin ENUM('L', 'P') DEFAULT 'L' AFTER email");
            console.log('-> Kolom jenis_kelamin ditambahkan.');
        }
        if (!hasFileKrs) {
            await db.query("ALTER TABLE users ADD COLUMN file_krs VARCHAR(255) NULL AFTER jenis_kelamin");
            console.log('-> Kolom file_krs ditambahkan.');
        }

        // 2. Membuat tabel kriteria
        console.log('Membuat tabel kriteria...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS kriteria (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kode VARCHAR(10) NOT NULL UNIQUE,
                nama_kriteria VARCHAR(255) NOT NULL,
                bobot FLOAT NOT NULL,
                tipe ENUM('benefit', 'cost') NOT NULL,
                deskripsi TEXT
            )
        `);
        console.log('-> Tabel kriteria dipastikan ada.');

        // 3. Insert default kriteria jika kosong
        const [kriteriaCek] = await db.query("SELECT COUNT(*) AS total FROM kriteria");
        if (kriteriaCek[0].total === 0) {
            console.log('Memasukkan nilai kriteria default...');
            await db.query(`
                INSERT INTO kriteria (kode, nama_kriteria, bobot, tipe, deskripsi) VALUES
                ('C1', 'Ketersediaan Jadwal Piket', 0.40, 'benefit', 'Semakin banyak jadwal kosong, semakin direkomendasikan'),
                ('C2', 'Jeda Waktu Perkuliahan', 0.30, 'benefit', 'Jeda yang cukup sebelum/sesudah shift'),
                ('C3', 'Beban SKS Hari Tersebut', 0.15, 'cost', 'Semakin tinggi SKS, semakin membebani'),
                ('C4', 'Kebutuhan Shift & Gender', 0.15, 'benefit', 'Prioritas Shift 2 untuk L, Shift 4 untuk P')
            `);
            console.log('-> 4 Kriteria dasar (C1-C4) ditambahkan.');
        }

        // 4. Membuat tabel member_courses untuk hasil parsing PDF KRS
        console.log('Membuat tabel member_courses...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS member_courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                matakuliah VARCHAR(255) NOT NULL,
                sks INT DEFAULT 0,
                hari VARCHAR(50) NOT NULL,
                jam_mulai TIME NOT NULL,
                jam_selesai TIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('-> Tabel member_courses dipastikan ada.');

        console.log('✅ SELESAI: Database berhasil di-patch untuk kebutuhan Machine Learning (SPK).');
        process.exit(0);

    } catch (error) {
        console.error('❌ ERROR GAGAL PATCH DATABASE:', error);
        process.exit(1);
    }
}

runPatch();
