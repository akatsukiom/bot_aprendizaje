// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const client = require('../client');
const db = require('../db');
const learningHandler = require('../src/handlers/learningHandler');

// Variable global para guardar el QR actual
let currentQR = null;

/* ==============================
   EVENTOS DEL CLIENTE WHATSAPP
============================== */

// Cuando se genera un QR
client.on('qr', (qr) => {
    console.log('📱 Código QR generado:');
    qrcode.generate(qr, { small: true });
    currentQR = qr;
});

// Cuando el cliente está listo
client.on('ready', () => {
    console.log('🤖 Bot de WhatsApp listo y en modo aprendizaje');
    currentQR = null;
});

// Cuando llega un mensaje
client.on('message', async (msg) => {
    const remitente = msg.from;
    const mensaje = msg.body;
    const fecha = new Date().toISOString();

    // Guardar en la base de datos principal
    db.run(
        `INSERT INTO mensajes (remitente, mensaje, fecha) VALUES (?, ?, ?)`,
        [remitente, mensaje, fecha],
        (err) => {
            if (err) {
                console.error("❌ Error al guardar mensaje:", err.message);
            } else {
                console.log(`💾 Mensaje guardado de ${remitente}: "${mensaje}"`);
            }
        }
    );

    // Procesar el mensaje para aprendizaje (sin responder)
    await learningHandler.processMessage(msg);
});

/* ==============================
   RUTAS RELACIONADAS AL WHATSAPP
============================== */

// Obtener el estado actual (asíncrono)
router.get('/qr-status', async (req, res) => {
    try {
        // Si la página de Puppeteer no existe, el cliente está destruido o no inicializado
        if (!client.pupPage) {
            return res.json({ state: 'DISCONNECTED', qr: currentQR });
        }

        const state = await client.getState();
        res.json({ state, qr: currentQR });
    } catch (err) {
        console.error("Error al obtener el estado:", err);
        res.json({ state: 'DISCONNECTED', qr: currentQR });
    }
});

// Generar/mostrar el código QR
router.get('/generate-qr', async (req, res) => {
    try {
        if (!client.pupPage) {
            return res.send(`
                <h1>Cliente no inicializado</h1>
                <p><a href="/">Volver al panel</a></p>
            `);
        }

        const connectionState = await client.getState();
        if (connectionState === 'CONNECTED') {
            return res.send(`
                <h1>✅ Bot ya está conectado</h1>
                <p>El bot ya está funcionando correctamente.</p>
                <p><a href="/">Volver al panel</a></p>
            `);
        }

        // Mostrar la página HTML que hace polling a /qr-status
        res.send(`
            <html>
            <head>
                <title>Código QR de WhatsApp</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                    #qrcode { margin: 20px auto; }
                    .status { margin: 20px 0; padding: 10px; background: #f0f0f0; border-radius: 5px; }
                </style>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            </head>
            <body>
                <h1>🔄 Generando código QR para WhatsApp</h1>
                <p>El código QR aparecerá aquí en unos segundos. Escanéalo con WhatsApp.</p>
                
                <div id="qrcode"></div>
                <div class="status" id="status">Esperando código QR...</div>
                
                <p><a href="/">Volver al panel</a></p>
                
                <script>
                    let qrCodeElement = null;
                    
                    function createQR(qrData) {
                        if (qrCodeElement) {
                            qrCodeElement.clear();
                            qrCodeElement.makeCode(qrData);
                        } else {
                            document.getElementById('qrcode').innerHTML = '';
                            qrCodeElement = new QRCode(document.getElementById("qrcode"), {
                                text: qrData,
                                width: 256,
                                height: 256,
                                colorDark: "#000000",
                                colorLight: "#ffffff",
                                correctLevel: QRCode.CorrectLevel.H
                            });
                        }
                        document.getElementById('status').innerText = 'Código QR generado. Escanéalo ahora.';
                    }
                    
                    async function checkStatus() {
                        try {
                            const response = await fetch('/qr-status');
                            const data = await response.json();
                            
                            if (data.state === 'CONNECTED') {
                                document.getElementById('status').innerText = '✅ Conectado exitosamente!';
                                document.getElementById('qrcode').innerHTML = '<h2>✅ Conectado</h2>';
                                clearInterval(intervalId);
                                setTimeout(() => { window.location.href = '/'; }, 3000);
                            } else if (data.qr) {
                                createQR(data.qr);
                            }
                        } catch (error) {
                            document.getElementById('status').innerText = 'Error al obtener estado: ' + error;
                        }
                    }
                    
                    const intervalId = setInterval(checkStatus, 3000);
                    checkStatus();
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("❌ Error al generar QR:", err);
        res.status(500).send("Error al generar QR. Intente nuevamente.");
    }
});

// Cerrar sesión
router.get('/logout', async (req, res) => {
    try {
        await client.logout();
        console.log("✅ Sesión de WhatsApp cerrada correctamente");

        // Eliminar carpeta de autenticación (opcional)
        const sessionPath = './.wwebjs_auth';
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log("🗑 Carpeta de sesión eliminada");
        }

        // Enviamos una página que recarga en 5s
        res.send(`
            <h1>✅ Sesión cerrada correctamente</h1>
            <p>La página se recargará automáticamente en 5 segundos para mostrar el código QR.</p>
            <p><a href="/">Volver al panel</a></p>
            <script>
                setTimeout(function() {
                    window.location.href = '/';
                }, 5000);
            </script>
        `);

        // Opcional: reiniciar el cliente después de un delay
        setTimeout(async () => {
            try {
                await client.destroy();
                console.log("🔄 Cliente destruido, reiniciando...");

                // Requiere volver a importar client.js o re-instanciar
                // ...
            } catch (error) {
                console.error("❌ Error al reiniciar el cliente:", error);
            }
        }, 2000);

    } catch (err) {
        console.error("❌ Error en el cierre de sesión:", err);
        res.status(500).send("Error al cerrar sesión. Intente nuevamente.");
    }
});

module.exports = router;
