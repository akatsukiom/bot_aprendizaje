const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require("express");
const qrcode = require("qrcode-terminal");
const puppeteer = require('puppeteer'); // Usar Puppeteer estándar en lugar de "puppeteer-core"

const app = express();
const port = process.env.PORT || 3000;

console.log("🚀 Iniciando el bot de WhatsApp...");

// Configurar el cliente de WhatsApp con Puppeteer
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: puppeteer.executablePath(), // Usa la versión integrada de Puppeteer
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu"
        ],
        headless: true
    }
});

// Evento cuando se genera el QR de WhatsApp
client.on("qr", (qrCode) => {
    console.log("📌 Se generó un nuevo QR. Escanéalo desde la consola.");
    qrcode.generate(qrCode, { small: true }); // Mostrar QR real en la consola
});

// Servidor Express para Render (Para evitar que cierre el proceso)
app.get("/", (req, res) => {
    res.send("🚀 Bot WhatsApp en ejecución en Render.");
});

app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor activo en el puerto ${port}. Render no cerrará el proceso.`);
});

// Iniciar WhatsApp después de iniciar el servidor
client.initialize();
