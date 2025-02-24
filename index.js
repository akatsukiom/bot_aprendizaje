const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

// Crear un servidor web simple
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Estado del Bot de WhatsApp</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
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
          .options {
            background-color: #f0f0f0;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .options h2 {
            margin-top: 0;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Bot de WhatsApp</h1>
          
          <div class="status">
            <p>✅ <strong>El servidor está activo</strong> - La aplicación se está ejecutando correctamente.</p>
          </div>
          
          <p>Esta es una versión simplificada de la aplicación sin la funcionalidad del bot de WhatsApp debido a limitaciones en el entorno de alojamiento.</p>
          
          <div class="options">
            <h2>Opciones para un bot de WhatsApp completo:</h2>
            <ul>
              <li><strong>DigitalOcean:</strong> Servidor VPS desde $5/mes con control total del entorno. La opción más confiable para bots de WhatsApp.</li>
              <li><strong>Twilio API para WhatsApp:</strong> Una alternativa que no requiere un navegador web completo.</li>
              <li><strong>Baileys:</strong> Una biblioteca Node.js que implementa la API web de WhatsApp sin necesidad de un navegador completo.</li>
            </ul>
          </div>
          
          <p>Hora del servidor: ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `);
});

// Añadir una ruta para verificar el estado
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`📡 Servidor web iniciado en puerto ${port}`);
  console.log(`🌐 Visita http://localhost:${port} para ver el estado`);
});