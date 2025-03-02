// index.js - Bot que almacena mensajes en SQLite sin responder y se mantiene activo
const { Client, LocalAuth } = require('whatsapp-web.js');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8000;

// Configuración de la base de datos SQLite
const dbPath = path.join(__dirname, 'mensajes.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error al conectar con la base de datos:", err.message);
    } else {
        console.log("📂 Base de datos SQLite conectada");
        db.run(`CREATE TABLE IF NOT EXISTS mensajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remitente TEXT,
            mensaje TEXT,
            fecha TEXT
        )`);
    }
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

// Evento para almacenar mensajes en la base de datos
client.on('message', async (msg) => {
    const remitente = msg.from;
    const mensaje = msg.body;
    const fecha = new Date().toISOString();

    db.run(`INSERT INTO mensajes (remitente, mensaje, fecha) VALUES (?, ?, ?)`,
        [remitente, mensaje, fecha],
        (err) => {
            if (err) {
                console.error("❌ Error al guardar mensaje:", err.message);
            } else {
                console.log(`💾 Mensaje guardado de ${remitente}: "${mensaje}"`);
            }
        }
    );
});

// Mantener el bot activo en Railway
setInterval(() => {
    console.log("🔄 Bot sigue corriendo...");
}, 10000);

// Mostrar los mensajes almacenados en logs para verificar
setTimeout(() => {
    db.all("SELECT * FROM mensajes", [], (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener mensajes:", err.message);
        } else {
            console.log("📜 Mensajes guardados en la base de datos:");
            console.table(rows);
        }
    });
}, 30000);

// Servidor Web para verificar el estado
app.get('/', (req, res) => {
    res.send("<h1>📡 Bot de WhatsApp activo y guardando mensajes en SQLite</h1>");
});

app.listen(port, () => {
    console.log(`🌍 Servidor corriendo en http://localhost:${port}`);
});

// Inicializar el bot
client.initialize();
