import app from './app.js';
import { assertRuntimeEnv, env } from './config/env.js';

assertRuntimeEnv();
const port = env.port;
app.listen(port, () => console.log(`NOVA API escuchando en http://localhost:${port}`));
