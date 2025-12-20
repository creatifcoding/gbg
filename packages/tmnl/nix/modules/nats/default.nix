{ inputs, lib, ... }:
{
  perSystem = { config, pkgs, system, lib, ... }: {
    mission-control.scripts = {
      nats-deploy = {
        description = "Deploy NATS cluster to k3d";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"

          echo "[NATS] Creating namespace..."
          kubectl create namespace nats || true

          echo "[NATS] Adding Helm repo..."
          helm repo add nats https://nats-io.github.io/k8s/helm/charts/
          helm repo update

          echo "[NATS] Installing NATS cluster..."
          helm upgrade --install nats nats/nats \
            -f nix/modules/nats/values.yaml \
            -n nats \
            --wait

          echo ""
          echo "[NATS] Deployment complete!"
          echo "Check status: kubectl get pods -n nats"
          echo "Get NATS Box: kubectl get pods -n nats -l app=nats-box"
        '';
      };

      nats-status = {
        description = "Check NATS cluster status";
        exec = ''
          echo "[NATS] Cluster Status:"
          kubectl get pods -n nats
          echo ""
          echo "[NATS] Services:"
          kubectl get svc -n nats
        '';
      };

      nats-test = {
        description = "Test NATS functionality";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"

          NATS_BOX=$(kubectl get pods -n nats -l app=nats-box -o jsonpath='{.items[0].metadata.name}')

          if [ -z "$NATS_BOX" ]; then
            echo "Error: NATS Box pod not found"
            exit 1
          fi

          echo "[NATS] Testing pub/sub..."
          kubectl exec -n nats "$NATS_BOX" -- nats pub test.subject "hello from nats-test at $(date -Iseconds)"

          echo ""
          echo "[NATS] Creating JetStream stream..."
          kubectl exec -n nats "$NATS_BOX" -- nats stream add TMNL_TEST \
            --subjects "tmnl.test.>" \
            --storage file \
            --replicas 3 \
            --max-msgs=-1 \
            --max-age=24h \
            --discard old || echo "Stream already exists"

          echo ""
          echo "[NATS] Stream info:"
          kubectl exec -n nats "$NATS_BOX" -- nats stream info TMNL_TEST

          echo ""
          echo "[NATS] Creating KV bucket..."
          kubectl exec -n nats "$NATS_BOX" -- nats kv add TMNL_CONFIG || echo "Bucket already exists"
          kubectl exec -n nats "$NATS_BOX" -- nats kv put TMNL_CONFIG test-key "test-value-$(date +%s)"
          kubectl exec -n nats "$NATS_BOX" -- nats kv get TMNL_CONFIG test-key

          echo ""
          echo "[NATS] All tests passed!"
        '';
      };

      nats-destroy = {
        description = "Destroy NATS cluster";
        exec = ''
          echo "[NATS] Uninstalling..."
          helm uninstall nats -n nats || true
          kubectl delete namespace nats || true
          echo "[NATS] Destroyed"
        '';
      };

      nats-shell = {
        description = "Open NATS Box shell";
        exec = ''
          NATS_BOX=$(kubectl get pods -n nats -l app=nats-box -o jsonpath='{.items[0].metadata.name}')

          if [ -z "$NATS_BOX" ]; then
            echo "Error: NATS Box pod not found"
            exit 1
          fi

          echo "[NATS] Opening shell in $NATS_BOX..."
          kubectl exec -it -n nats "$NATS_BOX" -- sh
        '';
      };
    };
  };
}
