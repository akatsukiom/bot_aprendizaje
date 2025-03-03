// routes/index.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const learningHandler = require('../src/handlers/learningHandler');

// 1) Página principal
router.get('/', async (req, res) => {
    // Aquí podrías consultar el estado real del cliente, pero
    // si solo quieres mostrar algo básico, hazlo directamente.
    // Ejemplo simple:
    res.send(`
    <html>
    <head>
        <title>Panel Principal</title>
    </head>
    <body>
        <h1>Panel del Bot de WhatsApp</h1>
        <p><a href="/generate-qr">Generar QR</a></p>
        <p><a href="/logout">Cerrar Sesión</a></p>
        <p><a href="/messages">Ver Mensajes</a></p>
        <p><a href="/learning/patterns">Ver Patrones</a></p>
        <!-- etc. -->
    </body>
    </html>
    `);
});

// 2) Obtener mensajes
router.get('/messages', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC LIMIT 100", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3) Estadísticas de aprendizaje
router.get('/learning/stats', async (req, res) => {
    try {
        const stats = await learningHandler.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4) Patrones aprendidos
router.get('/learning/patterns', (req, res) => {
    learningHandler.db.all(
        "SELECT * FROM patrones_respuesta ORDER BY frecuencia DESC", 
        [], 
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// 5) Exportar mensajes a JSON
router.get('/export/json', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.setHeader('Content-Disposition', 'attachment; filename=mensajes.json');
        res.json(rows);
    });
});

// 6) Exportar patrones aprendidos a JSON
router.get('/export/patterns/json', (req, res) => {
    learningHandler.db.all(
        "SELECT * FROM patrones_respuesta ORDER BY frecuencia DESC", 
        [], 
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.setHeader('Content-Disposition', 'attachment; filename=patrones.json');
            res.json(rows);
        }
    );
});

// 7) Exportar mensajes a CSV
router.get('/export/csv', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        let csvContent = "id,remitente,mensaje,fecha\n";
        rows.forEach(row => {
            const safeMessage = row.mensaje.replace(/"/g, '""');
            csvContent += `${row.id},"${row.remitente}","${safeMessage}","${row.fecha}"\n`;
        });
        res.setHeader('Content-Disposition', 'attachment; filename=mensajes.csv');
        res.setHeader('Content-Type', 'text/csv');
        res.send(csvContent);
    });
});

// Importar y usar las rutas de WhatsApp
const whatsappRoutes = require('./whatsappRoutes');
router.use('/', whatsappRoutes);

module.exports = router;
