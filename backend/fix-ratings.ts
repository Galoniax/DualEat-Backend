import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando recalculo de promedios de calificación...');
  
  // Obtener todos los locales
  const locals = await prisma.local.findMany({
    select: { id: true, name: true }
  });

  console.log(`Se encontraron ${locals.length} locales.`);

  for (const local of locals) {
    const aggregations = await prisma.localReview.aggregate({
      where: { local_id: local.id },
      _avg: { rating: true },
      _count: { rating: true }
    });

    const averageRating = aggregations._avg.rating || 0;
    const reviewCount = aggregations._count.rating;

    await prisma.local.update({
      where: { id: local.id },
      data: { average_rating: averageRating },
    });

    console.log(`Local "${local.name}" actualizado. Reseñas: ${reviewCount}, Promedio: ${averageRating}`);
  }

  console.log('¡Recalculo completado con éxito!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
