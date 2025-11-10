#!/bin/bash
# Wrapper script to force IPv4 for drizzle-kit
export NODE_OPTIONS="--dns-result-order=ipv4first"
export POSTGRES_URL=$(grep POSTGRES_URL .env.local | cut -d'=' -f2-)
npx drizzle-kit "$@"
