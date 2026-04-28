const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Dokumentasi Absensi RFID',
            version: '1.0.0',
            description: 'Dokumentasi lengkap endpoint untuk sistem absensi UKM Neo Telemetri.',
        },
        servers: [
            {
                // Gunakan environment variable untuk URL server
                url: process.env.BASE_URL || 'http://localhost:3000',
                description: 'Production/Development Server'
            },
            {
                // Tetap simpan localhost jika ingin spesifik untuk dev lokal
                url: 'http://localhost:3000',
                description: 'Local Development Server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        security: [{
            bearerAuth: []
        }]
    },
    apis: ['./routes/*.js'], 
};

const swaggerSpecs = swaggerJsDoc(swaggerOptions);
module.exports = swaggerSpecs;