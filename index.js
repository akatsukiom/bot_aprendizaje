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
    currentQR = qr; // Guardar el QR actual
});

// Evento cuando el cliente está listo
client.on('ready', () => {
    console.log('🤖 Bot de WhatsApp listo y en modo aprendizaje');
    currentQR = null; // Limpiar QR cuando estamos conectados
});

// Evento para almacenar mensajes en la base de datos y procesar aprendizaje
client.on('message', async (msg) => {
    const remitente = msg.from;
    const mensaje = msg.body;
    const fecha = new Date().toISOString();

    // Guardar en la base de datos principal
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

// Ruta para obtener el estado actual del QR
app.get('/qr-status', (req, res) => {
    const state = client.getState() || 'DISCONNECTED';
    res.json({
        state: state,
        qr: currentQR
    });
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
            csvContent += `${row.id},"${row.remitente}","${row.mensaje.replace(/"/g, '""')}","${row.fecha}"\n`;
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
                
                // Volver a registrar los eventos
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

// Ruta para forzar la regeneración del QR
app.get('/generate-qr', async (req, res) => {
    try {
        // Estado actual del cliente
        const connectionState = client.getState();
        
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

        // Reiniciar el cliente solo si no está conectado
        if (connectionState !== 'CONNECTED' && connectionState !== 'CONNECTING') {
            // Intentar reiniciar el cliente
            await client.destroy();
            global.client = new Client({
                authStrategy: new LocalAuth(),
                puppeteer: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                    headless: true
                }
            });
            
            // Restablecer eventos
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
app.get('/', (req, res) => {
    const connState = client.getState();
    const isConnected = connState === 'CONNECTED';
    
    if (!isConnected && currentQR) {
        // Si no está conectado y hay un QR, redirigir a la página del QR
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
            
            <p>El bot está registrando mensajes y aprendiendo patrones de conversación sin enviar respuestas.</p>
            
            <div class="stats" id="statsContainer">
                <div class="stat-box">
                    <h3>Mensajes</h3>
                    <div id="messageCount">Cargando...</div>
                </div>
                <div class="stat-box">
                    <h3>Patrones</h3>
                    <div id="patternCount">Cargando...</div>
                </div>
                <div class="stat-box">
                    <h3>Contextos</h3>
                    <div id="contextCount">Cargando...</div>
                </div>
            </div>
            
            <div class="controls">
                <a href="/logout"><button class="danger">❌ Cerrar Sesión</button></a>
                <a href="/export/json"><button>📂 Exportar Mensajes (JSON)</button></a>
                <a href="/export/csv"><button>📂 Exportar Mensajes (CSV)</button></a>
                <a href="/export/patterns/json"><button>📂 Exportar Patrones (JSON)</button></a>
            </div>
            
            <div class="tabs">
                <div class="tab active" id="messagesTab">Mensajes</div>
                <div class="tab" id="patternsTab">Patrones Aprendidos</div>
            </div>
            
            <div class="container">
                <div class="panel" id="messagesPanel">
                    <h2>📩 Mensajes Recibidos</h2>
                    <div id="chatBox"></div>
                </div>
                
                <div class="panel" id="patternsPanel" style="display: none;">
                    <h2>🧠 Patrones Aprendidos</h2>
                    <div id="patternsList"></div>
                </div>
            </div>
            
            <script>
                // Cambiar entre pestañas
                document.getElementById('messagesTab').addEventListener('click', () => {
                    document.getElementById('messagesTab').classList.add('active');
                    document.getElementById('patternsTab').classList.remove('active');
                    document.getElementById('messagesPanel').style.display = 'block';
                    document.getElementById('patternsPanel').style.display = 'none';
                });
                
                document.getElementById('patternsTab').addEventListener('click', () => {
                    document.getElementById('patternsTab').classList.add('active');
                    document.getElementById('messagesTab').classList.remove('active');
                    document.getElementById('patternsPanel').style.display = 'block';
                    document.getElementById('messagesPanel').style.display = 'none';
                    fetchPatterns();
                });
                
                // Cargar estadísticas
                async function fetchStats() {
                    try {
                        const response = await fetch('/learning/stats');
                        const stats = await response.json();
                        
                        document.getElementById('messageCount').textContent = stats.mensajes;
                        document.getElementById('patternCount').textContent = stats.patrones;
                        document.getElementById('contextCount').textContent = stats.contextos;
                    } catch (error) {
                        console.error('Error cargando estadísticas:', error);
                    }
                }
                
                // Cargar mensajes
                async function fetchMessages() {
                    try {
                        const response = await fetch('/messages');
                        const messages = await response.json();
                        const chatBox = document.getElementById("chatBox");
                        chatBox.innerHTML = "";
                        
                        if (messages.length === 0) {
                            chatBox.innerHTML = "<p>No hay mensajes recibidos aún</p>";
                            return;
                        }
                        
                        messages.forEach(msg => {
                            chatBox.innerHTML += \`
                                <div class="message">
                                    <strong>\${msg.remitente}</strong>: \${msg.mensaje.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                                    <div class="timestamp">\${new Date(msg.fecha).toLocaleString()}</div>
                                </div>
                            \`;
                        });
                        
                        chatBox.scrollTop = chatBox.scrollHeight;
                    } catch (error) {
                        console.error('Error cargando mensajes:', error);
                    }
                }
                
                // Cargar patrones
                async function fetchPatterns() {
                    try {
                        const response = await fetch('/learning/patterns');
                        const patterns = await response.json();
                        const patternsList = document.getElementById("patternsList");
                        patternsList.innerHTML = "";
                        
                        if (patterns.length === 0) {
                            patternsList.innerHTML = "<p>Aún no se han aprendido patrones</p>";
                            return;
                        }
                        
                        patterns.forEach(pattern => {
                            const categoryClass = \`category-\${pattern.categoria || 'general'}\`;
                            
                            patternsList.innerHTML += \`
                                <div class="pattern">
                                    <strong>Pregunta:</strong> \${pattern.patron.replace(/</g, "&lt;").replace(/>/g, "&gt;")} 
                                    <span class="pattern-category \${categoryClass}">\${pattern.categoria || 'general'}</span><br>
                                    <strong>Respuesta:</strong> \${pattern.respuesta.replace(/</g, "&lt;").replace(/>/g, "&gt;")}<br>
                                    <div class="timestamp">
                                        Frecuencia: \${pattern.frecuencia} | 
                                        Relevancia: \${Math.round(pattern.puntuacion_relevancia * 100)}% | 
                                        Actualizado: \${new Date(pattern.ultima_actualizacion).toLocaleString()}
                                    </div>
                                </div>
                            \`;
                        });
                    } catch (error) {
                        console.error('Error cargando patrones:', error);
                    }
                }
                
                // Inicializar la página
                fetchStats();
                fetchMessages();
                
                // Actualizar periódicamente
                setInterval(fetchMessages, 3000);
                setInterval(fetchStats, 10000);
            </script>
        </body>
        </html>
    `);
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`🌍 Servidor corriendo en http://localhost:${port}`);
});

// Inicializar el bot
client.initialize();

// Manejar cierre de la aplicación
process.on('SIGINT', async () => {
    console.log('Cerrando aplicación...');
    await learningHandler.close();
    process.exit(0);
});