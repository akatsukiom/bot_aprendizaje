const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require("express");
const fs = require("fs");
const qr = require("qr-image");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000; // Railway asigna un puerto dinámico

// Crear carpeta "public" si no existe
const qrFolder = path.join(__dirname, "public"); 
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
    const qrPath = path.join(qrFolder, "qr_code.png");
    qrImage.pipe(fs.createWriteStream(qrPath))
        .on("finish", () => console.log("✅ QR guardado correctamente en public/qr_code.png"))
        .on("error", (err) => console.error("❌ Error al guardar el QR:", err));
});

// Servir archivos estáticos desde la carpeta "public"
app.use("/public", express.static(qrFolder));

// Ruta principal para comprobar que el servidor está activo
app.get("/", (req, res) => {
    res.send("🚀 Servidor activo en Railway.");
});

// Ruta para ver el QR
app.get("/qr", (req, res) => {
    const qrPath = path.join(qrFolder, "qr_code.png");

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
