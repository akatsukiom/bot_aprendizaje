FROM node:18-slim

# Instalar git y librerías necesarias para Puppeteer en Debian/Ubuntu
RUN apt-get update && apt-get install -y \
    git \
    libnss3 \
    libatk1.0-0 \
    libpangocairo-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libgbm-dev \
    libasound2 \
    libpango-1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libatspi2.0-0 \
    libglib2.0-dev \  # Cambio aquí (en vez de libgobject-2.0-dev)
    libdrm-dev \       # Se mantiene en la lista de instalación
    libxshmfence1 \    
    && rm -rf /var/lib/apt/lists/*


# Crear directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de configuración
COPY package*.json ./

# Instalar dependencias sin opciones problemáticas
RUN npm install --no-optional --legacy-peer-deps

# Copiar el resto del código
COPY . .

# Exponer el puerto de Express
EXPOSE 8000

# Comando de inicio
CMD ["npm", "start"]
