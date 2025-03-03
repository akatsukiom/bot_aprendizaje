// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Importamos la instancia actual del cliente (con let para poder reasignarla tras logout)
let client = require('../client');

// Importar la DB y el learningHandler
const db = require('../db');
const learningHandler = require('../src/handlers/learningHandler');

// Importar el módulo de conexiones
const connections = require('../connections');

// Variable para guardar el QR actual
let currentQR = null;

// Variable global para saber a qué conexión corresponde la instancia actual
let currentConnectionId = null;

/* ============================================
   EVENTOS DEL CLIENTE DE WHATSAPP
============================================ */

// Cuando se genera un QR, actualizamos currentQR
client.on('qr', (qr) => {
  console.log('📱 Código QR generado:');
  qrcode.generate(qr, { small: true });
  currentQR = qr;
});

// Cuando el cliente está listo, actualizamos la conexión en el módulo connections
client.on('ready', () => {
  console.log('🤖 Bot de WhatsApp listo y en modo aprendizaje');
  currentQR = null;
  if (currentConnectionId) {
    // Actualizamos el estado a CONNECTED y obtenemos el número real del bot
    connections[currentConnectionId].state = 'CONNECTED';
    // Supongamos que client.info.wid.user contiene el número, ej.: '52123456789'
    connections[currentConnectionId].number = client.info?.wid?.user || '-';
  }
});

// Evento: mensaje entrante (del usuario)
client.on('message', async (msg) => {
  const remitente = msg.from;
  const mensaje = msg.body;
  const fecha = new Date().toISOString();

  db.run(
    `INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
     VALUES (?, ?, ?, ?)`,
    [remitente, mensaje, fecha, 0],
    (err) => {
      if (err) {
        console.error("❌ Error al guardar mensaje (usuario):", err.message);
      } else {
        console.log(`💾 Mensaje de usuario guardado: "${mensaje}" de ${remitente}`);
      }
    }
  );

  await learningHandler.processMessage(msg);
});

// Evento: mensaje creado (incluye mensajes del bot)
client.on('message_create', async (msg) => {
  if (msg.fromMe) {
    const remitente = msg.to;
    const mensaje = msg.body;
    const fecha = new Date().toISOString();

    db.run(
      `INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
       VALUES (?, ?, ?, ?)`,
      [remitente, mensaje, fecha, 1],
      (err) => {
        if (err) {
          console.error("❌ Error al guardar mensaje (bot):", err.message);
        } else {
          console.log(`💾 Mensaje del bot guardado: "${mensaje}" para ${remitente}`);
        }
      }
    );
  }
});

/* ============================================
   RUTAS RELACIONADAS CON WHATSAPP
============================================ */

// Endpoint para obtener el estado y número de la conexión actual
router.get('/connection-status', (req, res) => {
  const connectionId = req.query.connection;
  if (!connectionId || !connections[connectionId]) {
    return res.json({ state: 'DISCONNECTED', number: '-' });
  }
  res.json({
    state: connections[connectionId].state,
    number: connections[connectionId].number
  });
});

// Mostrar la página de QR (para iniciar conexión)
router.get('/generate-qr', async (req, res) => {
  try {
    const connectionId = req.query.connection;
    if (!connectionId || !connections[connectionId]) {
      return res.status(400).send("Parámetro de conexión inválido");
    }
    currentConnectionId = connectionId;
    // Marcar la conexión como en proceso (CONNECTING)
    connections[connectionId].state = 'CONNECTING';
    connections[connectionId].number = '-';

    const state = await client.getState();
    if (state === 'CONNECTED') {
      return res.send(`
        <h1>✅ Bot ya está conectado</h1>
        <p><a href="/">Volver al panel</a></p>
      `);
    }
    // Renderizar la página del QR
    res.send(`
      <html>
      <head>
        <title>Código QR de WhatsApp</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      </head>
      <body>
        <h1>Generando código QR para la Conexión ${connectionId}...</h1>
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
              const response = await fetch("/connection-status?connection=${connectionId}");
              const data = await response.json();
              if (data.state === "CONNECTED") {
                document.getElementById("status").innerText = "✅ Conectado exitosamente!";
                document.getElementById("qrcode").innerHTML = "<h2>✅ Conectado</h2>";
                clearInterval(intervalId);
                setTimeout(() => { window.location.href = "/"; }, 3000);
              } else if (data.state === "CONNECTING") {
                // Si sigue conectando, se puede actualizar el estado o hacer polling
                document.getElementById("status").innerText = "Conectando...";
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

// Ruta para cerrar sesión y reiniciar el cliente
router.get('/logout', async (req, res) => {
  try {
    await client.logout();
    console.log("✅ Sesión de WhatsApp cerrada correctamente");

    const sessionPath = './.wwebjs_auth';
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log("🗑 Carpeta de sesión eliminada");
    }

    await client.destroy();
    console.log("🔄 Cliente destruido.");

    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    client.on('qr', (qr) => {
      console.log('📱 Nuevo QR generado tras logout');
      qrcode.generate(qr, { small: true });
      currentQR = qr;
    });
    client.on('ready', () => {
      console.log('🤖 Nuevo cliente listo tras logout');
      currentQR = null;
      if (currentConnectionId) {
        connections[currentConnectionId].state = 'CONNECTED';
        connections[currentConnectionId].number = client.info?.wid?.user || '-';
      }
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

    await client.initialize();
    console.log("✅ Nuevo cliente inicializado tras logout.");

    res.send(`
      <h1>✅ Sesión cerrada y cliente reiniciado</h1>
      <p>Puedes <a href="/generate-qr?connection=${currentConnectionId}">generar un nuevo QR</a> para reconectar.</p>
      <p><a href="/">Volver al panel</a></p>
    `);
  } catch (error) {
    console.error("❌ Error en el cierre de sesión:", error);
    res.status(500).send("Error al cerrar sesión. Intente nuevamente.");
  }
});

module.exports = router;
