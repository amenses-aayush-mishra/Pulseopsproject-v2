'use strict';

/**
 * Tiny in-process Server-Sent Events hub keyed by Slack channel id.
 *
 * Used to push live "new_slack_message" events to the PulseOps Channel UI
 * once the async worker has written a message/attachment to the database.
 * Each channel keeps a Set of open SSE responses; on client disconnect the
 * response is removed so no memory grows unboundedly.
 *
 * In a horizontally-scaled deployment this in-memory hub would be swapped for
 * a Redis pub/sub (BullMQ BroadcastEvents / ioredis) — the API contract below
 * stays identical.
 */

const clients = new Map(); // channelId -> Set<res>

function subscribe(channelId, res) {
  if (!clients.has(channelId)) clients.set(channelId, new Set());
  clients.get(channelId).add(res);
  res.on('close', () => {
    const set = clients.get(channelId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(channelId);
    }
  });
}

function unsubscribe(channelId, res) {
  const set = clients.get(channelId);
  if (set) set.delete(res);
}

function broadcast(channelId, eventName, payload) {
  const set = clients.get(channelId);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  const frame = `event: ${eventName}\ndata: ${data}\n\n`;
  for (const res of set) {
    try {
      res.write(frame);
    } catch {
      // Client went away mid-write — the 'close' handler cleans it up.
    }
  }
}

function channelCount() {
  return clients.size;
}

module.exports = { subscribe, unsubscribe, broadcast, channelCount };