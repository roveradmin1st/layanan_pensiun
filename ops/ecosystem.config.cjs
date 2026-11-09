// PM2 Process Ecosystem Configuration for Layanan Pensiunan
// Strictly 1 fork instance as lpapp listening on 127.0.0.1:4000
// Memory cache state in single process; do not run cluster mode.

module.exports = {
  apps: [
    {
      name: 'layanan-pensiunan-api',
      script: 'src/server.js',
      cwd: '/srv/layanan-pensiunan/current/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      wait_ready: false,
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '4000',
        TZ: 'Asia/Jakarta'
      }
    }
  ]
};
