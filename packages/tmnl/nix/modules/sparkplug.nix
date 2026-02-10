{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      ...
    }:
    {
      mission-control.scripts = {
        sparkplug-publish = {
          description = "Run Sparkplug B test publisher (MQTT_BROKER env var for broker URL).";
          category = "IIoT";
          exec = ''
            MQTT_BROKER=''${MQTT_BROKER:-mqtt://localhost:1883} \
            INTERVAL_MS=''${INTERVAL_MS:-1000} \
            bun run scripts/sparkplug-publish.ts
          '';
        };

        sparkplug-test = {
          description = "Run Sparkplug adapter and protocol tests.";
          category = "IIoT";
          exec = ''
            bun test src/lib/iiot/__tests__/adapters/sparkplug-adapter.test.ts
          '';
        };

        sparkplug-spike = {
          description = "Run Sparkplug broker comparison spike tests (requires MQTT_BROKER).";
          category = "IIoT";
          exec = ''
            MQTT_BROKER=''${MQTT_BROKER:-mqtt://localhost:1883} \
            bun test src/lib/iiot/__tests__/spikes/
          '';
        };

        sparkplug-client-test = {
          description = "Run @selfcharters/sparkplug-client package tests.";
          category = "IIoT";
          exec = ''
            cd "$FLAKE_ROOT/packages/sparkplug-client" && bun test
          '';
        };
      };
    };
}
