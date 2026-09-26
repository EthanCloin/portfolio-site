#!/usr/bin/env bash
# Read-only snapshot of the droplet, printed into the GitHub Actions log so the
# state of the server can be inspected without an interactive SSH session.
set -uo pipefail
section() { printf '\n===== %s =====\n' "$*"; }
section "host";        hostnamectl 2>/dev/null || uname -a; uptime
section "disk";        df -h / /srv 2>/dev/null
section "node/ob/gh";  node --version 2>&1; ob --version 2>&1 | head -1; gh --version 2>&1 | head -1
section "obsidian-sync.service"; systemctl status obsidian-sync --no-pager 2>&1 | head -20
section "sync status"; sudo -u obsidian ob sync-status --path /srv/vault 2>&1 | head -20
section "vault";       ls -la /srv/vault 2>&1 | head -40
section "webroot";     ls -la /var/www/html/ethancloin.xyz 2>&1 | head -40
section "nginx";       nginx -t 2>&1; ls /etc/nginx/sites-enabled 2>&1
section "pending updates"; apt list --upgradable 2>/dev/null | wc -l
