import { DayOfWeek } from "@prisma/client";
import { prisma } from "../../../core/database/prisma/prisma";

interface preferencesDTO {
  filter: "distancia" | "descuento";
  categorias: string[];
  horario: boolean;
  bestSellers: boolean;
}

export class DiscoveryService {
  constructor() {}

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
  ) {
    // 1. Obtener el día de la semana actual
    const now = new Date();
    const current = this.days[now.getDay()];

    // 2. Obtener la hora actual en formato "HH:mm"
    const time =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    const locals = await prisma.local.findMany({
      where: {
        latitude: { gte: latMin, lte: latMax },
        longitude: { gte: lonMin, lte: lonMax },
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
                  name: { in: preferencesDTO.categorias },
                },
              }
            : undefined,

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

      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        address: true,
        average_rating: true,
        promotions: {
          where: { discount_pct: { gt: 0 } },
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
        return descB - descA; // De mayor a menor
      });
    }

    return locals;
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
        name: true,
        slug: true,
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
  }

  // =========================================================
  // OBTENER LOCAL
  // =========================================================
  async getLocal(slug: string) {
    const now = new Date();
    try {
      const local = await prisma.local.findUnique({
        where: { slug },
        include: {
          schedules: {
            select: { day_of_week: true, open_time: true, close_time: true },
            orderBy: { day_of_week: "asc" },
          },
          promotions: {
            where: {
              active: true,
              OR: [
                {
                  starts_at: {
                    lte: now,
                  },
                  ends_at: {
                    gte: now,
                  },
                },
                {
                  starts_at: null,
                  ends_at: null,
                },
              ],
            },
          },
          categories: {
            include: {
              foods: {
                where: {
                  local: {
                    slug: slug,
                  },
                },
              },
            },
          },
        },
      });
      return local;
    } catch (e) {
      console.error("Error obteniendo local por slug:", e);
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
      console.error("Error obteniendo reviews por slug:", e);
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
