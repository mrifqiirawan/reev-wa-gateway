module.exports = {
  apps: [
    {
      name: 'reev-wa-gateway',
      script: 'server.ts',
      interpreter: 'tsx',
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
