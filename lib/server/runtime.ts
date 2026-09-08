import { postgres } from './postgres';
export const env = { ...process.env, DB: postgres };
