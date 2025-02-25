// index.js corregido para tu bot de WhatsApp en Koyeb
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 8000;

// Verificar que Puppeteer se ejecuta correctamente
(async () => {
    console.log("🛠 Verificando instalación de Puppeteer...");
    try {
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        console.log("✅ Puppeteer se ejecutó correctamente");
        await browser.close();
    } catch (error) {
        console.error("❌ Error ejecutando Puppeteer:", error);
    }
})();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

// Evento para generar el QR en consola
client.on('qr', (qr) => {
    console.log("⚡ ESCANEA ESTE QR PARA CONECTAR WHATSAPP ⚡");
    qrcode.generate(qr, { small: true });
    console.log("📌 Código QR generado correctamente");
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

// Inicializar el bot
client.initialize();

// Servidor Express
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
        <head>
            <title>Bot de WhatsApp</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
            </style>
        </head>
        <body>
            <h1>Bot de WhatsApp</h1>
            <p>✅ El servidor está activo y el bot está funcionando.</p>
            <p>Revisa la consola de logs para escanear el código QR.</p>
            <p>Si no ves el QR, revisa los logs en Koyeb.</p>
        </body>
    </html>
    `);
});

app.listen(port, () => {
    console.log(`🌍 Servidor web corriendo en http://localhost:${port}`);

    // Mantener logs activos en Koyeb
    setInterval(() => {
        console.log("🔄 Bot sigue corriendo...");
    }, 10000);
});
