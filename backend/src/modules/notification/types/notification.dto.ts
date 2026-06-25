import { Notification } from "@prisma/client";

export interface Metadata {
  params?: {
    slug?: string;
    parent_slug?: string;
    id?: string;
    parent_id?: string;
  };
  message?: string;

  image_urls?: string[];
}

export interface CreateNotificationDTO {
  user_id: string;
  content_type: Notification["content_type"];
  content_id: string;
  title: string;
  message: string;
  metadata?: Metadata | any;
}
