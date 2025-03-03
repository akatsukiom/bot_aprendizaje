// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Importamos la instancia actual del cliente desde el módulo client.js
// Nota: Usamos una variable let para poder reasignarla tras reiniciar
let client = require('../client');

const db = require('../db');
const learningHandler = require('../src/handlers/learningHandler');

// Variable global para guardar el código QR actual
let currentQR = null;

/* ============================================
   EVENTOS DEL CLIENTE DE WHATSAPP
============================================ */
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

// Cuando se recibe un mensaje
client.on('message', async (msg) => {
  const remitente = msg.from;
  const mensaje = msg.body;
  const fecha = new Date().toISOString();

  // Guardar mensaje en la base de datos principal
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

  // Procesar el mensaje para aprendizaje
  await learningHandler.processMessage(msg);
});

/* ============================================
   RUTAS RELACIONADAS CON WHATSAPP
============================================ */

// Ruta para obtener el estado y el QR actual
router.get('/qr-status', async (req, res) => {
  try {
    // Si la página de Puppeteer no existe, consideramos que el cliente está desconectado
    if (!client.pupPage) {
      return res.json({ state: 'DISCONNECTED', qr: null });
    }
    const state = await client.getState();
    res.json({ state, qr: currentQR });
  } catch (err) {
    console.error("Error al obtener el estado:", err);
    res.json({ state: 'DISCONNECTED', qr: null });
  }
});

// Ruta para mostrar la página de QR
router.get('/generate-qr', async (req, res) => {
  try {
    const state = await client.getState();
    if (state === 'CONNECTED') {
      return res.send(`
        <h1>✅ Bot ya está conectado</h1>
        <p><a href="/">Volver al panel</a></p>
      `);
    }
    // Renderizamos una página simple que hace polling a /qr-status para mostrar el QR
    res.send(`
      <html>
      <head>
        <title>Código QR de WhatsApp</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      </head>
      <body>
        <h1>Generando código QR...</h1>
        <div id="qrcode"></div>
        <div id="status">Esperando código QR...</div>
        <script>
          let qrCodeElement = null;
          function createQR(qrData) {
            if (!qrCodeElement) {
              qrCodeElement = new QRCode(document.getElementById("qrcode"), {
                text: qrData,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
              });
            } else {
              qrCodeElement.clear();
              qrCodeElement.makeCode(qrData);
            }
            document.getElementById("status").innerText = "Código QR generado. Escanéalo ahora.";
          }
          async function checkStatus() {
            try {
              const response = await fetch("/qr-status");
              const data = await response.json();
              if (data.state === "CONNECTED") {
                document.getElementById("status").innerText = "✅ Conectado exitosamente!";
                document.getElementById("qrcode").innerHTML = "<h2>✅ Conectado</h2>";
                clearInterval(intervalId);
                setTimeout(() => { window.location.href = "/"; }, 3000);
              } else if (data.qr) {
                createQR(data.qr);
              }
            } catch (error) {
              document.getElementById("status").innerText = "Error: " + error;
            }
          }
          const intervalId = setInterval(checkStatus, 3000);
          checkStatus();
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("❌ Error al generar QR:", error);
    res.status(500).send("Error al generar QR. Intente nuevamente.");
  }
});

// Ruta para cerrar sesión y reiniciar el cliente inmediatamente (Opción 1)
router.get('/logout', async (req, res) => {
  try {
    // 1) Cerrar sesión de WhatsApp
    await client.logout();
    console.log("✅ Sesión de WhatsApp cerrada correctamente");

    // 2) Eliminar carpeta de autenticación (opcional)
    const sessionPath = './.wwebjs_auth';
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log("🗑 Carpeta de sesión eliminada");
    }

    // 3) Destruir la instancia actual
    await client.destroy();
    console.log("🔄 Cliente destruido.");

    // 4) Crear e inicializar un NUEVO cliente inmediatamente
    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    // 5) Volver a registrar los eventos
    client.on('qr', (qr) => {
      console.log('📱 Nuevo QR generado tras logout');
      qrcode.generate(qr, { small: true });
      currentQR = qr;
    });
    client.on('ready', () => {
      console.log('🤖 Nuevo cliente listo tras logout');
      currentQR = null;
    });
    client.on('message', async (msg) => {
      const remitente = msg.from;
      const mensaje = msg.body;
      const fecha = new Date().toISOString();
      db.run(`INSERT INTO mensajes (remitente, mensaje, fecha) VALUES (?, ?, ?)`,
        [remitente, mensaje, fecha],
        (err) => {
          if (err) {
            console.error("❌ Error al guardar mensaje:", err.message);
          } else {
            console.log(`💾 Mensaje guardado de ${remitente}: "${mensaje}"`);
          }
        }
      );
      await learningHandler.processMessage(msg);
    });

    // 6) Inicializar el nuevo cliente
    await client.initialize();
    console.log("✅ Nuevo cliente inicializado tras logout.");

    // 7) Responder al usuario
    res.send(`
      <h1>✅ Sesión cerrada y cliente reiniciado</h1>
      <p>Puedes <a href="/generate-qr">generar un nuevo QR</a> para reconectar.</p>
      <p><a href="/">Volver al panel</a></p>
    `);
  } catch (error) {
    console.error("❌ Error en el cierre de sesión:", error);
    res.status(500).send("Error al cerrar sesión. Intente nuevamente.");
  }
});

module.exports = router;
