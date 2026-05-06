import { createApiServer } from "./api";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 8787);

const server = createApiServer();

server.listen({ host, port }).then(() => {
  console.log(`Codex Hub WebOS API listening on http://${host}:${port}`);
});
