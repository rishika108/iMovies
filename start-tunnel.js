const lt = require('C:\\Users\\ritik\\AppData\\Roaming\\npm\\node_modules\\localtunnel');
const fs = require('fs');
const outFile = 'C:\\Users\\ritik\\.gemini\\antigravity\\scratch\\iMovies\\tunnel-url.txt';

async function start() {
  try {
    const tunnel = await lt({ port: 5173, subdomain: 'imovies-site' });
    fs.writeFileSync(outFile, tunnel.url);
    process.stdout.write('TUNNEL_URL=' + tunnel.url + '\n');
    tunnel.on('close', () => {
      process.stdout.write('Tunnel closed, restarting...\n');
      setTimeout(start, 3000);
    });
    tunnel.on('error', (err) => {
      process.stdout.write('Tunnel error: ' + err.message + '\n');
      setTimeout(start, 3000);
    });
  } catch (e) {
    process.stdout.write('Failed with subdomain, trying random: ' + e.message + '\n');
    try {
      const tunnel = await lt({ port: 5173 });
      fs.writeFileSync(outFile, tunnel.url);
      process.stdout.write('TUNNEL_URL=' + tunnel.url + '\n');
      tunnel.on('close', () => setTimeout(start, 3000));
    } catch (e2) {
      process.stdout.write('Tunnel failed: ' + e2.message + '\n');
      setTimeout(start, 5000);
    }
  }
}

start();
// Keep process alive
setInterval(() => {}, 30000);
