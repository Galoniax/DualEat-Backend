export interface CreatePostDTO {
    title: string;
    content: string;
    image_urls?: string[];
    user_id: string;
    community_id: string;
}