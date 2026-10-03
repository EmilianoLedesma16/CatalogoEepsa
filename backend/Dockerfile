FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 3001

# Sin modo watch: en el NAS el código sólo cambia al reconstruir la imagen
CMD ["npm", "run", "serve"]
