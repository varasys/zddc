#!/usr/bin/env node
/**
 * Training Data Collector for Qwen3-Coder-Next
 * 
 * Captures conversations where Qwen needs expert (Sonnet/Opus) assistance
 * and stores them in a format suitable for LoRA fine-tuning
 * 
 * Usage:
 *   node collect-interaction.js --query "..." --qwen "..." --expert "..." --domain "domain-name"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get script directory
const SCRIPT_DIR = __dirname;
const RAW_FILE = path.join(SCRIPT_DIR, 'raw', 'interactions.jsonl');

/**
 * Generate unique interaction ID
 */
function generateInteractionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `int_${timestamp}_${random}`;
}

/**
 * Detect domain from conversation content
 */
function detectDomain(messages) {
  const text = JSON.stringify(messages).toLowerCase();
  
  // ZDDC naming patterns
  if (text.includes('zddc') || 
      text.includes('trackingnumber') || 
      text.includes('revision') ||
      text.includes('_a (ifr)') ||
      text.includes('status code')) {
    return 'zddc-naming';
  }
  
  // HTML SPA patterns
  if (text.includes('html') || 
      text.includes('spa') || 
      text.includes('single-file') ||
      text.includes('es module') ||
      text.includes('vanilla js')) {
    return 'html-architecture';
  }
  
  // Build system patterns
  if (text.includes('build') || 
      text.includes('build.sh') || 
      text.includes('dist/') ||
      text.includes('template.html')) {
    return 'build-system';
  }
  
  // Debugging patterns
  if (text.includes('debug') || 
      text.includes('error') || 
      text.includes('fix') ||
      text.includes('console')) {
    return 'coding-debugging';
  }
  
  // Reasoning patterns
  if (text.includes('reason') || 
      text.includes('analyze') || 
      text.includes('architecture') ||
      text.includes('design')) {
    return 'reasoning-architecture';
  }
  
  // Default to general coding
  return 'general-coding';
}

/**
 * Create training example object
 */
function createTrainingExample(userQuery, qwenResponse, expertResponse, options = {}) {
  const domain = options.domain || detectDomain([userQuery, qwenResponse, expertResponse]);
  
  return {
    messages: [
      { role: 'user', content: userQuery },
      { role: 'assistant', content: qwenResponse },
      { role: 'user', content: 'consult Sonnet' },
      { role: 'assistant', content: expertResponse }
    ],
    metadata: {
      domain: domain,
      adapter: `lora-v1-${domain.replace(/-/g, '_')}`,
      timestamp: new Date().toISOString(),
      interaction_id: generateInteractionId(),
      source: 'manual-expert-consultation',
      ...options.metadata
    }
  };
}

/**
 * Append to JSONL file
 */
function appendToJSONL(filePath, data) {
  const jsonLine = JSON.stringify(data);
  fs.appendFileSync(filePath, jsonLine + '\n');
}

/**
 * Format domain name from detected or provided
 */
function formatDomainName(domain) {
  // Convert hyphens to underscores for adapter name
  return domain.replace(/-/g, '_');
}

/**
 * Collect a training example
 */
export function collect({
  userQuery,
  qwenResponse,
  expertResponse,
  domain = null,
  metadata = {}
}) {
  if (!userQuery || !qwenResponse || !expertResponse) {
    console.error('Error: Missing required parameters');
    console.error('Usage: node collect-interaction.js --query "..." --qwen "..." --expert "..."');
    process.exit(1);
  }
  
  const trainingExample = createTrainingExample(
    userQuery,
    qwenResponse,
    expertResponse,
    { domain, metadata }
  );
  
  // Ensure raw directory exists
  fs.mkdirSync(path.dirname(RAW_FILE), { recursive: true });
  
  // Append to raw file
  appendToJSONL(RAW_FILE, trainingExample);
  
  console.log('\n=== Training Example Captured ===');
  console.log(`Domain: ${trainingExample.metadata.domain}`);
  console.log(`Adapter: ${trainingExample.metadata.adapter}`);
  console.log(`Interaction ID: ${trainingExample.metadata.interaction_id}`);
  console.log(`Timestamp: ${trainingExample.metadata.timestamp}`);
  console.log(`Raw file: ${RAW_FILE}`);
  console.log('=================================\n');
  
  return trainingExample;
}

/**
 * CLI interface
 */
function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const queryIdx = args.findIndex(arg => arg === '--query');
  const qwenIdx = args.findIndex(arg => arg === '--qwen');
  const expertIdx = args.findIndex(arg => arg === '--expert');
  const domainIdx = args.findIndex(arg => arg === '--domain');
  
  if (queryIdx === -1 || qwenIdx === -1 || expertIdx === -1) {
    console.error('Error: Missing required arguments');
    console.error('Usage: node collect-interaction.js --query "..." --qwen "..." --expert "..." [--domain "domain"]');
    console.error('       node collect-interaction.js --query "Query" --qwen "Qwen answer" --expert "Expert answer"');
    process.exit(1);
  }
  
  const userQuery = args[queryIdx + 1];
  const qwenResponse = args[qwenIdx + 1];
  const expertResponse = args[expertIdx + 1];
  const domain = domainIdx !== -1 ? args[domainIdx + 1] : null;
  
  collect({ userQuery, qwenResponse, expertResponse, domain });
}

// Export for module usage
export default { collect, createTrainingExample, detectDomain };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
