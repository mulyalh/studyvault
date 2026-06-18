require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "studyvault",
      script: ".output/server/index.mjs",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      },
    },
  ],
};
