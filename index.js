// index.js
const express = require('express');
const path = require('path');

// Importar las rutas
const mainRouter = require('./routes/index'); // <-- Importa el router que sirve index.html
const whatsappRoutes = require('./routes/whatsappRoutes');// <-- El router de WhatsApp

const app = express();
const port = process.env.PORT || 8000;

// Servir la carpeta 'public' con el dashboard
app.use(express.static('public'));

// Usar las rutas de WhatsApp
app.use('/', mainRouter);
app.use('/', whatsappRoutes);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
