import { DayOfWeek } from "@prisma/client";
import { prisma } from "../../../core/database/prisma/prisma";
import { FoodService } from "../../menu/services/food.service";

interface preferencesDTO {
  filter: "distancia" | "descuento";
  categorias: number[];
  horario: boolean;
  bestSellers: boolean;
}

export class DiscoveryService {
  constructor(private readonly foodService: FoodService) {}

  private days: DayOfWeek[] = [
    "LUNES",
    "MARTES",
    "MIERCOLES",
    "JUEVES",
    "VIERNES",
    "SABADO",
    "DOMINGO",
  ];

  // =========================================================
  // OBTENER LOCAL POR MAPA O PREFERENCIAS
  // =========================================================
  async getLocalsInBounds(
    latMin: number,
    latMax: number,
    lonMin: number,
    lonMax: number,
    preferencesDTO: preferencesDTO,

    query?: string,
  ) {
    // 1. Obtener el día de la semana actual
    const now = new Date();
    const current = this.days[now.getDay()];

    // 2. Obtener la hora actual en formato "HH:mm"
    const time =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    const queryFilter: any =
      query && query.trim() !== ""
        ? {
            OR: [
              { name: { contains: query.trim(), mode: "insensitive" } },
              {
                foods: {
                  some: {
                    name: { contains: query.trim(), mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {};

    const locals = await prisma.local.findMany({
      where: {
        latitude: { gte: latMin, lte: latMax },
        longitude: { gte: lonMin, lte: lonMax },

        ...queryFilter,
        schedules: preferencesDTO.horario
          ? {
              some: {
                day_of_week: current,
                open_time: { lte: time },
                close_time: { gte: time },
              },
            }
          : undefined,
        categories:
          preferencesDTO.categorias.length > 0
            ? {
                some: {
                  id: { in: preferencesDTO.categorias },
                  foods: {
                    some: {},
                  },
                },
              }
            : /*{
                some: {
                  foods: {
                    some: {},
                  },
                },
              },*/ undefined,

        promotions:
          preferencesDTO.filter === "descuento"
            ? {
                some: {
                  discount_pct: { gt: 0 },
                },
              }
            : undefined,

        average_rating: preferencesDTO.bestSellers
          ? {
              gte: 4.0,
            }
          : undefined,
      },
      take: 80,
      select: {
        id: true,
        name: true,
        slug: true,
        type_local: true,
        image_url: true,
        latitude: true,
        longitude: true,
        address: true,
        average_rating: true,
        promotions: {
          where: {
            active: true,
            discount_pct: { gt: 0 },
          },
          orderBy: { discount_pct: "desc" },
          take: 1,
        },

        _count: {
          select: { reviews: true },
        },
      },
    });

    if (preferencesDTO.filter === "descuento") {
      return locals.sort((a, b) => {
        const descA = a.promotions[0]?.discount_pct || 0;
        const descB = b.promotions[0]?.discount_pct || 0;
        return descB - descA;
      });
    }

    if (!locals) return null;

    return locals;
  }

  async getHomeFeed(lat: number, lng: number, user_id: string) {
    const offset = 40000 / 111000;
    const latMin = lat - offset;
    const latMax = lat + offset;
    const lngMin = lng - offset / Math.cos((lat * Math.PI) / 180);
    const lngMax = lng + offset / Math.cos((lat * Math.PI) / 180);

    const now = new Date();
    const current = this.days[now.getDay()];
    const time =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    const baseLocalFilter = {
      latitude: { gte: latMin, lte: latMax },
      longitude: { gte: lngMin, lte: lngMax },
      schedules: {
        some: {
          day_of_week: current,
          open_time: { lte: time },
          close_time: { gte: time },
        },
      },
    };

    const userPreferenceFilter = {
      categories: {
        some: {
          user_preferences: { some: { user_id } },
        },
      },
    };

    // 2. Ejecutamos las consultas con un código mucho más limpio
    const [parati, ofertasHot, promociones, masPedidos, mejoresRestaurantes] =
      await Promise.all([
        // Para ti:
        prisma.food.findMany({
          where: { local: { ...baseLocalFilter, ...userPreferenceFilter } },
          include: {
            local: {
              select: {
                name: true,
                image_url: true,
                average_rating: true,
                latitude: true,
                longitude: true,
                slug: true,
              },
            },
            promotions: true,
          },
          orderBy: { promotions: { active: "desc" } },
          take: 15,
        }),

        // Ofertas Hot
        prisma.food.findMany({
          where: {
            promotions: {
              active: true,
              discount_pct: { gt: 0 },
              ends_at: { gte: now },
            },
            local: baseLocalFilter,
          },
          include: {
            local: {
              select: {
                name: true,
                image_url: true,
                average_rating: true,
                slug: true,
                latitude: true,
                longitude: true,
              },
            },
            promotions: {
              where: {
                active: true,
                discount_pct: { gt: 0 },
                ends_at: { gte: now },
              },
            },
          },
          take: 15,
        }),

        // Promociones:
        prisma.food.findMany({
          where: {
            promotions: {
              active: true,
              discount_pct: { gt: 0 },
            },
            local: { ...baseLocalFilter },
          },
          include: {
            local: {
              select: {
                name: true,
                image_url: true,
                average_rating: true,
                latitude: true,
                longitude: true,
                slug: true,
              },
            },
            promotions: {
              where: {
                active: true,
                discount_pct: { gt: 0 },
              },
            },
          },
          take: 15,
        }),

        // Más Pedidos
        prisma.food.findMany({
          where: { local: { ...baseLocalFilter } },
          include: {
            local: {
              select: {
                name: true,
                image_url: true,
                average_rating: true,
                slug: true,
                latitude: true,
                longitude: true,
              },
            },
            promotions: true,
          },
          orderBy: { order_items: { _count: "desc" } },
          take: 15,
        }),

        // Mejores Restaurantes
        prisma.local.findMany({
          where: { ...baseLocalFilter },
          include: {
            promotions: {
              where: { active: true, discount_pct: { gt: 0 } },
              orderBy: { discount_pct: "desc" },
              take: 1,
            },
          },
          orderBy: { average_rating: "desc" },
          take: 15,
        }),
      ]);

    const response: any = {};

    if (parati.length > 0) response.parati = parati;
    if (ofertasHot.length > 0) response.ofertas_hot = ofertasHot;
    if (promociones.length > 0) response.promociones = promociones;
    if (masPedidos.length > 0) response.mas_pedidos = masPedidos;
    if (mejoresRestaurantes.length > 0)
      response.restaurantes_destacados = mejoresRestaurantes;

    return response;
  }

  // =========================================================
  // OBTENER LOCALES POR CERCANÍA
  // =========================================================
  async getLocalsByNearby(lat: number, lng: number, radius: number) {
    const offset = radius / 111000;

    const latMin = lat - offset;
    const latMax = lat + offset;
    const lngMin = lng - offset / Math.cos((lat * Math.PI) / 180);
    const lngMax = lng + offset / Math.cos((lat * Math.PI) / 180);

    const now = new Date();
    const current = this.days[now.getDay()];

    const time =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    try {
      const locals = await prisma.local.findMany({
        where: {
          latitude: { gte: latMin, lte: latMax },
          longitude: { gte: lngMin, lte: lngMax },

          /*schedules: {
          some: {
            day_of_week: current,
            open_time: { lte: time },
            close_time: { gte: time },
          },
        },*/
        },
        select: {
          id: true,
          name: true,
          slug: true,
          image_url: true,
          latitude: true,
          longitude: true,
          address: true,
          average_rating: true,
        },
      });

      return locals.filter((local) => {
        const distance = this.calculateDistance(
          lat,
          lng,
          local.latitude,
          local.longitude,
        );
        return distance <= radius;
      });
    } catch (e) {
      return null;
    }
  }

  // =========================================================
  // OBTENER LOCAL
  // =========================================================
  async getLocal(slug: string) {
    try {
      const local = await this.foodService.getLocalWithMenu({ slug });
      return local;
    } catch (e) {
      return null;
    }
  }

  // =========================================================
  // OBTENER REVIEWS DE UN LOCAL
  // =========================================================
  async getReviews(page: number, slug: string) {
    try {
      const size = 10;
      const currentPage = Math.max(1, page);

      const skip = (currentPage - 1) * size;

      const [reviews, total] = await Promise.all([
        prisma.localReview.findMany({
          where: { local: { slug } },
          include: {
            user: {
              select: { name: true, avatar_url: true, slug: true },
            },
            local: {
              select: { average_rating: true },
            },
          },
          skip,
          take: size,
          orderBy: { created_at: "desc" },
        }),
        prisma.localReview.count({
          where: { local: { slug } },
        }),
      ]);

      return {
        data: {
          reviews,
          total,
        },
        pagination: {
          page: currentPage,
          hasMore: total > currentPage * size,
        },
      };
    } catch (e) {
      return null;
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
