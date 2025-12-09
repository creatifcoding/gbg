import { fastify } from "fastify";
import { fastifyConnectPlugin } from "@connectrpc/connect-fastify";
import routes from "./routes";

async function main() {
    const server = fastify({
        http2: true,
    });

    await server.register(fastifyConnectPlugin, {
        routes,
        grpc: true
    });
    server.get("/", (_, reply) => {
        reply.header("Content-Type", "text/plain");
        reply.code(200).send("Hello World!");
    });
    await server.listen({ host: "localhost", port: 4011 });
    console.log("server is listening at", server.addresses());
}

// You can remove the main() wrapper if you set type: module in your package.json,
// and update your tsconfig.json with target: es2017 and module: es2022.
void main();