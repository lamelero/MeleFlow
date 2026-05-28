import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema, refreshSchema, updateLanguageSchema } from "./auth.schema";
import { AuthService } from "./auth.service";

const service = new AuthService();

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const result = await service.register(input);
    return reply.code(201).send(result);
  });

  app.post("/login", async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const result = await service.login(input);
    return reply.send(result);
  });

  app.post("/refresh", async (req, reply) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await service.refresh(refreshToken);
    return reply.send(result);
  });

  app.post("/logout", async (req, reply) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await service.logout(refreshToken);
    return reply.code(204).send();
  });

  app.get(
    "/me",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const user = await service.getMe(sub);
      return reply.send(user);
    },
  );

  app.patch(
    "/language",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const { language } = updateLanguageSchema.parse(req.body);
      await service.updateLanguage(sub, language);
      return reply.code(204).send();
    },
  );
}
