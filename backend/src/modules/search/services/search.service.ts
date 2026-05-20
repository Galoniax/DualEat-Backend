import { prisma } from "@/core/database/prisma/prisma";

export class SearchService {
  async getGlobal(
    query: string,
    tab: string,
    page: number,
    community_id?: string,
  ) {
    try {
      const size = 20;

      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * size;

      const cleanQuery = query.trim();

      const filter = { contains: cleanQuery, mode: "insensitive" } as const;

      let data;

      switch (tab) {
        case "posts":
          data = await prisma.post.findMany({
            where: {
              active: true,
              title: filter,
              ...(community_id
                ? {
                    community_id: {
                      equals: community_id,
                    },
                  }
                : {}),
            },
            skip,
            take: size + 1,
            orderBy: {
              created_at: "desc",
            },

            include: {
              community: {
                select: {
                  id: true,
                  name: true,
                  image_url: true,
                  slug: true,
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              recipe: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  main_image: true,
                  total_time: true,
                  _count: {
                    select: {
                      steps: true,
                      ingredients: true,
                    },
                  },
                },
              },
            },
          });
          break;

        case "recipes":
          data = await prisma.recipe.findMany({
            where: {
              name: filter,
              ...(community_id
                ? {
                    posts: {
                      some: {
                        community_id: {
                          equals: community_id,
                        },
                      },
                    },
                  }
                : {}),
            },
            skip,
            take: size + 1,
            orderBy: {
              created_at: "desc",
            },
            select: {
              id: true,
              name: true,
              description: true,
              slug: true,
              main_image: true,
              total_time: true,
              _count: {
                select: {
                  steps: true,
                  ingredients: true,
                },
              },
            },
          });

          break;

        case "comments":
          data = await prisma.postComment.findMany({
            where: {
              content: filter,
              ...(community_id
                ? {
                    post: {
                      community_id: {
                        equals: community_id,
                      },
                    },
                  }
                : {}),
            },
            skip,
            take: size + 1,
            orderBy: {
              created_at: "desc",
            },
            select: {
              id: true,
              content: true,

              post: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  community: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          });
          break;

        case "communities":
          data = await prisma.community.findMany({
            where: {
              name: filter,
            },
            skip,
            take: size + 1,
            orderBy: {
              created_at: "desc",
            },
            select: {
              id: true,
              name: true,
              slug: true,
              image_url: true,
              description: true,
              total_members: true,
            },
          });
          break;
        default:
          break;
      }

      if (!data) {
        return {
          data: [],
          pagination: { page: currentPage, hasMore: false },
        };
      }

      const hasMore = data.length > size;
      if (hasMore) data.pop();

      return {
        data,
        pagination: { page: currentPage, hasMore },
      };
    } catch (e) {
      return null;
    }
  }
}
