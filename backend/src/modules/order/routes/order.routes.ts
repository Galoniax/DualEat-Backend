import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { CartController } from "../controllers/cart.controller";
import { CartService } from "../services/cart.service";
import { FoodService } from "../../menu/services/food.service";
import { SettingsService } from "../../local/service/settings.service";
import { OrderService } from "../services/order.service";
import { isAuthenticated } from "../../../core/middlewares/isAuthenticated";

const router = Router();

const local = new SettingsService();
const food = new FoodService();

// Controlador y servicio del carrito
const cartService = new CartService(local, food);
const cart = new CartController(cartService);

// Controlador y servicio de órdenes
const orderService = new OrderService();
const order = new OrderController(orderService);

// =========================================================
// 1. PEDIDOS
// =========================================================

// Obtener pedidos de un local
router.get("/locals/:id/orders", order.getOrders);

// Obtener pedidos de un usuario
router.get("/user/orders", isAuthenticated, order.getUserOrders);

// Obtener orden por ID
router.get("/user/orders/:id", order.getOrderById);

// Obtener info del carrito para validar precios y promociones antes de pagar
router.post('/cart/validate', cart.getCartInfo);

export default router;
