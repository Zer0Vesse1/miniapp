(() => {
  'use strict';

  const { PLAYERS, DEFAULT_NAMES, createRound, summarize, formatMoney } = globalThis.MahjongCalculator;
  const drafts = new WeakMap();

  function amount(cents) {
    const outcome = cents > 0n ? 'win' : cents < 0n ? 'loss' : 'even';
    return `<span class="mahjong-money" data-outcome="${outcome}">${formatMoney(cents)}</span>`;
  }

  function playerResults(totals, round) {
    return `<dl class="mahjong-results">${PLAYERS.map((player) => `
      <div class="mahjong-result">
        <dt data-player-name="${player}"></dt>
        <dd>${round?.resting === player ? '<span class="mahjong-muted">轮休</span>' : amount(totals[player])}</dd>
      </div>`).join('')}</dl>`;
  }

  function render(pane, model, onChange) {
    const scores = drafts.get(model) ?? {};
    drafts.set(model, scores);

    pane.innerHTML = `<div class="mahjong-view" data-mahjong-module data-color-mode="${model.colorMode}">
      <section class="module-feature">
        <p class="feature-meta">每胡 ¥${model.rate.toFixed(2)} · 每局一人轮休</p>
        <fieldset class="mahjong-fieldset">
          <legend>玩家名称</legend>
          <div class="mahjong-grid">
            ${PLAYERS.map((player) => `<label class="field">${DEFAULT_NAMES[player]}<input type="text" name="name-${player}" aria-label="玩家${DEFAULT_NAMES[player]}名称" maxlength="6"></label>`).join('')}
          </div>
        </fieldset>
        <form class="form" data-mahjong-round>
          <fieldset class="mahjong-fieldset">
            <legend>本局轮休</legend>
            <div class="mahjong-rest">
              ${PLAYERS.map((player) => `<label>
                <input type="radio" name="resting" value="${player}">
                <span data-player-name="${player}"></span>
              </label>`).join('')}
            </div>
          </fieldset>
          <fieldset class="mahjong-fieldset">
            <legend>本局胡数</legend>
            <div class="mahjong-grid">
              ${PLAYERS.map((player) => `<label class="field">
                <span><span data-player-name="${player}"></span><span data-score-rest="${player}"></span></span>
                <input name="${player}" type="number" step="1" inputmode="numeric" required placeholder="0">
              </label>`).join('')}
            </div>
          </fieldset>
          <p class="mahjong-error" role="alert" hidden></p>
          <button class="primary cursor-interaction" type="submit">记录本局</button>
        </form>
      </section>
      <div data-mahjong-summary></div>
      <section class="module-feature mahjong-history" aria-labelledby="m-app-mahjong-history">
        <div class="mahjong-section-header">
          <h3 id="m-app-mahjong-history" tabindex="-1">历史记录</h3>
          <button class="cursor-interaction mahjong-delete" type="button" data-mahjong-clear hidden>全部清除</button>
        </div>
        <div class="mahjong-history-list"></div>
      </section>
      <p class="live-status" data-mahjong-status role="status"></p>
    </div>`;

    const view = pane.querySelector('[data-mahjong-module]');
    const form = view.querySelector('[data-mahjong-round]');
    const error = form.querySelector('[role="alert"]');
    const summary = view.querySelector('[data-mahjong-summary]');
    const history = view.querySelector('.mahjong-history-list');
    const historyHeading = view.querySelector('#m-app-mahjong-history');
    const clear = view.querySelector('[data-mahjong-clear]');
    const status = view.querySelector('[data-mahjong-status]');
    let latestSave = Promise.resolve();
    const submit = form.querySelector('[type="submit"]');

    function save(changes) {
      const pending = latestSave.then(() => onChange({ ...model, ...changes() }));
      latestSave = pending.catch(() => false);
      return pending;
    }

    function showNames() {
      for (const element of view.querySelectorAll('[data-player-name]')) {
        element.textContent = model.playerNames[element.dataset.playerName];
      }
    }

    function showResting() {
      form.elements.resting.value = model.resting;
      for (const player of PLAYERS) {
        const resting = player === model.resting;
        const input = form.elements[player];
        input.disabled = resting;
        input.placeholder = resting ? '轮休' : '0';
        input.value = resting ? '' : scores[player] ?? '';
        view.querySelector(`[data-score-rest="${player}"]`).textContent = resting ? '（轮休）' : '';
      }
    }

    function showResults() {
      const { rounds, rate } = model;
      const { results, totals } = summarize(rounds, rate);
      const latest = rounds.at(-1);
      summary.innerHTML = latest ? `<section class="module-feature mahjong-summary">
        <div><h3>本局结果</h3>${playerResults(results.at(-1), latest)}</div>
        <div><h3>累计输赢 <span class="mahjong-muted">共 ${rounds.length} 局</span></h3>${playerResults(totals)}</div>
      </section>` : '';
      summary.hidden = !latest;
      clear.hidden = !latest;
      history.innerHTML = latest ? rounds.map((round, index) => `<article class="mahjong-history-round">
        <div class="mahjong-section-header">
          <h4>第 ${index + 1} 局</h4>
          <button class="cursor-interaction mahjong-delete" type="button" data-remove-round="${index}" aria-label="删除第 ${index + 1} 局">删除</button>
        </div>
        <dl class="mahjong-results">${PLAYERS.map((player) => `<div class="mahjong-result">
          <dt data-player-name="${player}"></dt>
          <dd class="mahjong-muted">${player === round.resting ? '轮休' : `${round[player]} 胡`}</dd>
          ${player === round.resting ? '' : `<dd>${amount(results[index][player])}</dd>`}
        </div>`).join('')}</dl>
      </article>`).join('') : '<p class="mahjong-muted">暂无对局记录</p>';
      showNames();
    }

    for (const player of PLAYERS) {
      const name = view.querySelector(`[name="name-${player}"]`);
      name.value = model.playerNames[player];
      name.addEventListener('change', async () => {
        const value = name.value.trim() || model.playerNames[player];
        if (value !== model.playerNames[player]) await save(() => ({ playerNames: { ...model.playerNames, [player]: value } }));
        name.value = model.playerNames[player];
        showNames();
      });
      form.elements[player].addEventListener('input', (event) => {
        scores[player] = event.target.value;
        error.hidden = true;
      });
    }

    form.addEventListener('change', async (event) => {
      if (event.target.name !== 'resting') return;
      const resting = event.target.value;
      if (await save(() => ({ resting }))) delete scores[model.resting];
      showResting();
      error.hidden = true;
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      let saved;
      try {
        const input = { ...scores };
        saved = await save(() => ({ rounds: [...model.rounds, createRound(input, model.resting)] }));
      } catch (failure) {
        error.textContent = failure.message;
        error.hidden = false;
        return;
      } finally {
        submit.disabled = false;
      }
      if (!saved) return;
      for (const player of PLAYERS) delete scores[player];
      error.hidden = true;
      showResting();
      showResults();
      status.textContent = `已记录第 ${model.rounds.length} 局`;
      form.elements[PLAYERS.find((player) => player !== model.resting)].focus({ preventScroll: true });
    });
    history.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-remove-round]');
      if (!button) return;
      const round = model.rounds[Number(button.dataset.removeRound)];
      if (!await save(() => ({ rounds: model.rounds.filter((entry) => entry !== round) }))) return;
      showResults();
      status.textContent = '已删除该局记录';
      const next = history.querySelector(`[data-remove-round="${Math.min(Number(button.dataset.removeRound), model.rounds.length - 1)}"]`);
      (next || historyHeading).focus({ preventScroll: true });
    });
    clear.addEventListener('click', async () => {
      if (!confirm('确定清除全部麻将对局记录？')) return;
      if (!await save(() => ({ rounds: [] }))) return;
      showResults();
      status.textContent = '已清除全部对局记录';
      historyHeading.focus({ preventScroll: true });
    });

    showResting();
    showResults();
  }

  globalThis.MahjongModule = Object.freeze({ render });
})();
