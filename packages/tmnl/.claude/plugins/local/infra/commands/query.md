---
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
argument-hint: "<question>"
description: "Ask questions about infrastructure"
---

# Infrastructure Query

Answer the user's infrastructure question using live container state and documentation.

## Query: $ARGUMENTS

## Protocol

1. **Collect current state**:
   ```bash
   cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docker && docker compose ps --format json
   ```

2. **If question involves specific service**, get its logs:
   ```bash
   docker compose logs --tail 30 <service>
   ```

3. **Reference documentation**:
   - Service briefings: `.claude/plugins/local/infra/skills/infrastructure/briefings/`
   - Troubleshooting: `.claude/plugins/local/infra/skills/infrastructure/journals/troubleshooting.md`
   - Docker compose: `docker/docker-compose.yml`

4. **Answer with**:
   - Current state observation
   - Root cause analysis (if applicable)
   - Recommended action
   - Relevant commands

## Example Queries

- "Why is electric restarting?" → Check logs, identify cause, suggest fix
- "What depends on postgres?" → Show dependency chain
- "Is search cluster healthy?" → Check container status, report
- "How do I debug nats?" → Provide diagnostics commands
- "Show network topology" → Generate ASCII diagram
