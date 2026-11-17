module.exports = {
  testEnvironment: "node",
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/unit/**/*.test.js"]
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      setupFiles: ["<rootDir>/tests/setupEnv.js"],
      testMatch: ["<rootDir>/tests/integration/**/*.test.js"]
    }
  ]
};
