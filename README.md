# Introducción

Este proyecto forma parte de DualEat, el motor principal (Backend) que da vida a la plataforma gastronómica. Expone la API RESTful y provee los servicios en tiempo real necesarios para la interacción de las aplicaciones cliente (móviles y web) con la base de datos y la lógica de negocio central.

Entre sus funcionalidades principales, se incluyen:

- Gestión completa de usuarios, autenticación de identidades seguras mediante JWT y estrategias OAuth (como Google).
- Procesamiento bidireccional y en tiempo real usando WebSockets (Socket.IO) para el seguimiento de entregas a domicilio y mensajería en vivo.
- Modelado e integración robusta de datos operando un ecosistema relacional con Prisma ORM.
- Soporte para funcionalidades avanzadas impulsadas por Inteligencia Artificial, integrando Groq SDK y Google Cloud Vision (para OCR).
- Almacenamiento eficiente y procesamiento de la carga de recursos de imágenes gracias a la integración con el ecosistema en la nube de Supabase.
- Sistema automatizado de mensajería y entrega de correos transaccionales a través de Nodemailer.
- Capa de cacheo e interacción de alto rendimiento en memoria utilizando Redis.

El objetivo principal de esta API es garantizar la escalabilidad integral, mantener la seguridad por encima de los estándares al procesar transacciones u órdenes en nuestra plataforma, y asegurar tiempos de respuesta ágiles para las interfaces cliente.

## Tecnologías aplicadas

### Backend API (Server)

- **Runtime**: Node.js 18+
- **Protocolo Web/Enrutamiento**: Express.js 5
- **Lenguaje Transpilado**: TypeScript
- **Base de Datos / ORM**: Prisma ORM, conectores hacia PostgreSQL.
- **Manejo en Memoria/Caché**: Redis (ioredis)
- **Integraciones IA**: Groq SDK, @google-cloud/vision
- **Seguridad y Rutas Autenticadas**: Passport (Google OAuth2), jsonwebtoken, bcrypt
- **WebSockets**: Socket.IO
- **Almacenamiento Cloud**: @supabase/supabase-js, API de subida Multer
- **Manejo de Tareas & Transacciones**: node-cron, nodemailer

## Scripts para levantar

El sistema se ejecuta funcionalmente en el entorno de desarrollo usando `npm`. Debes posicionarte dentro de la carpeta **(cd .\backend\)**, habiendo ejecutado `npm install` para instalar las dependencias previas. Para arrancar en modo de desarrollo con recarga en base a los cambios de archivo, utiliza `npm run dev`.

## Instalación

### Prerrequisitos

- Node.js 18+
- Gestor de paquetes `npm`
- Git
- Instancia de Base de Datos compatible con Prisma (ej. PostgreSQL local o remota), y un servicio local de Redis en caso de no correr todo mediante contenedores Docker.

1. Clonación

- `https://github.com/Galoniax/DualEat-Backend.git`

2. Posicionamiento

- `cd .\backend\`

3. Dependencias

- `npm install`

4. Variables de entorno

- Configurar el archivo `.env` en base a las API keys de proveedores externos (Google Cloud, Groq, variables generadas desde Supabase, URLs de DB general y JWT Secrets). Ver documentación interna para una plantilla.

5. Base de Datos (ORM)

- Para sincronizar la estructura con el gestor y ejecutar validaciones de prueba locales:
  - `npx prisma db push` o `npx prisma migrate dev`
  - `npm run seed`

6. Ejecución en modo desarrollo (Hot-Reload)

- `npm run dev`

---

## Despliegue a Producción

La construcción e inicialización del servidor pueden abordarse mediante contenedores, ya que el repositorio expone plantillas listas con `dockerfile` corporativo y `docker-compose.yml`.

### Build Típico de Nodo (Sin Docker)

```bash
# Transpila el proyecto desde \src a distribuíbles de JS puros sobre \dist
npm run build

# Levanta el nodo a través de index.js productivo
npm start
```

### Build Mediante Docker Compose

Puedes levantar todo el conjunto del proyecto (Servidor de Backend, Redis y cualquier herramienta descrita en el docker file) directo en la raíz global usando:

```bash
docker-compose up -d --build
```
Proveyendo de esta manera ambientes completamente controlados, con las redes virtuales necesarias para que se comuniquen sin contratiempos.

---

## Dependencias

### Backend (Server)

- **@google-cloud/vision** (^5.3.3): Proveedor integrado para uso de las API remotas de Google Cloud Vision, aportando reconocimiento óptico de caracteres (OCR) robusto.
- **@prisma/client** (^6.14.0): Tipado estricto auto-generado para ejecutar consultas ORM en tiempo constante.
- **@supabase/supabase-js** (^2.57.0): Interfaz para acceder a los ecosistemas de persistencia en la nube y Buckets de Amazon S3 emulados que da Supabase.
- **axios** (^1.11.0): Módulo HTTP que despacha consultas promise-based con sistemas terceros.
- **bcrypt** / **bcryptjs**: Herramientas criptográficas requeridas para consolidar el hasheo unidireccional de parámetros sensibles, como las contraseñas orgánicas de sistema.
- **cookie-parser** (^1.4.7): Middleware de inyección necesario para poder acceder de forma ágil y tipada a las cabeceras Set-Cookie.
- **express** (^5.1.0): Entorno minimalista estandarizado para gestionar la arquitectura central web de ruteo Node.js.
- **express-rate-limit** (^8.1.0): Limita la recepción de solicitudes permitidas hacia dominios protegidos, bloqueando tácticas de denegación de servicio (DDoS).
- **groq-sdk** (^1.1.2): SDK orientado hacia la interoperabilidad veloz para acceder a los LLM (como Llama) operados nativamente por hardware de Groq.
- **ioredis** (^5.7.0): Librería cliente adaptada a TypeScript para conectarse con clústeres nativos de base orientada a memoria y streaming Redis.
- **jsonwebtoken** (^9.0.2): Lógica especializada para decodificar, crear o validar de manera firmada JSON Web Tokens usados por las sesiones y rutas web.
- **multer** (^2.0.2): Software intermedio responsable de aceptar form-data entrante y filtrar temporalmente cualquier buffer o payload multimedia a subir.
- **node-cron** (^4.2.1): Servicio de programación y automatización capaz de cronogramizar invocaciones repetitivas y rutinas de background del lado servidor.
- **nodemailer** (^7.0.5): Módulo oficial para establecer integraciones SMTP eficientes y enviar e-mails automatizados transaccionales hacia flujos de usuarios finales.
- **passport** (^0.7.0) / **passport-google-oauth20**: Agente organizador que registra "strategies" externas permitiendo, por derivación, integrar logueos federados One-Click hacia identidades de Google.
- **qrcode** (^1.5.4): Dependencia visual backend usada a menudo para originar cadenas crudas Base64 QR representables (facturas, vinculaciones por código, etc.).
- **socket.io** (^4.8.1): Corazón bi-direccional multi-room implementado como servidor maestro que coordina los mensajes en tiempo real y el ciclo de vida online.

#### Comandos Backend

```bash
# Instalación principal de dependencias NodeJS ubicadas en dir backend
npm install

# Compilar proyecto Typescript limpiando y arrojando los resultados finalizados
npm run build

# Comando central productivo
npm start

# Inicia con un listener nodemon re-ejecutable y un compilador on-the-fly local
npm run dev

# Popular/Migrar en falso entidades genialmente estructuradas sobre ORM Prisma
npm run seed
```