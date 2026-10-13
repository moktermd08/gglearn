module.exports = {
  apps: [{
    name: "gglearn-web",
    cwd: "/var/www/gglearn.gglink.co.uk",
    script: "node_modules/next/dist/bin/next",
    args: "start -p 3400 -H 127.0.0.1",
    env: { NODE_ENV: "production" },
    max_memory_restart: "400M",
  }, {
    // Creates and renews the public campaign contests (weekly and monthly rounds start at midnight UTC on Monday and on the 1st).
    // It exits after each run and pm2 starts it again at the next cron time, so "stopped" in `pm2 list` is normal. The site does
    // the same check when pages are opened; this makes sure rounds exist even if nobody visits. Daily rather than weekly so
    // monthly and rolling rounds are covered too, and 01:05 rather than 00:05 so it is past midnight UTC whether the server clock
    // is on GMT or BST. It also runs once on every deploy (startOrRestart). Idempotent: running it again changes nothing.
    name: "gglearn-campaigns",
    cwd: "/var/www/gglearn.gglink.co.uk",
    script: "node_modules/tsx/dist/cli.mjs",
    args: "--env-file=.env.local scripts/seed-campaigns.ts",
    cron_restart: "5 1 * * *",
    autorestart: false,
    env: { NODE_ENV: "production" },
  }],
};
