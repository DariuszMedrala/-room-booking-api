process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || "postgres://postgres:postgres@localhost:5432/roombooking_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret-minimum-32-characters-long";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
