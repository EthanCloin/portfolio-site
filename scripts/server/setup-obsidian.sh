#!/usr/bin/env bash
# Prepare the droplet to run Obsidian Sync headlessly and to host the vault at /srv/vault.
# Idempotent: safe to re-run. Run as root (sudo). Does NOT log in to Obsidian; that step
# is interactive and is done once by the owner (see docs/obsidian-droplet.md).
set -euo pipefail

VAULT_DIR="${VAULT_DIR:-/srv/vault}"
SYNC_USER="${SYNC_USER:-obsidian}"
NODE_MAJOR="${NODE_MAJOR:-22}"

log() { printf '\n==> %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "run as root: sudo $0" >&2
  exit 1
fi

log "Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]]; then
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs
fi
node --version

log "obsidian-headless (ob)"
npm install -g obsidian-headless@latest >/dev/null
ob --version || true

log "service user ${SYNC_USER} and ${VAULT_DIR}"
if ! id -u "$SYNC_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${SYNC_USER}" --shell /bin/bash "$SYNC_USER"
fi
install -d -o "$SYNC_USER" -g "$SYNC_USER" -m 0750 "$VAULT_DIR"

log "systemd unit obsidian-sync.service"
cat > /etc/systemd/system/obsidian-sync.service <<UNIT
[Unit]
Description=Obsidian Sync (headless) for ${VAULT_DIR}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SYNC_USER}
Group=${SYNC_USER}
WorkingDirectory=${VAULT_DIR}
Environment=HOME=/home/${SYNC_USER}
ExecStart=$(command -v ob) sync --path ${VAULT_DIR} --continuous
Restart=always
RestartSec=10
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${VAULT_DIR} /home/${SYNC_USER}

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable obsidian-sync.service >/dev/null

# Let the deploy/admin user read the vault (for /publish) without becoming root.
if [[ -n "${GRANT_READ_USER:-}" ]] && id -u "$GRANT_READ_USER" >/dev/null 2>&1; then
  log "granting ${GRANT_READ_USER} read access to ${VAULT_DIR}"
  usermod -aG "$SYNC_USER" "$GRANT_READ_USER"
  chmod -R g+rX "$VAULT_DIR"
fi

log "gh CLI (for /publish to open pull requests)"
if ! command -v gh >/dev/null; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
  chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update -qq && apt-get install -y -qq gh
fi
gh --version | head -1

cat <<MSG

Done. Remaining one-time steps (interactive, run as the vault user):

  sudo -iu ${SYNC_USER}
  ob login                      # email, password, 2FA
  ob sync-list-remote           # confirm the vault name
  ob sync-setup --vault "<Vault Name>" --path ${VAULT_DIR} --device-name droplet
  ob sync --path ${VAULT_DIR}   # first full sync
  exit
  sudo systemctl start obsidian-sync && sudo systemctl status obsidian-sync

MSG
