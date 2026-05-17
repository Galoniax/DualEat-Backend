import { Router } from "express";
import { 
  createTicket, 
  getLocalTickets, 
  getAdminTickets, 
  getTicketMessages, 
  addMessage, 
  updateTicketStatus,
  markAsRead
} from "../controllers/support.controller";
// import { ensureAuthenticated } from "../../../core/middlewares/auth"; 
// Assuming auth middlewares would be added if needed, but keeping it open or using what's standard here.

const router = Router();

// Routes for Locals
router.post("/tickets", createTicket);
router.get("/tickets/local/:localId", getLocalTickets);

// Routes for Admins
router.get("/tickets/admin", getAdminTickets);

// Shared Routes (Ticket specific)
router.get("/tickets/:ticketId/messages", getTicketMessages);
router.post("/tickets/:ticketId/messages", addMessage);
router.patch("/tickets/:ticketId/status", updateTicketStatus);
router.post("/tickets/:ticketId/read", markAsRead);

export default router;
