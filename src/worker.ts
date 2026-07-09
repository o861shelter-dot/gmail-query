import { createApp, Env } from './handler';
const app = createApp();
export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(req, env, ctx);
  },
};
