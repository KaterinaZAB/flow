#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose config --quiet
docker compose build
docker compose up -d --wait
docker compose ps
