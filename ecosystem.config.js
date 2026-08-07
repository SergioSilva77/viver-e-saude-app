module.exports = {
  apps: [
    {
      name: 'viver-api',
      cwd: 'C:\\viver-saude\\apps\\api',
      script: 'C:\\Program Files\\nodejs\\node.exe',
      args: '--import tsx src/server.ts',
      env: { NODE_ENV: 'development' }
    },
    {
      name: 'viver-web',
      cwd: 'C:\\viver-saude\\apps\\web',
      script: 'C:\\Program Files\\nodejs\\node.exe',
      args: 'C:\\viver-saude\\node_modules\\vite\\bin\\vite.js --host',
      env: { NODE_ENV: 'development' }
    },
    {
      name: 'viver-admin',
      cwd: 'C:\\viver-saude\\apps\\admin',
      script: 'C:\\Program Files\\nodejs\\node.exe',
      args: 'C:\\viver-saude\\node_modules\\vite\\bin\\vite.js --host --port 5174',
      env: { NODE_ENV: 'development' }
    }
  ]
}
