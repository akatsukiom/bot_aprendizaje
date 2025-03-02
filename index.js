// index.js - Bot de WhatsApp en modo aprendizaje (solo captura, sin respuestas)

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Importar LearningHandler
const LearningHandler = require('./src/handlers/learningHandler');

const app = express();
const port = process.env.PORT || 8000;

// Configuración de la base de datos SQLite principal
const dbPath = path.join(__dirname, 'mensajes.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error al conectar con la base de datos:", err.message);
    } else {
        console.log("📂 Base de datos SQLite conectada");
        db.run(`CREATE TABLE IF NOT EXISTS mensajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remitente TEXT,
            mensaje TEXT,
            fecha TEXT
        )`);
    }
});

// Inicializar el cliente de WhatsApp como variable global
global.client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

// Referencia local para facilitar el uso
const client = global.client;

// Variable para almacenar el QR actual
let currentQR = null;

// Inicializar el módulo de aprendizaje
const learningHandler = new LearningHandler();

// Evento QR
client.on('qr', (qr) => {
    console.log('📱 Código QR generado:');
    qrcode.generate(qr, { small: true });
    currentQR = qr; 
});

// Evento cuando el cliente está listo
client.on('ready', () => {
    console.log('🤖 Bot de WhatsApp listo y en modo aprendizaje');
    currentQR = null;
});

// Evento para almacenar mensajes en la base de datos y procesar aprendizaje
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

// Ruta para obtener los mensajes en tiempo real
app.get('/messages', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC LIMIT 100", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Ruta para obtener estadísticas de aprendizaje
app.get('/learning/stats', async (req, res) => {
    try {
        const stats = await learningHandler.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener patrones aprendidos
app.get('/learning/patterns', (req, res) => {
    learningHandler.db.all(
        "SELECT * FROM patrones_respuesta ORDER BY frecuencia DESC", 
        [], 
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Ruta para obtener el estado actual del QR (ahora asíncrona) // <-- Cambio
app.get('/qr-status', async (req, res) => {
    try {
        // Esperamos el estado real del cliente
        const state = await client.getState();  // <-- Cambio
        res.json({
            state: state,
            qr: currentQR
        });
    } catch (err) {
        console.error("Error al obtener el estado:", err);
        // En caso de error, devolvemos 'DISCONNECTED'
        res.json({
            state: 'DISCONNECTED',
            qr: currentQR
        });
    }
});

// Ruta para exportar la base de datos a JSON
app.get('/export/json', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.setHeader('Content-Disposition', 'attachment; filename=mensajes.json');
        res.json(rows);
    });
});

// Ruta para exportar patrones aprendidos a JSON
app.get('/export/patterns/json', (req, res) => {
    learningHandler.db.all(
        "SELECT * FROM patrones_respuesta ORDER BY frecuencia DESC", 
        [], 
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.setHeader('Content-Disposition', 'attachment; filename=patrones.json');
            res.json(rows);
        }
    );
});

// Ruta para exportar la base de datos a CSV
app.get('/export/csv', (req, res) => {
    db.all("SELECT * FROM mensajes ORDER BY fecha DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        let csvContent = "id,remitente,mensaje,fecha\n";
        rows.forEach(row => {
            // Escapar comillas internas en "mensaje"
            const safeMessage = row.mensaje.replace(/"/g, '""');
            csvContent += `${row.id},"${row.remitente}","${safeMessage}","${row.fecha}"\n`;
        });
        res.setHeader('Content-Disposition', 'attachment; filename=mensajes.csv');
        res.setHeader('Content-Type', 'text/csv');
        res.send(csvContent);
    });
});

// Ruta mejorada para cerrar sesión y mostrar QR
app.get('/logout', async (req, res) => {
    try {
        // Cerrar sesión de WhatsApp correctamente
        await client.logout();
        console.log("✅ Sesión de WhatsApp cerrada correctamente");
        
        // Eliminar carpeta de autenticación
        const sessionPath = './.wwebjs_auth';
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log("🗑 Carpeta de sesión eliminada");
        }
        
        // Enviar respuesta con JavaScript para recargar después de 5 segundos
        res.send(`
            <h1>✅ Sesión cerrada correctamente</h1>
            <p>La página se recargará automáticamente en 5 segundos para mostrar el código QR.</p>
            <p>O puedes <a href="/">hacer clic aquí</a> para volver al inicio.</p>
            <script>
                setTimeout(function() {
                    window.location.href = '/';
                }, 5000);
            </script>
        `);
        
        // Reiniciar WhatsApp después de enviar la respuesta
        setTimeout(async () => {
            try {
                // Destruir la instancia actual del cliente
                await client.destroy();
                console.log("🔄 Cliente destruido, reiniciando...");
                
                // Crear una nueva instancia del cliente
                global.client = new Client({
                    authStrategy: new LocalAuth(),
                    puppeteer: {
                        args: ['--no-sandbox', '--disable-setuid-sandbox'],
                        headless: true
                    }
                });
                
                // Re-registrar eventos
                client.on('qr', (qr) => {
                    console.log('📱 Nuevo código QR generado');
                    qrcode.generate(qr, { small: true });
                    currentQR = qr;
                });
                
                client.on('ready', () => {
                    console.log('🤖 Bot de WhatsApp reiniciado y listo');
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
                
                // Inicializar el nuevo cliente
                await client.initialize();
            } catch (error) {
                console.error("❌ Error al reiniciar el cliente:", error);
            }
        }, 2000);
        
    } catch (error) {
        console.error("❌ Error en el cierre de sesión:", error);
        res.status(500).send("Error al cerrar sesión. Intente nuevamente.");
    }
});

// Ruta para forzar la regeneración del QR (ahora asíncrona) // <-- Cambio
app.get('/generate-qr', async (req, res) => {
    try {
        // Esperar el estado real del cliente // <-- Cambio
        const connectionState = await client.getState(); // <-- Cambio
        
        if (connectionState === 'CONNECTED') {
            res.send(`
                <h1>✅ Bot ya está conectado</h1>
                <p>El bot ya está conectado a WhatsApp y funcionando correctamente.</p>
                <p><a href="/">Volver al panel</a></p>
            `);
            return;
        }
        
        // Mostrar página con QR dinámico
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
                    
                    // Función para crear el QR
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
                    
                    // Función para verificar el estado
                    async function checkStatus() {
                        try {
                            const response = await fetch('/qr-status');
                            const data = await response.json();
                            
                            if (data.state === 'CONNECTED') {
                                document.getElementById('status').innerText = '✅ Conectado exitosamente!';
                                document.getElementById('qrcode').innerHTML = '<h2>✅ Conectado</h2>';
                                clearInterval(intervalId);
                                
                                // Redirigir al panel principal después de 3 segundos
                                setTimeout(() => {
                                    window.location.href = '/';
                                }, 3000);
                                
                            } else if (data.qr) {
                                createQR(data.qr);
                            }
                        } catch (error) {
                            document.getElementById('status').innerText = 'Error al obtener estado: ' + error;
                        }
                    }
                    
                    // Verificar cada 3 segundos
                    const intervalId = setInterval(checkStatus, 3000);
                    
                    // Verificar inmediatamente al cargar
                    checkStatus();
                </script>
            </body>
            </html>
        `);

        // Si no está conectado ni conectándose, reiniciamos el cliente
        if (connectionState !== 'CONNECTED' && connectionState !== 'CONNECTING') {
            await client.destroy();
            global.client = new Client({
                authStrategy: new LocalAuth(),
                puppeteer: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                    headless: true
                }
            });
            
            // Re-registrar eventos
            client.on('qr', (qr) => {
                console.log('📱 Nuevo código QR generado');
                currentQR = qr;
                qrcode.generate(qr, { small: true });
            });
            
            client.on('ready', () => {
                console.log('🤖 Bot de WhatsApp reiniciado y listo');
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
            
            // Inicializar cliente
            await client.initialize();
        }
        
    } catch (error) {
        console.error("❌ Error al generar QR:", error);
        res.status(500).send("Error al generar QR. Intente nuevamente.");
    }
});

// Página principal con consola de mensajes y patrones en tiempo real
// Ahora asíncrona para obtener el estado real // <-- Cambio
app.get('/', async (req, res) => {
    try {
        // Esperamos el estado real del cliente // <-- Cambio
        const connState = await client.getState(); // <-- Cambio
        const isConnected = (connState === 'CONNECTED');

        // Si no está conectado y tenemos un QR, redirigimos a la página del QR
        if (!isConnected && currentQR) {
            res.redirect('/generate-qr');
            return;
        }

        res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bot de WhatsApp en Modo Aprendizaje</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                .container { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; }
                .panel { flex: 1; min-width: 300px; max-width: 500px; margin: 10px; background: #f4f4f4; padding: 10px; border-radius: 10px; height: 400px; overflow-y: scroll; }
                .stats { display: flex; justify-content: center; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
                .stat-box { background: #2196F3; color: white; padding: 15px; border-radius: 5px; min-width: 120px; text-align: center; }
                .message { text-align: left; margin-bottom: 10px; padding: 5px; border-radius: 5px; background: white; }
                .pattern { text-align: left; margin-bottom: 10px; padding: 5px; border-radius: 5px; background: #e0f7fa; }
                .timestamp { font-size: 12px; color: gray; }
                .tabs { display: flex; justify-content: center; margin-bottom: 20px; }
                .tab { padding: 10px 20px; margin: 0 5px; background: #ddd; border-radius: 5px 5px 0 0; cursor: pointer; }
                .tab.active { background: #2196F3; color: white; }
                button { background: #2196F3; color: white; padding: 10px; border: none; cursor: pointer; margin: 5px; border-radius: 5px; }
                .status-indicator { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px; }
                .status-connected { background-color: #4CAF50; }
                .status-disconnected { background-color: #F44336; }
                .status-bar { margin: 10px 0; padding: 10px; border-radius: 5px; background-color: #f0f0f0; }
                .danger { background-color: #F44336; }
            </style>
        </head>
        <body>
            <h1>🧠 Bot de WhatsApp en Modo Aprendizaje</h1>
            
            <div class="status-bar">
                <div class="status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}"></div>
                Estado actual: <strong>${isConnected ? 'Conectado' : 'Desconectado'}</strong>
                ${!isConnected ? ' <a href="/generate-qr"><button>Generar QR</button></a>' : ''}
            </div>

            <div>
                <a href="/logout"><button class="danger">Cerrar Sesión</button></a>
            </div>

            <div class="tabs">
                <div class="tab active" onclick="showTab('messages')">Mensajes</div>
                <div class="tab" onclick="showTab('patterns')">Patrones Aprendidos</div>
            </div>

            <div class="container">
                <div id="messages" class="panel">
                    <h2>📩 Mensajes Recibidos</h2>
                    <div id="message-list">Cargando...</div>
                </div>
                
                <div id="patterns" class="panel" style="display:none;">
                    <h2>🧩 Patrones Aprendidos</h2>
                    <div id="pattern-list">Cargando...</div>
                </div>
            </div>

            <div class="stats">
                <div class="stat-box">
                    <span id="total-messages">0</span><br>Mensajes
                </div>
                <div class="stat-box">
                    <span id="total-patterns">0</span><br>Patrones
                </div>
                <div class="stat-box">
                    <span id="total-contexts">0</span><br>Contextos
                </div>
            </div>

            <button onclick="exportMessagesJSON()">Exportar Mensajes (JSON)</button>
            <button onclick="exportMessagesCSV()">Exportar Mensajes (CSV)</button>
            <button onclick="exportPatternsJSON()">Exportar Patrones (JSON)</button>

            <script>
                function showTab(tabId) {
                    document.getElementById('messages').style.display = (tabId === 'messages') ? 'block' : 'none';
                    document.getElementById('patterns').style.display = (tabId === 'patterns') ? 'block' : 'none';
                    
                    const tabs = document.getElementsByClassName('tab');
                    for (let i = 0; i < tabs.length; i++) {
                        tabs[i].classList.remove('active');
                    }
                    event.target.classList.add('active');
                }

                async function loadMessages() {
                    try {
                        const response = await fetch('/messages');
                        const data = await response.json();
                        const messageList = document.getElementById('message-list');
                        messageList.innerHTML = '';
                        data.forEach(msg => {
                            const div = document.createElement('div');
                            div.className = 'message';
                            div.innerHTML = \`
                                <strong>\${msg.remitente}:</strong> \${msg.mensaje}
                                <div class="timestamp">\${msg.fecha}</div>
                            \`;
                            messageList.appendChild(div);
                        });
                    } catch (err) {
                        console.error('Error al cargar mensajes:', err);
                    }
                }

                async function loadPatterns() {
                    try {
                        const response = await fetch('/learning/patterns');
                        const data = await response.json();
                        const patternList = document.getElementById('pattern-list');
                        patternList.innerHTML = '';
                        data.forEach(pt => {
                            const div = document.createElement('div');
                            div.className = 'pattern';
                            div.innerHTML = \`
                                <strong>Patrón:</strong> \${pt.patron}<br>
                                <strong>Respuesta:</strong> \${pt.respuesta}<br>
                                Frecuencia: \${pt.frecuencia} | Relevancia: \${pt.puntuacion_relevancia} | Categoría: \${pt.categoria}
                                <div class="timestamp">Última actualización: \${pt.ultima_actualizacion}</div>
                            \`;
                            patternList.appendChild(div);
                        });
                    } catch (err) {
                        console.error('Error al cargar patrones:', err);
                    }
                }

                async function loadStats() {
                    try {
                        const response = await fetch('/learning/stats');
                        const data = await response.json();
                        document.getElementById('total-messages').innerText = data.mensajes;
                        document.getElementById('total-patterns').innerText = data.patrones;
                        document.getElementById('total-contexts').innerText = data.contextos;
                    } catch (err) {
                        console.error('Error al cargar estadísticas:', err);
                    }
                }

                function exportMessagesJSON() {
                    window.location.href = '/export/json';
                }

                function exportMessagesCSV() {
                    window.location.href = '/export/csv';
                }

                function exportPatternsJSON() {
                    window.location.href = '/export/patterns/json';
                }

                // Cargar todo al inicio
                loadMessages();
                loadPatterns();
                loadStats();
            </script>
        </body>
        </html>
        `);
    } catch (error) {
        console.error("Error en / ruta principal:", error);
        res.status(500).send("Error al renderizar la página principal.");
    }
});

// Iniciar el servidor
app.listen(port, async () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);

    // Inicializar el cliente de WhatsApp
    await client.initialize();
    console.log("✅ Cliente de WhatsApp inicializado");
});
