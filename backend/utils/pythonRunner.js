const { spawn } = require('child_process');
const path = require('path');

/**
 * Menjalankan script Python secara native dari Node.js
 * @param {string} scriptName - Nama file python (contoh: 'spkController.py')
 * @param {Array<string>} args - Parameter yang akan di-pass ke sys.argv
 */
const runPythonScript = (scriptName, args = []) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../python', scriptName);
        
        // Asumsi perintah default adalah 'python'. Jika di Linux (aaPanel) menggunakan 'python3',
        // maka variabel environment PYTHON_CMD bisa diset di .env
        const pythonCmd = process.env.PYTHON_CMD || 'python';
        const pythonProcess = spawn(pythonCmd, [scriptPath, ...args]);

        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python script ${scriptName} exited with code ${code}. Error: ${errorData}`);
                return reject(new Error(`Python Execution Error: ${errorData}`));
            }
            
            try {
                // Skrip Python dipastikan memuntahkan JSON string murni di stdout (baris paling akhir)
                const jsonString = outputData.trim().split('\n').pop(); // Ambil baris terakhir jika ada print() lain
                const jsonResult = JSON.parse(jsonString);
                resolve(jsonResult);
            } catch (err) {
                console.error("Gagal parsing JSON dari Python:", outputData);
                reject(new Error('Gagal membaca respons dari sistem ML.'));
            }
        });
    });
};

module.exports = { runPythonScript };
