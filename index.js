// index.js
const express = require('express');
const app = express();
const port = process.env.PORT || 8000;
app.use(express.static('public'));

// Importar rutas
const routes = require('./routes');

// Importar el cliente de WhatsApp
const client = require('./client');

// Usar las rutas
app.use('/', routes);

// Iniciar el servidor solo después de inicializar el cliente
app.listen(port, async () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);

    // Inicializar el cliente
    await client.initialize();
    console.log("✅ Cliente de WhatsApp inicializado");
});
