const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Importar DB y learningHandler (si los usas)
const db = require('../db');
const learningHandler = require('../src/handlers/learningHandler');

// Crear una instancia única del cliente
let client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Variable global para almacenar el QR actual
let currentQR = null;
// Variable global para almacenar el número de WhatsApp cuando esté conectado
let connectedNumber = '-';

/* ==============================
   EVENTOS DEL CLIENTE
============================== */

// Cuando se genera un QR
client.on('qr', (qr) => {
  console.log('📱 Se generó un nuevo QR');
  qrcode.generate(qr, { small: true });
  currentQR = qr;
});

// Cuando el cliente está listo
client.on('ready', () => {
  console.log('🤖 Bot de WhatsApp listo y en modo aprendizaje');
  currentQR = null;
  // Al estar conectado, guardar el número real
  connectedNumber = client.info && client.info.wid ? client.info.wid.user : '-';
});

// Evento: mensaje entrante (usuario)
client.on('message', async (msg) => {
  const remitente = msg.from;
  const mensaje = msg.body;
  const fecha = new Date().toISOString();

  if (db) {
    db.run(`
      INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
      VALUES (?, ?, ?, 0)
    `, [remitente, mensaje, fecha], (err) => {
      if (err) {
        console.error('❌ Error al guardar mensaje (usuario):', err.message);
      } else {
        console.log(`💾 Mensaje de usuario guardado: "${mensaje}" de ${remitente}`);
      }
    });
  }
  if (learningHandler) {
    await learningHandler.processMessage(msg);
  }
});

// Evento: mensaje creado (bot)
client.on('message_create', async (msg) => {
  if (msg.fromMe) {
    const remitente = msg.to;
    const mensaje = msg.body;
    const fecha = new Date().toISOString();

    if (db) {
      db.run(`
        INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
        VALUES (?, ?, ?, 1)
      `, [remitente, mensaje, fecha], (err) => {
        if (err) {
          console.error('❌ Error al guardar mensaje (bot):', err.message);
        } else {
          console.log(`💾 Mensaje del bot guardado: "${mensaje}" para ${remitente}`);
        }
      });
    }
  }
});

/* ==============================
   INICIALIZAR CLIENTE
============================== */
client.initialize().then(() => {
  console.log('✅ Cliente de WhatsApp inicializado');
}).catch(err => {
  console.error('Error al inicializar cliente:', err);
});

/* ==============================
   RUTAS
============================== */

// Endpoint /qr-status: devuelve el estado actual y, si está en proceso, el QR
router.get('/qr-status', async (req, res) => {
  try {
    const state = await client.getState(); // Posibles valores: CONNECTED, DISCONNECTED, etc.
    if (state === 'CONNECTED') {
      return res.json({ state: 'CONNECTED', qr: null });
    }
    if (!client.pupPage) {
      return res.json({ state: 'DISCONNECTED', qr: null });
    }
    return res.json({ state: 'CONNECTING', qr: currentQR });
  } catch (err) {
    console.error('Error al obtener estado:', err);
    return res.json({ state: 'DISCONNECTED', qr: null });
  }
});

// Endpoint /connection-status: devuelve el estado y el número (si conectado)
router.get('/connection-status', async (req, res) => {
  try {
    const state = await client.getState();
    if (state === 'CONNECTED') {
      return res.json({ state: 'CONNECTED', number: connectedNumber });
    }
    return res.json({ state: 'DISCONNECTED', number: '-' });
  } catch (err) {
    console.error('Error al consultar connection status:', err);
    return res.json({ state: 'DISCONNECTED', number: '-' });
  }
});

// Ruta /generate-qr: página HTML que hace polling a /qr-status
router.get('/generate-qr', async (req, res) => {
  try {
    const state = await client.getState();
    if (state === 'CONNECTED') {
      return res.send(`
        <h1>✅ Bot ya está conectado</h1>
        <p><a href="/">Volver al panel</a></p>
      `);
    }
    res.send(`
      <html>
      <head>
        <title>Generando código QR</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      </head>
      <body>
        <h1>Generando código QR...</h1>
        <p id="status">Conectando...</p>
        <div id="qrcode"></div>
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
              const resp = await fetch("/qr-status");
              const data = await resp.json();
              if (data.state === "CONNECTED") {
                document.getElementById("status").innerText = "✅ Conectado exitosamente!";
                document.getElementById("qrcode").innerHTML = "<h2>✅ Conectado</h2>";
                clearInterval(intervalId);
                setTimeout(() => {
                  window.location.href = "/";
                }, 3000);
              } else if (data.state === "CONNECTING") {
                if (data.qr) {
                  createQR(data.qr);
                } else {
                  document.getElementById("status").innerText = "Conectando...";
                }
              } else {
                document.getElementById("status").innerText = "Desconectado. Genera un nuevo QR.";
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
  } catch (err) {
    console.error('Error al generar QR:', err);
    res.status(500).send('Error al generar QR. Intenta nuevamente.');
  }
});

// Ruta /logout: cierra sesión y reinicializa el cliente
router.get('/logout', async (req, res) => {
  try {
    await client.logout();
    console.log('✅ Sesión de WhatsApp cerrada correctamente');
    const sessionPath = './.wwebjs_auth';
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log('🗑 Carpeta de sesión eliminada');
    }
    await client.destroy();
    console.log('🔄 Cliente destruido.');
    
    // Crear un nuevo cliente
    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
    // Registrar eventos nuevamente
    client.on('qr', (qr) => {
      console.log('📱 Nuevo QR tras logout');
      qrcode.generate(qr, { small: true });
      currentQR = qr;
    });
    client.on('ready', () => {
      console.log('🤖 Nuevo cliente listo tras logout');
      currentQR = null;
      connectedNumber = client.info && client.info.wid ? client.info.wid.user : '-';
    });
    client.on('message', async (msg) => {
      const remitente = msg.from;
      const mensaje = msg.body;
      const fecha = new Date().toISOString();
      if (db) {
        db.run(`
          INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
          VALUES (?, ?, ?, 0)
        `, [remitente, mensaje, fecha]);
      }
      if (learningHandler) {
        await learningHandler.processMessage(msg);
      }
    });
    client.on('message_create', async (msg) => {
      if (msg.fromMe && db) {
        const remitente = msg.to;
        const mensaje = msg.body;
        const fecha = new Date().toISOString();
        db.run(`
          INSERT INTO mensajes (remitente, mensaje, fecha, fromMe)
          VALUES (?, ?, ?, 1)
        `, [remitente, mensaje, fecha]);
      }
    });
    await client.initialize();
    console.log('✅ Nuevo cliente inicializado tras logout.');
    
    res.send(`
      <h1>✅ Sesión cerrada y cliente reiniciado</h1>
      <p>Puedes <a href="/generate-qr">generar un nuevo QR</a> para reconectar.</p>
      <p><a href="/">Volver al panel</a></p>
    `);
  } catch (err) {
    console.error('❌ Error al cerrar sesión:', err);
    res.status(500).send('Error al cerrar sesión. Intenta nuevamente.');
  }
});

module.exports = router;
