export interface ChatSessionData {
  text: string;
  role: "USER" | "IA";
}
export interface ChatSession {
  chat_id: string;
  title: string;
  createdAt: string;
  lastActivity: string;
  messages: ChatSessionData[];
  recipe_id?: string | null;
}
