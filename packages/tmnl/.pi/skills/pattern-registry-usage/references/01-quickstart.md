# Pattern Registry Quickstart

## 1) Search approved patterns first

```json
{
  "tool": "pattern_registry_search",
  "params": {
    "query": "atom state authority",
    "tags": ["effect-atom"],
    "limit": 10
  }
}
```

## 2) Run AST discovery in target scope

```json
{
  "tool": "pattern_registry_extract_ast",
  "params": {
    "roots": ["src/lib", ".pi/extensions"],
    "sourceId": "audit:atom-usage",
    "discoveredBy": "agent",
    "minOccurrences": 1,
    "maxOccurrences": 500,
    "persist": true
  }
}
```

## 3) Query discovery ledger

```json
{
  "tool": "pattern_registry_query_discoveries",
  "params": {
    "sourceType": "ast",
    "tags": ["effect-atom"],
    "limit": 20,
    "offset": 0
  }
}
```

## 4) Annotate a key finding

```json
{
  "tool": "pattern_registry_add_annotation",
  "params": {
    "annotation": {
      "annotationId": "ann-<uuid>",
      "eventId": "evt-<id>",
      "patternId": "pat-<id>",
      "author": "agent",
      "message": "Approved baseline for this feature.",
      "labels": ["approved", "baseline"]
    }
  }
}
```

## 5) Optional consolidation

```json
{
  "tool": "pattern_registry_merge_preview",
  "params": {
    "limitGroups": 200,
    "includeCandidates": true
  }
}
```

Then:

```json
{
  "tool": "pattern_registry_merge_apply",
  "params": {
    "maxGroups": 200,
    "stopOnConflict": true,
    "dryRun": false
  }
}
```

Inspect conflicts:

```json
{
  "tool": "pattern_registry_list_conflicts",
  "params": {
    "status": "open",
    "limit": 50,
    "offset": 0
  }
}
```
