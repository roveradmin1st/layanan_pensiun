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
        HOST: process.env.HOST || "0.0.0.0",
        JWT_SECRET: process.env.JWT_SECRET || "4f8b9e1a3c7d5f2e6a0b8c4d2e9f1a3b5c7e9d0f2a4b6c8d1e3f5a7b9c0d2e4f"
      }
    }
  ]
};
