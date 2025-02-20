const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require("express");
const fs = require("fs");
const qr = require("qr-image");

const app = express();
const port = process.env.PORT || 3000; // Railway asigna un puerto dinámico

let qrBase64 = null; // Variable para almacenar el QR en formato Base64

// Configurar el cliente de WhatsApp con LocalAuth para guardar la sesión
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./session" // Guardar la sesión en un directorio persistente
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
        executablePath: "/usr/bin/google-chrome-stable" // Ruta exacta en Railway
    }
});

// Evento cuando se genera el QR
client.on("qr", (qrCode) => {
    if (!qrBase64) { // Solo generar QR si no existe uno previo
        console.log("📌 Se generó un nuevo QR. Escanéalo para conectar.");

        // Convertir el QR a Base64
        const qrImage = qr.imageSync(qrCode, { type: "png" });
        qrBase64 = `data:image/png;base64,${qrImage.toString("base64")}`;
    }
});

// Evento cuando el cliente está listo
client.on("ready", () => {
    console.log("✅ Bot conectado y listo para capturar mensajes.");
});

// Manejar desconexiones sin que Railway reinicie el bot
client.on("disconnected", (reason) => {
    console.log("❌ Cliente desconectado. Razón:", reason);
    console.log("🔄 Reiniciando conexión en 10 segundos...");
    setTimeout(() => {
        client.initialize();
    }, 10000);
});

// Servidor Express para Railway
app.get("/", (req, res) => {
    res.send("🚀 Servidor activo en Railway.");
});

// Ruta para mostrar el QR en la web
app.get("/qr", (req, res) => {
    if (qrBase64) {
        res.send(`
            <html>
            <head><title>QR de WhatsApp</title></head>
            <body style="text-align: center;">
                <h2>Escanea este código QR para conectar WhatsApp</h2>
                <img src="${qrBase64}" alt="QR Code">
            </body>
            </html>
        `);
    } else {
        res.status(404).send("QR aún no generado, espera unos segundos...");
    }
});

// Iniciar el servidor en Railway
app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor corriendo en Railway en el puerto ${port}`);
});

// Inicializar WhatsApp después de iniciar el servidor
client.initialize();
