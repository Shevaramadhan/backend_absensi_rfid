const express = require('express');
const cors = require('cors');
const jalankanCronJobs = require('./utils/attendanceCron');
require('dotenv').config();

jalankanCronJobs(); // Mulai cron jobs saat server dijalankan

const app = express();
const port = process.env.PORT || 3000;

// Import routes
const rfidRoutes = require('./routes/rfid');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const anggotaRoutes = require('./routes/anggota');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');


// Middleware
app.use(cors());
app.use(express.json()); // Parsing data JSON
app.use(express.urlencoded({ extended: true })); // Parsing data Form

// Test Route
app.get('/', (req, res) => {
    res.json({ message: 'Server Backend Absensi RFID berjalan lancar.' });
});

//routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use('/api/admin', adminRoutes);
app.use('/api/anggota', anggotaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/uploads', express.static('public/uploads')); // Menyajikan file statis dari folder uploads
// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});