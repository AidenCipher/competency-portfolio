#!/usr/bin/env bash
# Reset the fictional demo learner ("Jo") on the LOCAL Supabase stack. supabase/seed.sql is idempotent and only ever
# deletes the one fixed demo account, so real learners are never touched. For a hosted project, run the same file in
# the Supabase SQL editor.
set -euo pipefail
export PATH="/Applications/Docker.app/Contents/Resources/bin:$HOME/.docker/bin:$PATH"
cd "$(dirname "$0")/.."
container="$(docker ps --filter name=supabase_db_ --format '{{.Names}}' | head -1)"
if [ -z "$container" ]; then echo "Local Supabase is not running. Start it with: npm run db:start" >&2; exit 1; fi
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/seed.sql
echo "Demo learner reset."
