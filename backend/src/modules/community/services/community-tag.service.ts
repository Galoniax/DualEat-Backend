import { prisma } from "../../../core/database/prisma/prisma";
import { CommunityTag } from "@prisma/client";

export class CommunityTagService {
  /** CREAR ETIQUETA */
  async createCommunityTag(data: CommunityTag) {
    try {
      return await prisma.communityTag.create({
        data,
      });
    } catch (error) {
      throw new Error(`Failed to create community tag: ${error}`);
    }
  }

  /** OBTENER ETIQUETA POR CATEGORIA */
  async getByIdCategory(id: number) {
    try {
      return await prisma.communityTag.findMany({
        where: {
          category_id: id,
        },
        include: {
          category: true,
        },
      });
    } catch (error) {
      throw new Error(`Failed to get community tags: ${error}`);
    }
  }

  /** OBTENER TODAS LAS ETIQUETAS */
  async getAllCommunityTags() {
    try {
      const result = await prisma.communityTag.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          name: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to get community tags: ${error}`);
    }
  }

  /** ACTUALIZAR ETIQUETA */
  async updateCommunityTag(id: number, data: any) {
    try {
      return await prisma.communityTag.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new Error(`Failed to update community tag: ${error}`);
    }
  }

  /** ELIMINAR ETIQUETA */
  async deleteCommunityTag(id: number) {
    try {
      return await prisma.communityTag.delete({
        where: { id },
      });
    } catch (error) {
      throw new Error(`Failed to delete community tag: ${error}`);
    }
  }
}
