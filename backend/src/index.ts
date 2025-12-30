// --- Módulos Principales de Autenticación y Locales ---
export { default as Auth } from "./modules/auth/routes/auth.routes";
export { default as Contact } from "./modules/mail/routes/contact.routes";

// --- Módulos de Negocio (Business - Menu - FoodCategory - Review) ---
export { default as Review } from "./modules/review/review.routes";
export { default as Menu } from "./modules/menu/routes/menu.routes";
export { default as FoodCategory } from "./modules/menu/routes/food-category.routes";
export { default as Local } from "./modules/local/routes/local.routes";

// --- Módulos de Comunidad ---
export { default as Community } from "./modules/community/routes/community.routes";
export { default as CommunityTags } from "./modules/community/routes/community-tag.routes";
export { default as TagCategory } from "./modules/community/routes/tag-category.routes";
export { default as Vote } from "./modules/vote/vote.routes";

// --- Módulos de Contenido (Recetas y Posts) ---
export { default as Recipe } from "./modules/recipe/recipe.routes";
export { default as Post } from "./modules/post/post.routes";
export { default as Chat } from "./modules/chat/chat.routes";

// --- Módulos de Utilidad y Misceláneos ---
export { default as Notification } from "./modules/notification/routes/notification.routes";
export { default as Onboarding } from "./routes/onBoarding.routes";
export { default as Admin } from "./routes/admin.routes";
export { default as Users } from "./routes/users";
