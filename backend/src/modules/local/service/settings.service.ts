import { prisma } from "../../../core/database/prisma/prisma";
import { Local, LocalSchedule, DayOfWeek } from "@prisma/client";

type ScheduleInput = {
  day_of_week: DayOfWeek;
  open_time: string;
  close_time: string;
};

export class SettingsService {
  /** GET LOCAL BY ID */
  async getLocalById(localId: string) {
    try {
      const local = await prisma.local.findUnique({
        where: {
          id: localId,
        },
        include: {
          categories: true,
          schedules: {
            select: { day_of_week: true, open_time: true, close_time: true },
            orderBy: { day_of_week: "asc" },
          },
          promotions: {
            where: {
              active: true,
              discount_pct: { gt: 0 },
              food_id: null,
            },
          },
        },
      });
      return local;
    } catch (e) {
      console.error("Error obteniendo local por ID:", e);
      return null;
    }
  }

  /** UPDATE LOCAL BY ID */
  async updateLocalById(
    localId: string,
    data: Partial<Local>,
  ): Promise<Local | null> {
    try {
      const updatedLocal = await prisma.local.update({
        where: { id: localId },
        data: {
          name: data.name,
          description: data.description,
          address: data.address,
          phone: data.phone,
          email: data.email,
          image_url: data.image_url,
          categories: data.categories,

          latitude: data.latitude,
          longitude: data.longitude,
        },
      });
      return updatedLocal;
    } catch (error) {
      if ((error as any).code === "P2025") {
        return null;
      }
      throw error;
    }
  }

  /** UPDATE LOCAL SCHEDULES */
  async updateLocalSchedules(
    localId: string,
    schedules: ScheduleInput[],
  ): Promise<LocalSchedule[]> {
    const transaction = await prisma.$transaction(async (tx) => {
      await tx.localSchedule.deleteMany({
        where: { local_id: localId },
      });

      const createPromises = schedules.map((schedule) =>
        tx.localSchedule.create({
          data: {
            local_id: localId,
            day_of_week: schedule.day_of_week,
            open_time: schedule.open_time,
            close_time: schedule.close_time,
          },
        }),
      );

      const newSchedules = await Promise.all(createPromises);
      return newSchedules;
    });

    return transaction;
  }

  /** GET LOCAL SCHEDULES */
  async getLocalSchedules(slug: string) {
    try {
      const local = await prisma.local.findUnique({
        where: { slug },
        include: {
          schedules: {
            select: { day_of_week: true, open_time: true, close_time: true },
            orderBy: { day_of_week: "asc" },
          },
        },
      });

      if (!local) return null;
      return local;
    } catch (e) {
      return null;
    }
  }
}
