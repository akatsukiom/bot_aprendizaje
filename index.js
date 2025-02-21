const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require("express");
const qrcode = require("qrcode-terminal"); // Para mostrar QR en consola

const app = express();
const port = process.env.PORT || 3000;

console.log("🚀 Iniciando el bot de WhatsApp...");

// Configurar el cliente de WhatsApp con LocalAuth para guardar la sesión
const client = new Client({
    authStrategy: new LocalAuth(),
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
        executablePath: "/usr/bin/google-chrome-stable" // Ruta exacta en Render
    }
});

// Evento cuando se genera el QR de WhatsApp
client.on("qr", (qrCode) => {
    console.log("📌 Se generó un nuevo QR. Escanéalo desde la consola.");
    qrcode.generate(qrCode, { small: true }); // Mostrar QR real de WhatsApp en la consola
});

// Servidor Express para ver que está activo
app.get("/", (req, res) => {
    res.send("🚀 Servidor activo en Render.");
});

app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor corriendo en el puerto ${port}`);
});

// Iniciar WhatsApp después de iniciar el servidor
client.initialize();
