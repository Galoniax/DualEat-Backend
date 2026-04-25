import { prisma } from "../../../core/database/prisma/prisma";
import { OrderStatus } from "@prisma/client"; // <-- Importamos el Enum de Prisma

export class StatisticsService {
  
  /** OBTENER LOS PLATOS MÁS VENDIDOS DE UN LOCAL */
  async getTopFoods(localId: string, from?: string, to?: string) {
    // 1. Buscamos los items de las órdenes confirmadas en el rango de fechas
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          local_id: localId,
          status: OrderStatus.COMPLETED, 
          created_at: {
            gte: from ? new Date(from) : undefined,
            lte: to ? new Date(to) : undefined,
          },
        },
      },
    });

    // 2. Agrupamos y calculamos en memoria (Ahora el Map usa 'string' para el food_id)
    const foodSummary = new Map<string, { food_id: string; total_quantity: number; total_revenue: number }>();

    for (const item of orderItems) {
      const foodId = item.food_id;
      const quantity = item.quantity || 0;
      // Usamos directamente el unit_price que Prisma nos confirmó que existe en tu tabla
      const price = Number(item.unit_price || 0); 
      const revenue = quantity * price;

      if (foodSummary.has(foodId)) {
        const existing = foodSummary.get(foodId)!;
        existing.total_quantity += quantity;
        existing.total_revenue += revenue;
      } else {
        foodSummary.set(foodId, {
          food_id: foodId,
          total_quantity: quantity,
          total_revenue: revenue,
        });
      }
    }

    // 3. Ordenamos de mayor a menor cantidad y tomamos el top 7
    const top7 = Array.from(foodSummary.values())
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 7);

    // 4. Buscamos solo los nombres de esos 7 platos en la base de datos
    const foodIds = top7.map((f) => f.food_id);
    const foods = await prisma.food.findMany({
      where: { id: { in: foodIds } },
      select: { id: true, name: true },
    });
    
    // Mapeamos los nombres para inyectarlos en el resultado final
    const foodMap = new Map(foods.map((f) => [f.id, f.name]));

    return top7.map((item) => ({
      food_id: item.food_id,
      name: foodMap.get(item.food_id) || "Desconocido",
      total_quantity: item.total_quantity,
      total_revenue: item.total_revenue,
    }));
  }

  /** OBTENER GANANCIAS MENSUALES DE UN LOCAL */
  async getMonthlyLocalEarnings(localId: string, from: string, to: string) {
    const orders = await prisma.order.findMany({
      where: {
        local_id: localId,
        status: OrderStatus.COMPLETED,
        created_at: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      select: {
        total: true,
        created_at: true,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    const monthlySummary: Record<string, { total_earnings: number; total_orders: number }> = {};

    orders.forEach((order) => {
      const monthYear = order.created_at.toISOString().slice(0, 7);
      
      if (!monthlySummary[monthYear]) {
        monthlySummary[monthYear] = { total_earnings: 0, total_orders: 0 };
      }
      
      monthlySummary[monthYear].total_earnings += Number(order.total || 0);
      monthlySummary[monthYear].total_orders += 1;
    });

    return Object.entries(monthlySummary).map(([month, data]) => ({
      mes: month,
      ganancia: data.total_earnings,
      pedidos: data.total_orders,
    }));
  }
}