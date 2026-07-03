import type { PermissionAction, PermissionEffect, PermissionPersona, PermissionProfile, PermissionRule } from "./permissions.js"

export interface RenderNatsAclOptions {
  readonly passwordEnvPrefix?: string
  readonly inboxSubject?: string
}

interface PermissionBuckets {
  readonly publishAllow: Set<string>
  readonly publishDeny: Set<string>
  readonly subscribeAllow: Set<string>
  readonly subscribeDeny: Set<string>
}

const defaultPasswordEnvPrefix = "PCT_NATS_PASSWORD"
const defaultInboxSubject = "_INBOX.>"

const buckets = (): PermissionBuckets => ({
  publishAllow: new Set(),
  publishDeny: new Set(),
  subscribeAllow: new Set(),
  subscribeDeny: new Set(),
})

const personaEnvName = (persona: PermissionPersona, prefix: string): string =>
  `${prefix}_${persona.toUpperCase().replaceAll("-", "_")}`

const quote = (value: string): string => JSON.stringify(value)

const sorted = (values: Set<string>): ReadonlyArray<string> => [...values].sort((a, b) => a.localeCompare(b))

const renderArray = (values: ReadonlyArray<string>): string => `[${values.map(quote).join(", ")}]`

const addSubject = (set: Set<string>, subject: string): void => {
  if (subject.trim().length > 0) set.add(subject)
}

const apply = (
  bucket: PermissionBuckets,
  action: PermissionAction,
  effect: PermissionEffect,
  subject: string,
  inboxSubject: string,
): void => {
  const publish = effect === "allow" ? bucket.publishAllow : bucket.publishDeny
  const subscribe = effect === "allow" ? bucket.subscribeAllow : bucket.subscribeDeny

  switch (action) {
    case "publish":
    case "write":
    case "delete":
    case "admin":
      addSubject(publish, subject)
      return
    case "subscribe":
    case "read":
      addSubject(subscribe, subject)
      return
    case "request":
      addSubject(publish, subject)
      if (effect === "allow") addSubject(subscribe, inboxSubject)
      return
    case "respond":
      addSubject(subscribe, subject)
      if (effect === "allow") addSubject(publish, inboxSubject)
      return
  }
}

const subjectForRule = (rule: PermissionRule): string => {
  switch (rule.resourceKind) {
    case "jetstream-api":
    case "nats-subject":
      return rule.resource
    case "kv-bucket":
      return `$KV.${rule.resource}.>`
    case "micro-endpoint":
      return rule.resource
    case "http-route":
    case "eventlog-peer":
      return `_PCT.${rule.resourceKind}.${rule.resource}`
  }
}

const renderPermissionObject = (bucket: PermissionBuckets): string => {
  const publishAllow = sorted(bucket.publishAllow)
  const publishDeny = sorted(bucket.publishDeny)
  const subscribeAllow = sorted(bucket.subscribeAllow)
  const subscribeDeny = sorted(bucket.subscribeDeny)

  const lines = ["      permissions: {"]
  lines.push("        publish: {")
  if (publishAllow.length > 0) lines.push(`          allow: ${renderArray(publishAllow)}`)
  if (publishDeny.length > 0) lines.push(`          deny: ${renderArray(publishDeny)}`)
  lines.push("        }")
  lines.push("        subscribe: {")
  if (subscribeAllow.length > 0) lines.push(`          allow: ${renderArray(subscribeAllow)}`)
  if (subscribeDeny.length > 0) lines.push(`          deny: ${renderArray(subscribeDeny)}`)
  lines.push("        }")
  lines.push("      }")
  return lines.join("\n")
}

export const renderNatsAclProfile = (
  profile: PermissionProfile,
  options: RenderNatsAclOptions = {},
): string => {
  const passwordEnvPrefix = options.passwordEnvPrefix ?? defaultPasswordEnvPrefix
  const inboxSubject = options.inboxSubject ?? defaultInboxSubject
  const byPersona = new Map<PermissionPersona, PermissionBuckets>()

  for (const rule of profile.rules) {
    const bucket = byPersona.get(rule.persona) ?? buckets()
    byPersona.set(rule.persona, bucket)
    const subject = subjectForRule(rule)
    for (const action of rule.actions) apply(bucket, action, rule.effect, subject, inboxSubject)
  }

  const users = [...byPersona.entries()].sort(([a], [b]) => a.localeCompare(b))
  return [
    "authorization {",
    "  users: [",
    ...users.flatMap(([persona, bucket], index) => {
      const comma = index === users.length - 1 ? "" : ","
      return [
        "    {",
        `      user: ${quote(persona)}`,
        `      password: $${personaEnvName(persona, passwordEnvPrefix)}`,
        renderPermissionObject(bucket),
        `    }${comma}`,
      ]
    }),
    "  ]",
    "}",
  ].join("\n")
}
