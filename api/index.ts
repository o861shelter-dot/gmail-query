import { handle } from 'hono/vercel';
import { createApp } from '../src/handler';

export const config = { runtime: 'edge' };
const app = createApp();
export default handle(app);
