"use strict";
/**
 * Donation & Supporter System for web-search
 *
 * Manages:
 * - Supporter recognition
 * - Donation prompts (non-intrusive)
 * - Credits display
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.donationManager = void 0;
exports.isSupporter = isSupporter;
exports.getSupporterTier = getSupporterTier;
exports.getSupporterMessage = getSupporterMessage;
exports.getStats = getStats;
exports.shouldShowDonationPrompt = shouldShowDonationPrompt;
exports.getDonationPrompt = getDonationPrompt;
exports.getCreditsText = getCreditsText;
exports.addSupporter = addSupporter;
const fs = __importStar(require("fs"));
const path_1 = require("path");
// Default supporters file (shipped with plugin)
let supportersData = {
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
// Try to load supporters data
try {
    const dataPath = (0, path_1.join)(__dirname, "supporters.json");
    if (fs.existsSync(dataPath)) {
        supportersData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    }
}
catch {
    // Use defaults
}
const TIER_EMOJI = {
    founding: "🏆",
    pizza: "🍕",
    lunch: "🍔",
    coffee: "☕",
};
const TIER_NAMES = {
    founding: "Founding Member",
    pizza: "Pizza Tier",
    lunch: "Lunch Tier",
    coffee: "Coffee Tier",
};
const TIER_AMOUNTS = {
    founding: "$50+",
    pizza: "$25",
    lunch: "$10",
    coffee: "$3",
};
// ---------------------------------------------------------------------------
// Supporter Functions
// ---------------------------------------------------------------------------
function isSupporter(name) {
    const allSupporters = [
        ...supportersData.founding,
        ...supportersData.pizza,
        ...supportersData.lunch,
        ...supportersData.coffee,
    ];
    return allSupporters.some((s) => s.toLowerCase() === name.toLowerCase());
}
function getSupporterTier(name) {
    if (supportersData.founding.some((s) => s.toLowerCase() === name.toLowerCase()))
        return "founding";
    if (supportersData.pizza.some((s) => s.toLowerCase() === name.toLowerCase()))
        return "pizza";
    if (supportersData.lunch.some((s) => s.toLowerCase() === name.toLowerCase()))
        return "lunch";
    if (supportersData.coffee.some((s) => s.toLowerCase() === name.toLowerCase()))
        return "coffee";
    return null;
}
function getSupporterMessage(name) {
    const tier = getSupporterTier(name);
    if (!tier)
        return null;
    const emoji = TIER_EMOJI[tier];
    return `${emoji} Thanks for supporting web-search, ${name}! You're a ${TIER_NAMES[tier]}.`;
}
function getStats() {
    return {
        total: supportersData.stats.totalSupporters,
        founding: supportersData.founding.length,
        pizza: supportersData.pizza.length,
        lunch: supportersData.lunch.length,
        coffee: supportersData.coffee.length,
    };
}
// ---------------------------------------------------------------------------
// Donation Prompt (Non-intrusive)
// ---------------------------------------------------------------------------
// Track when we last showed the prompt
let lastPromptTime = 0;
const PROMPT_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours
function shouldShowDonationPrompt() {
    const now = Date.now();
    if (now - lastPromptTime < PROMPT_COOLDOWN) {
        return false;
    }
    lastPromptTime = now;
    return true;
}
function getDonationPrompt() {
    const stats = getStats();
    const supporterCount = stats.total;
    // Different messages based on supporter count
    if (supporterCount === 0) {
        return `
💡 web-search is free and open source. If you find it useful, consider supporting development:
   https://ko-fi.com/thriloke96
   Every coffee helps keep this project alive! ☕`;
    }
    return `
💡 web-search is free, thanks to ${supporterCount} supporters!
   Want to join them? https://ko-fi.com/thriloke96
   🏆 Founding Members get priority support + feature requests.`;
}
// ---------------------------------------------------------------------------
// Credits Display
// ---------------------------------------------------------------------------
function getCreditsText() {
    const lines = [];
    if (supportersData.founding.length > 0) {
        lines.push(`🏆 Founding Members: ${supportersData.founding.join(", ")}`);
    }
    if (supportersData.pizza.length > 0) {
        lines.push(`🍕 Pizza Tier: ${supportersData.pizza.join(", ")}`);
    }
    if (supportersData.lunch.length > 0) {
        lines.push(`🍔 Lunch Tier: ${supportersData.lunch.join(", ")}`);
    }
    if (supportersData.coffee.length > 0) {
        const coffeeList = supportersData.coffee.slice(0, 5).join(", ");
        const remaining = supportersData.coffee.length - 5;
        lines.push(`☕ Coffee Tier: ${coffeeList}${remaining > 0 ? ` +${remaining} others` : ""}`);
    }
    if (lines.length === 0) {
        return "web-search is free and open source. No supporters yet — be the first!";
    }
    return "Made possible by supporters:\n" + lines.join("\n");
}
// ---------------------------------------------------------------------------
// Add Supporter (for admin use)
// ---------------------------------------------------------------------------
function addSupporter(name, tier) {
    if (!supportersData[tier].includes(name)) {
        supportersData[tier].push(name);
        supportersData.stats.totalSupporters++;
        supportersData.stats.lastUpdated = new Date().toISOString().split("T")[0];
        // Save to file
        try {
            const dataPath = (0, path_1.join)(__dirname, "supporters.json");
            fs.writeFileSync(dataPath, JSON.stringify(supportersData, null, 2));
        }
        catch {
            // File write failed, but data is updated in memory
        }
    }
}
// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
exports.donationManager = {
    isSupporter,
    getSupporterTier,
    getSupporterMessage,
    getStats,
    shouldShowDonationPrompt,
    getDonationPrompt,
    getCreditsText,
    addSupporter,
    TIER_EMOJI,
    TIER_NAMES,
    TIER_AMOUNTS,
};
