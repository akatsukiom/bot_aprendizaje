// index.js corregido para tu bot
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const port = process.env.PORT || 8000;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

client.on('qr', (qr) => {
    console.log("Escanea este QR para conectar WhatsApp:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log("✅ Bot conectado correctamente");
});

client.on('message', async (msg) => {
    console.log(`📩 Mensaje recibido: ${msg.body}`);
    if (msg.body.toLowerCase() === 'hola') {
        await msg.reply("👋 ¡Hola! Soy tu bot de WhatsApp.");
    }
});

client.initialize();

app.listen(port, () => {
    console.log(`Servidor web corriendo en http://localhost:${port}`);
});