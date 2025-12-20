{ inputs, lib, ... }:
{
  perSystem = { config, pkgs, system, lib, ... }: {
    mission-control.scripts = {
      postgres-deploy = {
        description = "Deploy PostgreSQL to k3d";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"
          
          echo "[PostgreSQL] Creating namespace..."
          kubectl create namespace data || true
          
          echo "[PostgreSQL] Creating ConfigMap with init script..."
          kubectl create configmap postgres-init \
            -n data \
            --from-file=init-extensions.sql=nix/modules/postgres/init-extensions.sql \
            --dry-run=client -o yaml | kubectl apply -f -
          
          echo "[PostgreSQL] Deploying StatefulSet..."
          kubectl apply -f nix/modules/postgres/statefulset.yaml
          
          echo "[PostgreSQL] Waiting for pod to be ready..."
          kubectl wait --for=condition=ready pod -l app=postgres -n data --timeout=300s || true
          
          echo ""
          echo "[PostgreSQL] Deployment complete!"
          echo "Check status: kubectl get pods -n data"
          echo "Connect: kubectl exec -it -n data statefulset/postgres -- psql -U postgres -d tmnl"
        '';
      };

      postgres-status = {
        description = "Check PostgreSQL status";
        exec = ''
          echo "[PostgreSQL] Pod Status:"
          kubectl get pods -n data -l app=postgres
          echo ""
          echo "[PostgreSQL] Service:"
          kubectl get svc -n data postgres
          echo ""
          echo "[PostgreSQL] Checking extensions..."
          kubectl exec -n data statefulset/postgres -- psql -U postgres -d tmnl -c "\dx" || true
        '';
      };

      postgres-test = {
        description = "Test PostgreSQL functionality";
        exec = ''
          echo "[PostgreSQL] Testing connection..."
          kubectl exec -n data statefulset/postgres -- psql -U postgres -d tmnl -c "SELECT version();"
          
          echo ""
          echo "[PostgreSQL] Listing extensions..."
          kubectl exec -n data statefulset/postgres -- psql -U postgres -d tmnl -c "\dx"
          
          echo ""
          echo "[PostgreSQL] Listing schemas..."
          kubectl exec -n data statefulset/postgres -- psql -U postgres -d tmnl -c "\dn+"
          
          echo ""
          echo "[PostgreSQL] Sample data from device_readings..."
          kubectl exec -n data statefulset/postgres -- psql -U postgres -d tmnl -c "SELECT * FROM ams.device_readings LIMIT 5;"
          
          echo ""
          echo "[PostgreSQL] Latest readings view..."
          kubectl exec -n data statefulset/postgres -- psql -U postgres -d tmnl -c "SELECT * FROM ams.latest_device_readings;"
          
          echo ""
          echo "[PostgreSQL] All tests passed!"
        '';
      };

      postgres-shell = {
        description = "Open PostgreSQL shell";
        exec = ''
          kubectl exec -it -n data statefulset/postgres -- psql -U postgres -d tmnl
        '';
      };

      postgres-destroy = {
        description = "Destroy PostgreSQL deployment";
        exec = ''
          echo "[PostgreSQL] Uninstalling..."
          kubectl delete -f nix/modules/postgres/statefulset.yaml || true
          kubectl delete pvc -n data -l app=postgres || true
          kubectl delete namespace data || true
          echo "[PostgreSQL] Destroyed"
        '';
      };
    };
  };
}
