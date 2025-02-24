const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Servidor web básico
app.get('/', (req, res) => {
  res.send('<h1>Bot de WhatsApp</h1><p>Servicio activo</p>');
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor web iniciado en puerto ${port}`);
  
  // Iniciar bot después de que el servidor esté listo
  setTimeout(initBot, 3000);
});

// Función para iniciar el bot
function initBot() {
  try {
    console.log("Iniciando WhatsApp bot...");
    
    // Importar whatsapp-web.js
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const qrcode = require('qrcode-terminal');
    
    // Crear cliente de WhatsApp
 // En la parte donde configuramos el cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});
    
    // Evento de código QR
    client.on('qr', (qr) => {
      console.log('CÓDIGO QR RECIBIDO:');
      qrcode.generate(qr, {small: true});
      
      // Mostrar QR en la web
      app.get('/qr', (req, res) => {
        res.send(`
          <html>
            <head>
              <title>WhatsApp QR Code</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body style="text-align: center; padding: 20px;">
              <h1>Escanea este código QR con WhatsApp</h1>
              <p>Abre WhatsApp en tu teléfono > Configuración > Dispositivos vinculados</p>
              <div style="margin: 20px;">
                <pre>${qr}</pre>
              </div>
            </body>
          </html>
        `);
      });
    });
    
    // Evento: cliente listo
    client.on('ready', () => {
      console.log('Cliente WhatsApp listo y conectado');
    });
    
    // Evento: mensaje recibido
    client.on('message', (msg) => {
      const text = msg.body.toLowerCase();
      
      if (text === 'hola' || text === 'hi') {
        msg.reply('👋 ¡Hola! Soy un bot de WhatsApp.');
      }
    });
    
    // Inicializar cliente
    client.initialize();
    
  } catch (error) {
    console.error("Error al iniciar el bot:", error);
  }
}