#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
backup_dir=${FLOW_BACKUP_DIR:-/var/backups/flow}
mkdir -p "$backup_dir"
backup_file="$backup_dir/flow-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
trap 'rm -f "$backup_file.partial"' EXIT HUP INT TERM
docker compose exec -T postgres pg_dump -U potok -d potok -Fc > "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"
printf '%s\n' "$backup_file"
