'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PinClient } = require('./PinClient');

test('sendPing posts to /api/v1/pings with X-Channel-Key', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push([url, opts]);
    return { ok: true, status: 200, json: async () => ({ id: 'p1', status: 'queued', total_recipients: 3 }) };
  };
  const client = new PinClient({ baseUrl: 'https://api.example.com', channelId: 'ch1', apiKey: 'pin_sk_x' });
  const result = await client.sendPing('Show at 5PM!');
  assert.equal(result.total_recipients, 3);
  const [url, opts] = calls[0];
  assert.equal(url, 'https://api.example.com/api/v1/pings');
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers['X-Channel-Key'], 'pin_sk_x');
  assert.deepEqual(JSON.parse(opts.body), { channel_id: 'ch1', message: 'Show at 5PM!' });
});

test('setLive posts to /channels/{id}/live', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push([url, opts]);
    return { ok: true, status: 200, json: async () => ({ is_live: true }) };
  };
  const client = new PinClient({ baseUrl: 'https://api.example.com/', channelId: 'ch1', apiKey: 'pin_sk_x' });
  const result = await client.setLive(true);
  assert.equal(result.is_live, true);
  const [url, opts] = calls[0];
  assert.equal(url, 'https://api.example.com/api/v1/channels/ch1/live');
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers['X-Channel-Key'], 'pin_sk_x');
  assert.deepEqual(JSON.parse(opts.body), { live: true });
});

test('non-2xx throws with detail message', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 402,
    json: async () => ({ detail: 'quota exceeded' })
  });
  await assert.rejects(
    () => new PinClient({ baseUrl: 'http://x', channelId: 'c', apiKey: 'k' }).sendPing('m'),
    /quota exceeded/
  );
});

test('testConnection hits /health', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push([url, opts]);
    return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
  };
  const result = await new PinClient({
    baseUrl: 'https://api.example.com',
    channelId: 'ch1',
    apiKey: 'pin_sk_x'
  }).testConnection();
  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0][0], 'https://api.example.com/health');
  assert.equal(calls[0][1].method, 'GET');
});
