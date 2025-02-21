const express = require("express");
const qrcode = require("qrcode-terminal");

const app = express();
const port = process.env.PORT || 3000;

console.log("📌 Generando QR de prueba en consola...");

// Simulación de un código QR aleatorio
const testQR = "https://wa.me/521234567890"; // Puedes cambiarlo por otro enlace de prueba

qrcode.generate(testQR, { small: true }); // Mostrar QR en la consola

app.get("/", (req, res) => {
    res.send("🚀 Servidor activo en Render. Mira la consola para ver el QR.");
});

app.listen(port, "0.0.0.0", () => {
    console.log(`📡 Servidor corriendo en el puerto ${port}`);
});
