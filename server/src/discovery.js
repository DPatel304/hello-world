/* Being found on the home Wi-Fi. Orlis Play calls out "orlis?" to the whole
   network (a UDP broadcast on DISCOVERY_PORT); the server answers with its
   name and where to reach it. A broadcast never leaves the home network -
   routers don't pass them on - so this can't be heard from the internet. */
import { createSocket } from 'node:dgram';

export const DISCOVERY_PORT = 47870;
export const HELLO = 'orlis?';

export function listenForApps({ port = DISCOVERY_PORT, answer }){
  const sock = createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('message', (msg, from) => {
    if (msg.toString('utf8').trim() !== HELLO) return;
    const reply = Buffer.from(JSON.stringify({ app: 'orlis', ...answer() }));
    sock.send(reply, from.port, from.address);
  });
  sock.on('error', (e) => console.error('Wi-Fi discovery stopped:', e.message));
  return new Promise((ok) => sock.bind(port, () => ok(sock)));
}
