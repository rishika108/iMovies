const { exec } = require('child_process');

const ltBin = 'node "C:\\Users\\ritik\\AppData\\Roaming\\npm\\node_modules\\localtunnel\\bin\\lt.js"';

function startTunnel() {
  console.log('[tunnel] Starting localtunnel...');
  const proc = exec(`${ltBin} --port 5173 --subdomain imovies-app`);

  proc.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  proc.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  proc.on('close', (code) => {
    console.log(`[tunnel] Closed (code ${code}). Restarting in 3s...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
