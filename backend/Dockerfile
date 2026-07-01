FROM node:22

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate

# Exponer puerto
EXPOSE 3000

# Script de inicio que espera a la base de datos
CMD ["sh", "-c", "npx prisma db push && npm run dev"]