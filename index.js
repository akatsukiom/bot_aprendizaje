const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const express = require("express");
const qr = require("qr-image");

const app = express();
const port = process.env.PORT || 3000; // Usa el puerto de Railway si está disponible

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
        executablePath: "/usr/bin/google-chrome-stable" // Ruta exacta en Railway
    }
});

let qrCodeData = null;

client.on("qr", (qrCode) => {
    console.log("📌 Se generó un nuevo QR. Escanéalo para conectar.");

    // Guardar el QR en una variable
    qrCodeData = qrCode;
});

// Servir el QR como imagen en una URL
app.get("/qr", (req, res) => {
    if (qrCodeData) {
        const qrImage = qr.image(qrCodeData, { type: "png" });
        res.setHeader("Content-Type", "image/png");
        qrImage.pipe(res);
    } else {
        res.send("QR aún no generado, espera unos segundos...");
    }
});

// Iniciar el servidor en Railway
app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor QR corriendo en Railway en el puerto ${port}`);
});

// Inicializar WhatsApp después de iniciar el servidor
client.initialize();

client.on('ready', () => {
    console.log("✅ Bot conectado y listo para capturar mensajes.");
});

// 📌 Capturar mensajes entrantes (del cliente)
client.on('message', async msg => {
    guardarMensaje(msg.from, "cliente", msg.body);
});

// 📌 Capturar mensajes enviados (del operador)
client.on('message_create', async msg => {
    if (msg.fromMe) { // Solo guarda los mensajes que envía el operador
        guardarMensaje(msg.to, "operador", msg.body);
    }
});

// 📌 Función para guardar los mensajes organizados por cliente
function guardarMensaje(remitente, tipo, mensaje) {
    const filePath = "historial_clientes.json";
    let historial = {};

    // Si el archivo ya existe, cargarlo
    if (fs.existsSync(filePath)) {
        historial = JSON.parse(fs.readFileSync(filePath));
    }

    // Si el número del cliente no existe, crearlo
    if (!historial[remitente]) {
        historial[remitente] = { mensajes: [] };
    }

    // Agregar el mensaje al historial del cliente
    historial[remitente].mensajes.push({
        tipo,  // "cliente" o "operador"
        texto: mensaje,
        timestamp: new Date().toISOString()
    });

    // Guardar el historial actualizado
    fs.writeFileSync(filePath, JSON.stringify(historial, null, 2));
    console.log(`📌 Mensaje guardado (${tipo}) para ${remitente}.`);
}
