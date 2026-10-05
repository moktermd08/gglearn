module.exports = {
  apps: [{
    name: "gglearn-web",
    cwd: "/var/www/gglearn.gglink.co.uk",
    script: "node_modules/next/dist/bin/next",
    args: "start -p 3400 -H 127.0.0.1",
    env: { NODE_ENV: "production" },
    max_memory_restart: "400M",
  }],
};
