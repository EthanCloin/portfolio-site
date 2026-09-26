# Obsidian Sync on the droplet

The droplet keeps a live copy of the Obsidian vault at `/srv/vault` using Obsidian's official
headless client ([`obsidian-headless`](https://github.com/obsidianmd/obsidian-headless), open beta,
requires an Obsidian Sync subscription). Edits made on the phone or laptop arrive within seconds,
so `/publish` and any agent on the server always read the current notes.

## One-time setup

1. **Install everything** (Node 22, `ob`, the `obsidian` service user, the systemd unit, `gh`).
   Either trigger the *Server (manual)* workflow in GitHub Actions with action `setup-obsidian`,
   or run it yourself over SSH:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/EthanCloin/portfolio-site/main/scripts/server/setup-obsidian.sh -o /tmp/setup-obsidian.sh
   less /tmp/setup-obsidian.sh          # read it first
   sudo GRANT_READ_USER="$USER" bash /tmp/setup-obsidian.sh
   ```
2. **Log in and link the vault** (interactive; needs your Obsidian email, password, 2FA, and the
   vault's end-to-end encryption password if it has one):
   ```bash
   sudo -iu obsidian
   ob login
   ob sync-list-remote
   ob sync-setup --vault "<Vault Name>" --path /srv/vault --device-name droplet
   ob sync --path /srv/vault            # first full sync; wait for it to finish
   exit
   sudo systemctl start obsidian-sync
   sudo systemctl status obsidian-sync
   ```
3. **Check it**: trigger the *Server (manual)* workflow with action `status`, or `ob sync-status --path /srv/vault`.

The systemd unit runs `ob sync --continuous` as the `obsidian` user and restarts on failure.
Credentials live in that user's home directory and never in this repository.

## Pointing an agent at the vault

- **On the droplet**: `sudo -iu obsidian` (or your own user, which is in the `obsidian` group and can
  read the vault), `cd /srv/vault`, run `claude`. A `CLAUDE.md` at the vault root (synced with the
  vault, see `docs/vault-CLAUDE.md`) tells any agent how the vault is organised.
- **On a laptop/phone**: the Obsidian app already syncs the same vault locally; run the agent in that
  folder. The same `CLAUDE.md` applies because it is part of the vault.
- **Publishing from the droplet**: clone this repository next to the vault
  (`git clone https://github.com/EthanCloin/portfolio-site ~/portfolio-site`), run `gh auth login`
  once, then `claude` inside the clone and use `/publish <note>`.

## Operations

| Task | How |
|---|---|
| Snapshot of server state | Actions → *Server (manual)* → `status` |
| Sync service logs | Actions → *Server (manual)* → `sync-logs` |
| Restart sync | Actions → *Server (manual)* → `restart-sync` |
| Upgrade the client | `sudo npm install -g obsidian-headless@latest && sudo systemctl restart obsidian-sync` |
| Re-authenticate | `sudo -iu obsidian ob login` then restart the service |
