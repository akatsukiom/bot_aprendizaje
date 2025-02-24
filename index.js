const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Crear carpeta para la sesión si no existe
const SESSION_DIR = path.join(__dirname, 'baileys_auth_info');
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Configurar el servidor Express
const app = express();
const port = process.env.PORT || 8000;

// Variable para almacenar el QR
let qrUrl = '';
let connectionStatus = 'disconnected';
let lastQR = null;

// Función para iniciar el bot de WhatsApp
async function startWhatsappBot() {
    // Cargar estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    // Crear socket de WhatsApp
    const sock = makeWASocket({
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Bot WhatsApp', 'Chrome', '10.0.0'],
    });
    
    // Manejar conexiones/desconexiones
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada debido a ', lastDisconnect?.error, ', reconectando: ', shouldReconnect);
            
            connectionStatus = 'disconnected';
            
            // Reconectar si no fue un logout
            if (shouldReconnect) {
                startWhatsappBot();
            }
        } else if (connection === 'open') {
            console.log('¡Conexión abierta!');
            connectionStatus = 'connected';
            qrUrl = '';
        }
        
        // Actualizar QR si está disponible
        if (qr) {
            lastQR = qr;
            try {
                qrUrl = await QRCode.toDataURL(qr);
                console.log('Nuevo QR generado, accede a /qr para escanearlo');
            } catch (err) {
                console.error('Error al generar QR:', err);
            }
        }
    });
    
    // Guardar credenciales cuando se actualicen
    sock.ev.on('creds.update', saveCreds);
    
    // Manejar mensajes entrantes
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message) {
            // Extraer el texto del mensaje si existe
            const messageText = msg.message.conversation || 
                               (msg.message.extendedTextMessage && 
                                msg.message.extendedTextMessage.text) || '';
            
            console.log('Mensaje recibido:', messageText);
            
            // Responder a mensajes específicos
            if (messageText.toLowerCase() === 'hola') {
                await sock.sendMessage(msg.key.remoteJid, { text: '👋 ¡Hola! Soy un bot de WhatsApp creado con Baileys.' });
            } else if (messageText.toLowerCase() === 'info') {
                await sock.sendMessage(msg.key.remoteJid, { 
                    text: '📱 *Bot de WhatsApp*\n\nEste bot fue creado usando Baileys y está alojado en Koyeb.' 
                });
            }
        }
    });
    
    return sock;
}

// Ruta principal
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
        <head>
            <title>Bot de WhatsApp con Baileys</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                h1 {
                    color: #2c3e50;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 10px;
                }
                .status {
                    background-color: #e8f4fd;
                    border-left: 4px solid #3498db;
                    padding: 15px;
                    margin: 20px 0;
                }
                .status.connected {
                    background-color: #d4edda;
                    border-left-color: #28a745;
                }
                .status.disconnected {
                    background-color: #f8d7da;
                    border-left-color: #dc3545;
                }
                .qr-container {
                    margin: 20px 0;
                    text-align: center;
                }
                .refresh-btn {
                    background-color: #3498db;
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-top: 10px;
                }
                .refresh-btn:hover {
                    background-color: #2980b9;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Bot de WhatsApp con Baileys</h1>
                
                <div class="status ${connectionStatus}">
                    <p><strong>Estado:</strong> ${connectionStatus === 'connected' ? 
                        '✅ Conectado' : 
                        '⏳ Esperando conexión'}</p>
                </div>
                
                ${qrUrl ? `
                <div class="qr-container">
                    <h2>Escanea este código QR con WhatsApp</h2>
                    <p>Abre WhatsApp en tu teléfono > Configuración > Dispositivos vinculados > Vincular un dispositivo</p>
                    <img src="${qrUrl}" alt="QR Code" style="max-width: 300px;" />
                    <p><a href="/qr"><button class="refresh-btn">Actualizar QR</button></a></p>
                </div>
                ` : connectionStatus === 'connected' ? `
                <p>✅ El bot está conectado y funcionando. No es necesario escanear un código QR.</p>
                ` : `
                <p>⏳ Esperando código QR. <a href="/">Actualiza la página</a> en unos segundos.</p>
                `}
                
                <h2>Instrucciones</h2>
                <ol>
                    <li>Escanea el código QR con WhatsApp si aparece.</li>
                    <li>Una vez conectado, el bot responderá a los siguientes comandos:
                        <ul>
                            <li><strong>hola</strong> - El bot te saludará</li>
                            <li><strong>info</strong> - El bot mostrará información sobre sí mismo</li>
                        </ul>
                    </li>
                </ol>
                
                <p>Hora del servidor: ${new Date().toLocaleString()}</p>
            </div>
            <script>
                // Recargar la página cada 30 segundos si estamos esperando QR o conexión
                ${connectionStatus !== 'connected' ? `
                setTimeout(() => {
                    window.location.reload();
                }, 30000);
                ` : ''}
            </script>
        </body>
    </html>
    `);
});

// Ruta específica para el QR
app.get('/qr', (req, res) => {
    if (qrUrl) {
        res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Código QR - WhatsApp</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                    img { max-width: 300px; margin: 20px auto; display: block; }
                </style>
            </head>
            <body>
                <h1>Escanea este código QR con WhatsApp</h1>
                <p>Abre WhatsApp en tu teléfono > Configuración > Dispositivos vinculados > Vincular un dispositivo</p>
                <img src="${qrUrl}" alt="QR Code for WhatsApp" />
                <p><a href="/">Volver a la página principal</a></p>
                <script>
                    // Recargar la página cada 20 segundos para obtener un nuevo QR si es necesario
                    setTimeout(() => {
                        window.location.reload();
                    }, 20000);
                </script>
            </body>
        </html>
        `);
    } else if (connectionStatus === 'connected') {
        res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Bot Conectado</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                </style>
            </head>
            <body>
                <h1>¡Bot Conectado!</h1>
                <p>No es necesario escanear un código QR. El bot ya está conectado a WhatsApp.</p>
                <p><a href="/">Volver a la página principal</a></p>
            </body>
        </html>
        `);
    } else {
        res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Esperando QR</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                </style>
                <meta http-equiv="refresh" content="5">
            </head>
            <body>
                <h1>Esperando código QR</h1>
                <p>El sistema está generando un código QR. Por favor, espera unos segundos...</p>
                <p><a href="/qr">Actualizar</a> | <a href="/">Volver a la página principal</a></p>
            </body>
        </html>
        `);
    }
});

// Iniciar el servidor Express
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor web iniciado en puerto ${port}`);
    console.log(`Visita http://localhost:${port} para ver el estado`);
    
    // Iniciar el bot de WhatsApp
    startWhatsappBot()
        .then(() => console.log('Inicialización del bot completada'))
        .catch(err => console.error('Error iniciando el bot:', err));
});