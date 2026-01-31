#!/usr/bin/env node

import { DemoInABoxMCPServer } from './server.js';

async function main() {
  const server = new DemoInABoxMCPServer();
  
  try {
    await server.connect();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
