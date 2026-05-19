'use strict';

const fs = require('node:fs/promises');
const { getPricing } = require('./pricing');

const SCHEMA_VERSION = 1;
const ROUND_PRECISION = 1e-10;
const SERIALIZE_DECIMALS = 8;

/**
 * Rounds a number to the given precision step.
 * Used for internal cost accumulation.
 */
function roundTo(value, precision) {
  return Math.round(value / precision) * precision;
}

/**
 * Rounds a number to a fixed number of decimal places for serialization.
 */
function roundToDecimals(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * CapExceededError — thrown by CostLedger.checkCaps() when a cost cap is breached.
 */
class CapExceededError extends Error {
  /**
   * @param {{ type: 'goal'|'floor', limitUsd: number, actualUsd: number, floor: number|null }} opts
   */
  constructor({ type, limitUsd, actualUsd, floor }) {
    const scope = type === 'goal'
      ? 'goal total'
      : `floor ${floor}`;
    const message =
      `CapExceededError: ${scope} cost $${actualUsd.toFixed(SERIALIZE_DECIMALS)} ` +
      `exceeds $${limitUsd.toFixed(SERIALIZE_DECIMALS)} limit`;
    super(message);
    this.name = 'CapExceededError';
    this.type = type;
    this.limitUsd = limitUsd;
    this.actualUsd = actualUsd;
    this.floor = floor;
  }
}

/**
 * CostLedger — tracks token usage and USD cost per agent, per floor, and in total.
 *
 * All internal costs are rounded to 1e-10 precision.
 * Serialized costs are rounded to 8 decimal places.
 */
class CostLedger {
  constructor() {
    /** @type {Map<number, { costUsd: number, entries: object[] }>} */
    this.floors = new Map();
    this.totalCostUsd = 0;
    this.schemaVersion = SCHEMA_VERSION;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Records token usage for an agent on a given floor and computes cost.
   *
   * @param {{
   *   agent: string,
   *   floor: number,
   *   inputTokens: number,
   *   outputTokens: number,
   *   model: string,
   *   cacheReadTokens?: number,
   *   cacheWriteTokens?: number
   * }} usage
   */
  addUsage({
    agent,
    floor,
    inputTokens,
    outputTokens,
    model,
    cacheReadTokens = 0,
    cacheWriteTokens = 0,
  }) {
    const p = getPricing(model);

    const cost = roundTo(
      (inputTokens       / 1e6) * p.inputPerMtok
      + (outputTokens    / 1e6) * p.outputPerMtok
      + (cacheReadTokens / 1e6) * p.cacheReadPerMtok
      + (cacheWriteTokens/ 1e6) * p.cacheWrite5mPerMtok,
      ROUND_PRECISION
    );

    const entry = {
      agent,
      floor,
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd: cost,
      timestamp: new Date().toISOString(),
    };

    if (!this.floors.has(floor)) {
      this.floors.set(floor, { costUsd: 0, entries: [] });
    }
    const floorData = this.floors.get(floor);
    floorData.costUsd = roundTo(floorData.costUsd + cost, ROUND_PRECISION);
    floorData.entries.push(entry);

    this.totalCostUsd = roundTo(this.totalCostUsd + cost, ROUND_PRECISION);
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Returns the total cost for a specific floor number.
   * Returns 0 if the floor has no recorded usage.
   *
   * @param {number} n
   * @returns {number}
   */
  getFloorCost(n) {
    return this.floors.get(n)?.costUsd ?? 0;
  }

  /**
   * Returns the grand total cost across all floors.
   *
   * @returns {number}
   */
  getGoalCost() {
    return this.totalCostUsd;
  }

  /**
   * Checks cost caps without modifying state. Throws CapExceededError on first breach.
   * Goal cap is checked before per-floor caps.
   *
   * @param {{ perFloorUsd?: number, perGoalUsd?: number }} caps
   * @throws {CapExceededError}
   */
  checkCaps({ perFloorUsd, perGoalUsd } = {}) {
    if (perGoalUsd != null && this.totalCostUsd > perGoalUsd) {
      throw new CapExceededError({
        type: 'goal',
        limitUsd: perGoalUsd,
        actualUsd: this.totalCostUsd,
        floor: null,
      });
    }

    if (perFloorUsd != null) {
      for (const [n, data] of this.floors) {
        if (data.costUsd > perFloorUsd) {
          throw new CapExceededError({
            type: 'floor',
            limitUsd: perFloorUsd,
            actualUsd: data.costUsd,
            floor: n,
          });
        }
      }
    }
  }

  /**
   * Serializes the ledger to a JSON file at the given path.
   *
   * @param {string} path
   * @returns {Promise<void>}
   */
  async save(path) {
    const floorsObj = {};
    for (const [n, data] of this.floors) {
      floorsObj[n] = {
        costUsd: roundToDecimals(data.costUsd, SERIALIZE_DECIMALS),
        entries: data.entries.map((e) => ({
          ...e,
          costUsd: roundToDecimals(e.costUsd, SERIALIZE_DECIMALS),
        })),
      };
    }

    const payload = {
      schemaVersion: this.schemaVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      totalCostUsd: roundToDecimals(this.totalCostUsd, SERIALIZE_DECIMALS),
      floors: floorsObj,
    };

    await fs.writeFile(path, JSON.stringify(payload, null, 2), 'utf8');
  }

  /**
   * Loads a ledger from a JSON file at the given path.
   * Returns a new empty CostLedger if the file does not exist (ENOENT).
   * Throws if the file contains an unknown schemaVersion.
   *
   * @param {string} path
   * @returns {Promise<CostLedger>}
   */
  static async load(path) {
    let raw;
    try {
      raw = await fs.readFile(path, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return new CostLedger();
      }
      throw err;
    }

    const data = JSON.parse(raw);

    if (data.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(
        `CostLedger.load: unknown schemaVersion ${data.schemaVersion}. ` +
        `Expected ${SCHEMA_VERSION}.`
      );
    }

    const ledger = new CostLedger();
    ledger.schemaVersion = data.schemaVersion;
    ledger.createdAt = data.createdAt;
    ledger.updatedAt = data.updatedAt;
    ledger.totalCostUsd = data.totalCostUsd;

    for (const [nStr, floorData] of Object.entries(data.floors || {})) {
      const n = Number(nStr);
      ledger.floors.set(n, {
        costUsd: floorData.costUsd,
        entries: floorData.entries || [],
      });
    }

    return ledger;
  }
}

module.exports = { CostLedger, CapExceededError };
