const venom = require('venom-bot');
const express = require('express');
const qr = require('qr-image');
const app = express();
const port = process.env.PORT || 3000;

let qrCode = null;
let sessionStatus = 'initializing';

// Configurar middleware para servir archivos estáticos
app.use(express.static('public'));

// Ruta principal que muestra el estado y el QR si está disponible
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>WhatsApp Bot</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background-color: #f0f2f5;
                    padding: 20px;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 600px;
                    width: 100%;
                }
                .status {
                    margin: 20px 0;
                    padding: 10px;
                    border-radius: 5px;
                    background: #e8f5e9;
                    color: #2e7d32;
                }
                .qr-container {
                    margin: 20px 0;
                }
                .qr-container img {
                    max-width: 300px;
                    height: auto;
                }
                .refresh-button {
                    background: #25d366;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    margin-top: 20px;
                }
                .instructions {
                    margin-top: 20px;
                    color: #666;
                    font-size: 14px;
                    line-height: 1.5;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>WhatsApp Bot QR Code</h1>
                <div class="status" id="status">
                    Estado: ${sessionStatus}
                </div>
                <div class="qr-container" id="qr-container">
                    ${qrCode ? `<img src="data:image/png;base64,${qrCode}" alt="QR Code">` : 'Generando QR...'}
                </div>
                <button class="refresh-button" onclick="window.location.reload()">
                    Actualizar página
                </button>
                <div class="instructions">
                    <p>Para conectar tu WhatsApp:</p>
                    <ol style="text-align: left">
                        <li>Abre WhatsApp en tu teléfono</li>
                        <li>Toca Menú o Configuración y selecciona WhatsApp Web</li>
                        <li>Apunta tu teléfono hacia esta pantalla para escanear el código QR</li>
                    </ol>
                </div>
            </div>
            <script>
                // Recargar la página cada 30 segundos si no hay QR
                if (!${!!qrCode}) {
                    setTimeout(() => window.location.reload(), 30000);
                }
            </script>
        </body>
        </html>
    `);
});

// Ruta para obtener el estado actual
app.get('/status', (req, res) => {
    res.json({ status: sessionStatus, hasQR: !!qrCode });
});

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor web iniciado en el puerto ${port}`);
});

// Función para generar QR en base64
function generateQRBase64(qrData) {
    const qrPNG = qr.imageSync(qrData, { type: 'png', size: 20 });
    return qrPNG.toString('base64');
}

// Iniciar Venom
function startBot() {
    venom
        .create({
            session: 'bot-session',
            multidevice: true,
            headless: true,
            useChrome: false,
            debug: false,
            logQR: true,
            disableWelcome: true,
            createPathFileToken: true,
            waitForLogin: true,
        })
        .then((client) => {
            console.log('Bot iniciado exitosamente!');
            sessionStatus = 'connected';
            start(client);
        })
        .catch((error) => {
            console.error('Error al iniciar el bot:', error);
            sessionStatus = 'error';
            // Reintentar después de 30 segundos
            setTimeout(startBot, 30000);
        });
}

// Configurar eventos del bot
function start(client) {
    // Manejar mensajes entrantes
    client.onMessage(async (message) => {
        if (message.body === '!ping') {
            await client.sendText(message.from, 'pong');
        }
    });

    // Manejar nuevo QR
    client.onQR((qrContent) => {
        console.log('Nuevo QR generado');
        qrCode = generateQRBase64(qrContent);
        sessionStatus = 'waiting_for_qr_scan';
    });

    // Manejar desconexión
    client.onStateChange((state) => {
        console.log('Estado del bot:', state);
        sessionStatus = state;
        if (state === 'DISCONNECTED') {
            // Intentar reconectar
            setTimeout(() => {
                startBot();
            }, 5000);
        }
    });
}

// Iniciar el bot
console.log('Iniciando bot...');
startBot();