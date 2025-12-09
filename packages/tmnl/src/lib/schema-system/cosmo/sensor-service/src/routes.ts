import type { ConnectRouter } from "@connectrpc/connect";
import { ServiceV1Service } from "./generated/service/v1/service_pb";

export default (router: ConnectRouter) => {
    router.service(ServiceV1Service, {
        queryHello: async (req) => {
            return {
                hello: `Hello ${req.name}!`
            }
        }
    });
};