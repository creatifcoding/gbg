# TypeScript Connect RPC Fastify Service

This is a template to create a GraphQL Service using Cosmo Connect.
The Stack is Cosmo Router as the GraphQL-to-gRPC Gateway,
and Connect RPC + Fastify as the backend service.

To run this stack in production, we recommend using [Cosmo Schema Registry](https://cosmo-docs.wundergraph.com/overview) for schema management, breaking change detection, metrics and observability.

## Getting Started

```bash
npm install
npm run bootstrap
npm run start
```

## Development

1. Modify the `./graph/schema.graphql` file
2. Run `npm run generate` to update the proto files and re-generate the connect rpc stub files as well as the router execution config
3. Update the `./src/routes.ts` file to match the updated connect rpc contract
4. Run `npm run start` to start the service and Router

## Notes

- `router.compose.yaml` is the input to generate the `router.execution.config.json` file, you can add more services/subgraphs
- `router.config.yaml` is the configuration for the Router, you can find the full list of configuration options in the [Router Config Reference](https://cosmo-docs.wundergraph.com/router/configuration)
- `router.execution.config.json` is the output of running `npm run generate:router`, don't modify this file manually
- `buf.gen.yaml` is the configuration for generating the connect rpc files
- `buf.yaml` is the configuration for connect rpc
- `./src/index.ts` is the entry point for the fastify service
- `./src/routes.ts` is the entry point for the connect rpc service implementation
- `./src/graph/schema.graphql` is the source of truth for the service schema/contract
- `./src/proto/service/v1/service.v1.proto` is the generated proto file from the GraphQL Schema
- `./router/router` is the Router binary