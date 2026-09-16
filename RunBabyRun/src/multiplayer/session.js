export function clockSample(sent, received, remote) {
  return { rtt: received - sent, offset: remote - (sent + received) / 2 };
}

// One reliable, ordered data channel; only the host owns the simulation.
export function createSession({ Peer, room, peerOptions = {}, onStatus, onInvite, onMessage, onReady, onClose, now = () => performance.now() }) {
  const host = !room;
  const peer = new Peer(peerOptions);
  let connection, closed = false, ready = false, lastSeen = now(), sampleId = 0;
  const pending = new Map(), samples = [];
  let timeout = setTimeout(() => fail('Spojení se nepodařilo navázat. Zkontrolujte síť a otevřete novou pozvánku.'), 30000);
  const heartbeat = setInterval(() => {
    if (!connection?.open) return;
    if (now() - lastSeen > 10000) return fail('Spojení s druhým hráčem se přerušilo. Založte novou hru.');
    send({ type: 'heartbeat' });
  }, 2000);
  function send(message) {
    if (!closed && connection?.open) {
      try { connection.send(message); } catch { fail('Odesílání selhalo. Založte novou hru.'); }
    }
  }
  function fail(message) {
    if (closed) return;
    onStatus(message);
    dispose();
    onClose();
  }
  function ping() {
    const id = ++sampleId;
    pending.set(id, now());
    send({ type: 'ping', id });
  }
  function attach(candidate) {
    if (connection || closed) { candidate.on('open', () => candidate.close()); return; }
    connection = candidate;
    clearTimeout(timeout);
    timeout = setTimeout(() => fail('Synchronizace spojení vypršela. Otevřete novou pozvánku.'), 30000);
    candidate.on('open', () => {
      lastSeen = now();
      onStatus('Spojeno. Měříme RTT a synchronizujeme hodiny…');
      if (!host) ping();
    });
    candidate.on('data', (message) => {
      if (closed || !message || typeof message.type !== 'string') return;
      lastSeen = now();
      if (message.type === 'heartbeat') return;
      if (message.type === 'ping' && host) send({ type: 'pong', id: message.id, time: now() });
      else if (message.type === 'pong' && !host && pending.has(message.id) && Number.isFinite(message.time)) {
        samples.push(clockSample(pending.get(message.id), now(), message.time));
        pending.delete(message.id);
        if (samples.length < 8) ping();
        else {
          const best = samples.reduce((a, b) => a.rtt < b.rtt ? a : b);
          ready = true;
          clearTimeout(timeout);
          send({ type: 'synced', ...best });
          onReady(best);
        }
      } else if (message.type === 'synced' && host && !ready && Number.isFinite(message.rtt) && message.rtt >= 0 && Number.isFinite(message.offset)) {
        ready = true;
        clearTimeout(timeout);
        onReady({ rtt: message.rtt, offset: 0 });
      } else if (ready) onMessage(message);
    });
    candidate.on('close', () => fail('Druhý hráč se odpojil. Založte novou hru.'));
    candidate.on('error', () => fail('WebRTC spojení selhalo. Zkuste jinou síť nebo novou pozvánku.'));
  }
  peer.on('open', (id) => {
    if (closed) return;
    if (host) {
      clearTimeout(timeout); // A host may wait indefinitely for an invitation to be opened.
      onInvite(id);
      onStatus('Čekáme na hráče 2. Pošlete mu pozvánku.');
    } else attach(peer.connect(room, { reliable: true, serialization: 'json' }));
  });
  peer.on('connection', (candidate) => host ? attach(candidate) : candidate.on('open', () => candidate.close()));
  peer.on('error', () => fail('Připojení selhalo. Pozvánka může být neplatná nebo síť blokuje WebRTC. Založte novou hru.'));
  function dispose() {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    clearInterval(heartbeat);
    connection?.close();
    peer.destroy();
  }
  return { send, dispose };
}
