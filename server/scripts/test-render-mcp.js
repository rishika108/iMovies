/**
 * test-render-mcp.js
 * Verification and Diagnostic Script for Render MCP (Model Context Protocol) Server
 *
 * Endpoint: https://mcp.render.com/mcp
 * Usage: node test-render-mcp.js [API_KEY]
 */

const https = require('https');

const apiKey = process.argv[2] || process.env.RENDER_API_KEY || '';

function postMcp(body, sessionId) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };
    if (sessionId) {
      headers['mcp-session-id'] = sessionId;
    }

    const req = https.request('https://mcp.render.com/mcp', {
      method: 'POST',
      headers,
      timeout: 10000
    }, (res) => {
      let data = '';
      const sid = res.headers['mcp-session-id'] || sessionId;
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        sessionId: sid,
        data
      }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timed out to https://mcp.render.com/mcp'));
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

async function verifyRenderMcp() {
  console.log('================================================================');
  console.log('   Render Hosted MCP Server Diagnostic & Verification Tool      ');
  console.log('================================================================');
  console.log(`Endpoint: https://mcp.render.com/mcp`);
  console.log(`Using API Key: ${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (length: ${apiKey.length})\n`);

  // Step 1: Initialize handshake
  console.log('1. Testing MCP Initialize Handshake...');
  try {
    const initRes = await postMcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'antigravity-render-mcp', version: '1.0.0' }
      }
    });

    if (initRes.statusCode === 200) {
      const parsed = JSON.parse(initRes.data);
      console.log('   [SUCCESS] Handshake accepted by Render MCP Server.');
      console.log(`   Server Name: ${parsed.result?.serverInfo?.name}`);
      console.log(`   Protocol: ${parsed.result?.protocolVersion}`);
      console.log(`   Session ID: ${initRes.sessionId}\n`);

      // Initialized notification
      await postMcp({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      }, initRes.sessionId);

      // Step 2: Query Tools
      console.log('2. Querying Available MCP Tools (tools/list)...');
      const toolsRes = await postMcp({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      }, initRes.sessionId);

      const toolsData = JSON.parse(toolsRes.data);
      const tools = toolsData.result?.tools || [];
      console.log(`   [SUCCESS] Received ${tools.length} available tools from Render:`);
      tools.slice(0, 8).forEach(t => {
        console.log(`    - ${t.name}`);
      });
      if (tools.length > 8) {
        console.log(`    ... and ${tools.length - 8} more tools.\n`);
      }

      // Step 3: Test Calling list_workspaces
      console.log('3. Testing Authenticated Call (list_workspaces)...');
      const workspaceRes = await postMcp({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_workspaces',
          arguments: {}
        }
      }, initRes.sessionId);

      const wsData = JSON.parse(workspaceRes.data);
      if (wsData.result?.isError) {
        console.log('   [API KEY NOTICE]: Render MCP server returned:');
        console.log(`   "${wsData.result?.content?.[0]?.text}"`);
        console.log('   Note: Official Render API keys start with "rnd_".');
        console.log('   To generate a valid key: Render Dashboard -> Account Settings -> API Keys -> Create API Key.');
      } else {
        console.log('   [SUCCESS] Workspaces retrieved successfully:');
        console.log(JSON.stringify(wsData.result?.content, null, 2));
      }
    } else {
      console.error(`   [FAIL] HTTP status ${initRes.statusCode}: ${initRes.data}`);
    }
  } catch (err) {
    console.error('   [FAIL] Connection error:', err.message);
  }
  console.log('\n================================================================');
}

verifyRenderMcp();
