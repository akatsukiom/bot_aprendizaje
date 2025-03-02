// index.js - Bot que almacena mensajes en SQLite, muestra en tiempo real y permite exportación
const { Client, LocalAuth } = require('whatsapp-web.js');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const path = require('path');
const fs = require('fs');

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

// Ruta para obtener los mensajes en tiempo real
app.get('/messages', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Ruta para exportar la base de datos a JSON
app.get('/export/json', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.setHeader('Content-Disposition', 'attachment; filename=mensajes.json');
        res.json(rows);
    });
});

// Ruta para exportar la base de datos a CSV
app.get('/export/csv', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        let csvContent = "id,remitente,mensaje,fecha\n";
        rows.forEach(row => {
            csvContent += `${row.id},"${row.remitente}","${row.mensaje}","${row.fecha}"\n`;
        });
        res.setHeader('Content-Disposition', 'attachment; filename=mensajes.csv');
        res.setHeader('Content-Type', 'text/csv');
        res.send(csvContent);
    });
});

// Ruta para cerrar sesión y generar un nuevo QR
app.get('/logout', (req, res) => {
    const sessionPath = './.wwebjs_auth';
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true });
        console.log("🗑 Sesión eliminada. Se generará un nuevo QR.");
    }
    res.send("<h1>✅ Sesión cerrada</h1><p>Recarga la página para escanear un nuevo QR.</p><a href='/'>🔄 Volver</a>");
    process.exit(1);
});

// Página principal con consola de mensajes en tiempo real y botones de exportación
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bot de WhatsApp</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                .chat-box { max-width: 600px; margin: auto; background: #f4f4f4; padding: 10px; border-radius: 10px; height: 300px; overflow-y: scroll; }
                .message { text-align: left; margin-bottom: 10px; padding: 5px; border-radius: 5px; background: white; }
                .timestamp { font-size: 12px; color: gray; }
                button { background: blue; color: white; padding: 10px; border: none; cursor: pointer; margin-top: 10px; }
            </style>
        </head>
        <body>
            <h1>📡 Bot de WhatsApp Activo</h1>
            <p>El bot está funcionando correctamente.</p>
            <a href="/logout"><button style="background: red;">❌ Cerrar Sesión</button></a>
            <a href="/export/json"><button>📂 Exportar JSON</button></a>
            <a href="/export/csv"><button>📂 Exportar CSV</button></a>
            <h2>📩 Mensajes Recibidos</h2>
            <div class="chat-box" id="chatBox"></div>
            <script>
                async function fetchMessages() {
                    const response = await fetch('/messages');
                    const messages = await response.json();
                    const chatBox = document.getElementById("chatBox");
                    chatBox.innerHTML = "";
                    messages.forEach(msg => {
                       chatBox.innerHTML += `
    <div class="message">
        <strong>${msg.remitente}</strong>: ${msg.mensaje.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        <div class="timestamp">${new Date(msg.fecha).toLocaleString()}</div>
    </div>
`;

                    chatBox.scrollTop = chatBox.scrollHeight;
                }
                setInterval(fetchMessages, 3000);
                fetchMessages();
            </script>
        </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`🌍 Servidor corriendo en http://localhost:${port}`);
});

// Inicializar el bot
client.initialize();
