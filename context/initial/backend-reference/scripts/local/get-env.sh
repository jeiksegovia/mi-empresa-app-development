#!/bin/bash
# Local helper to create a .env from .env.example
# @todo: this file will be replaced with fetch-env-api.mjs
set -euo pipefail

if [ -f .env ]; then
  echo ".env already exists"
  exit 0
fi
cp .env.example .env
