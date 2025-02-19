const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer-core');

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

client.on('qr', qr => {
    console.log("📌 Escanea este código QR con WhatsApp:");
    qrcode.generate(qr, { small: true });
});

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

client.initialize();
