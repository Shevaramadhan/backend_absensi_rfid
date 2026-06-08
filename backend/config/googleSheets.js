// config/googleSheets.js
const { google } = require('googleapis');
require('dotenv').config();

let sheetsClient = null;
let sheetsAktif = false;

/**
 * Inisialisasi Google Sheets client menggunakan Service Account.
 * Dipanggil lazy (hanya saat pertama dibutuhkan).
 */
const getSheetsClient = () => {
    if (sheetsClient) return sheetsClient;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !key || email === 'nama@project.iam.gserviceaccount.com') {
        console.warn('⚠️  Google Sheets belum dikonfigurasi (GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY kosong).');
        return null;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: email,
                // Ganti literal \n dari env string menjadi newline asli
                private_key: key.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        sheetsClient = google.sheets({ version: 'v4', auth });
        sheetsAktif = true;
        return sheetsClient;
    } catch (err) {
        console.error('❌ Gagal inisialisasi Google Sheets client:', err.message);
        return null;
    }
};

/**
 * Cek apakah koneksi Sheets aktif
 */
const isSheetsAktif = () => sheetsAktif;

module.exports = { getSheetsClient, isSheetsAktif };
