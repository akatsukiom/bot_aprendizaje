// index.js - Optimizado para Railway
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require("express");
const qrcode = require("qrcode-terminal");
const { createServer } = require('http');
const fs = require('fs');
const path = require('path');

// Configurar Express
const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// Variables para almacenar el código QR
let qrValue = null;
let clientReady = false;
let startTime = new Date();

// Directorio para almacenar sesiones
const SESSION_DIR = path.join(__dirname, 'session');
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

console.log("🚀 Iniciando el bot de WhatsApp...");

// Configurar el cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: SESSION_DIR
    }),
    puppeteer: {
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process", // <- Este parámetro ayuda con Railway
            "--disable-gpu"
        ],
        headless: true
    }
});

// Evento cuando se genera el QR de WhatsApp
client.on("qr", (qrCode) => {
    qrValue = qrCode;
    console.log("📌 Se generó un nuevo QR. Escanéalo desde la interfaz web o la consola.");
    qrcode.generate(qrCode, { small: true }); // Mostrar QR en la consola
});

// Evento cuando el cliente está listo
client.on("ready", () => {
    clientReady = true;
    console.log("✅ Bot de WhatsApp conectado y listo!");
});

// Manejar mensajes
client.on("message", async (msg) => {
    console.log(`📩 Mensaje recibido de ${msg.from}: ${msg.body}`);
    
    // Agregar aquí la lógica de respuesta del bot
    if (msg.body.toLowerCase() === 'hola') {
        msg.reply('👋 ¡Hola! Soy un bot de WhatsApp ejecutándose en Railway.');
    }
});

// Manejar desconexiones
client.on("disconnected", (reason) => {
    clientReady = false;
    console.log("❌ Cliente desconectado:", reason);
    
    // Intentar reconectar después de 10 segundos
    setTimeout(() => {
        console.log("🔄 Intentando reconectar...");
        client.initialize();
    }, 10000);
});

// Rutas de Express
app.get("/", (req, res) => {
    // Página de estado simple con estilos básicos
    res.send(`
    <!DOCTYPE html>
    <html>
        <head>
            <title>Bot WhatsApp - Estado</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .status {
                    padding: 15px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
                .status.online {
                    background-color: #e8f5e9;
                    color: #2e7d32;
                    border-left: 5px solid #2e7d32;
                }
                .status.offline {
                    background-color: #ffebee;
                    color: #c62828;
                    border-left: 5px solid #c62828;
                }
                h1 {
                    color: #333;
                }
                .qr-code {
                    text-align: center;
                    margin: 20px 0;
                }
                .info {
                    margin-top: 20px;
                    padding: 15px;
                    background-color: #e3f2fd;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📱 Bot WhatsApp en Railway</h1>
                
                <div class="status ${clientReady ? 'online' : 'offline'}">
                    <strong>Estado:</strong> ${clientReady ? '✅ Conectado' : '❌ Esperando conexión'}
                </div>
                
                ${!clientReady && qrValue ? `
                <div class="qr-code">
                    <h2>Escanea el código QR para conectar</h2>
                    <p>Ve a la URL <a href="/qr" target="_blank">/qr</a> para ver el código QR</p>
                </div>
                ` : ''}
                
                <div class="info">
                    <p><strong>Tiempo de actividad:</strong> ${getUptime()}</p>
                    <p>Este es un bot de WhatsApp ejecutándose en Railway.</p>
                </div>
            </div>
        </body>
    </html>
    `);
});

// Ruta para mostrar el código QR como texto (puede ser escaneado desde la consola)
app.get("/qr", (req, res) => {
    if (qrValue) {
        res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>WhatsApp QR Code</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <h1>Escanea este código QR con WhatsApp</h1>
                <div id="qrcode"></div>
                <p>Abre WhatsApp en tu teléfono > Configuración > Dispositivos vinculados > Vincular un dispositivo</p>
                
                <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
                <script>
                    var typeNumber = 0;
                    var errorCorrectionLevel = 'L';
                    var qr = qrcode(typeNumber, errorCorrectionLevel);
                    qr.addData('${qrValue}');
                    qr.make();
                    document.getElementById('qrcode').innerHTML = qr.createImgTag(5);
                </script>
            </body>
        </html>
        `);
    } else {
        res.send("No hay código QR disponible en este momento.");
    }
});

// Ruta para checar estado (útil para health checks)
app.get("/health", (req, res) => {
    res.json({
        status: clientReady ? "connected" : "waiting",
        uptime: getUptime(),
        startTime: startTime.toISOString()
    });
});

// Iniciar el servidor Express
server.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor activo en el puerto ${port}`);
    
    // Iniciar WhatsApp después de iniciar el servidor
    client.initialize().catch(err => {
        console.error("❌ Error al inicializar el cliente de WhatsApp:", err);
    });
});

// Función para calcular el tiempo de actividad
function getUptime() {
    const now = new Date();
    const uptimeMs = now - startTime;
    
    const days = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptimeMs % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${days}d ${hours}h ${minutes}m`;
}

// Manejar señales de terminación
process.on("SIGINT", async () => {
    console.log("Cerrando bot...");
    await client.destroy();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("Cerrando bot por señal SIGTERM...");
    await client.destroy();
    process.exit(0);
});