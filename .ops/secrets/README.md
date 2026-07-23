# .ops/secrets — sops fronting git-crypt

Two layers, so a committed secret is `git-crypt( sops( plaintext ) )` — unreadable without
**both** the local git-crypt key and the local age key.

- **sops (age)** encrypts the *values* inside a file; you edit via `sops`.
- **git-crypt** transparently encrypts the *whole file* in the repo (this directory), catching
  anything that slips in as plaintext.

## Keys — local only, NEVER committed
| Key | Location | Purpose |
|-----|----------|---------|
| age private | `~/.config/sops/age/keys.txt` | decrypts sops values (public recipient is in `.sops.yaml`) |
| git-crypt   | `.git/git-crypt/` + backup `~/.config/git-crypt/gbg.key` | decrypts the whole-file layer |

Back **both** up offline (password manager). Lose them → the encrypted secrets are gone.

## Encrypt a secret
```bash
cd .ops/secrets
# e.g. from the mini's /etc/gbg-morning/notify.env:
sops -e --input-type dotenv --output-type dotenv /etc/gbg-morning/notify.env > notify.sops.env
git add notify.sops.env      # git-crypt re-encrypts the whole file on commit
```

## Read / edit
```bash
sops notify.sops.env     # decrypts into $EDITOR, re-encrypts on save
sops -d notify.sops.env  # print plaintext to stdout
```

## Unlock on a fresh clone / new machine
```bash
git-crypt unlock ~/.config/git-crypt/gbg.key
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
```

`.sops.yaml` defines which paths (`*.sops.env|yaml|json`) auto-encrypt.
