// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta a la base de datos
const dbPath = path.join(__dirname, 'mensajes.db');

// Crear o conectar la DB
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error al conectar con la base de datos:", err.message);
    } else {
        console.log("📂 Base de datos SQLite conectada");
        // Crear tabla mensajes si no existe
        db.run(`
            CREATE TABLE IF NOT EXISTS mensajes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                remitente TEXT,
                mensaje TEXT,
                fecha TEXT
            )
        `);
    }
});

module.exports = db;
