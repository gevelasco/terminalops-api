type EnvConfig = {
  NODE_ENV: string;
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  ORIGIN: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  SALT_ROUNDS: number;
};

export default EnvConfig;
