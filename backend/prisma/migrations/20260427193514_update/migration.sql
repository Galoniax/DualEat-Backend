/*
  Warnings:

  - You are about to drop the column `visibility` on the `Community` table. All the data in the column will be lost.
  - You are about to drop the column `edited` on the `PostComment` table. All the data in the column will be lost.
  - You are about to drop the column `unit_of_measure_id` on the `RecipeIngredient` table. All the data in the column will be lost.
  - The primary key for the `Vote` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Vote` table. All the data in the column will be lost.
  - You are about to drop the `UnitOfMeasure` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Community` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Post` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Recipe` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unit` to the `RecipeIngredient` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('GRAMOS', 'KILOGRAMOS', 'MILILITROS', 'LITROS', 'CUCHARADITA', 'CUCHARADA', 'TAZA', 'UNIDAD', 'PIZCA', 'PAQUETE', 'OPCIONAL');

-- DropForeignKey
ALTER TABLE "CommunityMember" DROP CONSTRAINT "CommunityMember_community_id_fkey";

-- DropForeignKey
ALTER TABLE "PostComment" DROP CONSTRAINT "PostComment_parent_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "PostComment" DROP CONSTRAINT "PostComment_post_id_fkey";

-- DropForeignKey
ALTER TABLE "RecipeIngredient" DROP CONSTRAINT "RecipeIngredient_recipe_id_fkey";

-- DropForeignKey
ALTER TABLE "RecipeIngredient" DROP CONSTRAINT "RecipeIngredient_unit_of_measure_id_fkey";

-- DropForeignKey
ALTER TABLE "RecipeStep" DROP CONSTRAINT "RecipeStep_recipe_id_fkey";

-- DropIndex
DROP INDEX "Vote_user_id_content_type_content_id_key";

-- AlterTable
ALTER TABLE "Community" DROP COLUMN "visibility",
ADD COLUMN     "banner_url" TEXT;

-- AlterTable
ALTER TABLE "Local" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PostComment" DROP COLUMN "edited",
ADD COLUMN     "reply_to_user_id" TEXT;

-- AlterTable
ALTER TABLE "RecipeIngredient" DROP COLUMN "unit_of_measure_id",
ADD COLUMN     "unit" "Unit" NOT NULL;

-- AlterTable
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Vote_pkey" PRIMARY KEY ("user_id", "content_id", "content_type");

-- DropTable
DROP TABLE "UnitOfMeasure";

-- DropEnum
DROP TYPE "Visibility";

-- CreateIndex
CREATE UNIQUE INDEX "Community_name_key" ON "Community"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_reply_to_user_id_fkey" FOREIGN KEY ("reply_to_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
