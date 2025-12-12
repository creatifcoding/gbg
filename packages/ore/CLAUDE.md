# Claude Development Notes

## NX Project Configuration

When adding new scripts to `package.json`, always add corresponding nx executors to `project.json`:

```json
"script-name": {
  "executor": "nx:run-commands",
  "options": {
    "command": "bun run script-name",
    "cwd": "packages/ore"
  }
}
```

This ensures scripts can be run via both `bun run` and `nx run ore:script-name`.
