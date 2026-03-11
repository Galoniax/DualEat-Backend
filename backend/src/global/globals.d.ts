import { UserSessionData } from "../shared/interfaces/user.dto";

declare const __dirname: string;

declare global {
  namespace Express {
    interface Request {
      user?: UserSessionData;
      sessionId?: string;
    }
  }
}