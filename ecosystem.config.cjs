module.exports = {
  apps: [
    {
      name: "layanan-pensiunan-api",
      script: "src/server.js",
      cwd: "./backend",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 4000,
        HOST: process.env.HOST || "127.0.0.1",
        JWT_SECRET: process.env.JWT_SECRET
      }
    }
  ]
};
