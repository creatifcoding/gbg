import {
  Globe,
  FileType,
  Code,
  Calendar,
  Tag,
  User,
  MapPin,
  Shield,
  Hash,
  Layers,
  type LucideIcon,
} from "lucide-react"

// ────────────────────────────────────────────────
// Trigger configuration
// ────────────────────────────────────────────────

/** Characters safe to use as dork triggers: they match user expectations
 *  for "command" entry and don't collide with normal prose typing. */
export const ALLOWED_TRIGGERS = ["/", "@", "#", ":", "!"] as const
export type AllowedTrigger = (typeof ALLOWED_TRIGGERS)[number]
export const DEFAULT_TRIGGER: AllowedTrigger = "/"

export function isAllowedTrigger(char: string): char is AllowedTrigger {
  return (ALLOWED_TRIGGERS as readonly string[]).includes(char)
}

// ────────────────────────────────────────────────
// Value definition for operators with known enumerations
// ────────────────────────────────────────────────

export interface DorkValue {
  value: string
  label: string
  description?: string
}

// ────────────────────────────────────────────────
// Operator definition
// ────────────────────────────────────────────────

export interface DorkOperator {
  key: string
  label: string
  description: string
  placeholder: string
  category: "scope" | "filter" | "modifier"
  icon: LucideIcon
  examples: string[]
  colorClass: string
  /** If present, the value mode shows a rolodex of known values */
  values?: DorkValue[]
  /** Whether the value is free-form text (default: true if no values) */
  freeform?: boolean
}

// ────────────────────────────────────────────────
// Category metadata
// ────────────────────────────────────────────────

export const CATEGORIES = [
  { key: "scope" as const, label: "Scope" },
  { key: "filter" as const, label: "Filter" },
  { key: "modifier" as const, label: "Modifier" },
]

// ────────────────────────────────────────────────
// Value enumerations
// ────────────────────────────────────────────────

const FILE_TYPES: DorkValue[] = [
  { value: "pdf", label: "PDF", description: "Portable Document Format" },
  { value: "csv", label: "CSV", description: "Comma-separated values" },
  { value: "json", label: "JSON", description: "JavaScript Object Notation" },
  { value: "xml", label: "XML", description: "Extensible Markup Language" },
  { value: "html", label: "HTML", description: "HyperText Markup Language" },
  { value: "md", label: "Markdown", description: "Markdown document" },
  { value: "txt", label: "Text", description: "Plain text file" },
  { value: "yaml", label: "YAML", description: "YAML Ain't Markup Language" },
  { value: "toml", label: "TOML", description: "Tom's Obvious Markup Language" },
  { value: "sql", label: "SQL", description: "Structured Query Language" },
  { value: "graphql", label: "GraphQL", description: "GraphQL schema/query" },
  { value: "proto", label: "Protobuf", description: "Protocol Buffers" },
  { value: "svg", label: "SVG", description: "Scalable Vector Graphics" },
  { value: "png", label: "PNG", description: "Portable Network Graphics" },
  { value: "jpg", label: "JPEG", description: "Joint Photographic Experts Group" },
  { value: "gif", label: "GIF", description: "Graphics Interchange Format" },
  { value: "webp", label: "WebP", description: "Modern image format" },
  { value: "wasm", label: "WASM", description: "WebAssembly binary" },
  { value: "zip", label: "ZIP", description: "Compressed archive" },
  { value: "tar.gz", label: "Tarball", description: "Compressed tar archive" },
]

const LANGUAGES: DorkValue[] = [
  { value: "typescript", label: "TypeScript", description: "Typed JavaScript superset" },
  { value: "javascript", label: "JavaScript", description: "Dynamic scripting language" },
  { value: "python", label: "Python", description: "General-purpose language" },
  { value: "rust", label: "Rust", description: "Systems programming language" },
  { value: "go", label: "Go", description: "Compiled language by Google" },
  { value: "java", label: "Java", description: "Enterprise OOP language" },
  { value: "kotlin", label: "Kotlin", description: "Modern JVM language" },
  { value: "swift", label: "Swift", description: "Apple platform language" },
  { value: "c", label: "C", description: "Low-level systems language" },
  { value: "cpp", label: "C++", description: "Systems + OOP language" },
  { value: "csharp", label: "C#", description: ".NET platform language" },
  { value: "ruby", label: "Ruby", description: "Dynamic scripting language" },
  { value: "php", label: "PHP", description: "Server-side scripting" },
  { value: "scala", label: "Scala", description: "Functional JVM language" },
  { value: "elixir", label: "Elixir", description: "Concurrent functional language" },
  { value: "haskell", label: "Haskell", description: "Pure functional language" },
  { value: "lua", label: "Lua", description: "Lightweight scripting language" },
  { value: "zig", label: "Zig", description: "Low-level systems language" },
  { value: "ocaml", label: "OCaml", description: "Functional programming language" },
  { value: "sql", label: "SQL", description: "Database query language" },
  { value: "shell", label: "Shell", description: "Bash/sh scripting" },
  { value: "css", label: "CSS", description: "Stylesheets" },
  { value: "html", label: "HTML", description: "Markup language" },
]

const STATUSES: DorkValue[] = [
  { value: "open", label: "Open", description: "Currently open items" },
  { value: "closed", label: "Closed", description: "Resolved/closed items" },
  { value: "merged", label: "Merged", description: "Merged pull requests" },
  { value: "draft", label: "Draft", description: "Work in progress drafts" },
  { value: "archived", label: "Archived", description: "Archived/deprecated items" },
  { value: "pending", label: "Pending", description: "Awaiting review or action" },
  { value: "stale", label: "Stale", description: "No recent activity" },
  { value: "locked", label: "Locked", description: "Locked from further interaction" },
]

const TAGS: DorkValue[] = [
  { value: "react", label: "React", description: "React library" },
  { value: "nextjs", label: "Next.js", description: "React framework" },
  { value: "api", label: "API", description: "Application programming interface" },
  { value: "security", label: "Security", description: "Security related" },
  { value: "performance", label: "Performance", description: "Performance optimization" },
  { value: "accessibility", label: "Accessibility", description: "A11y improvements" },
  { value: "testing", label: "Testing", description: "Tests and QA" },
  { value: "devops", label: "DevOps", description: "CI/CD and infrastructure" },
  { value: "documentation", label: "Documentation", description: "Docs and guides" },
  { value: "bug", label: "Bug", description: "Bug report" },
  { value: "feature", label: "Feature", description: "Feature request" },
  { value: "refactor", label: "Refactor", description: "Code refactoring" },
  { value: "breaking-change", label: "Breaking Change", description: "Introduces breaking changes" },
  { value: "good-first-issue", label: "Good First Issue", description: "Beginner friendly" },
  { value: "help-wanted", label: "Help Wanted", description: "Community help requested" },
]

const TOPICS: DorkValue[] = [
  { value: "machine-learning", label: "Machine Learning", description: "ML and AI" },
  { value: "web-dev", label: "Web Development", description: "Frontend and backend web" },
  { value: "devops", label: "DevOps", description: "CI/CD, infra, deployment" },
  { value: "security", label: "Security", description: "Cybersecurity and InfoSec" },
  { value: "mobile", label: "Mobile", description: "iOS and Android development" },
  { value: "data-science", label: "Data Science", description: "Data analysis and viz" },
  { value: "blockchain", label: "Blockchain", description: "Web3 and distributed ledger" },
  { value: "cloud", label: "Cloud", description: "Cloud computing platforms" },
  { value: "databases", label: "Databases", description: "SQL, NoSQL, graph DBs" },
  { value: "networking", label: "Networking", description: "Network protocols and tools" },
  { value: "gamedev", label: "Game Dev", description: "Game development" },
  { value: "embedded", label: "Embedded", description: "Embedded systems and IoT" },
  { value: "compilers", label: "Compilers", description: "Compiler design and PLT" },
]

// ────────────────────────────────────────────────
// Operator definitions
// ────────────────────────────────────────────────

export const DORK_OPERATORS: DorkOperator[] = [
  {
    key: "site:",
    label: "Site",
    description: "Limit results to a specific domain",
    placeholder: "example.com",
    category: "scope",
    icon: Globe,
    examples: ["github.com", "stackoverflow.com", "reddit.com"],
    colorClass: "bg-primary/20 text-primary border-primary/30",
    freeform: true,
  },
  {
    key: "filetype:",
    label: "File Type",
    description: "Filter by file extension",
    placeholder: "pdf",
    category: "filter",
    icon: FileType,
    examples: ["pdf", "csv", "json", "xml"],
    colorClass: "bg-accent/20 text-accent border-accent/30",
    values: FILE_TYPES,
    freeform: true,
  },
  {
    key: "lang:",
    label: "Language",
    description: "Filter by programming language",
    placeholder: "typescript",
    category: "filter",
    icon: Code,
    examples: ["typescript", "python", "rust", "go"],
    colorClass: "bg-chart-5/20 text-chart-5 border-chart-5/30",
    values: LANGUAGES,
    freeform: true,
  },
  {
    key: "after:",
    label: "After Date",
    description: "Results after a specific date",
    placeholder: "2025-01-01",
    category: "modifier",
    icon: Calendar,
    examples: ["2025-01-01", "2024-06-15", "2023-12-31"],
    colorClass: "bg-chart-4/20 text-chart-4 border-chart-4/30",
    freeform: true,
  },
  {
    key: "before:",
    label: "Before Date",
    description: "Results before a specific date",
    placeholder: "2026-01-01",
    category: "modifier",
    icon: Calendar,
    examples: ["2026-01-01", "2025-06-15", "2025-01-01"],
    colorClass: "bg-chart-4/20 text-chart-4 border-chart-4/30",
    freeform: true,
  },
  {
    key: "tag:",
    label: "Tag",
    description: "Filter by tag or label",
    placeholder: "react",
    category: "filter",
    icon: Tag,
    examples: ["react", "nextjs", "api", "security"],
    colorClass: "bg-primary/20 text-primary border-primary/30",
    values: TAGS,
    freeform: true,
  },
  {
    key: "author:",
    label: "Author",
    description: "Filter by content author",
    placeholder: "username",
    category: "scope",
    icon: User,
    examples: ["vercel", "rauchg", "shadcn"],
    colorClass: "bg-accent/20 text-accent border-accent/30",
    freeform: true,
  },
  {
    key: "repo:",
    label: "Repository",
    description: "Scope to a specific repository",
    placeholder: "owner/repo",
    category: "scope",
    icon: Layers,
    examples: ["vercel/next.js", "facebook/react", "sveltejs/svelte"],
    colorClass: "bg-chart-5/20 text-chart-5 border-chart-5/30",
    freeform: true,
  },
  {
    key: "is:",
    label: "Status",
    description: "Filter by item status",
    placeholder: "open",
    category: "modifier",
    icon: Shield,
    examples: ["open", "closed", "merged", "draft"],
    colorClass: "bg-chart-4/20 text-chart-4 border-chart-4/30",
    values: STATUSES,
    freeform: false,
  },
  {
    key: "path:",
    label: "Path",
    description: "Filter by file path pattern",
    placeholder: "src/components/",
    category: "scope",
    icon: MapPin,
    examples: ["src/", "lib/", "app/api/", "components/"],
    colorClass: "bg-primary/20 text-primary border-primary/30",
    freeform: true,
  },
  {
    key: "topic:",
    label: "Topic",
    description: "Filter by topic or subject area",
    placeholder: "machine-learning",
    category: "filter",
    icon: Hash,
    examples: ["machine-learning", "web-dev", "devops", "security"],
    colorClass: "bg-accent/20 text-accent border-accent/30",
    values: TOPICS,
    freeform: true,
  },
]
