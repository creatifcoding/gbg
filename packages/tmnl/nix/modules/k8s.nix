{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      lib,
      ...
    }:
    let
      inherit (pkgs.stdenv) isLinux isDarwin;
    in
    {
      devShells.tmnl-k8s = pkgs.mkShell {
        name = "tmnl-k8s";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        nativeBuildInputs = with pkgs; [
          # Cluster management
          k3d
          kubectl
          kubernetes-helm
          k9s
          stern  # Multi-pod log tailing

          # Kustomize for CRD management
          kustomize

          # YAML processing
          yq-go

          # Container tools
          docker-client
        ];

        shellHook = ''
          echo "[tmnl-k8s] Kubernetes development environment"
          echo "  → k3d, kubectl, helm, k9s, kustomize"
          echo ""
          echo "  Quickstart:"
          echo "    k8s-cluster-create   Create local k3d cluster"
          echo "    k8s-pepr-dev         Run Pepr operator (registers CRDs, watches resources)"
          echo "    k8s-pepr-deploy      Deploy operator to cluster"
          echo "    k8s-crd-status       Show CRDs and resources"
          echo ""
        '';
      };

      mission-control.scripts = {
        # =====================================================================
        # CLUSTER LIFECYCLE
        # =====================================================================

        k8s-cluster-create = {
          description = "Create local k3d cluster for TMNL development.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            CLUSTER_NAME="''${1:-tmnl}"

            echo "[k8s] Creating k3d cluster: $CLUSTER_NAME"

            # Check if cluster exists
            if k3d cluster list | grep -q "^$CLUSTER_NAME "; then
              echo "[k8s] Cluster '$CLUSTER_NAME' already exists"
              echo "  → Use 'k8s-cluster-delete' to remove it first"
              exit 1
            fi

            # Create cluster with port mappings for:
            # - 3002: Cosmo Router GraphQL
            # - 4011: Sensor subgraph
            # - 8080: General HTTP
            k3d cluster create "$CLUSTER_NAME" \
              --port "3002:3002@loadbalancer" \
              --port "4011:4011@loadbalancer" \
              --port "8080:80@loadbalancer" \
              --agents 2 \
              --wait

            echo ""
            echo "[k8s] Cluster created successfully!"
            echo "  → kubectl context set to: k3d-$CLUSTER_NAME"
            echo ""
            kubectl cluster-info
          '';
        };

        k8s-cluster-delete = {
          description = "Delete local k3d cluster.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            CLUSTER_NAME="''${1:-tmnl}"

            echo "[k8s] Deleting k3d cluster: $CLUSTER_NAME"
            k3d cluster delete "$CLUSTER_NAME"
            echo "[k8s] Cluster deleted"
          '';
        };

        k8s-cluster-start = {
          description = "Start stopped k3d cluster.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            CLUSTER_NAME="''${1:-tmnl}"

            echo "[k8s] Starting k3d cluster: $CLUSTER_NAME"
            k3d cluster start "$CLUSTER_NAME"
            echo "[k8s] Cluster started"
            kubectl cluster-info
          '';
        };

        k8s-cluster-stop = {
          description = "Stop k3d cluster without deleting.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            CLUSTER_NAME="''${1:-tmnl}"

            echo "[k8s] Stopping k3d cluster: $CLUSTER_NAME"
            k3d cluster stop "$CLUSTER_NAME"
            echo "[k8s] Cluster stopped"
          '';
        };

        k8s-cluster-list = {
          description = "List all k3d clusters.";
          category = "Kubernetes";
          exec = ''
            k3d cluster list
          '';
        };

        # =====================================================================
        # CRD MANAGEMENT
        # =====================================================================

        k8s-crd-delete = {
          description = "Delete Cosmo CRDs from cluster.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            echo "[k8s] Deleting Cosmo CRDs..."
            kubectl delete crd cosmorouters.tmnl.gbg.dev --ignore-not-found
            kubectl delete crd cosmosubgraphs.tmnl.gbg.dev --ignore-not-found

            echo "[k8s] CRDs deleted"
          '';
        };

        k8s-crd-status = {
          description = "Show status of Cosmo CRDs and resources.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            echo "[k8s] Cosmo CRDs:"
            kubectl get crd | grep -E "tmnl|NAME" || echo "  (none found)"

            echo ""
            echo "[k8s] CosmoRouters:"
            kubectl get cosmorouters --all-namespaces 2>/dev/null || echo "  (none found)"

            echo ""
            echo "[k8s] CosmoSubgraphs:"
            kubectl get cosmosubgraphs --all-namespaces 2>/dev/null || echo "  (none found)"
          '';
        };

        # =====================================================================
        # PEPR OPERATOR
        # =====================================================================

        k8s-pepr-dev = {
          description = "Run Pepr operator in dev mode (live reload).";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            INFRA_DIR="$FLAKE_ROOT/src/infra/graph"
            cd "$INFRA_DIR"

            echo "[k8s] Starting Pepr operator in dev mode..."
            echo "  → Watching for CosmoRouter and CosmoSubgraph changes"
            echo ""

            bunx pepr dev
          '';
        };

        k8s-pepr-build = {
          description = "Build Pepr operator container.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            INFRA_DIR="$FLAKE_ROOT/src/infra/graph"
            cd "$INFRA_DIR"

            echo "[k8s] Building Pepr operator..."
            bunx pepr build

            echo ""
            echo "[k8s] Build complete. Deploy with 'k8s-pepr-deploy'"
          '';
        };

        k8s-pepr-deploy = {
          description = "Deploy Pepr operator to cluster.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            INFRA_DIR="$FLAKE_ROOT/src/infra/graph"
            cd "$INFRA_DIR"

            echo "[k8s] Deploying Pepr operator..."
            bunx pepr deploy

            echo ""
            echo "[k8s] Operator deployed. Check status:"
            echo "  kubectl get pods -n pepr-system"
          '';
        };

        k8s-pepr-logs = {
          description = "Tail Pepr operator logs.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            echo "[k8s] Tailing Pepr operator logs..."
            stern -n pepr-system .
          '';
        };

        # =====================================================================
        # TEST RESOURCES (TypeScript, no YAML)
        # =====================================================================

        k8s-test-create = {
          description = "Create test CosmoRouter and CosmoSubgraph instances.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            INFRA_DIR="$FLAKE_ROOT/src/infra/graph"
            cd "$INFRA_DIR"

            echo "[k8s] Creating test resources via TypeScript..."
            bunx tsx test/create-test-resources.ts create

            echo ""
            echo "[k8s] Verify with: k8s-crd-status"
          '';
        };

        k8s-test-delete = {
          description = "Delete test CosmoRouter and CosmoSubgraph instances.";
          category = "Kubernetes";
          exec = ''
            set -euo pipefail

            INFRA_DIR="$FLAKE_ROOT/src/infra/graph"
            cd "$INFRA_DIR"

            echo "[k8s] Deleting test resources..."
            bunx tsx test/create-test-resources.ts delete
          '';
        };

        # =====================================================================
        # UTILITIES
        # =====================================================================

        k8s-dashboard = {
          description = "Open k9s terminal UI for cluster.";
          category = "Kubernetes";
          exec = ''
            k9s
          '';
        };

        k8s-context = {
          description = "Show/switch kubectl context.";
          category = "Kubernetes";
          exec = ''
            if [ -n "''${1:-}" ]; then
              kubectl config use-context "$1"
            else
              echo "Current context: $(kubectl config current-context)"
              echo ""
              echo "Available contexts:"
              kubectl config get-contexts
            fi
          '';
        };
      };
    };
}
