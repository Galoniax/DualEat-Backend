import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { UserService } from "../../modules/auth/services/user.service";

export function configurePassport() {
  const userService = new UserService();

  // Serialización y deserialización del usuario
  passport.serializeUser(function (user: any, done) {
    done(null, user);
  });

  passport.deserializeUser(function (obj: any, done) {
    done(null, obj);
  });

  // Estrategia de autenticación con Google
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        passReqToCallback: true,
        proxy: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          if (!profile.emails?.[0]?.value) {
            return done(new Error("Email no encontrado en perfil de Google"));
          }
          const googleUser = {
            googleId: profile.id,
            email: profile.emails[0].value.toLowerCase(),
            name: profile.displayName,
            avatar_url: profile.photos?.[0]?.value || null,
            provider: "google",
          };
          const existingUser = await userService.getByEmail(googleUser.email);

          let user;

          if (existingUser) {
            user = existingUser;
          } else {
            user = googleUser;
          }

          return done(null, {
            ...user,
            isExisting: !!existingUser,
            isBusiness: existingUser?.is_business || false,
          });
        } catch (error) {
          console.error("Error in Google Strategy:", error);
          return done(error as Error);
        }
      },
    ),
  );
}
