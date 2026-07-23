#!/usr/bin/env bash
# bringup.sh — one-shot Mac mini bring-up for the morning-window automation.
# Runs the bring-up steps (SSH keys → verify → push → sudo install), idempotently.
#
#   Run it normally (NOT sudo). It calls sudo only for the install step.
#     bash .ops/bringup.sh
#   Override the repo path if needed:  GBG_REPO=/path/to/gbg bash .ops/bringup.sh
set -uo pipefail

REPO="${GBG_REPO:-$HOME/.getbymacbeeroom/assets/code/repos/gbg}"
BRANCH="${GBG_BRANCH:-claude/morning-window-automation}"
MW=".ops/mac-mini-morning-window"

c_head='\033[1;36m'; c_ok='\033[1;32m'; c_warn='\033[1;33m'; c_err='\033[1;31m'; c_off='\033[0m'
say()  { printf "${c_head}==> %s${c_off}\n" "$*"; }
ok()   { printf "${c_ok} \xe2\x9c\x93 %s${c_off}\n" "$*"; }
warn() { printf "${c_warn} !  %s${c_off}\n" "$*"; }
die()  { printf "${c_err} \xe2\x9c\x97 %s${c_off}\n" "$*" >&2; exit 1; }
pause(){ printf "${c_warn}--- %s${c_off}" "$*"; read -r _; }

[ -d "$REPO/.git" ] || die "No git repo at $REPO. Set GBG_REPO=/path/to/gbg and re-run."
cd "$REPO" || die "cannot cd $REPO"
[ -x "$MW/install.sh" ] || die "Missing $MW/install.sh under $REPO"

# --- Discover github-* host aliases from ~/.ssh/config ---
say "Reading github-* aliases from ~/.ssh/config"
ALIASES=()
if [ -f "$HOME/.ssh/config" ]; then
  while IFS= read -r a; do ALIASES+=("$a"); done < <(
    awk 'tolower($1)=="host"{for(i=2;i<=NF;i++) if($i ~ /^github-/) print $i}' "$HOME/.ssh/config" | sort -u)
fi
[ "${#ALIASES[@]}" -gt 0 ] || warn "No github-* Host aliases found — check ~/.ssh/config"
printf '    found: %s\n' "${ALIASES[*]:-<none>}"

PUSH_ALIAS="$(git remote get-url --push origin 2>/dev/null | sed -n 's/^git@\(github-[^:]*\):.*/\1/p')"
[ -n "$PUSH_ALIAS" ] && printf '    push remote uses: %s\n' "$PUSH_ALIAS"

# --- Steps 1+2: verify SSH auth per alias; if it fails, show the pubkey to add ---
verify_alias() {
  local out
  out="$(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T "git@$1" 2>&1)"
  grep -qi "successfully authenticated\|^Hi " <<<"$out"
}

say "Steps 1–2 — SSH keys on GitHub + verify auth"
for alias in "${ALIASES[@]}"; do
  acct="${alias#github-}"
  if verify_alias "$alias"; then ok "$alias already authenticated"; continue; fi
  key="$HOME/.ssh/id_ed25519_${acct}.pub"
  [ -f "$key" ] || key="$(awk -v h="$alias" '
      tolower($1)=="host"{cur=($2==h)}
      cur && tolower($1)=="identityfile"{print $2".pub"; exit}' "$HOME/.ssh/config" 2>/dev/null | sed "s#^~#$HOME#")"
  echo
  warn "$alias NOT authenticated. Add this public key to that GitHub account:"
  echo  "    https://github.com/settings/ssh/new   (log in as '$acct' first)"
  [ -f "$key" ] && sed 's/^/    /' "$key" || warn "  (pubkey id_ed25519_${acct}.pub not found)"
  echo  "    Alternative:  gh auth login  # as $acct, then: gh ssh-key add $key"
  pause "Press Enter after the key is added (or Ctrl-C to stop)... "
  verify_alias "$alias" && ok "$alias now authenticated" || warn "$alias still failing — pushes as $acct will fail"
done

# --- Step 3: push ---
say "Step 3 — push $BRANCH"
git rev-parse --verify "$BRANCH" >/dev/null 2>&1 || die "Local branch $BRANCH not found"
if git push -u origin "$BRANCH"; then ok "pushed $BRANCH"; else
  warn "push failed — fix SSH auth above, then re-run (safe to re-run)."; exit 1; fi

# --- Step 4: install (single sudo) ---
say "Step 4 — install morning-window automation"
( cd "$MW" && sudo ./install.sh ) || die "install.sh failed"

echo
ok "Bring-up complete. ntfy topic:"
sudo grep '^NTFY_TOPIC' /etc/gbg-morning/notify.env 2>/dev/null | sed 's/^/    /' || true
echo
say "Next: install the 'ntfy' app, subscribe to that topic, confirm the test push."
say "Optional remote access:"
echo "     ( cd $REPO/.ops/mac-mini-remote-access && sudo ./install.sh ) && sudo tailscale up --ssh --accept-routes"
