import { config } from "dotenv";
config();

const { buildApp } = await import("./app");
const { env } = await import("./config/env");

const app = await buildApp({ logger: true });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`🚀 Server ready at http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
