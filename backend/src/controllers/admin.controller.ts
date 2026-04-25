import { Request, Response } from 'express';
import { createBusinessUserAndLocal } from '../services/admin.service';

export const handleCreateBusinessUserAndLocal = async (req: Request, res: Response) => {
  const { userData, businessData, localData } = req.body;

  // Validaciones básicas de los datos
  if (!userData || !userData.email || !userData.password || !localData || !localData.name) {
    return res.status(400).json({ message: 'Faltan campos requeridos (usuario o nombre del local).' });
  }

  try {
    const result = await createBusinessUserAndLocal(userData, businessData || {}, localData);
    res.status(201).json({ message: 'Business user and local created successfully.', data: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

import { prisma } from "../core/database/prisma/prisma";

export const handleGetAdminStats = async (_req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count({ where: { role: 'USER' } });
    const pendingLocals = await (prisma.local as any).count({ where: { active: false } });
    const activeLocals = await (prisma.local as any).count({ where: { active: true } });
    const totalFoodCategories = await prisma.foodCategory.count();
    const totalCommunities = await prisma.community.count();

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        pendingLocals,
        activeLocals,
        totalFoodCategories,
        totalCommunities,
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error fetching stats.' });
  }
};

export const handleGetUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        is_business: true,
        created_at: true,
        avatar_url: true,
      },
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al obtener usuarios." });
  }
};

export const handleToggleUserStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { active } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: id as string },
      data: { active }
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al actualizar estado del usuario." });
  }
};