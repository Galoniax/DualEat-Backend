export interface PostDTO {
  id?: string;
  title: string;
  content: string;
  image_urls: string[];
  community_id: string;
}

export interface CommentDTO {
  post_id: string;
  parent_comment_id: string | null;
  reply_to_user_id: string | null;
  content: string;
}

