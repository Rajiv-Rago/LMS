#!/bin/bash

# Apply donation system to all LM Studio plugins
# Usage: ./scripts/apply-donations-to-all.sh

KOFI_URL="https://ko-fi.com/thriloke96"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "🎯 Applying donation system to all plugins..."
echo "📍 Ko-fi URL: $KOFI_URL"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Plugin directories
PLUGINS=(
  "ai-lab-plugin"
  "alerts-plugin"
  "calendar-plugin"
  "codebase-plugin"
  "context-plugin"
  "database-plugin"
  "document-parser-plugin"
  "email-plugin"
  "git-plugin"
  "humanize-plugin"
  "ideas-plugin"
  "job-search-plugin"
  "knowledge-plugin"
  "rag-plugin"
  "research-plugin"
  "web-search-advanced-plugin"
  "web-search-plugin"
)

for plugin in "${PLUGINS[@]}"; do
  PLUGIN_DIR="$BASE_DIR/$plugin"
  
  if [ ! -d "$PLUGIN_DIR" ]; then
    echo -e "${YELLOW}⚠️  Skipping $plugin (directory not found)${NC}"
    continue
  fi
  
  echo -e "${GREEN}📦 Processing: $plugin${NC}"
  
  # Create src directory if it doesn't exist
  mkdir -p "$PLUGIN_DIR/src"
  
  # Copy donations.ts
  cp "$BASE_DIR/web-search-plugin/src/donations.ts" "$PLUGIN_DIR/src/donations.ts"
  
  # Create supporters.json if it doesn't exist
  if [ ! -f "$PLUGIN_DIR/src/supporters.json" ]; then
    cat > "$PLUGIN_DIR/src/supporters.json" << 'EOF'
{
  "founding": [],
  "pizza": [],
  "lunch": [],
  "coffee": [],
  "stats": {
    "totalDonations": 0,
    "totalSupporters": 0,
    "lastUpdated": "2024-01-01"
  }
}
EOF
  fi
  
  # Create DONATE.md if it doesn't exist
  if [ ! -f "$PLUGIN_DIR/DONATE.md" ]; then
    cp "$BASE_DIR/web-search-plugin/DONATE.md" "$PLUGIN_DIR/DONATE.md"
  fi
  
  # Create scripts directory and add-supporter.js
  mkdir -p "$PLUGIN_DIR/scripts"
  cp "$BASE_DIR/web-search-plugin/scripts/add-supporter.js" "$PLUGIN_DIR/scripts/add-supporter.js"
  
  echo -e "   ${GREEN}✓ Added donations.ts${NC}"
  echo -e "   ${GREEN}✓ Added supporters.json${NC}"
  echo -e "   ${GREEN}✓ Added DONATE.md${NC}"
  echo -e "   ${GREEN}✓ Added add-supporter.js${NC}"
  echo ""
done

echo "✅ Done! Donation system applied to all plugins."
echo ""
echo "📋 Next steps:"
echo "1. Update each plugin's promptPreprocessor.ts to import donations"
echo "2. Update each plugin's index.ts to export donationManager"
echo "3. Build all plugins: npm run build"
echo ""
echo "Example promptPreprocessor.ts update:"
echo '  import { donationManager } from "./donations";'
echo '  // Add to first message:'
echo '  if (donationManager.shouldShowDonationPrompt()) {'
echo '    prompt += `\n\n${donationManager.getDonationPrompt()}`;'
echo '  }'
