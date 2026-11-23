(() => {
  const { MIN_SERVINGS, MAX_SERVINGS, MAX_ROWS, readRecipe, normalizeRecipe, normalizeDuration,
    readRecipeMeta, formatRecipeMeta, formatIngredientAmount } = globalThis.CookingGuide;
  const demoCover = document.currentScript.dataset.demoCover;
  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const recipeImage = (source, className, alt = '') => {
    if (!source) return '';
    const url = source === 'demo:scallion-noodles' ? demoCover : source;
    return `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" decoding="async" referrerpolicy="no-referrer">`;
  };

  function renderList(pane, entries, icon) {
    const cards = entries.map((record) => {
      const recipe = readRecipe(record);
      const meta = [formatRecipeMeta(record), `${recipe.steps.length} 个步骤`].filter(Boolean).join(' · ');
      const thumbnail = recipeImage(recipe.coverImage, 'module-record-image') || escapeHtml(Array.from(record.title.trim())[0] ?? '·');
      return `<button class="module-record-card cursor-interaction" type="button" data-action="record" data-key="${escapeHtml(record.id)}">
        <span class="module-record-thumbnail" aria-hidden="true">${thumbnail}</span>
        <span class="record-info"><span class="record-name">${escapeHtml(record.title)}</span><span class="record-meta">${escapeHtml(meta)}</span></span>
        <span class="module-record-end" aria-hidden="true">${icon('chevron-right')}</span>
      </button>`;
    }).join('');
    pane.innerHTML = cards ? `<div class="module-record-list">${cards}</div>` : '<p class="module-record-empty">还没有菜谱</p>';
  }

  function createWindow(windowElement, shell, saveRecord, fallbackFocus) {
    let session;
    let screen;
    let draft;
    let overlayTrigger;
    let saving = false;

    const button = (action, label, className = '', attributes = '') =>
      `<button class="cooking-button ${className} cursor-interaction" type="button" data-cooking-action="${action}" ${attributes}>${label}</button>`;
    const backButton = (label) =>
      `<button class="page-back cursor-interaction" type="button" data-cooking-action="back" aria-label="${label}"></button>`;
    const scroll = () => windowElement.querySelector('.cooking-scroll');

    function renderIngredients() {
      const { ingredients, servings } = session.recipe;
      if (!ingredients.length) return '<p class="cooking-empty">还没有用料记录</p>';
      const rows = ingredients.map((ingredient, index) => `<li class="cooking-ingredient">
        <span>${escapeHtml(ingredient.name)}</span>
        <span data-cooking-amount="${index}">${escapeHtml(formatIngredientAmount(ingredient, session.servings, servings))}</span>
      </li>`).join('');
      return `<div class="cooking-servings" aria-label="调整份数">
        ${button('less', '−', '', 'aria-label="减少份数"')}
        <output data-cooking-servings aria-live="polite">${session.servings} 人份</output>
        ${button('more', '+', '', 'aria-label="增加份数"')}
      </div><ul class="cooking-ingredients">${rows}</ul>`;
    }

    function renderSteps(withTotal = false) {
      const { steps } = session.recipe;
      if (!steps.length) return '<p class="cooking-empty">还没有步骤记录</p>';
      return `<ol class="cooking-steps">${steps.map((step, index) => `<li class="cooking-step">
        <div class="cooking-step-number">步骤 ${index + 1}${withTotal ? `<span> / ${steps.length}</span>` : ''}</div>
        <p class="cooking-heat">${step.heat ? `火候 · ${escapeHtml(step.heat)}` : '火候 · 未记录'}</p>
        ${recipeImage(step.image, 'cooking-step-image', `步骤 ${index + 1} 配图`)}
        <p class="cooking-step-copy">${escapeHtml(step.text)}</p>
      </li>`).join('')}</ol>`;
    }

    function renderTips() {
      return session.recipe.tips ? `<p class="cooking-tips">${escapeHtml(session.recipe.tips)}</p>`
        : '<p class="cooking-empty">还没有小贴士</p>';
    }

    function detailView() {
      const { record, recipe } = session;
      const meta = formatRecipeMeta(record);
      return `<header class="cooking-bar">${backButton('返回')}
        <span class="cooking-bar-title">烹饪指南</span>
        <div class="cooking-bar-actions">${button('edit', '编辑')}</div>
      </header>
      <div class="cooking-scroll" tabindex="0" aria-label="菜谱内容">
        <section class="cooking-hero">
          ${recipeImage(recipe.coverImage, 'cooking-cover', `${record.title}成品`)}
          <div class="cooking-hero-content"><h2 id="cooking-title" tabindex="-1">${escapeHtml(record.title)}</h2>
            ${meta ? `<p class="cooking-meta">${escapeHtml(meta)}</p>` : ''}
          </div>
        </section>
        <section class="cooking-section">
          <div class="cooking-section-header"><h3>用料</h3></div>
          ${renderIngredients()}
        </section>
        <section class="cooking-section">
          <div class="cooking-section-header"><h3>步骤</h3>
            ${recipe.steps.length ? button('mode', '进入烹饪模式', 'cooking-button-primary') : ''}
          </div>
          ${renderSteps()}
        </section>
        <section class="cooking-section"><div class="cooking-section-header"><h3>小贴士</h3></div>${renderTips()}</section>
      </div>`;
    }

    function modeView() {
      return `<header class="cooking-bar">${backButton('退出烹饪模式')}
        <h2 id="cooking-title" class="cooking-bar-title" tabindex="-1">烹饪模式</h2>
        <div class="cooking-bar-actions">
          ${button('ingredients', '用料', '', 'aria-expanded="false" aria-controls="cooking-panel"')}
          ${button('tips', '小贴士', '', 'aria-expanded="false" aria-controls="cooking-panel"')}
        </div>
      </header>
      <div class="cooking-scroll" tabindex="0" aria-label="烹饪步骤">
        <h3 class="cooking-mode-title">${escapeHtml(session.record.title)}</h3>
        ${renderSteps(true)}
      </div>
      <div class="cooking-panel-overlay" hidden>
        <section class="cooking-panel" id="cooking-panel" role="dialog" aria-modal="true" aria-labelledby="cooking-panel-title"></section>
      </div>`;
    }

    function field(label, name, value = '', attributes = '') {
      return `<label class="field">${label}<input name="${name}" value="${escapeHtml(value)}" ${attributes}></label>`;
    }

    function textarea(label, name, value = '', attributes = '') {
      return `<label class="field">${label}<textarea name="${name}" ${attributes}>${escapeHtml(value)}</textarea></label>`;
    }

    function durationField(value) {
      return `<div class="field">
        <label for="cooking-duration">烹饪时间（选填）</label>
        <div class="cooking-duration-control">
          ${button('duration-less', '−', '', 'aria-label="减少烹饪时间"')}
          <div class="cooking-duration-input">
            <input id="cooking-duration" name="durationMinutes" type="text" inputmode="numeric" pattern="[0-9]+"
              maxlength="${String(Number.MAX_SAFE_INTEGER).length}" value="${escapeHtml(value ?? '')}" aria-describedby="cooking-duration-unit">
            <span id="cooking-duration-unit">分钟</span>
          </div>
          ${button('duration-more', '+', '', 'aria-label="增加烹饪时间"')}
        </div>
      </div>`;
    }

    function imageField(label, name, value) {
      const demo = value === 'demo:scallion-noodles';
      const attributes = `type="url" maxlength="2048" placeholder="https://…"${demo ? ' data-demo-image="demo:scallion-noodles"' : ''}`;
      return field(label, name, demo ? '' : value, attributes)
        + (demo ? '<p class="cooking-muted">已使用示例图片。填写图片链接可替换。</p>' : '');
    }

    function editorRow(kind, index, value = {}) {
      const step = kind === 'step';
      const label = step ? '步骤' : '用料';
      const fields = step ? [
        field('火候', 'heat', value.heat, 'maxlength="60" placeholder="例如小火、煮沸后转中火、无需加热" required'),
        textarea('做法', 'text', value.text, 'maxlength="2000" rows="3" required'),
        imageField('步骤图片链接（选填）', 'image', value.image)
      ] : [
        field('食材', 'name', value.name, 'maxlength="60" required'),
        field('用量', 'quantity', value.quantity, 'maxlength="40" placeholder="例如 1/2、1–2、适量"'),
        field('单位', 'unit', value.unit, 'maxlength="20" placeholder="例如 汤匙"')
      ];
      return `<div class="cooking-editor-row" data-cooking-row="${kind}">
        <div class="cooking-editor-row-header"><strong data-row-title>${label} ${index + 1}</strong>
          ${button('remove', '移除', '', `aria-label="移除${label} ${index + 1}"`)}
        </div>
        <div class="cooking-editor-fields">${fields.join('')}</div>
      </div>`;
    }

    function editorGroup(kind, items, open) {
      const step = kind === 'step';
      const label = step ? '步骤' : '用料';
      return `<details class="cooking-section cooking-editor-group"${open ? ' open' : ''}>
        <summary>
          <span class="cooking-editor-group-title">${label}</span>
          <span class="cooking-editor-group-count"><span data-editor-count>${items.length}</span> ${step ? '步' : '项'}</span>
        </summary>
        <div class="cooking-editor-group-body">
          <div data-editor-rows="${kind}">${items.map((item, index) => editorRow(kind, index, item)).join('')}</div>
          ${button(`add-${kind}`, '<span aria-hidden="true">+</span>', 'cooking-editor-add',
            `aria-label="添加${label}"${items.length >= MAX_ROWS ? ' disabled' : ''}`)}
        </div>
      </details>`;
    }

    function editorView() {
      const { record, recipe } = session;
      const value = !record && draft ? draft : { title: record?.title, ...(record && readRecipeMeta(record)), recipe };
      const editRecipe = value.recipe;
      return `<header class="cooking-bar">${backButton('取消编辑')}
        <h2 id="cooking-title" class="cooking-bar-title" tabindex="-1">${record ? '编辑菜谱' : '新增菜谱'}</h2>
      </header>
      <div class="cooking-scroll">
        <form class="cooking-editor">
          <section class="cooking-section">
            ${field('菜名', 'title', value.title, 'maxlength="30" required')}
            ${durationField(value.durationMinutes)}
            ${textarea('简介（选填）', 'summary', value.summary, 'maxlength="180" rows="2" placeholder="例如 家常快手"')}
            ${field('原始份数', 'servings', editRecipe.servings, `type="number" min="${MIN_SERVINGS}" max="${MAX_SERVINGS}" step="1" inputmode="numeric" required`)}
            ${imageField('成品图片链接（选填）', 'coverImage', editRecipe.coverImage)}
          </section>
          ${editorGroup('ingredient', editRecipe.ingredients, !record)}
          ${editorGroup('step', editRecipe.steps, !record)}
          <section class="cooking-section">${textarea('小贴士（选填）', 'tips', editRecipe.tips, 'maxlength="2000" rows="3"')}</section>
          <p class="cooking-form-error" role="alert" hidden></p>
          <button class="cooking-button cooking-button-primary cursor-interaction" type="submit">保存菜谱</button>
        </form>
      </div>`;
    }

    function syncServings() {
      const { servings, recipe } = session;
      windowElement.querySelectorAll('[data-cooking-servings]').forEach((element) => { element.textContent = `${servings} 人份`; });
      windowElement.querySelectorAll('[data-cooking-amount]').forEach((element) => {
        element.textContent = formatIngredientAmount(recipe.ingredients[Number(element.dataset.cookingAmount)], servings, recipe.servings);
      });
      windowElement.querySelectorAll('[data-cooking-action="less"]').forEach((control) => { control.disabled = servings <= MIN_SERVINGS; });
      windowElement.querySelectorAll('[data-cooking-action="more"]').forEach((control) => { control.disabled = servings >= MAX_SERVINGS; });
    }

    function syncDuration(input) {
      const value = Number(input.value);
      const control = input.closest('.cooking-duration-control');
      input.dataset.lastValue = input.value;
      control.querySelector('[data-cooking-action="duration-less"]').disabled = value === 0;
      control.querySelector('[data-cooking-action="duration-more"]').disabled = value === Number.MAX_SAFE_INTEGER;
    }

    function changeDuration(input, delta) {
      const value = Number(input.value) + delta;
      if (!Number.isSafeInteger(value) || value < 0) return;
      input.value = String(value);
      syncDuration(input);
    }

    function checkDurationInput(event) {
      const input = event.target;
      if (input.id !== 'cooking-duration' || event.isComposing) return;
      const digits = input.value.normalize('NFKC');
      if (!/^\d*$/.test(digits) || !Number.isSafeInteger(Number(digits))) input.value = input.dataset.lastValue;
      else if (digits !== input.value) input.value = digits;
      syncDuration(input);
    }

    function render(nextScreen, focusAction) {
      screen = nextScreen;
      windowElement.dataset.screen = screen;
      windowElement.innerHTML = screen === 'mode' ? modeView() : screen === 'editor' ? editorView() : detailView();
      if (screen === 'detail') scroll().scrollTop = session.detailScroll;
      if (screen === 'editor') syncDuration(windowElement.querySelector('#cooking-duration'));
      syncServings();
      const focusTarget = focusAction && windowElement.querySelector(`[data-cooking-action="${focusAction}"]`);
      (focusTarget || windowElement.querySelector('#cooking-title')).focus({ preventScroll: true });
    }

    function open(record, trigger) {
      const recipe = record ? readRecipe(record) : { servings: 2, ingredients: [{ name: '', quantity: '', unit: '' }], steps: [{}], coverImage: '', tips: '' };
      session = { record, recipe, servings: recipe.servings, trigger, detailScroll: 0 };
      shell.inert = true;
      windowElement.hidden = false;
      render(record ? 'detail' : 'editor');
    }

    function close() {
      const { trigger } = session;
      windowElement.hidden = true;
      windowElement.replaceChildren();
      shell.inert = false;
      session = undefined;
      (trigger?.isConnected && !trigger.closest('[hidden], [inert]') ? trigger : fallbackFocus(trigger))?.focus({ preventScroll: true });
    }

    function showPanel(action, trigger) {
      const overlay = windowElement.querySelector('.cooking-panel-overlay');
      const ingredients = action === 'ingredients';
      const title = ingredients ? '用料' : '小贴士';
      overlay.firstElementChild.innerHTML = `<header class="cooking-panel-header"><h3 id="cooking-panel-title">${title}</h3>
        ${button('close-panel', '关闭', '', `aria-label="关闭${title}"`)}</header>${ingredients ? renderIngredients() : renderTips()}`;
      overlayTrigger = trigger;
      overlayTrigger.setAttribute('aria-expanded', 'true');
      overlay.hidden = false;
      windowElement.querySelector('.cooking-bar').inert = true;
      scroll().inert = true;
      syncServings();
      overlay.querySelector('button').focus();
    }

    function closePanel() {
      const overlay = windowElement.querySelector('.cooking-panel-overlay:not([hidden])');
      if (!overlay) return false;
      overlay.hidden = true;
      windowElement.querySelector('.cooking-bar').inert = false;
      scroll().inert = false;
      overlayTrigger.setAttribute('aria-expanded', 'false');
      overlayTrigger.focus({ preventScroll: true });
      overlayTrigger = undefined;
      return true;
    }

    function readEditor(form) {
      const values = new FormData(form);
      const text = (name) => values.get(name).trim();
      const readField = (container, name) => {
        const input = container.querySelector(`[name="${name}"]`);
        return input.value.trim() || input.dataset.demoImage || '';
      };
      const rows = (kind, names) => [...form.querySelectorAll(`[data-cooking-row="${kind}"]`)].map((row) =>
        Object.fromEntries(names.map((name) => [name, readField(row, name)])));
      return {
        title: text('title'), summary: text('summary'), durationMinutes: text('durationMinutes'),
        recipe: {
          servings: values.get('servings'), tips: text('tips'),
          coverImage: readField(form, 'coverImage'),
          ingredients: rows('ingredient', ['name', 'quantity', 'unit']),
          steps: rows('step', ['heat', 'text', 'image'])
        }
      };
    }

    function goBack() {
      if (saving) return;
      if (screen === 'mode') return render('detail', 'mode');
      if (screen === 'editor' && session.record) return render('detail', 'edit');
      if (screen === 'editor') draft = readEditor(windowElement.querySelector('form'));
      close();
    }

    function syncEditorCount(list) {
      const group = list.closest('.cooking-editor-group');
      group.querySelector('[data-editor-count]').textContent = list.children.length;
      group.querySelector('.cooking-editor-add').disabled = list.children.length >= MAX_ROWS;
    }

    function addRow(kind, trigger) {
      const list = trigger.parentElement.querySelector('[data-editor-rows]');
      if (list.children.length >= MAX_ROWS) return;
      list.insertAdjacentHTML('beforeend', editorRow(kind, list.children.length));
      list.lastElementChild.querySelector('input').focus();
      syncEditorCount(list);
    }

    function removeRow(trigger) {
      const row = trigger.closest('[data-cooking-row]');
      const kind = row.dataset.cookingRow;
      const list = row.parentElement;
      const label = kind === 'step' ? '步骤' : '用料';
      const add = windowElement.querySelector(`[data-cooking-action="add-${kind}"]`);
      const focusTarget = row.nextElementSibling?.querySelector('button') ?? row.previousElementSibling?.querySelector('button') ?? add;
      row.remove();
      [...list.children].forEach((remaining, index) => {
        remaining.querySelector('[data-row-title]').textContent = `${label} ${index + 1}`;
        remaining.querySelector('button').setAttribute('aria-label', `移除${label} ${index + 1}`);
      });
      syncEditorCount(list);
      focusTarget.focus();
    }

    windowElement.addEventListener('click', (event) => {
      if (saving) {
        event.preventDefault();
        return;
      }
      if (event.target.matches('.cooking-panel-overlay')) closePanel();
      const trigger = event.target.closest('[data-cooking-action]');
      switch (trigger?.dataset.cookingAction) {
        case 'back': goBack(); break;
        case 'edit':
        case 'mode':
          session.detailScroll = scroll().scrollTop;
          render(trigger.dataset.cookingAction === 'edit' ? 'editor' : 'mode');
          break;
        case 'less':
        case 'more': {
          const delta = trigger.dataset.cookingAction === 'less' ? -1 : 1;
          session.servings = Math.max(MIN_SERVINGS, Math.min(MAX_SERVINGS, session.servings + delta));
          syncServings();
          if (trigger.disabled) {
            trigger.parentElement.querySelector('button:not([disabled])').focus({ preventScroll: true });
          }
          break;
        }
        case 'ingredients':
        case 'tips': showPanel(trigger.dataset.cookingAction, trigger); break;
        case 'close-panel': closePanel(); break;
        case 'add-ingredient': addRow('ingredient', trigger); break;
        case 'add-step': addRow('step', trigger); break;
        case 'remove': removeRow(trigger); break;
        case 'duration-less':
        case 'duration-more': {
          const input = windowElement.querySelector('#cooking-duration');
          changeDuration(input, trigger.dataset.cookingAction === 'duration-less' ? -1 : 1);
          if (trigger.disabled) input.focus({ preventScroll: true });
          break;
        }
      }
    });
    windowElement.addEventListener('input', checkDurationInput);
    windowElement.addEventListener('compositionend', checkDurationInput);

    windowElement.addEventListener('invalid', (event) => {
      const group = event.target.closest('.cooking-editor-group');
      if (group) group.open = true;
    }, true);

    async function saveEditor(form, value) {
      const submit = form.querySelector('button[type="submit"]');
      const label = submit.textContent;
      const buttons = windowElement.querySelectorAll('button:not([disabled], [aria-disabled])');
      const fields = form.querySelectorAll('input:not([readonly]), textarea:not([readonly])');
      saving = true;
      form.setAttribute('aria-busy', 'true');
      submit.textContent = '正在保存…';
      for (const button of buttons) button.setAttribute('aria-disabled', 'true');
      for (const field of fields) field.readOnly = true;
      try {
        return await saveRecord(value, session.record);
      } finally {
        saving = false;
        form.removeAttribute('aria-busy');
        submit.textContent = label;
        for (const button of buttons) button.removeAttribute('aria-disabled');
        for (const field of fields) field.readOnly = false;
      }
    }

    windowElement.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return;
      const form = event.target;
      const error = form.querySelector('.cooking-form-error');
      error.hidden = true;
      try {
        const value = readEditor(form);
        if (!value.title) throw new Error('请填写菜名。');
        if (!value.recipe.steps.length) {
          const add = form.querySelector('[data-cooking-action="add-step"]');
          add.closest('.cooking-editor-group').open = true;
          add.focus();
          throw new Error('请至少添加一个步骤。');
        }
        value.durationMinutes = normalizeDuration(value.durationMinutes === '' ? null : Number(value.durationMinutes));
        value.recipe.servings = Number(value.recipe.servings);
        value.recipe = normalizeRecipe(value.recipe, { strict: true });
        const record = await saveEditor(form, value);
        if (!session.record) draft = undefined;
        session.record = record;
        session.recipe = value.recipe;
        session.servings = value.recipe.servings;
        session.detailScroll = 0;
        render('detail');
      } catch (problem) {
        error.textContent = problem?.message || '未能保存菜谱，请重试。';
        error.hidden = false;
        error.scrollIntoView({ block: 'nearest' });
      }
    });

    windowElement.addEventListener('keydown', (event) => {
      if (!saving && !event.isComposing && event.target.id === 'cooking-duration'
        && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        changeDuration(event.target, event.key === 'ArrowUp' ? 1 : -1);
      }
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (event.isComposing) return;
        event.preventDefault();
        if (!closePanel()) goBack();
      }
      if (event.key !== 'Tab') return;
      const region = windowElement.querySelector('.cooking-panel-overlay:not([hidden])') ?? windowElement;
      const controls = [...region.querySelectorAll('button, input, textarea, summary, [tabindex="0"]')]
        .filter((element) => !element.disabled && !element.closest('[hidden], [inert], details:not([open]) > :not(summary)'));
      if (event.shiftKey && (document.activeElement === controls[0] || !controls.includes(document.activeElement))) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault();
        controls[0]?.focus();
      }
    });

    return { open, clearDraft: () => { draft = undefined; } };
  }

  globalThis.CookingModule = { renderList, createWindow };
})();
