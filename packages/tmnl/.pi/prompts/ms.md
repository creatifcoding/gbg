---
description: "metaskill — CRUD on skills, nodes, utils. Auto-routes from natural language."
---
Load the metaskill skill from `.pi/skills/metaskill/SKILL.md`.

First, print this operations card:

```
╔══════════════════════════════════════════════════════════════╗
║  METASKILL                                                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  SKILL        create · inspect · update · delete             ║
║               adopt · dogfood                                ║
║                                                              ║
║  NODE         create · inspect · update · delete · refresh   ║
║                                                              ║
║  UTIL         create · run · update · delete                 ║
║                                                              ║
║  WORKSPACE    inspect · adopt                                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

Then read the user's request below and route to the matching `§ entity:operation` protocol in SKILL.md. Follow the protocol steps. If the request is ambiguous, ask which operation they mean.

User request: $ARGUMENTS
