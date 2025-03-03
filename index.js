// index.js
const express = require('express');
const path = require('path');

// Importar las rutas
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();
const port = process.env.PORT || 8000;

// Servir la carpeta 'public' con el dashboard
app.use(express.static('public'));

// Usar las rutas de WhatsApp
app.use('/', whatsappRoutes);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
