# Hygraph Integration Index

Welcome! This document helps you navigate the Hygraph integration setup.

---

## 📚 Documentation Guide

Choose based on your needs:

### 🚀 **I want to get started NOW**
→ Read: **[QUICKSTART_HYGRAPH.md](./QUICKSTART_HYGRAPH.md)** (5 min read)

Quick commands to get a Hygraph experiment running in minutes.

### 📖 **I want complete details**
→ Read: **[HYGRAPH_SETUP.md](./HYGRAPH_SETUP.md)** (15 min read)

Comprehensive guide covering:
- Architecture and setup
- Hygraph MCP capabilities
- Integration patterns
- Troubleshooting

### 🔧 **I want to know what was fixed**
→ Read: **[SETUP_SUMMARY.md](./SETUP_SUMMARY.md)** (10 min read)

Details on:
- Submodule interference fix
- Files changed and why
- Configuration updates
- Testing instructions

### 🧪 **I'm setting up experiments**
→ Read: **[experiments/README.md](./experiments/README.md)** (5 min read)

Guidelines for the experiments directory:
- Purpose and structure
- NX commands for experiments
- Best practices
- Moving to production

---

## ⚡ The Problem & Solution

### Problem
Your NX workspace has many submodules in `/submodules` that were interfering with NX project discovery:
- Slow command execution
- Conflicts during project generation
- TypeScript processing unnecessary files

### Solution
Three-layer fix implemented:

1. **`.nxignore`** - Tells NX what to ignore
2. **`nx.json` plugins** - Each plugin excludes submodules
3. **`tsconfig.base.json`** - TypeScript excludes submodules

**Result:** NX and TS now ignore external dependencies, workspace works smoothly!

---

## 🎯 Quick Reference

### Project Structure
```
gbg/
├── .nxignore              # ← NEW: NX ignore file
├── nx.json               # ← MODIFIED: Plugin excludes
├── tsconfig.base.json    # ← MODIFIED: TS excludes
│
├── HYGRAPH_INDEX.md      # ← You are here
├── QUICKSTART_HYGRAPH.md # ← Start here for quick setup
├── HYGRAPH_SETUP.md      # ← Full documentation
├── SETUP_SUMMARY.md      # ← What was changed
│
├── experiments/
│   └── README.md         # ← Experiments guidelines
├── packages/             # Your actual libraries
└── apps/                 # Your actual applications
```

### Essential Commands

```bash
# Verify fix worked
nx list | head -20              # Should show only workspace projects

# Generate experiment app
nx generate @nx/next:app hygraph-cms --directory=experiments

# Common experiment commands
nx serve experiments-hygraph-cms        # Run dev server
nx build experiments-hygraph-cms        # Build for production
nx lint experiments-hygraph-cms         # Check code style
nx test experiments-hygraph-cms         # Run tests
```

---

## 🔗 Available Resources

| Resource | What It Does |
|----------|--------------|
| Hygraph Docs | https://hygraph.com/docs |
| GraphQL Request | GraphQL client library |
| Experiments Dir | Safe place to prototype |
| MCP Tools | Content management via Claude |

---

## 🎓 Learning Path

### Level 1: Just Want It Working (30 min)
1. Read `QUICKSTART_HYGRAPH.md`
2. Follow the 5-step setup
3. You're done!

### Level 2: Want to Understand (1 hour)
1. Read `SETUP_SUMMARY.md` (understand what was fixed)
2. Read `QUICKSTART_HYGRAPH.md` (get it running)
3. Skim `HYGRAPH_SETUP.md` (learn the details)

### Level 3: Deep Dive (2-3 hours)
1. Read all documentation thoroughly
2. Explore the MCP capabilities
3. Create a real Hygraph project
4. Build something with Hygraph!

---

## ❓ FAQ

**Q: Why do we have an experiments directory?**  
A: To safely test new tools and frameworks (like Hygraph) without affecting production code.

**Q: What if my NX commands still don't work?**  
A: See troubleshooting section in `SETUP_SUMMARY.md` or run `nx reset` to clear cache.

**Q: Can I use something other than Next.js for experiments?**  
A: Yes! Use `@nx/react:app` or `@nx/web:app` instead. See `experiments/README.md`.

**Q: How do I move an experiment to production?**  
A: Move it from `experiments/` to `packages/` (libs) or `apps/` (apps). See `experiments/README.md`.

**Q: What's the Hygraph MCP?**  
A: A Model Context Protocol that lets you manage Hygraph content directly via Claude. See `HYGRAPH_SETUP.md`.

---

## 📋 Checklist: Getting Started

- [ ] Read this file (you're here! ✓)
- [ ] Read `QUICKSTART_HYGRAPH.md`
- [ ] Sign up for Hygraph at hygraph.com
- [ ] Create a Hygraph project and get credentials
- [ ] Run: `nx generate @nx/next:app hygraph-cms --directory=experiments`
- [ ] Add `.env.local` with `NEXT_PUBLIC_HYGRAPH_ENDPOINT`
- [ ] Install: `pnpm add graphql-request graphql`
- [ ] Start server: `nx serve experiments-hygraph-cms`
- [ ] Start building! 🚀

---

## 🤝 Need Help?

1. **First time?** → `QUICKSTART_HYGRAPH.md`
2. **Troubleshooting?** → `SETUP_SUMMARY.md` troubleshooting section
3. **Details?** → `HYGRAPH_SETUP.md`
4. **Experiments?** → `experiments/README.md`

---

## ✅ Status

- ✅ NX submodule interference fixed
- ✅ Hygraph MCP available
- ✅ Documentation complete
- ✅ Experiments directory ready
- ✅ Quick-start guide ready

**You're all set! Happy coding! 🎉**

---

**Last Updated:** November 12, 2025  
**Status:** Ready for Production Use

