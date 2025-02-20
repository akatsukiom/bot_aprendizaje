const venom = require('venom-bot');
const express = require('express');
const qr = require('qr-image');
const app = express();
const port = process.env.PORT || 3000;

console.log('Iniciando aplicación...');

const venomOptions = {
    session: 'bot-session',
    multidevice: true,
    headless: true,
    useChrome: true,
    browserPathExecutable: '/usr/bin/google-chrome-stable',
    browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ]
};

app.get('/', (req, res) => {
    res.send('Bot WhatsApp Activo');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor iniciado en puerto ${port}`);
});

function startBot() {
    console.log('Iniciando bot con opciones:', JSON.stringify(venomOptions, null, 2));
    
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

            client.onQR((qrCode) => {
                console.log('Nuevo QR generado:', qrCode.length, 'caracteres');
            });
        })
        .catch((error) => {
            console.error('Error al iniciar bot:', error);
            setTimeout(startBot, 30000);
        });
}

console.log('Iniciando proceso completo...');
startBot();