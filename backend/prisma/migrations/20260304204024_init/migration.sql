-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('INACTIVE', 'TRIAL', 'ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('POST', 'COMMENT');

-- CreateEnum
CREATE TYPE "public"."VoteType" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PAID', 'COMPLETED', 'CANCELLED', 'READY');

-- CreateEnum
CREATE TYPE "public"."Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."LocalUserRole" AS ENUM ('admin', 'staff');

-- CreateEnum
CREATE TYPE "public"."TypesCategory" AS ENUM ('Tipos_de_comida', 'Estilos_o_dietas', 'Origen_y_cultura');

-- CreateEnum
CREATE TYPE "public"."NotificationFrequency" AS ENUM ('ALWAYS', 'NONE');

-- CreateEnum
CREATE TYPE "public"."NotificationContentType" AS ENUM ('POST', 'COMMUNITY', 'LOCAL', 'ORDER', 'COMMENT');

-- CreateEnum
CREATE TYPE "public"."DayOfWeek" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "public"."LocalEventType" AS ENUM ('TASK', 'PAYMENT', 'MEETING', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."EventStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStateMP" AS ENUM ('inactive', 'authorized', 'active', 'paused', 'cancelled', 'finished');

-- CreateEnum
CREATE TYPE "public"."SubscriptionType" AS ENUM ('LOCAL', 'COMMUNITY_USER');

-- CreateEnum
CREATE TYPE "public"."SubscriptionPlan" AS ENUM ('LOCAL_MONTHLY', 'LOCAL_ANNUAL', 'COMMUNITY_USER_MONTHLY', 'COMMUNITY_USER_ANNUAL');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "reset_code" TEXT,
    "reset_expires_at" TIMESTAMP(3),
    "is_business" BOOLEAN NOT NULL DEFAULT false,
    "subscription_status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "trial_ends_at" TIMESTAMP(3),
    "notificationsPref" "public"."NotificationFrequency" NOT NULL DEFAULT 'ALWAYS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPreference" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "food_category_id" INTEGER,
    "community_tag_id" INTEGER,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_type" "public"."NotificationContentType",
    "content_id" TEXT,
    "metadata" JSONB,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Local" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "type_local" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LocalSchedule" (
    "id" TEXT NOT NULL,
    "day_of_week" "public"."DayOfWeek" NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,

    CONSTRAINT "LocalSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LocalCalendarEvent" (
    "id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "is_full_day" BOOLEAN NOT NULL DEFAULT false,
    "event_type" "public"."LocalEventType" NOT NULL DEFAULT 'TASK',
    "status" "public"."EventStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LocalNote" (
    "id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LocalUser" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "role" "public"."LocalUserRole" NOT NULL DEFAULT 'staff',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LocalReview" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT,

    CONSTRAINT "LocalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoodCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tipo" "public"."TypesCategory" NOT NULL,
    "icon_url" TEXT,

    CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Food" (
    "id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "image_url" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "votes_up" INTEGER NOT NULL DEFAULT 0,
    "votes_down" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Promotion" (
    "id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "food_id" TEXT,
    "title" TEXT,
    "description" TEXT,
    "discount_pct" DOUBLE PRECISION NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vote" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_type" "public"."ContentType" NOT NULL,
    "content_id" TEXT NOT NULL,
    "vote_type" "public"."VoteType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Community" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "visibility" "public"."Visibility" NOT NULL DEFAULT 'PUBLIC',
    "total_members" INTEGER NOT NULL DEFAULT 0,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TagCategory" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,

    CONSTRAINT "TagCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommunityTag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CommunityTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommunityMember" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "receives_notifications" "public"."NotificationFrequency" NOT NULL DEFAULT 'ALWAYS',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_moderator" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Recipe" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "total_time" INTEGER,
    "main_image" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "quantity" TEXT NOT NULL,
    "unit_of_measure_id" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecipeStep" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "estimated_time" INTEGER,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image_urls" TEXT[],
    "votes_up" INTEGER NOT NULL DEFAULT 0,
    "votes_down" INTEGER NOT NULL DEFAULT 0,
    "total_comments" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recipe_id" TEXT,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PostComment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "content" TEXT NOT NULL,
    "votes_up" INTEGER NOT NULL DEFAULT 0,
    "votes_down" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UnitOfMeasure" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "local_id" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "short_code" TEXT,
    "delivery_date" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItem" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "food_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "local_id" TEXT,
    "mp_preapproval_id" TEXT NOT NULL,
    "subscription_type" "public"."SubscriptionType" NOT NULL,
    "plan" "public"."SubscriptionPlan" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency_id" TEXT NOT NULL DEFAULT 'ARS',
    "status" "public"."SubscriptionStateMP" NOT NULL DEFAULT 'authorized',
    "start_date" TIMESTAMP(3) NOT NULL,
    "next_payment_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "payment_history" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_LocalCategories" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LocalCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_CommunityTags" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CommunityTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_user_id_food_category_id_key" ON "public"."UserPreference"("user_id", "food_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_user_id_community_tag_id_key" ON "public"."UserPreference"("user_id", "community_tag_id");

-- CreateIndex
CREATE INDEX "Notification_created_at_user_id_idx" ON "public"."Notification"("created_at", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Local_slug_key" ON "public"."Local"("slug");

-- CreateIndex
CREATE INDEX "Local_name_latitude_longitude_idx" ON "public"."Local"("name", "latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "LocalSchedule_local_id_day_of_week_open_time_close_time_key" ON "public"."LocalSchedule"("local_id", "day_of_week", "open_time", "close_time");

-- CreateIndex
CREATE INDEX "LocalCalendarEvent_local_id_start_time_idx" ON "public"."LocalCalendarEvent"("local_id", "start_time");

-- CreateIndex
CREATE INDEX "LocalNote_local_id_is_pinned_due_date_idx" ON "public"."LocalNote"("local_id", "is_pinned", "due_date");

-- CreateIndex
CREATE INDEX "LocalUser_local_id_idx" ON "public"."LocalUser"("local_id");

-- CreateIndex
CREATE UNIQUE INDEX "LocalUser_user_id_local_id_key" ON "public"."LocalUser"("user_id", "local_id");

-- CreateIndex
CREATE UNIQUE INDEX "LocalReview_order_id_key" ON "public"."LocalReview"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "FoodCategory_name_key" ON "public"."FoodCategory"("name");

-- CreateIndex
CREATE INDEX "FoodCategory_name_idx" ON "public"."FoodCategory"("name");

-- CreateIndex
CREATE INDEX "Food_local_id_idx" ON "public"."Food"("local_id");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "public"."Food"("name");

-- CreateIndex
CREATE INDEX "Food_category_id_idx" ON "public"."Food"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_food_id_key" ON "public"."Promotion"("food_id");

-- CreateIndex
CREATE INDEX "Promotion_discount_pct_idx" ON "public"."Promotion"("discount_pct");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_user_id_content_type_content_id_key" ON "public"."Vote"("user_id", "content_type", "content_id");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "public"."Community"("slug");

-- CreateIndex
CREATE INDEX "Community_name_idx" ON "public"."Community"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TagCategory_slug_key" ON "public"."TagCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TagCategory_name_key" ON "public"."TagCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityTag_name_key" ON "public"."CommunityTag"("name");

-- CreateIndex
CREATE INDEX "CommunityMember_community_id_idx" ON "public"."CommunityMember"("community_id");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_user_id_community_id_key" ON "public"."CommunityMember"("user_id", "community_id");

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredient_id_idx" ON "public"."RecipeIngredient"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_recipe_id_step_number_key" ON "public"."RecipeStep"("recipe_id", "step_number");

-- CreateIndex
CREATE INDEX "PostComment_post_id_idx" ON "public"."PostComment"("post_id");

-- CreateIndex
CREATE INDEX "PostComment_user_id_idx" ON "public"."PostComment"("user_id");

-- CreateIndex
CREATE INDEX "PostComment_parent_comment_id_idx" ON "public"."PostComment"("parent_comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_name_key" ON "public"."UnitOfMeasure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_abbreviation_key" ON "public"."UnitOfMeasure"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "public"."Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Order_local_id_short_code_key" ON "public"."Order"("local_id", "short_code");

-- CreateIndex
CREATE INDEX "Subscription_mp_preapproval_id_idx" ON "public"."Subscription"("mp_preapproval_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_user_id_local_id_subscription_type_key" ON "public"."Subscription"("user_id", "local_id", "subscription_type");

-- CreateIndex
CREATE INDEX "_LocalCategories_B_index" ON "public"."_LocalCategories"("B");

-- CreateIndex
CREATE INDEX "_CommunityTags_B_index" ON "public"."_CommunityTags"("B");

-- AddForeignKey
ALTER TABLE "public"."UserPreference" ADD CONSTRAINT "UserPreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPreference" ADD CONSTRAINT "UserPreference_food_category_id_fkey" FOREIGN KEY ("food_category_id") REFERENCES "public"."FoodCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPreference" ADD CONSTRAINT "UserPreference_community_tag_id_fkey" FOREIGN KEY ("community_tag_id") REFERENCES "public"."CommunityTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalSchedule" ADD CONSTRAINT "LocalSchedule_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalCalendarEvent" ADD CONSTRAINT "LocalCalendarEvent_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalNote" ADD CONSTRAINT "LocalNote_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalUser" ADD CONSTRAINT "LocalUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalUser" ADD CONSTRAINT "LocalUser_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalReview" ADD CONSTRAINT "LocalReview_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalReview" ADD CONSTRAINT "LocalReview_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalReview" ADD CONSTRAINT "LocalReview_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Food" ADD CONSTRAINT "Food_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Food" ADD CONSTRAINT "Food_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."FoodCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Promotion" ADD CONSTRAINT "Promotion_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Promotion" ADD CONSTRAINT "Promotion_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vote" ADD CONSTRAINT "Vote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Community" ADD CONSTRAINT "Community_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommunityTag" ADD CONSTRAINT "CommunityTag_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."TagCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommunityMember" ADD CONSTRAINT "CommunityMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommunityMember" ADD CONSTRAINT "CommunityMember_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recipe" ADD CONSTRAINT "Recipe_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "public"."UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecipeStep" ADD CONSTRAINT "RecipeStep_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostComment" ADD CONSTRAINT "PostComment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostComment" ADD CONSTRAINT "PostComment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostComment" ADD CONSTRAINT "PostComment_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."PostComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "public"."Local"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LocalCategories" ADD CONSTRAINT "_LocalCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."FoodCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LocalCategories" ADD CONSTRAINT "_LocalCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CommunityTags" ADD CONSTRAINT "_CommunityTags_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CommunityTags" ADD CONSTRAINT "_CommunityTags_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."CommunityTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
