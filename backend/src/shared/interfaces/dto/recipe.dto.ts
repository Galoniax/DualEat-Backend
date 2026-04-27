import { Unit } from "@prisma/client";

export interface RecipeDTO {
  name: string;
  description: string;
  total_time?: number;
  main_image: string;
  user_id: string;

  ingredients: RecipeIngredientDTO[];
  steps: RecipeStepDTO[];
}

export interface RecipeStepDTO {
  step_number: number;
  description: string;
  estimated_time: number | null;
  image_url: string;
}

export interface RecipeIngredientDTO {
  ingredient_id: number;
  quantity: string;
  unit: Unit;
  notes?: string;
}