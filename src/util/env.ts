import { cleanEnv, port, str } from "envalid";
import dotenv from "dotenv";

dotenv.config();

const env = cleanEnv(process.env, {
  PORT: port(),
  DB_CONNECT: str(),
  TOKEN_SECRET: str(),
  CLOUD_NAME: str(),
  CLOUD_API_KEY: str(),
  CLOUD_API_SECRET: str(),
});

export default env;
