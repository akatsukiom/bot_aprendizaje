// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Importar la instancia actual del cliente (con let para poder reasignar tras logout)
let client = require('../client');

// Importar la DB y el learningHandler
const db = require('../db');
const learningHandler = require('../src/handlers/learningHandler');

// Variable para guardar el QR actual
let currentQR = null;

/* ============================================
   EVENTOS DEL CLIENTE DE WHATSAPP
============================================ */

// 1) Evento: se genera un QR
client.on('qr', (qr) => {
  console.log('📱 Código QR generado:');
  qrcode.generate(qr, { small: true });
  currentQR = qr;
});

// 2) Evento: el cliente está listo
client.on('ready', () => {
  console.log('🤖 Bot de WhatsApp listo y en modo aprendizaje');
  currentQR = null;
});

// 3) Evento: llega un mensaje (del usuario)
client.on('message', async (msg) => {
  const remitente = msg.from;         // Número del usuario
  const mensaje = msg.body;
  const fecha = new Date().toISOString();

  // Guardar mensaje en la base de datos con fromMe=0
  db.run(`
    INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
    VALUES (?, ?, ?, ?)
  `, [remitente, mensaje, fecha, 0], (err) => {
    if (err) {
      console.error("❌ Error al guardar mensaje (usuario):", err.message);
    } else {
      console.log(`💾 Mensaje de usuario guardado: "${mensaje}" de ${remitente}`);
    }
  });

  // Procesar el mensaje para aprendizaje (opcional)
  await learningHandler.processMessage(msg);
});

// 4) Evento: se crea un mensaje (incluye los que envía el bot)
client.on('message_create', async (msg) => {
  // Solo guardamos si lo envía el bot
  if (msg.fromMe) {
    const remitente = msg.to;         // A quién se lo envía el bot
    const mensaje = msg.body;
    const fecha = new Date().toISOString();

    // Guardar mensaje en la base de datos con fromMe=1
    db.run(`
      INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
      VALUES (?, ?, ?, ?)
    `, [remitente, mensaje, fecha, 1], (err) => {
      if (err) {
        console.error("❌ Error al guardar mensaje (bot):", err.message);
      } else {
        console.log(`💾 Mensaje del bot guardado: "${mensaje}" para ${remitente}`);
      }
    });
  }
});

/* ============================================
   RUTAS RELACIONADAS CON WHATSAPP
============================================ */

// Obtener estado y QR actual
router.get('/qr-status', async (req, res) => {
  try {
    // Si Puppeteer no existe, asumimos desconectado
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

// Mostrar la página de QR
router.get('/generate-qr', async (req, res) => {
  try {
    const state = await client.getState();
    if (state === 'CONNECTED') {
      return res.send(`
        <h1>✅ Bot ya está conectado</h1>
        <p><a href="/">Volver al panel</a></p>
      `);
    }
    // Renderiza HTML con script que hace polling a /qr-status
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

// Cerrar sesión y reiniciar cliente inmediatamente
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

    // 4) Crear e inicializar un NUEVO cliente
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

      db.run(`
        INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
        VALUES (?, ?, ?, ?)
      `, [remitente, mensaje, fecha, 0], (err) => {
        if (err) {
          console.error("❌ Error al guardar mensaje (usuario):", err.message);
        } else {
          console.log(`💾 Mensaje de usuario guardado: "${mensaje}" de ${remitente}`);
        }
      });

      await learningHandler.processMessage(msg);
    });
    client.on('message_create', async (msg) => {
      if (msg.fromMe) {
        const remitente = msg.to;
        const mensaje = msg.body;
        const fecha = new Date().toISOString();

        db.run(`
          INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
          VALUES (?, ?, ?, ?)
        `, [remitente, mensaje, fecha, 1], (err) => {
          if (err) {
            console.error("❌ Error al guardar mensaje (bot):", err.message);
          } else {
            console.log(`💾 Mensaje del bot guardado: "${mensaje}" para ${remitente}`);
          }
        });
      }
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
