#!/usr/bin/env bash
# Creates local Postgres user + database to match apps/api/.env.example
# Run on Ubuntu/WSL after: sudo apt install postgresql

set -euo pipefail

DB_USER="${DB_USER:-app}"
DB_PASS="${DB_PASS:-app}"
DB_NAME="${DB_NAME:-shortener}"

echo "Creating role '$DB_USER' and database '$DB_NAME' (if missing)..."

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
SQL

echo "Done. DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
