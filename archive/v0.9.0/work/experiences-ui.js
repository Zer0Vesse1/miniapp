(() => {
  const model = globalThis.RecordExperiences;
  const copy = {
    cooking: { title: '我的烹饪', quick: '次数 +1', action: '记重要烹饪', undo: '撤回最近一次快速计数', note: '心得', added: '已记下这次烹饪' },
    people: { title: '我们的交集', quick: '记一次见面', action: '记重要经历', undo: '撤回最近一次快速见面记录', note: '经历', added: '已记下今天的见面' }
  };
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function today() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function entry(kind) {
    return `<button class="experience-entry cursor-interaction" type="button" data-open-experiences>
      ${copy[kind].title}<span class="experience-chevron" aria-hidden="true"></span>
    </button>`;
  }

  function mount(container, initialRecord, { save, backButton, onBack }) {
    let record = initialRecord;
    const { kind } = record;
    const words = copy[kind];
    const [quickType, importantType] = model.kinds[kind];
    const cooking = kind === 'cooking';
    let editor;
    let pending = false;
    const entries = () => record.experiences ?? [];
    const sorted = () => [...entries()].reverse().sort((a, b) => model.sortKey(b.date).localeCompare(model.sortKey(a.date)));
    const lastQuick = () => entries().findLast((item) => item.quick);
    const openRows = () => [...container.querySelectorAll('details[open]')].map((row) => row.dataset.experienceId);
    const quickSelector = '[data-experience-action="quick"]';
    const rowSelector = (id) => `[data-experience-id="${CSS.escape(id)}"] summary`;

    function summary(ordered) {
      const latest = ordered[0];
      if (cooking) return latest ? `做过 ${ordered.length} 次 · 上次 ${model.dateLabel(latest.date, false)}` : '还没有烹饪记录';
      const first = ordered.findLast((item) => item.type === '初识');
      const meetings = ordered.filter((item) => item.type === quickType);
      const parts = [];
      if (first) parts.push(`${model.dateLabel(first.date)}相识`);
      if (meetings.length) parts.push(`已记 ${meetings.length} 次见面`, `上次 ${model.dateLabel(meetings[0].date, false)}`);
      return parts.join(' · ') || (latest ? '还没有见面记录' : '还没有交集记录');
    }

    function rows(ordered, expanded) {
      return ordered.map((item) => {
        const date = model.dateLabel(item.date);
        const label = cooking ? date : item.type;
        const meta = cooking ? (item.type === importantType ? importantType : item.note ? '有心得' : '') : date;
        return `<li><details data-experience-id="${escape(item.id)}"${expanded.includes(item.id) ? ' open' : ''}>
          <summary class="cursor-interaction"><span>${escape(label)}</span><small>${escape(meta)}</small>
            <span class="experience-chevron" aria-hidden="true"></span></summary>
          <div class="experience-note">${item.note ? `<p>${escape(item.note)}</p>` : ''}
            <button class="experience-text cursor-interaction" type="button" data-experience-action="edit">
              ${item.note ? '编辑' : '补充'}${words.note}</button></div>
        </details></li>`;
      }).join('');
    }

    function updateTimeline(expanded, message = '') {
      const ordered = sorted();
      container.querySelector('.experience-summary').textContent = summary(ordered);
      container.querySelector('.experience-events').innerHTML = rows(ordered, expanded);
      const undo = container.querySelector('[data-experience-action="undo"]');
      if (!lastQuick() && document.activeElement === undo) container.querySelector(quickSelector).focus();
      undo.disabled = !lastQuick();
      container.querySelector('[role="status"]').textContent = message;
    }

    function showTimeline({ expanded = [], focus = quickSelector, message = '' } = {}) {
      editor = undefined;
      backButton.setAttribute('aria-label', `返回${record.title}详情`);
      container.innerHTML = `<h3 class="experience-title">${words.title}</h3>
        <p class="experience-summary"></p>
        <div class="experience-controls">
          <button class="experience-quick cursor-interaction" type="button" data-experience-action="quick">${words.quick}</button>
          <button class="experience-important cursor-interaction" type="button" data-experience-action="important">${words.action}</button>
          <button class="experience-undo cursor-interaction" type="button" data-experience-action="undo"
            aria-label="${words.undo}" title="${words.undo}"><span aria-hidden="true">↶</span></button>
        </div>
        <p class="experience-status" role="status"></p>
        <p class="experience-error" role="alert" hidden></p>
        <ol class="experience-events"></ol>`;
      updateTimeline(expanded, message);
      container.querySelector(focus)?.focus({ preventScroll: true });
    }

    function showEditor(item) {
      const date = item?.date ?? today();
      const approximate = !model.exact.test(date);
      const type = item?.type ?? (cooking ? importantType : quickType);
      editor = { item, id: item?.id ?? crypto.randomUUID(), expanded: openRows() };
      backButton.setAttribute('aria-label', `返回${words.title}`);
      container.innerHTML = `<form class="experience-form">
        <h3 class="experience-title">${item ? `编辑${words.note}` : words.action}</h3>
        <label class="field" data-experience-exact${approximate ? ' hidden' : ''}>日期
          <input name="date" type="date" value="${approximate ? today() : escape(date)}" required${approximate ? ' disabled' : ''}>
        </label>
        ${cooking ? '' : `<label class="experience-precision">
          <input type="checkbox" name="approximate"${approximate ? ' checked' : ''}>只记得大概日期
        </label>
        <label class="field" data-experience-approximate${approximate ? '' : ' hidden'}>大概日期
          <input type="text" name="date" maxlength="24" placeholder="例如 2022 年秋天" required
            value="${approximate ? escape(date) : ''}"${approximate ? '' : ' disabled'}>
        </label>
        <div class="field"><label for="m-app-experience-type">类型</label>
          <select id="m-app-experience-type" name="type">${model.kinds.people.map((option) =>
            `<option${option === type ? ' selected' : ''}>${option}</option>`).join('')}</select></div>`}
        <div class="field"><label for="m-app-experience-note">${cooking ? '心得' : '经历内容'}（选填）</label>
          <textarea id="m-app-experience-note" name="note" rows="4" maxlength="${model.noteLimit}">${escape(item?.note ?? '')}</textarea>
        </div>
        <p class="experience-error" role="alert" hidden></p>
        <button class="primary cursor-interaction" type="submit">保存</button>
      </form>`;
      container.querySelector('[name="date"]:enabled').focus({ preventScroll: true });
    }

    function back() {
      if (pending) return;
      if (!editor) {
        onBack(record);
        return;
      }
      const { item, expanded } = editor;
      showTimeline({ expanded, focus: item ? rowSelector(item.id) : '[data-experience-action="important"]' });
    }

    function showError(error) {
      const message = container.querySelector('[role="alert"]');
      message.textContent = error.message;
      message.hidden = false;
    }

    async function commit(next, after) {
      const controls = [...container.querySelectorAll('button:not(:disabled)')];
      pending = true;
      backButton.setAttribute('aria-disabled', 'true');
      for (const control of controls) control.setAttribute('aria-disabled', 'true');
      container.querySelector('[role="alert"]').hidden = true;
      try {
        record = await save(record, next);
      } catch (error) {
        showError(error);
        return;
      } finally {
        pending = false;
        backButton.removeAttribute('aria-disabled');
        for (const control of controls) control.removeAttribute('aria-disabled');
      }
      after();
    }

    container.addEventListener('click', (event) => {
      const button = event.target.closest('[data-experience-action]');
      if (!button || pending) return;
      const action = button.dataset.experienceAction;
      if (action === 'important' || action === 'edit') {
        const id = button.closest('details')?.dataset.experienceId;
        showEditor(entries().find((item) => item.id === id));
        return;
      }
      const expanded = openRows();
      if (action === 'quick') {
        const item = { id: crypto.randomUUID(), date: today(), type: quickType, note: '', quick: true };
        commit([...entries(), item], () => updateTimeline(expanded, words.added));
      } else if (action === 'undo') {
        const recent = lastQuick();
        if (!recent) return;
        commit(entries().filter((item) => item.id !== recent.id), () => updateTimeline(expanded, '已撤回最近一次快速记录'));
      }
    });

    container.addEventListener('change', (event) => {
      if (event.target.name !== 'approximate') return;
      const approximate = event.target.checked;
      const exact = container.querySelector('[data-experience-exact]');
      const estimate = container.querySelector('[data-experience-approximate]');
      exact.hidden = exact.querySelector('input').disabled = approximate;
      estimate.hidden = estimate.querySelector('input').disabled = !approximate;
    });

    container.addEventListener('submit', (event) => {
      event.preventDefault();
      if (pending || !editor) return;
      const fields = new FormData(event.target);
      const { item, id, expanded } = editor;
      let date;
      try {
        date = model.dateValue(fields.get('date'), kind);
      } catch (error) {
        showError(error);
        return;
      }
      const saved = { id, date, type: cooking ? item?.type ?? importantType : fields.get('type'), note: fields.get('note').trim(), quick: false };
      const next = item ? entries().map((existing) => existing.id === id ? saved : existing) : [...entries(), saved];
      commit(next, () => showTimeline({ expanded: [...expanded, id], focus: rowSelector(id), message: '经历已保存' }));
    });

    showTimeline();
    return { back };
  }

  globalThis.RecordExperienceView = { entry, mount };
})();
