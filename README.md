# Bot de WhatsApp para Railway

Este es un bot de WhatsApp que se ejecuta 24/7 en la plataforma Railway. Utiliza la biblioteca whatsapp-web.js para interactuar con WhatsApp.

## Características

- ✅ Ejecución 24/7 en Railway
- 📱 Interfaz web para verificar el estado y escanear el código QR
- 🚀 Fácil de implementar y mantener
- 🔄 Reconexión automática en caso de desconexión

## Requisitos

- Node.js 16 o superior
- Una cuenta de Railway
- Una cuenta de WhatsApp

## Implementación en Railway

1. Haz fork de este repositorio
2. Conéctalo a Railway
3. ¡Listo! Railway desplegará automáticamente tu bot

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar en modo producción
npm start
```

## Cómo escanear el código QR

1. Una vez que la aplicación esté ejecutándose, ve a la URL de la aplicación
2. Si el bot no está conectado, verás un enlace para ver el código QR
3. Escanea el código QR desde WhatsApp en tu teléfono (Configuración > Dispositivos vinculados > Vincular un dispositivo)

## Personalización

Puedes modificar la lógica de respuesta del bot en el archivo `index.js`. Busca la sección donde se manejan los mensajes:

```javascript
client.on("message", async (msg) => {
    // Agregar aquí tu lógica personalizada
});
```

## Licencia

MIT