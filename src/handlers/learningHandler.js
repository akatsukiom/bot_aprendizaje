// src/handlers/learningHandler.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const natural = require('natural');

class LearningHandler {
    constructor() {
        // Inicializar base de datos para aprendizaje
        this.dbPath = path.join(__dirname, '../../learning.db');
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error("❌ Error al conectar con la base de aprendizaje:", err.message);
            } else {
                console.log("📚 Base de datos de aprendizaje conectada");
                this.initDatabase();
            }
        });

        // Inicializar tokenizer para análisis de texto
        this.tokenizer = new natural.WordTokenizer();
        this.stemmer = natural.PorterStemmerEs;

        // Configuración de aprendizaje
        this.config = {
            LEARNING_ENABLED: true,          // Activar/desactivar aprendizaje
            MIN_PATTERN_LENGTH: 3,           // Longitud mínima de un patrón (palabras)
            MAX_CONTEXT_MESSAGES: 10,        // Número máximo de mensajes en contexto
            RELEVANCE_THRESHOLD: 0.5,        // Umbral mínimo de relevancia
            RESPONSE_FREQUENCY_THRESHOLD: 5  // Frecuencia mínima para considerar patrón confiable
        };

        // Mapeo de conversaciones para seguimiento temporal
        this.conversationContext = new Map();
    }

    // Inicializar la base de datos
    async initDatabase() {
        // Crear tablas si no existen
        this.db.run(`CREATE TABLE IF NOT EXISTS mensajes_aprendizaje (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remitente TEXT,
            mensaje TEXT,
            fecha TEXT,
            es_pregunta INTEGER DEFAULT 0,
            es_respuesta INTEGER DEFAULT 0,
            mensaje_previo_id INTEGER,
            chat_id TEXT,
            procesado INTEGER DEFAULT 0
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS patrones_respuesta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patron TEXT UNIQUE,
            respuesta TEXT,
            frecuencia INTEGER DEFAULT 1,
            ultima_actualizacion TEXT,
            categoria TEXT,
            puntuacion_relevancia REAL DEFAULT 0
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS contextos_chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT UNIQUE,
            mensajes_recientes TEXT,
            ultima_interaccion TEXT,
            tema_detectado TEXT
        )`);

        console.log("✅ Tablas de aprendizaje verificadas/creadas");
    }

    // Procesar un mensaje para aprendizaje (no envía respuestas)
    async processMessage(msg) {
        if (!this.config.LEARNING_ENABLED) return;

        try {
            const remitente = msg.from;
            const mensaje = msg.body;
            const chatId = msg.from;
            const fecha = new Date().toISOString();
            
            // Determinar si es pregunta
            const esPreg = this.esPregunta(mensaje) ? 1 : 0;
            
            // Buscar mensaje previo para detectar patrones de conversación
            this.detectarRespuesta(chatId, mensaje, async (mensajePrevioId) => {
                const esResp = mensajePrevioId ? 1 : 0;
                
                // Guardar mensaje en la base de datos
                await this.guardarMensaje(remitente, mensaje, fecha, esPreg, esResp, mensajePrevioId, chatId);
                
                // Actualizar contexto de la conversación
                await this.actualizarContexto(chatId, mensaje);
                
                console.log(`💾 Mensaje aprendido. Es pregunta: ${esPreg}, Es respuesta: ${esResp}`);
            });
            
        } catch (error) {
            console.error("❌ Error en aprendizaje:", error);
        }
    }

    // Analizar si un mensaje es una pregunta
    esPregunta(mensaje) {
        const mensajeLimpio = mensaje.toLowerCase().trim();
        
        // Verificar signos de interrogación
        if (mensajeLimpio.includes('?') || mensajeLimpio.includes('¿')) {
            return true;
        }
        
        // Verificar palabras interrogativas comunes en español
        const palabrasInterrogativas = [
            'quien', 'quién', 'quienes', 'quiénes', 
            'que', 'qué', 'cual', 'cuál', 'cuales', 'cuáles',
            'como', 'cómo', 'donde', 'dónde', 'cuando', 'cuándo',
            'por que', 'por qué', 'porque', 'porqué',
            'cuanto', 'cuánto', 'cuantos', 'cuántos'
        ];
        
        const tokens = this.tokenizer.tokenize(mensajeLimpio);
        if (tokens.length > 0 && palabrasInterrogativas.includes(tokens[0])) {
            return true;
        }
        
        return false;
    }

    // Guardar mensaje en la base de datos
    async guardarMensaje(remitente, mensaje, fecha, esPregunta, esRespuesta, mensajePrevioId, chatId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO mensajes_aprendizaje 
                (remitente, mensaje, fecha, es_pregunta, es_respuesta, mensaje_previo_id, chat_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [remitente, mensaje, fecha, esPregunta, esRespuesta, mensajePrevioId, chatId],
                function(err) {
                    if (err) {
                        console.error("❌ Error al guardar mensaje de aprendizaje:", err.message);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    // Detectar si es una respuesta a un mensaje previo
    detectarRespuesta(chatId, mensaje, callback) {
        this.db.get(
            "SELECT * FROM mensajes_aprendizaje WHERE chat_id = ? ORDER BY id DESC LIMIT 1",
            [chatId],
            (err, row) => {
                if (err) {
                    console.error("Error al buscar mensaje previo:", err.message);
                    callback(null);
                    return;
                }
                
                if (!row) {
                    callback(null);
                    return;
                }
                
                // Si el mensaje previo es una pregunta, este podría ser una respuesta
                if (row.es_pregunta === 1) {
                    // Aprender el patrón pregunta-respuesta
                    this.aprenderPatron(row.mensaje, mensaje);
                    callback(row.id);
                } else {
                    callback(null);
                }
            }
        );
    }

    // Aprender patrón de pregunta-respuesta
    aprenderPatron(pregunta, respuesta) {
        if (!pregunta || !respuesta) return;
        
        const ahora = new Date().toISOString();
        const preguntaNormalizada = pregunta.toLowerCase().trim();
        const respuestaNormalizada = respuesta.toLowerCase().trim();
        
        // Calcular relevancia básica (respuestas cortas son menos relevantes)
        const tokens = this.tokenizer.tokenize(respuestaNormalizada);
        const puntuacionRelevancia = tokens.length < 3 ? 0.3 : 
                                   tokens.length < 8 ? 0.6 : 0.8;
        
        // Determinar categoría básica
        let categoria = this.detectarCategoria(preguntaNormalizada);
        
        this.db.get(
            "SELECT * FROM patrones_respuesta WHERE patron = ?",
            [preguntaNormalizada],
            (err, row) => {
                if (err) {
                    console.error("Error al buscar patrón:", err.message);
                    return;
                }
                
                if (row) {
                    // Actualizar patrón existente
                    this.db.run(
                        `UPDATE patrones_respuesta 
                        SET respuesta = ?, frecuencia = frecuencia + 1, 
                        ultima_actualizacion = ?, puntuacion_relevancia = ? 
                        WHERE id = ?`,
                        [respuestaNormalizada, ahora, Math.max(row.puntuacion_relevancia, puntuacionRelevancia), row.id]
                    );
                    console.log(`📝 Patrón actualizado: "${preguntaNormalizada}" -> "${respuestaNormalizada}"`);
                } else {
                    // Insertar nuevo patrón
                    this.db.run(
                        `INSERT INTO patrones_respuesta 
                        (patron, respuesta, ultima_actualizacion, categoria, puntuacion_relevancia) 
                        VALUES (?, ?, ?, ?, ?)`,
                        [preguntaNormalizada, respuestaNormalizada, ahora, categoria, puntuacionRelevancia]
                    );
                    console.log(`📝 Nuevo patrón aprendido: "${preguntaNormalizada}" -> "${respuestaNormalizada}"`);
                }
            }
        );
    }

    // Detectar categoría del mensaje
    detectarCategoria(mensaje) {
        const categorias = {
            'producto': [/precio/, /costo/, /cuánto/, /cuanto/, /vale/, /cuenta/, /comprar/],
            'soporte': [/ayuda/, /problema/, /error/, /funciona/, /no puedo/, /falla/],
            'info': [/información/, /horario/, /contacto/, /ubicación/, /dirección/, /teléfono/]
        };
        
        for (const [categoria, patrones] of Object.entries(categorias)) {
            for (const patron of patrones) {
                if (patron.test(mensaje)) {
                    return categoria;
                }
            }
        }
        
        return 'general';
    }

    // Actualizar contexto de la conversación
    async actualizarContexto(chatId, mensaje) {
        const ahora = new Date().toISOString();
        
        this.db.get(
            "SELECT * FROM contextos_chat WHERE chat_id = ?",
            [chatId],
            (err, row) => {
                if (err) {
                    console.error("Error al buscar contexto:", err.message);
                    return;
                }
                
                let mensajesRecientes = [];
                
                if (row && row.mensajes_recientes) {
                    try {
                        mensajesRecientes = JSON.parse(row.mensajes_recientes);
                    } catch (e) {
                        console.error("Error al parsear mensajes recientes:", e);
                        mensajesRecientes = [];
                    }
                }
                
                // Añadir mensaje al contexto
                mensajesRecientes.push({
                    texto: mensaje,
                    timestamp: ahora
                });
                
                // Mantener solo los últimos X mensajes
                if (mensajesRecientes.length > this.config.MAX_CONTEXT_MESSAGES) {
                    mensajesRecientes = mensajesRecientes.slice(-this.config.MAX_CONTEXT_MESSAGES);
                }
                
                const mensajesRecientesJSON = JSON.stringify(mensajesRecientes);
                
                if (row) {
                    // Actualizar contexto existente
                    this.db.run(
                        "UPDATE contextos_chat SET mensajes_recientes = ?, ultima_interaccion = ? WHERE chat_id = ?",
                        [mensajesRecientesJSON, ahora, chatId]
                    );
                } else {
                    // Insertar nuevo contexto
                    this.db.run(
                        "INSERT INTO contextos_chat (chat_id, mensajes_recientes, ultima_interaccion) VALUES (?, ?, ?)",
                        [chatId, mensajesRecientesJSON, ahora]
                    );
                }
            }
        );
    }

    // Buscar la mejor respuesta para un mensaje
    async buscarRespuesta(mensaje) {
        return new Promise((resolve, reject) => {
            const mensajeNormalizado = mensaje.toLowerCase().trim();
            
            // Primero buscar coincidencia exacta
            this.db.get(
                "SELECT * FROM patrones_respuesta WHERE patron = ? AND frecuencia >= ? ORDER BY frecuencia DESC LIMIT 1",
                [mensajeNormalizado, this.config.RESPONSE_FREQUENCY_THRESHOLD],
                (err, exactMatch) => {
                    if (err) {
                        console.error("Error al buscar respuesta:", err.message);
                        resolve(null);
                        return;
                    }
                    
                    if (exactMatch) {
                        resolve({
                            respuesta: exactMatch.respuesta,
                            confianza: 0.9,
                            tipo: 'exacta'
                        });
                        return;
                    }
                    
                    // Si no hay coincidencia exacta, buscar coincidencia similar
                    this.db.all(
                        "SELECT * FROM patrones_respuesta WHERE frecuencia >= ? ORDER BY frecuencia DESC",
                        [this.config.RESPONSE_FREQUENCY_THRESHOLD],
                        (err, patterns) => {
                            if (err || !patterns || patterns.length === 0) {
                                resolve(null);
                                return;
                            }
                            
                            // Encontrar la mejor coincidencia parcial
                            let bestMatch = null;
                            let highestScore = 0;
                            
                            for (const pattern of patterns) {
                                const similarity = this.calcularSimilitud(mensajeNormalizado, pattern.patron);
                                
                                if (similarity > highestScore && similarity > this.config.RELEVANCE_THRESHOLD) {
                                    highestScore = similarity;
                                    bestMatch = pattern;
                                }
                            }
                            
                            if (bestMatch) {
                                resolve({
                                    respuesta: bestMatch.respuesta,
                                    confianza: highestScore,
                                    tipo: 'similar'
                                });
                            } else {
                                resolve(null);
                            }
                        }
                    );
                }
            );
        });
    }

    // Calcular similitud entre dos textos
    calcularSimilitud(texto1, texto2) {
        if (!texto1 || !texto2) return 0;
        
        // Tokenizar y obtener raíces de palabras
        const tokens1 = this.tokenizer.tokenize(texto1);
        const tokens2 = this.tokenizer.tokenize(texto2);
        
        if (tokens1.length === 0 || tokens2.length === 0) return 0;
        
        const stems1 = tokens1.map(token => this.stemmer.stem(token));
        const stems2 = tokens2.map(token => this.stemmer.stem(token));
        
        // Calcular coeficiente de Jaccard (intersección / unión)
        const set1 = new Set(stems1);
        const set2 = new Set(stems2);
        
        // Calcular intersección
        const intersection = new Set();
        for (const item of set1) {
            if (set2.has(item)) {
                intersection.add(item);
            }
        }
        
        // Calcular coeficiente de Jaccard
        return intersection.size / (set1.size + set2.size - intersection.size);
    }

    // Obtener estadísticas de aprendizaje
    async getStats() {
        return new Promise((resolve, reject) => {
            Promise.all([
                this.countRows("mensajes_aprendizaje"),
                this.countRows("patrones_respuesta"),
                this.countRows("contextos_chat")
            ]).then(([mensajes, patrones, contextos]) => {
                resolve({
                    mensajes,
                    patrones,
                    contextos,
                    timestamp: new Date().toISOString()
                });
            }).catch(err => {
                reject(err);
            });
        });
    }

    // Contar filas en una tabla
    async countRows(tableName) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT COUNT(*) AS count FROM ${tableName}`, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    // Cerrar la base de datos al finalizar
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error("Error al cerrar la base de datos de aprendizaje:", err);
                } else {
                    console.log("Base de datos de aprendizaje cerrada correctamente");
                }
            });
        }
    }
}

module.exports = LearningHandler;