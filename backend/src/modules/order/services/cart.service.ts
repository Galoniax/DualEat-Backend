import { SettingsService } from "../../local/service/settings.service";
import { FoodService } from "../../menu/services/food.service";

export class CartService {
  constructor(
    private readonly localService: SettingsService,
    private readonly foodService: FoodService,
  ) {}
  // =========================================================
  // OBTENER INFORMACIÓN DEL CARRITO
  // =========================================================
  getCartInfo = async (
    foodIds: string[], 
    localId: string
  ) => {
    const local = await this.localService.getLocalById(localId);

    if (!local) {
      return null;
    }

    const maxDiscount = local.promotions.reduce(
      (max, p) => Math.max(max, p.discount_pct || 0),
      0,
    );

    const foods = await this.foodService.getFoodsByIds(foodIds);

    if (!foods) return null;

    const processedFoods = foods.map((food) => {
      const specificPromo = food.promotions;

      let appliedDiscountPct = 0;

      if (specificPromo && specificPromo.discount_pct) {
        appliedDiscountPct = specificPromo.discount_pct;
      } else if (maxDiscount > 0) {
        appliedDiscountPct = maxDiscount;
      }

      let finalPrice = food.price;
      if (appliedDiscountPct > 0) {
        finalPrice = food.price - food.price * (appliedDiscountPct / 100);
      }

      const { promotions, ...foodData } = food;

      return {
        ...foodData,
        original_price: food.price,
        price: finalPrice,
        discount_pct_applied:
          appliedDiscountPct > 0 ? appliedDiscountPct : null,
        ends_at: specificPromo?.ends_at || null,
      };
    });

    return {
      local,
      items: processedFoods,
    };
  };
}
