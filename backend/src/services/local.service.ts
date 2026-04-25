import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getLocals = async () => {
  return prisma.local.findMany();
};

export const getLocalById = async (localId: string) => {
  return prisma.local.findUnique({
    where: { id: localId },
  });
};

export const updateLocal = async (localId: string, localData: any) => {
  return prisma.local.update({
    where: { id: localId },
    data: localData,
  });
};

export const deleteLocal = async (localId: string) => {
  return prisma.$transaction(async (tx) => {
    await tx.localUser.deleteMany({ where: { local_id: localId } });
    await tx.localSchedule.deleteMany({ where: { local_id: localId } });
    await tx.localNote.deleteMany({ where: { local_id: localId } });
    await tx.localCalendarEvent.deleteMany({ where: { local_id: localId } });
    await tx.food.deleteMany({ where: { local_id: localId } });
    await tx.localReview.deleteMany({ where: { local_id: localId } });
    await tx.subscription.deleteMany({ where: { local_id: localId } });
    await tx.promotion.deleteMany({ where: { local_id: localId } });

    return tx.local.delete({
      where: { id: localId },
    });
  });
};