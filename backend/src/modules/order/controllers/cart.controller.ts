import { CartService } from "../services/cart.service";

export class CartController {
  constructor(private cartService: CartService) {}

  // =========================================================
  // OBTENER INFO DEL CARRITO
  // =========================================================
  getCartInfo = async (req: any, res: any) => {
    const { food_ids, local_id } = req.body;

    if (!local_id || !food_ids || !Array.isArray(food_ids)) {
      return res
        .status(400)
        .json({ success: false, message: "Datos incompletos" });
    }

    try {
      const cart = await this.cartService.getCartInfo(food_ids, local_id);

      if (!cart) {
        return res
          .status(404)
          .json({ success: false, message: "Carrito no encontrado" });
      }

      return res.status(200).json({ success: true, data: cart });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  };
}
