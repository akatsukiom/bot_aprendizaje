// Dockerfile corregido para tu bot
FROM node:18-slim

# Instalar git y dependencias necesarias
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de configuración
COPY package*.json ./

# Instalar dependencias sin opciones problemáticas
RUN npm install --no-optional --legacy-peer-deps

# Copiar el resto del código
COPY . .

# Exponer el puerto de Express si se usa
EXPOSE 8000

# Comando de inicio
CMD ["npm", "start"]
"]