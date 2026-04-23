"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
// Load environment variables from .env file
dotenv_1.default.config();
// Define the schema for environment variables
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('8080'),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    REDIS_HOST: zod_1.z.string().default('127.0.0.1'),
    REDIS_PORT: zod_1.z.coerce.number().default(6379),
    FIREBASE_SERVICE_ACCOUNT: zod_1.z.string().optional(),
});
// Parse and validate process.env
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
    process.exit(1);
}
exports.env = parsedEnv.data;
