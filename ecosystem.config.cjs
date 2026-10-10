module.exports = {
  apps: [
    {
      name: 'reev-wa-gateway',
      cwd: __dirname,
      script: 'server.ts',
      interpreter: 'node',
      node_args: '--import tsx',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
