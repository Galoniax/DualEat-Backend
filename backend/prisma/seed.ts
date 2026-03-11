import { PrismaClient, TypesCategory } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import slugify from "slugify";

const prisma = new PrismaClient();

const ingredientsFilePath = join(__dirname, "../..", "ingredientes.txt");

// GENERATE SLUG
function generateSlug(text: string): string {
  return slugify(text, { lower: true, strict: true, locale: "es" });
}
// =================================================================
// DATOS PARA UNIDADES DE MEDIDA
const unitsOfMeasure = [
  { name: "gramos", abbreviation: "g" },
  { name: "kilogramos", abbreviation: "kg" },
  { name: "mililitros", abbreviation: "ml" },
  { name: "litros", abbreviation: "l" },
  { name: "cucharadita", abbreviation: "cdita" },
  { name: "cucharada", abbreviation: "cda" },
  { name: "taza", abbreviation: "taza" },
  { name: "unidad", abbreviation: "u" },
  { name: "pizca", abbreviation: "pizca" },
  { name: "paquete", abbreviation: "paquete" },
  { name: "opcional", abbreviation: "opcional" },
];
// DATOS PARA COMUNIDADES Y PREFERENCIAS DE USUARIOS
const tagData = [
  {
    category: {
      name: "Recetas y cocina",
      description: "Recetas para el día a día o momentos especiales.",
      icon_url: "Recetas y cocina",
    },
    tags: [
      "Cocina con niños",
      "A la parrilla",
      "Microondas only",
      "Cocina económica",
      "Sin horno",
      "Cocina express",
    ],
  },
  {
    category: {
      name: "Estilos de vida",
      description: "Tags relacionados con dietas y estilos alimenticios.",
      icon_url: "Estilos de vida",
    },
    tags: [
      "Keto",
      "Vegano",
      "Vegetariano",
      "Sin TACC",
      "Sin azúcar",
      "Bajo en sodio",
      "Proteico",
      "Fitness",
      "Paleo",
      "Raw food",
      "Mediterráneo",
      "Detox",
    ],
  },
  {
    category: {
      name: "Técnicas culinarias",
      description: "Conoce y practica técnicas de chef.",
      icon_url: "Tecnicas culinarias",
    },
    tags: [
      "Sous vide",
      "Fermentación",
      "Ahumado casero",
      "Confitado",
      "Marinado",
      "Encurtidos",
      "Deshidratado",
      "Flameado",
      "Emulsificado",
      "Braseado",
      "Tempura",
      "Molecular",
    ],
  },
  {
    category: {
      name: "Tendencias foodie",
      description: "Lo último que se habla en el mundo gastronómico.",
      icon_url: "Tendencias foodie",
    },
    tags: [
      "Viral",
      "Street food",
      "Fusion cuisine",
      "Comfort food",
      "Artesanal",
      "Superfoods",
    ],
  },
  {
    category: {
      name: "Presupuesto",
      description: "Consejos y recetas para ahorrar.",
      icon_url: "Presupuesto",
    },
    tags: ["Ingredientes baratos", "Compra inteligente", "Ofertas del super"],
  },
];

// CATEGORÍAS GLOBALES DE COMIDA
const foodCategories = [
  // TIPOS DE COMIDA
  {
    name: "Hamburguesas",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Hamburguesas",
  },
  {
    name: "Pizzas",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Pizzas",
  },
  {
    name: "Milanesas",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Milanesas",
  },
  {
    name: "Para Picar",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Para Picar",
  },
  {
    name: "Sandwiches",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Sandwiches",
  },
  {
    name: "Arepas",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Arepas",
  },
  {
    name: "Woks",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Woks",
  },
  {
    name: "Empanadas",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Empanadas",
  },
  {
    name: "Pastas",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Pastas",
  },
  {
    name: "Ensaladas",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Ensaladas",
  },
  {
    name: "Parrila",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Parrilla",
  },
  {
    name: "Postres",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Postres",
  },
  {
    name: "Helados",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Helados",
  },
  {
    name: "Desayunos/Merienda",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Desayunos/Merienda",
  },
  {
    name: "Panchos",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Panchos",
  },
  {
    name: "Sushi",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Sushi",
  },
  {
    name: "Comida Dulce",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Comida Dulce",
  },
  {
    name: "Infusiones",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Infusiones",
  },
  {
    name: "Bebidas",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Bebidas",
  },
  {
    name: "Cervezas y Tragos",
    tipo: TypesCategory.Tipos_de_comida,
    icon_url: "Cervezas y Tragos",
  },
  {
    name: "Vegetariano/Veggie",
    tipo: TypesCategory.Estilos_o_dietas,
    icon_url: "Vegetariano/Veggie",
  },
  {
    name: "Sin Tacc",
    tipo: TypesCategory.Estilos_o_dietas,
    icon_url: "Sin Tacc",
  },
  {
    name: "Comida Vietnamita",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Vietnamita",
  },
  {
    name: "Comida China",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida China",
  },
  {
    name: "Comida Coreana",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Coreana",
  },
  {
    name: "Comida Japonesa",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Japonesa",
  },
  {
    name: "Comida Peruana",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Peruana",
  },
  {
    name: "Comida India",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida India",
  },
  {
    name: "Comida Árabe",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Arabe",
  },
  {
    name: "Comida Medio Oriente",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Medio Oriente",
  },
  {
    name: "Comida Mexicana",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Mexicana",
  },
  {
    name: "Comida Brasileña",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Brasileña",
  },
  {
    name: "Comida Francesa",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Francesa",
  },
  {
    name: "Comida Italiana",
    tipo: TypesCategory.Origen_y_cultura,
    icon_url: "Comida Italiana",
  },
];

async function main() {
  try {
    // ---- 1. Siembra de la tabla UnitOfMeasure ----
    await prisma.unitOfMeasure.createMany({
      data: unitsOfMeasure,
      skipDuplicates: true,
    });
    console.log(
      `${unitsOfMeasure.length} unidades de medida han sido insertadas.`,
    );

    // ---- 2. Siembra de la tabla Ingredient ----
    const ingredientsFileContent = readFileSync(ingredientsFilePath, "utf-8");
    const ingredientNames = ingredientsFileContent
      .split("\n")
      .map((line: any) => line.trim().toLowerCase())
      .filter((line: any) => line.length > 0);

    const ingredientsToCreate = ingredientNames.map((name: string) => ({
      name,
    }));

    await prisma.ingredient.createMany({
      data: ingredientsToCreate,
      skipDuplicates: true,
    });
    console.log(
      `${ingredientsToCreate.length} ingredientes han sido insertados.`,
    );

    // ---- 3. Siembra de FoodCategory ----
    for (const category of foodCategories) {
      const existingCategory = await prisma.foodCategory.findFirst({
        where: { name: category.name },
      });

      if (!existingCategory) {
        await prisma.foodCategory.create({
          data: category,
        });
      }
    }
    console.log("Food Category completado");

    // ---- 4. Siembra de TagCategory + CommunityTag ----
    for (const item of tagData) {
      const categoryData = {
        ...item.category,
        slug: generateSlug(item.category.name), // Generar slug para TagCategory
      };

      let category = await prisma.tagCategory.findFirst({
        where: { name: item.category.name },
      });

      if (!category) {
        category = await prisma.tagCategory.create({
          data: categoryData,
        });
      } else {
        // Si ya existe, nos aseguramos de que tenga slug si lo hicimos requerido
        if (!category.slug) {
          await prisma.tagCategory.update({
            where: { id: category.id },
            data: { slug: categoryData.slug },
          });
        }
      }

      for (const tagName of item?.tags ?? []) {
        const existingTag = await prisma.communityTag.findUnique({
          where: { name: tagName },
        });

        if (!existingTag) {
          await prisma.communityTag.create({
            data: {
              name: tagName,
              category_id: category.id,
              active: true,
            },
          });
        }
      }
    }
    console.log("TagCategory y CommunityTag completado");

    // ---- 5. SEED DE LOCALES  ----
    const localsData = [
      {
        name: "Local El Fogon Centro",
        description: "La mejor parrilla del centro.",
        address: "Calle Falsa 123",
        image_url: "url_imagen_parrilla1",
        type_local: "Parrilla",
        latitude: -34.602622,
        longitude: -58.381592,
      },
      {
        name: "Local Pizzeria Caballito",
        description: "Pizzas a la piedra.",
        address: "Av. Rivadavia 4567",
        image_url: "url_imagen_pizza1",
        type_local: "Pizzería",
        latitude: -34.606932,
        longitude: -58.376457,
      },
      {
        name: "Local Sushi-D Belgrano",
        description: "Sushi fresco y delicioso.",
        address: "Av. Cabildo 100",
        image_url: "url_imagen_sushi1",
        type_local: "Sushi Bar",
        latitude: -34.598948,
        longitude: -58.379761,
      },
      {
        name: "Local Cafe Palermo",
        description: "Cafe de especialidad.",
        address: "Uriarte 2000",
        image_url: "https://cdn-ikpiegf.nitrocdn.com/FsBdHZLBmVMMWfdGbyWEiYuDVxpHBooT/assets/images/optimized/rev-ff89652/avocaty.io/wp-content/uploads/2025/03/tipos-cafeterias.jpg",
        type_local: "Cafetería",
        latitude: -34.690615,
        longitude: -58.332808,
      },
      {
        name: "Sushi Bar",
        description: "Sushi Bar especializado en pescados",
        address: "Av. Libertador 5000",
        image_url: "https://media-cdn.tripadvisor.com/media/photo-m/1280/2a/7c/09/82/sushi-bar-setting.jpg",
        type_local: "Sushi",
        latitude: -34.688737,
        longitude: -58.334233,
      },
    ];

    const locals = await Promise.all(
      localsData.map(async (local) => {
        const existingLocal = await prisma.local.findFirst({
          where: { name: local.name },
        });

        const localDataWithSlug = {
          ...local,
          slug: generateSlug(local.name),
        };

        if (!existingLocal) {
          return prisma.local.create({ data: localDataWithSlug });
        }
        return existingLocal;
      }),
    );
    console.log(`${locals.length} locales han sido insertados o ya existen.`);
  } catch (error) {
    console.error("Error durante el seeding:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
