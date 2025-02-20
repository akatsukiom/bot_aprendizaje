const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require("express");
const fs = require("fs");
const qr = require("qr-image");
const puppeteer = require('puppeteer-core');

const app = express();
const port = process.env.PORT || 3000; // Railway asigna un puerto dinámico

// Crear carpeta "public" si no existe
const qrFolder = __dirname + "/public"; 
if (!fs.existsSync(qrFolder)) {
    fs.mkdirSync(qrFolder);
}

// Configurar el cliente de WhatsApp
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

// Evento cuando se genera el QR
client.on("qr", (qrCode) => {
    console.log("📌 Se generó un nuevo QR. Escanéalo para conectar.");

    // Generar y guardar el QR como imagen en la carpeta "public"
    const qrImage = qr.image(qrCode, { type: "png" });
    qrImage.pipe(fs.createWriteStream(`${qrFolder}/qr_code.png`))
        .on("finish", () => console.log("✅ QR guardado correctamente en public/qr_code.png"))
        .on("error", (err) => console.error("❌ Error al guardar el QR:", err));
});

// Servidor Express para Railway
app.use(express.static(qrFolder)); // Servir archivos estáticos desde "public"

// Ruta principal para comprobar que el servidor está activo
app.get("/", (req, res) => {
    res.send("🚀 Servidor activo en Railway.");
});

// Ruta para ver el QR
app.get("/qr", (req, res) => {
    const qrPath = `${qrFolder}/qr_code.png`;

    if (fs.existsSync(qrPath)) {
        res.sendFile(qrPath);
    } else {
        res.status(404).send("QR aún no generado, espera unos segundos...");
    }
});

// Ruta de depuración para ver si el archivo existe en Railway
app.get("/files", (req, res) => {
    fs.readdir(qrFolder, (err, files) => {
        if (err) {
            res.status(500).send("❌ Error al leer la carpeta public");
        } else {
            res.send(`📂 Archivos en public/: <br> ${files.join("<br>")}`);
        }
    });
});

// Iniciar el servidor en Railway
app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor corriendo en Railway en el puerto ${port}`);
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
