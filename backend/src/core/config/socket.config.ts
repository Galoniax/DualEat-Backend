import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import dotenv from "dotenv";

dotenv.config();

let io: SocketServer | null = null;

export function initializeSocket(httpServer: HttpServer) {
  // 1. Inicialización de Socket.io
  const socketIoServer = new SocketServer(httpServer, {
    // Configuración de CORS para permitir la conexión desde el frontend
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
    },
  });

  io = socketIoServer;

  // 2. Lógica de Conexión y Asignación de Salas (Rooms)
  io.on("connection", (socket) => {
    const user_id = socket.handshake.auth.user_id as string;

    if (user_id) {
      // Cada usuario se une a una sala nombrada con su propio ID.
      socket.join(user_id);
      console.log(
        `[Socket] Usuario conectado: ${user_id}. Sala asignada: ${user_id}`,
      );
    } else {
      console.log("[Socket] Usuario conectado sin ID. Conexión limitada.");
    }

    socket.on("join_ticket", (ticketId: string) => {
      socket.join(`ticket_${ticketId}`);
      console.log(
        `[Socket] Usuario ${user_id || "Anon"} se unió al ticket: ${ticketId}`,
      );
    });

    socket.on("leave_ticket", (ticketId: string) => {
      socket.leave(`ticket_${ticketId}`);
      console.log(
        `[Socket] Usuario ${user_id || "Anon"} salió del ticket: ${ticketId}`,
      );
    });

    socket.on("disconnect", () => {
      if (user_id) {
        console.log(`[Socket] Usuario desconectado: ${user_id}`);
      }
    });
  });

  console.log("Socket.io OK - Servidor de tiempo real inicializado.");
}

/**
 * Devuelve la instancia de Socket.io.
 */
export function getSocketServer(): SocketServer {
  if (!io) {
    throw new Error(
      "Socket.io no ha sido inicializado. Llama a initializeSocket(httpServer) primero.",
    );
  }
  return io;
}
