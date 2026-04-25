import { Visibility } from "@prisma/client";

export interface CreateCommunityDTO {
  name: string;
  slug?: string;
  description: string;
  image_url?: string;
  visibility: Visibility; 
  creator_id: string;
  selectedTags: number[]; 
}