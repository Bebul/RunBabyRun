import { PeerServer } from 'peer';
import { createServer } from 'vite';

const signaling = PeerServer({ host: '127.0.0.1', port: 9000, path: '/' });
const server = await createServer({
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
  define: { 'import.meta.env.VITE_PEER_OPTIONS': JSON.stringify(JSON.stringify({
    host: '127.0.0.1', port: 9000, path: '/', secure: false, config: { iceServers: [] },
  })) },
});
await server.listen();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  await server.close(); signaling.close(); process.exit(0);
});
