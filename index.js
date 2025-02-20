const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require("express");
const fs = require("fs");
const qr = require("qr-image");

const app = express();
const port = process.env.PORT || 3000;

let qrBase64 = null;
let qrGenerated = false;

// Configurar el cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./session"
    }),
    puppeteer: {
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu"
        ],
        headless: true,
        executablePath: "/usr/bin/google-chrome-stable"
    }
});

// Evento cuando se genera el QR
client.on("qr", (qrCode) => {
    if (!qrGenerated) {
        console.log("📌 Se generó un nuevo QR. Escanéalo para conectar.");
        const qrImage = qr.imageSync(qrCode, { type: "png" });
        qrBase64 = `data:image/png;base64,${qrImage.toString("base64")}`;
        qrGenerated = true;
    }
});

// Evento cuando el cliente está listo
client.on("ready", () => {
    console.log("✅ Bot conectado y listo para capturar mensajes.");
});

// Evento para mensajes recibidos
client.on('message', async msg => {
    if (msg.body === '!ping') {
        await msg.reply('pong');
    }
});

// Manejar desconexiones
client.on("disconnected", (reason) => {
    console.log("❌ Cliente desconectado. Razón:", reason);
    qrGenerated = false;
    qrBase64 = null;
    console.log("🔄 Reiniciando conexión en 10 segundos...");
    setTimeout(() => {
        client.initialize();
    }, 10000);
});

// Ruta principal
app.get("/", (req, res) => {
    res.send("🚀 Servidor activo en Railway.");
});

// Ruta para mostrar el QR
app.get("/qr", async (req, res) => {
    // Esperar hasta que el QR esté disponible (con timeout)
    let attempts = 0;
    while (!qrBase64 && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }

    if (qrBase64) {
        res.send(`
            <html>
            <head>
                <title>QR de WhatsApp</title>
                <meta http-equiv="refresh" content="30">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f0f2f5;
                    }
                    .container {
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                    img {
                        max-width: 300px;
                        height: auto;
                    }
                    h2 {
                        color: #128C7E;
                        margin-bottom: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Escanea este código QR para conectar WhatsApp</h2>
                    <img src="${qrBase64}" alt="QR Code">
                    <p>La página se actualizará automáticamente cada 30 segundos</p>
                </div>
            </body>
            </html>
        `);
    } else {
        res.status(404).send(`
            <html>
            <head>
                <title>QR no disponible</title>
                <meta http-equiv="refresh" content="5">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f0f2f5;
                    }
                    .message {
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="message">
                    <h2>QR aún no generado</h2>
                    <p>Por favor espera unos segundos, la página se recargará automáticamente...</p>
                </div>
            </body>
            </html>
        `);
    }
});

// Iniciar el servidor
app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor corriendo en Railway en el puerto ${port}`);
});

// Inicializar WhatsApp después de iniciar el servidor
client.initialize();