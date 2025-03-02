// index.js corregido para mostrar el QR en una página web
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');

const app = express();
const port = process.env.PORT || 8000;

let qrCodeUrl = ''; // Variable para almacenar el QR

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

// Evento para generar el QR en una URL accesible
client.on('qr', async (qr) => {
    console.log("⚡ Código QR generado, accede a /qr para escanearlo.");
    qrCodeUrl = await qrcode.toDataURL(qr);
});

// Evento cuando el bot está listo
client.on('ready', () => {
    console.log("✅ Bot conectado correctamente");
});

// Evento para manejar mensajes
client.on('message', async (msg) => {
    console.log(`📩 Mensaje recibido: ${msg.body}`);
    if (msg.body.toLowerCase() === 'hola') {
        await msg.reply("👋 ¡Hola! Soy tu bot de WhatsApp.");
    }
});

// Servidor Web para Mostrar el QR
app.get('/', (req, res) => {
    res.send(`
        <h1>Bot de WhatsApp</h1>
        <p>Estado: ${qrCodeUrl ? "Escanea el QR para conectarte" : "✅ Bot ya conectado"}</p>
        ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="Código QR" />` : ""}
    `);
});

// Ruta específica para ver el QR
app.get('/qr', (req, res) => {
    if (!qrCodeUrl) {
        return res.send("<h1>✅ Bot ya está conectado</h1>");
    }
    res.send(`
        <h1>Escanea este código QR</h1>
        <img src="${qrCodeUrl}" alt="Código QR" />
    `);
});

app.listen(port, () => {
    console.log(`🌍 Servidor corriendo en http://localhost:${port}`);
});

// Inicializar el bot
client.initialize();
