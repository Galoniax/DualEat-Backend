export interface ReviewDTO {
  order_id: string;
  rating: number;
  comment?: string;
  votes?: {
    id: string;
    type: "UP" | "DOWN";
  }[];
}
