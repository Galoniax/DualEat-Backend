import express from "express";
import passport from "passport";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import {
  Auth,
  Contact,
  Review,
  Menu,
  FoodCategory,
  Local,
  Order,
  Community,
  CommunityTags,
  Recipe,
  Post,
  Chat,
  Notification,
  Vote,
  Admin,
  Users,
  Subscription,
  Support,
  Search,
  Payment,
} from "./index";

import { configurePassport } from "./core/config/passport";
import { redisClient } from "./core/config/redis";
import { API_PREFIX } from "./core/config/config";
import { initializeSocket } from "@/core/config/socket.config";
import { CleanupJob } from "@/core/jobs/cleanup.job";
import { SubscriptionCron } from "@/core/jobs/subscription.cron";

// Inicialización de variables de entorno y aplicación
dotenv.config();
const app = express();

app.set("trust proxy", 1); // Confiar en el proxy de Railway para rate limiting
const PORT = process.env.PORT || 3000;

// 2.1. CREACIÓN DEL SERVIDOR HTTP (Requerido por Socket.io)
const httpServer = http.createServer(app);

// 2.2. CONEXIONES Y SERVICIOS
async function initializeApp() {
  try {
    await redisClient.ping();
    console.log("Redis OK - Aplicación iniciando...");
    initializeSocket(httpServer);
  } catch (e: any) {
    console.error("No se pudo conectar a Redis:", e);
    process.exit(1);
  }
}



initializeApp();

const allowedOrigins = [process.env.FRONTEND_URL, process.env.MOBILE_URL];

const validOrigins = allowedOrigins.filter(
  (origin): origin is string => typeof origin === "string"
);

// 3. MIDDLEWARES GLOBALES
// Configuración de CORS
app.use(
  cors({
    origin: validOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Origin",
      "Accept",
      "X-Requested-With",
    ],
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Configuración de sesiones
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  })
);

// 4. AUTENTICACIÓN (PASSPORT)
app.use(passport.initialize());
app.use(passport.session());

configurePassport();

// 5. DEFINICIÓN DE RUTAS API

// Rutas de Módulos
app.use(`${API_PREFIX}/auth`, Auth);
app.use(`${API_PREFIX}/contact`, Contact);
app.use(`${API_PREFIX}/search`, Search);

// Módulo de Comunidad
app.use(`${API_PREFIX}/community`, Community);
app.use(`${API_PREFIX}/community-tags`, CommunityTags);
app.use(`${API_PREFIX}/recipe`, Recipe);
app.use(`${API_PREFIX}/post`, Post);
app.use(`${API_PREFIX}/notification`, Notification);
app.use(`${API_PREFIX}/vote`, Vote);
app.use(`${API_PREFIX}/chat`, Chat);

//Admin
app.use(`${API_PREFIX}/admin`, Admin);

//Locales
app.use(`${API_PREFIX}/users`, Users);
app.use(`${API_PREFIX}/review`, Review);
app.use(`${API_PREFIX}/menu`, Menu);
app.use(`${API_PREFIX}/food-categories`, FoodCategory);
app.use(`${API_PREFIX}/local`, Local);
app.use(`${API_PREFIX}/order`, Order);
app.use(`${API_PREFIX}/subscription`, Subscription);
app.use(`${API_PREFIX}/support`, Support);
app.use(`${API_PREFIX}/payment`, Payment);

// Middleware de manejo de errores
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
);

// Tarea de limpieza y expiración
const cleanupJob = new CleanupJob();
cleanupJob.start();

const subscriptionCron = new SubscriptionCron();
subscriptionCron.start();

// 6. INICIAR SERVIDOR
httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}${API_PREFIX}`);
  console.log(`Google OAuth Callback URL: ${process.env.GOOGLE_CALLBACK_URL}`);
  console.log(`Servidor Socket.io escuchando en puerto ${PORT}`);
});

export default app;