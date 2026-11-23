(() => {
  'use strict';

  const PLAYERS = Object.freeze(['a', 'b', 'c', 'd']);
  const DEFAULT_NAMES = Object.freeze({ a: '甲', b: '乙', c: '丙', d: '丁' });
  const DEFAULT_RATE = 0.05;
  const DEFAULT_RESTING = 'd';
  const NAME_LIMIT = 6;

  function readNumber(value) {
    if (typeof value === 'number') return value;
    return typeof value === 'string' && value.trim() ? Number(value) : NaN;
  }

  function readRateCents(decimal) {
    const parts = /^(\d*)(?:\.(\d{0,2})0*)?$/.exec(decimal);
    if (!parts) return null;
    const [, yuan, fraction = ''] = parts;
    return BigInt(yuan || '0') * 100n + BigInt(fraction.padEnd(2, '0'));
  }

  function parseRate(value) {
    const rate = readNumber(value);
    if (!(rate > 0 && rate <= Number.MAX_SAFE_INTEGER / 100)) return null;
    const cents = readRateCents(String(rate));
    if (typeof value === 'string' && cents !== readRateCents(value.trim())) return null;
    return cents === null ? null : rate;
  }

  function readRound(hu, resting) {
    if (!PLAYERS.includes(resting)) return null;
    const round = { resting };
    for (const player of PLAYERS) {
      const count = player === resting ? 0 : readNumber(hu?.[player]);
      if (!Number.isSafeInteger(count)) return null;
      round[player] = count;
    }
    return round;
  }

  function createRound(hu, resting) {
    const round = readRound(hu, resting);
    if (!round) throw new Error('请为上场的三位玩家填写整数胡数。');
    return round;
  }

  function normalizeState(value, { strict = false } = {}) {
    const resting = value?.resting;
    const colorMode = value?.colorMode;
    const rate = parseRate(value?.rate);
    const playerNames = {};
    for (const player of PLAYERS) {
      const name = value?.playerNames?.[player];
      const trimmed = typeof name === 'string' ? name.trim() : '';
      if (strict && (!trimmed || trimmed.length > NAME_LIMIT)) {
        throw new Error('备份中的麻将玩家名称格式不正确。');
      }
      const shortened = trimmed.slice(0, NAME_LIMIT).replace(/[\uD800-\uDBFF]$/, '').trimEnd();
      playerNames[player] = shortened || DEFAULT_NAMES[player];
    }

    if (strict && (!PLAYERS.includes(resting) || !['default', 'chinese'].includes(colorMode)
      || rate === null || typeof value.rate !== 'number' || !Array.isArray(value.rounds))) {
      throw new Error('备份中的麻将结算设置格式不正确。');
    }

    const rounds = [];
    for (const source of Array.isArray(value?.rounds) ? value.rounds : []) {
      // Legacy records with three players omit the fourth player's score and rest status.
      const round = readRound(source, strict ? source?.resting : source?.resting ?? DEFAULT_RESTING);
      if (strict && (!round || PLAYERS.some(player => source[player] !== round[player]))) {
        throw new Error(`备份中的麻将第 ${rounds.length + 1} 局记录格式不正确。`);
      }
      if (round) rounds.push(round);
    }

    return {
      rounds,
      resting: PLAYERS.includes(resting) ? resting : DEFAULT_RESTING,
      playerNames,
      colorMode: colorMode === 'chinese' ? 'chinese' : 'default',
      rate: rate ?? DEFAULT_RATE
    };
  }

  function zeroAmounts() {
    return { a: 0n, b: 0n, c: 0n, d: 0n };
  }

  function toRateCents(rate) {
    const validRate = parseRate(rate);
    if (validRate === null) throw new Error('每胡金额须为大于 0 的金额，最多保留两位小数。');
    return readRateCents(String(validRate));
  }

  function settleInCents(round, rateCents) {
    const amounts = zeroAmounts();
    const active = PLAYERS.filter(player => player !== round.resting);
    for (const [index, left] of active.entries()) {
      for (const right of active.slice(index + 1)) {
        const difference = (BigInt(round[left]) - BigInt(round[right])) * rateCents;
        amounts[left] += difference;
        amounts[right] -= difference;
      }
    }
    return amounts;
  }

  function settleRound(round, rate) {
    return settleInCents(round, toRateCents(rate));
  }

  function summarize(rounds, rate) {
    const rateCents = toRateCents(rate);
    const totals = zeroAmounts();
    const results = rounds.map(round => {
      const amounts = settleInCents(round, rateCents);
      for (const player of PLAYERS) totals[player] += amounts[player];
      return amounts;
    });
    return { results, totals };
  }

  function formatMoney(cents) {
    const absolute = cents < 0n ? -cents : cents;
    const sign = cents < 0n ? '-' : cents > 0n ? '+' : '';
    return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
  }

  globalThis.MahjongCalculator = Object.freeze({
    PLAYERS, DEFAULT_NAMES, DEFAULT_RATE, parseRate, normalizeState,
    createRound, settleRound, summarize, formatMoney
  });
})();
