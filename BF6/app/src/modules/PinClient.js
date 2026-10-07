'use strict';

// HTTP client for the PIN notification API (machine auth via X-Channel-Key).
// Never log the API key.

const REQUEST_TIMEOUT_MS = 10000;

class PinClient {
  constructor({ baseUrl, channelId, apiKey }) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.channelId = String(channelId || '');
    this.apiKey = String(apiKey || '');
  }

  async sendPing(message) {
    return this.#request('POST', '/api/v1/pings', {
      channel_id: this.channelId,
      message: String(message || '')
    });
  }

  async setLive(live) {
    return this.#request('POST', `/api/v1/channels/${encodeURIComponent(this.channelId)}/live`, {
      live: Boolean(live)
    });
  }

  async testConnection() {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    return { ok: response.ok };
  }

  async #request(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Channel-Key': this.apiKey
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      throw new Error(await readErrorDetail(response));
    }
    return response.json();
  }
}

async function readErrorDetail(response) {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === 'string') return payload.detail;
    if (payload?.detail != null) return JSON.stringify(payload.detail);
  } catch {
    // Fall through to status text.
  }
  return `HTTP ${response.status}`;
}

module.exports = { PinClient };
