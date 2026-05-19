'use strict';

/**
 * PRICING table — per-million-token USD rates, verified May 2026.
 * Keys match normalized model IDs (lowercase, no extra whitespace).
 */
const PRICING = {
  'claude-opus-4-5': {
    inputPerMtok:       5.00,
    outputPerMtok:     25.00,
    cacheWrite5mPerMtok: 6.25,
    cacheWrite1hPerMtok: 10.00,
    cacheReadPerMtok:    0.50,
  },
  'claude-opus-4-6': {
    inputPerMtok:       5.00,
    outputPerMtok:     25.00,
    cacheWrite5mPerMtok: 6.25,
    cacheWrite1hPerMtok: 10.00,
    cacheReadPerMtok:    0.50,
  },
  'claude-opus-4-7': {
    inputPerMtok:       5.00,
    outputPerMtok:     25.00,
    cacheWrite5mPerMtok: 6.25,
    cacheWrite1hPerMtok: 10.00,
    cacheReadPerMtok:    0.50,
  },
  'claude-sonnet-4-5': {
    inputPerMtok:       3.00,
    outputPerMtok:     15.00,
    cacheWrite5mPerMtok: 3.75,
    cacheWrite1hPerMtok: 6.00,
    cacheReadPerMtok:    0.30,
  },
  'claude-sonnet-4-6': {
    inputPerMtok:       3.00,
    outputPerMtok:     15.00,
    cacheWrite5mPerMtok: 3.75,
    cacheWrite1hPerMtok: 6.00,
    cacheReadPerMtok:    0.30,
  },
  'claude-haiku-4-5': {
    inputPerMtok:       1.00,
    outputPerMtok:      5.00,
    cacheWrite5mPerMtok: 1.25,
    cacheWrite1hPerMtok: 2.00,
    cacheReadPerMtok:    0.10,
  },
};

const VALID_KEYS = Object.keys(PRICING).join(', ');

/**
 * Returns the pricing entry for a given model ID.
 * Normalizes the input by stripping whitespace and lowercasing.
 * Throws a descriptive Error if the model is not found.
 *
 * @param {string} model
 * @returns {{ inputPerMtok: number, outputPerMtok: number, cacheWrite5mPerMtok: number, cacheWrite1hPerMtok: number, cacheReadPerMtok: number }}
 */
function getPricing(model) {
  if (typeof model !== 'string') {
    throw new Error(
      `getPricing: model must be a string, got ${typeof model}. Valid keys: ${VALID_KEYS}`
    );
  }
  const normalized = model.trim().toLowerCase();
  const entry = PRICING[normalized];
  if (!entry) {
    throw new Error(
      `getPricing: unknown model "${model}" (normalized: "${normalized}"). ` +
      `Valid keys: ${VALID_KEYS}`
    );
  }
  return entry;
}

module.exports = { PRICING, getPricing };
