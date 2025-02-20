const venom = require('venom-bot');
const express = require('express');
const qr = require('qr-image');
const app = express();
const port = process.env.PORT || 3000;

let qrCode = null;
let sessionStatus = 'initializing';

console.log('Iniciando servidor...');

app.get('/', (req, res) => {
    console.log('Acceso a ruta principal');
    res.send('Bot WhatsApp Activo');
});

// Iniciar el servidor
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor iniciado en puerto ${port}`);
});

// Configuración de venom-bot
const venomOptions = {
    session: 'bot-session',
    multidevice: true,
    headless: true,
    useChrome: true,
    debug: true,
    logQR: true,
    browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-webgl',
        '--disable-threaded-animation',
        '--disable-threaded-scrolling',
        '--disable-in-process-stack-traces',
        '--disable-histogram-customizer',
        '--disable-gl-extensions',
        '--disable-composited-antialiasing',
        '--disable-canvas-aa',
        '--disable-3d-apis',
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding',
        '--disable-accelerated-mjpeg-decode',
        '--disable-app-list-dismiss-on-blur',
        '--disable-accelerated-video-decode'
    ],
    createPathFileToken: true,
    chromiumVersion: '818858',
};

console.log('Iniciando venom con opciones:', JSON.stringify(venomOptions, null, 2));

function startBot() {
    console.log('Intentando iniciar el bot...');
    
    venom
        .create(venomOptions)
        .then((client) => {
            console.log('Bot iniciado exitosamente');
            
            client.onMessage((message) => {
                console.log('Mensaje recibido:', message.body);
                if (message.body === '!ping') {
                    client.sendText(message.from, 'pong');
                }
            });

            client.onStateChange((state) => {
                console.log('Estado del bot cambiado a:', state);
                sessionStatus = state;
            });

            client.onQR((qrCode) => {
                console.log('Nuevo código QR generado');
                // Convertir QR a imagen y guardarlo
                const qrImage = qr.imageSync(qrCode, { type: 'png' });
                qrCode = qrImage.toString('base64');
            });

        })
        .catch((error) => {
            console.error('Error al iniciar el bot:', error);
            // Reintentar después de 30 segundos
            setTimeout(startBot, 30000);
        });
}

// Iniciar el bot
console.log('Iniciando proceso del bot...');
startBot();