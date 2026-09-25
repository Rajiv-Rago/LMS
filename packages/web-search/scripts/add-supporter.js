#!/usr/bin/env node

/**
 * Script to add supporters to web-search
 * Usage: node scripts/add-supporter.js <name> <tier>
 * 
 * Tiers: founding, pizza, lunch, coffee
 * Example: node scripts/add-supporter.js "Alice" coffee
 */

const fs = require("fs");
const path = require("path");

const SUPPORTERS_PATH = path.join(__dirname, "..", "src", "supporters.json");

const VALID_TIERS = ["founding", "pizza", "lunch", "coffee"];

function addSupporter(name, tier) {
  if (!name || !tier) {
    console.log("Usage: node scripts/add-supporter.js <name> <tier>");
    console.log("Tiers: founding, pizza, lunch, coffee");
    process.exit(1);
  }

  if (!VALID_TIERS.includes(tier)) {
    console.log(`Invalid tier: ${tier}`);
    console.log("Valid tiers: founding, pizza, lunch, coffee");
    process.exit(1);
  }

  // Read current data
  let data;
  try {
    data = JSON.parse(fs.readFileSync(SUPPORTERS_PATH, "utf-8"));
  } catch {
    data = {
      founding: [],
      pizza: [],
      lunch: [],
      coffee: [],
      stats: {
        totalDonations: 0,
        totalSupporters: 0,
        lastUpdated: new Date().toISOString().split("T")[0],
      },
    };
  }

  // Check if already exists
  if (data[tier].includes(name)) {
    console.log(`${name} is already a ${tier} supporter!`);
    process.exit(0);
  }

  // Add supporter
  data[tier].push(name);
  data.stats.totalSupporters++;
  data.stats.lastUpdated = new Date().toISOString().split("T")[0];

  // Save
  fs.writeFileSync(SUPPORTERS_PATH, JSON.stringify(data, null, 2));

  console.log(`✅ Added ${name} as ${tier} supporter!`);
  console.log(`Total supporters: ${data.stats.totalSupporters}`);
}

// CLI
const [,, name, tier] = process.argv;
addSupporter(name, tier);
