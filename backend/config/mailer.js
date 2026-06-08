const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;
let emailAktif = false;

// Hanya setup transporter jika konfigurasi Gmail tersedia
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD 
    && process.env.GMAIL_USER !== 'emailkamu@gmail.com') {
    
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });

    // Verifikasi koneksi saat startup
    transporter.verify()
        .then(() => {
            emailAktif = true;
            console.log('✅ Koneksi email (Nodemailer) berhasil.');
        })
        .catch((err) => {
            emailAktif = false;
            console.warn('⚠️  Email tidak aktif:', err.message);
            console.warn('   Server tetap berjalan tanpa fitur email.');
        });
} else {
    console.log('ℹ️  Email belum dikonfigurasi (GMAIL_USER/GMAIL_APP_PASSWORD kosong).');
    console.log('   Semua email akan di-log ke console saja.');
}

/**
 * Fungsi helper untuk mengirim email
 * Jika email tidak aktif, hanya log ke console (tidak error)
 */
const kirimEmail = async (to, subject, html) => {
    // Jika email tidak aktif, log ke console sebagai pengganti
    if (!emailAktif || !transporter) {
        console.log('\n📧 [EMAIL SIMULASI]');
        console.log(`   Ke: ${to}`);
        console.log(`   Subjek: ${subject}`);
        console.log('   (Email tidak terkirim — Gmail belum dikonfigurasi)\n');
        return { simulated: true };
    }

    const mailOptions = {
        from: `"Absensi Neo Telemetri" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html
    };

    return transporter.sendMail(mailOptions);
};

module.exports = { kirimEmail };
