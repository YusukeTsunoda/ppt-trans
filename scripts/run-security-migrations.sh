#!/bin/bash

# Security Migrations Runner
# This script applies all security-related database migrations

set -e

echo "🔒 Running Security Database Migrations..."
echo "========================================="

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first."
    echo "   Run: npm install -g supabase"
    exit 1
fi

# Check if project is linked
if ! supabase status &> /dev/null; then
    echo "❌ Supabase project is not linked."
    echo "   Run: supabase link --project-ref your-project-ref"
    exit 1
fi

# Run migrations
echo ""
echo "📝 Applying migrations..."
echo "------------------------"

MIGRATIONS_DIR="./supabase/migrations"

# List of security migrations in order
MIGRATIONS=(
    "20250829_security_tables.sql"
    "20250829_csrf_tokens.sql"
    "20250829_rate_limiting.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    MIGRATION_FILE="$MIGRATIONS_DIR/$migration"
    
    if [ -f "$MIGRATION_FILE" ]; then
        echo "⏳ Applying: $migration"
        
        # Apply the migration
        if supabase db push "$MIGRATION_FILE" 2>/dev/null; then
            echo "✅ Successfully applied: $migration"
        else
            echo "⚠️  Migration may already be applied or encountered an issue: $migration"
            echo "   Please check manually if needed."
        fi
    else
        echo "⚠️  Migration file not found: $MIGRATION_FILE"
    fi
    
    echo ""
done

echo "========================================="
echo "✨ Security migrations process completed!"
echo ""
echo "📋 Summary of migrations:"
echo "  • security_events & error_logs tables"
echo "  • csrf_tokens table with cleanup function"
echo "  • rate_limit_attempts table with check function"
echo ""
echo "🔍 To verify, run: supabase db dump --data-only | grep -E 'security_events|error_logs|csrf_tokens|rate_limit_attempts'"
echo ""
echo "📝 Note: If using pg_cron, uncomment the scheduled cleanup jobs in the migration files."