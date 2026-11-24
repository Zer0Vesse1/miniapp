(() => {
  const model = globalThis.PeopleCards;
  const { fields, limits } = model;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function avatarMarkup(avatar, title) {
    return avatar ? `<span class="person-avatar" aria-hidden="true"><img src="${escape(avatar)}" alt=""></span>`
      : `<span class="person-avatar person-avatar-fallback" aria-hidden="true">${escape(model.initial(title))}</span>`;
  }

  function detailRow(label, content, kind = '') {
    return content ? `<div class="person-row"><dt>${escape(label)}</dt><dd class="${kind}">${content}</dd></div>` : '';
  }

  function section(rows) {
    const content = rows.join('');
    return content ? `<dl class="person-group">${content}</dl>` : '';
  }

  function contactDetail({ label, value }) {
    const text = escape(value);
    if (/^[+\d][\d ().-]{3,28}$/.test(value)) {
      return detailRow(label, `<a href="tel:${value.replace(/[ ().-]/g, '')}">${text}</a>`);
    }
    if (/^[A-Z0-9.!$'_*+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
      return detailRow(label, `<a href="mailto:${text}">${text}</a>`);
    }
    return detailRow(label, text);
  }

  function textField(label, name, value, limit, required = false) {
    return `<label class="person-input-row"><span>${escape(label)}</span>
      <input name="${name}" value="${escape(value)}" maxlength="${limit}"${required ? ' required' : ''}></label>`;
  }

  function birthdayForm({ year, month, day }) {
    return `<fieldset class="person-birthday"><legend>生日</legend>
      <div class="person-birthday-fields">
        <label><span>年（选填）</span><input type="number" name="birth-year" inputmode="numeric" min="1" max="${new Date().getFullYear()}" value="${escape(year)}"></label>
        <label><span>月</span><input type="number" name="birth-month" inputmode="numeric" min="1" max="12" value="${escape(month)}"></label>
        <label><span>日</span><input type="number" name="birth-day" inputmode="numeric" min="1" max="31" value="${escape(day)}"></label>
      </div></fieldset>`;
  }

  function ageForm(manualAge) {
    return `<div class="person-input-row">
      <span>年龄</span>
      <input name="manual-age" aria-label="年龄" type="number" min="0" max="${limits.age}" step="1"
        inputmode="numeric" placeholder="可选填" value="${escape(manualAge)}">
      <output class="person-age-output" aria-label="按生日计算的年龄" hidden></output>
    </div>`;
  }

  function checkbox(name, value, label, checked) {
    return `<label class="person-check"><input type="checkbox" name="${name}" value="${escape(value)}"${checked ? ' checked' : ''}>
      <span>${escape(label)}</span></label>`;
  }

  function contactRow({ label = '', value = '' } = {}) {
    return `<div class="person-contact-row">
      <input name="contact-label" aria-label="联系方式类型" list="m-app-contact-labels" placeholder="类型" maxlength="${limits.label}" value="${escape(label)}">
      <input name="contact-value" aria-label="联系方式内容" placeholder="联系方式" maxlength="${limits.value}" value="${escape(value)}">
      <button class="person-row-remove cursor-interaction" type="button" data-person-remove-row aria-label="移除此联系方式">−</button>
    </div>`;
  }

  async function prepareAvatar(file) {
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
      throw new Error('请选择小于 20 MB 的图片。');
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      if (!size) throw new Error();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.min(size, 256);
      const context = canvas.getContext('2d');
      context.fillStyle = '#f0eef8';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size,
        0, 0, canvas.width, canvas.height);
      const avatar = canvas.toDataURL('image/jpeg', 0.82);
      if (avatar.length > limits.avatar) throw new Error();
      return avatar;
    } catch {
      throw new Error('无法读取这张图片，请试试 JPG 或 PNG。');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function settingRow(kind, { id = '', label = '', visible = true, previous = '' } = {}) {
    const custom = kind === 'custom';
    return `<div class="person-setting-row" data-person-setting-row="${kind}" data-id="${escape(id)}" data-previous="${escape(previous)}">
      ${custom ? checkbox('custom-visible', id, '显示', visible) : ''}
      <input aria-label="${custom ? '自定义属性名称' : '关系名称'}" placeholder="${custom ? '例如 常去的球场' : '例如 邻居'}"
        type="text" name="${kind}-label" maxlength="${limits.label}" value="${escape(label)}" required>
      ${custom ? '<button class="person-inline-button person-archive-button cursor-interaction" type="button" data-person-archive-field>移除</button>'
        : '<button class="person-row-remove cursor-interaction" type="button" data-person-remove-row aria-label="移除此关系选项">−</button>'}
    </div>`;
  }

  function setError(form, message = '') {
    const error = form.querySelector('.person-form-error');
    error.textContent = message;
    error.hidden = !message;
    if (message) {
      error.tabIndex = -1;
      error.focus();
    }
  }

  function appendRow(list, markup, input) {
    list.insertAdjacentHTML('beforeend', markup);
    list.lastElementChild.querySelector(input).focus();
  }

  function removeRow(button, fallback) {
    const row = button.parentElement;
    const next = row.nextElementSibling ?? row.previousElementSibling;
    row.remove();
    (next?.querySelector('input[type="text"], input[name="contact-label"]') ?? fallback).focus();
  }

  function create({ setSheet, sheetContent, sheetBack, closeSheet, showNotice, savePerson, savePeopleSettings,
    saveExperiences, icon, findRecord, getSettings, isOpen }) {
    const drafts = new Map();
    const experienceView = globalThis.RecordExperienceView;

    function showDetails(record, trigger, focusMore = false) {
      const person = model.personFor(record);
      const settings = getSettings();
      const has = (key) => settings.fields.includes(key);
      const years = has('birthday') ? (model.age(person.birthday) ?? person.manualAge) : null;
      const tags = person.relationships.length
        ? `<span class="person-tags">${person.relationships.map((value) => `<span class="person-tag">${escape(value)}</span>`).join('')}</span>` : '';
      const groups = [
        section([
          has('birthday') ? detailRow('生日', escape(model.birthdayLabel(person.birthday))) : '',
          years !== null ? detailRow('年龄', `${years} 岁`) : '',
          has('location') ? detailRow('所在地', escape(person.location)) : '',
          has('relationships') ? detailRow('关系', tags) : '',
        ]),
        has('contacts') ? section(person.contacts.map(contactDetail)) : '',
        section(settings.custom.filter((field) => field.visible && !field.archived)
          .map(({ id, label }) => detailRow(label, escape(person.custom[id])))),
        has('notes') ? section([detailRow('备注', escape(person.notes), 'person-notes')]) : ''
      ].join('');
      if (!setSheet('人物卡片', `<article class="person-card">
        <header class="person-hero">
          ${has('avatar') ? avatarMarkup(person.avatar, record.title) : ''}
          <h3 class="person-name">${escape(record.title)}</h3>
          ${has('nickname') && person.nickname ? `<p class="person-nickname">${escape(person.nickname)}</p>` : ''}
        </header>
        ${experienceView.entry('people')}
        <div class="person-groups">${groups || '<p class="person-empty">打开编辑可补充人物资料。</p>'}</div>
      </article>`, trigger, { record, onBack: closeSheet, onEdit: () => showEditor(record), focusMore })) return;
      sheetContent.querySelector('[data-open-experiences]').onclick = () => showExperiences(record);
    }

    function showExperiences(record) {
      let screen;
      if (!setSheet(record.title, '<section class="experience-page" data-experience-page></section>', undefined, {
        onBack: () => screen.back(), backLabel: `返回${record.title}详情`
      })) return;
      screen = experienceView.mount(sheetContent.querySelector('[data-experience-page]'), record, {
        save: saveExperiences,
        backButton: sheetBack,
        onBack: (latest) => {
          showDetails(latest);
          sheetContent.querySelector('[data-open-experiences]')?.focus({ preventScroll: true });
        }
      });
    }

    function showEditor(record, trigger) {
      const key = record?.id ?? 'new';
      const person = model.personFor(record);
      const source = record ? JSON.stringify([record.title, record.time, person]) : '';
      const remembered = drafts.get(key);
      const draft = remembered?.source === source ? remembered.values
        : { ...person, title: record?.title ?? '', birth: model.birthdayParts(person.birthday) };
      if (remembered && remembered.source !== source) drafts.delete(key);
      const settings = getSettings();
      const has = (field) => settings.fields.includes(field);
      const relationships = [...new Set([...settings.relationships, ...draft.relationships])];
      const customFields = settings.custom.filter((field) => field.visible && !field.archived);
      let saving = false;
      const goBack = () => {
        if (saving) return;
        const current = record && findRecord(record.id);
        if (current) showDetails(current, undefined, true);
        else closeSheet();
      };
      if (!setSheet(record ? '编辑人物卡片' : '新增人物卡片', `<form class="person-form">
        ${has('avatar') ? `<div class="person-hero">
          <div data-person-avatar-preview>${avatarMarkup(draft.avatar, draft.title)}</div>
          <div class="person-avatar-actions">
            <button type="button" class="person-inline-button cursor-interaction" data-person-pick>选择头像</button>
            <button type="button" class="person-inline-button cursor-interaction" data-person-clear${draft.avatar ? '' : ' hidden'}>移除头像</button>
            <input type="file" accept="image/*" class="person-avatar-input" aria-label="选择头像文件" hidden>
          </div>
        </div>` : ''}
        <div class="person-group">
          ${textField('姓名', 'title', draft.title, limits.title, true)}
          ${has('nickname') ? textField('昵称／称呼', 'nickname', draft.nickname, limits.name) : ''}
          ${has('birthday') ? birthdayForm(draft.birth) + ageForm(draft.manualAge) : ''}
          ${has('location') ? textField('所在地', 'location', draft.location, limits.name) : ''}
        </div>
        ${has('relationships') ? `<fieldset class="person-group person-field-toggles">
          <legend>关系（可多选）</legend>
          ${relationships.length ? relationships.map((label) => checkbox('relationship', label, label, draft.relationships.includes(label))).join('')
            : '<p class="person-empty">可在人物卡片设置添加关系选项。</p>'}
        </fieldset>` : ''}
        ${has('contacts') ? `<fieldset class="person-group">
          <legend>联系方式</legend>
          <div class="person-contact-list">${draft.contacts.map(contactRow).join('')}</div>
          <datalist id="m-app-contact-labels"><option value="手机"><option value="微信"><option value="邮箱"><option value="其他"></datalist>
          <button class="person-inline-button cursor-interaction" type="button" data-person-add-contact>${icon('plus')}添加联系方式</button>
        </fieldset>` : ''}
        ${customFields.length ? `<div class="person-group">${customFields.map(({ id, label }) => textField(label, `custom-${id}`, draft.custom[id], limits.value)).join('')}</div>` : ''}
        ${has('notes') ? `<label class="person-group person-input-row person-notes"><span>备注</span>
          <textarea name="notes" rows="4" maxlength="${limits.notes}">${escape(draft.notes)}</textarea></label>` : ''}
        <p class="person-form-error" role="alert" hidden></p>
        <div class="person-form-actions">
          <button class="primary cursor-interaction" type="submit">保存</button>
          <button class="secondary cursor-interaction" type="button" data-person-cancel>取消</button>
        </div>
      </form>`, trigger, { onBack: goBack, backLabel: record ? '返回人物详情' : undefined })) return;

      const form = sheetContent.querySelector('.person-form');
      const title = form.elements.title;
      const submit = form.querySelector('[type="submit"]');
      const addContact = form.querySelector('[data-person-add-contact]');
      const contactList = form.querySelector('.person-contact-list');
      const photo = form.querySelector('.person-avatar-input');
      const pickPhoto = form.querySelector('[data-person-pick]');
      const clearPhoto = form.querySelector('[data-person-clear]');
      const birthFields = form.querySelector('.person-birthday');
      const ageInput = form.elements['manual-age'];
      const ageOutput = form.querySelector('.person-age-output');
      let avatar = draft.avatar;
      let photoLoading = false;
      const active = () => form.isConnected && isOpen();

      function readBirth() {
        return {
          year: form.elements['birth-year'].value,
          month: form.elements['birth-month'].value,
          day: form.elements['birth-day'].value
        };
      }

      function updateAge() {
        const { year, month, day } = readBirth();
        const calculated = model.age(model.birthdayValue(year, month, day));
        ageInput.hidden = ageInput.disabled = calculated !== null;
        ageOutput.hidden = calculated === null;
        ageOutput.textContent = calculated === null ? '' : `${calculated} 岁（按生日计算）`;
      }

      function capture() {
        const values = new FormData(form);
        const contactLabels = values.getAll('contact-label');
        return {
          title: title.value,
          avatar,
          nickname: values.get('nickname') ?? draft.nickname,
          birth: birthFields ? readBirth() : draft.birth,
          manualAge: ageInput?.value ?? draft.manualAge,
          location: values.get('location') ?? draft.location,
          relationships: has('relationships') ? values.getAll('relationship') : draft.relationships,
          contacts: has('contacts') ? values.getAll('contact-value').map((value, index) => ({ label: contactLabels[index], value })) : draft.contacts,
          notes: values.get('notes') ?? draft.notes,
          custom: { ...draft.custom, ...Object.fromEntries(customFields.map(({ id }) => [id, values.get(`custom-${id}`)])) }
        };
      }

      function updateAvatar() {
        if (!photo) return;
        form.querySelector('[data-person-avatar-preview]').innerHTML = avatarMarkup(avatar, title.value);
        clearPhoto.hidden = !avatar;
      }

      function remember() {
        drafts.set(key, { source, values: capture() });
      }

      if (birthFields) {
        updateAge();
        birthFields.addEventListener('input', updateAge);
      }

      form.addEventListener('input', (event) => {
        title.setCustomValidity('');
        form.elements['birth-day']?.setCustomValidity('');
        remember();
        if (!avatar && event.target === title) updateAvatar();
      });

      form.querySelector('[data-person-cancel]').addEventListener('click', () => {
        if (saving) return;
        drafts.delete(key);
        goBack();
      });

      addContact?.addEventListener('click', () => {
        if (contactList.children.length >= limits.contacts) return setError(form, `最多可以填写 ${limits.contacts} 条联系方式。`);
        appendRow(contactList, contactRow(), 'input');
        remember();
        setError(form);
      });
      contactList?.addEventListener('click', (event) => {
        const remove = event.target.closest('[data-person-remove-row]');
        if (!remove) return;
        removeRow(remove, addContact);
        remember();
        setError(form);
      });

      pickPhoto?.addEventListener('click', () => photo.click());
      clearPhoto?.addEventListener('click', () => {
        avatar = '';
        updateAvatar();
        remember();
        pickPhoto.focus();
      });
      photo?.addEventListener('change', async () => {
        const file = photo.files[0];
        if (!file) return;
        photoLoading = true;
        submit.disabled = pickPhoto.disabled = clearPhoto.disabled = true;
        setError(form);
        try {
          const prepared = await prepareAvatar(file);
          if (!active()) return;
          avatar = prepared;
          updateAvatar();
          remember();
        } catch (error) {
          if (active()) setError(form, error.message);
        } finally {
          photoLoading = false;
          photo.value = '';
          submit.disabled = pickPhoto.disabled = clearPhoto.disabled = false;
        }
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (saving || photoLoading) return;
        title.value = title.value.trim();
        if (!form.reportValidity()) return;
        const { title: name, birth, manualAge, ...values } = capture();
        const birthday = has('birthday') ? model.birthdayValue(birth.year, birth.month, birth.day) : person.birthday;
        if (birthday === null) {
          form.elements['birth-day'].setCustomValidity('请输入有效的生日。年份可留空。');
          form.elements['birth-day'].reportValidity();
          return;
        }
        if (values.relationships.length > limits.relationships) {
          return setError(form, `最多可以选择 ${limits.relationships} 项关系。`);
        }
        values.contacts = values.contacts.filter(({ value }) => value.trim()).map(({ label, value }) => ({
          label: label.trim() || '联系方式', value
        }));
        setError(form);
        saving = submit.disabled = true;
        try {
          const enteredAge = manualAge === '' || manualAge === null ? null : Number(manualAge);
          const saved = await savePerson(name, model.normalizePerson({ ...values, birthday, manualAge: enteredAge }), record);
          drafts.delete(key);
          if (active()) showDetails(saved, undefined, Boolean(record));
          showNotice('人物卡片已保存');
        } catch (error) {
          if (active()) setError(form, error.message);
          else showNotice(error.message);
        } finally {
          saving = submit.disabled = false;
        }
      });
    }

    function mountSettings(container) {
      const settings = getSettings();
      container.innerHTML = `<form class="person-settings">
        <fieldset class="person-group person-field-toggles"><legend>显示的属性</legend>
          ${fields.map(([key, label]) => checkbox('field', key, label, settings.fields.includes(key))).join('')}
        </fieldset>
        <fieldset class="person-group">
          <legend>自定义属性</legend>
          <div class="person-settings-list" data-person-settings-list="custom">
            ${settings.custom.filter(({ archived }) => !archived).map((field) => settingRow('custom', field)).join('')}
          </div>
          <button class="person-inline-button cursor-interaction" type="button" data-person-add-setting="custom">${icon('plus')}添加属性</button>
          <details class="person-custom-archive" hidden>
            <summary>已移除的属性</summary>
            <p class="person-empty">恢复属性时也会找回已填内容。</p>
            <div class="person-settings-list" data-person-settings-list="archived"></div>
          </details>
        </fieldset>
        <fieldset class="person-group">
          <legend>关系选项</legend>
          <div class="person-settings-list" data-person-settings-list="relation">
            ${settings.relationships.map((label) => settingRow('relation', { label, previous: label })).join('')}
          </div>
          <button class="person-inline-button cursor-interaction" type="button" data-person-add-setting="relation">${icon('plus')}添加关系</button>
        </fieldset>
        <p class="person-form-error" role="alert" hidden></p>
        <button class="primary cursor-interaction" type="submit">保存人物属性设置</button>
      </form>`;
      const form = container.querySelector('form');
      const submit = form.querySelector('[type="submit"]');
      const settingsList = (kind) => form.querySelector(`[data-person-settings-list="${kind}"]`);
      const customList = settingsList('custom');
      const archiveList = settingsList('archived');
      const archive = archiveList.closest('details');
      const addCustom = form.querySelector('[data-person-add-setting="custom"]');
      const archivedFields = new Map(settings.custom.filter(({ archived }) => archived).map((field) => [field.id, field]));
      let base = settings;

      function renderArchive() {
        archive.hidden = !archivedFields.size;
        archiveList.innerHTML = [...archivedFields.values()].map(({ id, label }) => `<div class="person-setting-row">
          <span class="person-archived-label">${escape(label)}</span>
          <button class="person-inline-button cursor-interaction" type="button" data-person-restore-field="${escape(id)}">恢复</button>
        </div>`).join('');
      }

      customList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-person-archive-field]');
        if (!button) return;
        const { id } = button.parentElement.dataset;
        const saved = base.custom.find((field) => field.id === id);
        if (saved) archivedFields.set(id, { ...saved, archived: true });
        removeRow(button, addCustom);
        renderArchive();
        setError(form);
      });

      archiveList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-person-restore-field]');
        if (!button) return;
        if (customList.children.length >= limits.custom) {
          return setError(form, `最多可使用 ${limits.custom} 个自定义属性。`);
        }
        const field = archivedFields.get(button.dataset.personRestoreField);
        archivedFields.delete(field.id);
        renderArchive();
        appendRow(customList, settingRow('custom', { ...field, visible: true }), 'input[type="text"]');
        setError(form);
      });
      renderArchive();

      form.addEventListener('click', (event) => {
        const add = event.target.closest('[data-person-add-setting]');
        const remove = event.target.closest('[data-person-remove-row]');
        if (add) {
          const kind = add.dataset.personAddSetting;
          const list = settingsList(kind);
          const cap = kind === 'custom' ? limits.custom : limits.relationships;
          if (list.children.length >= cap) return setError(form, `最多可以添加 ${cap} 项。`);
          if (kind === 'custom' && list.children.length + archivedFields.size >= limits.customTotal) {
            return setError(form, '自定义属性已达上限，可以恢复并重命名已移除的属性。');
          }
          const id = kind === 'custom' ? `field-${crypto.randomUUID()}` : '';
          appendRow(list, settingRow(kind, { id }), 'input[type="text"]');
        } else if (remove) {
          const kind = remove.parentElement.dataset.personSettingRow;
          removeRow(remove, form.querySelector(`[data-person-add-setting="${kind}"]`));
        } else return;
        setError(form);
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submit.disabled) return;
        const values = new FormData(form);
        const custom = [...customList.children].map((row) => ({
          id: row.dataset.id,
          label: row.querySelector('[name="custom-label"]').value.trim(),
          visible: row.querySelector('[name="custom-visible"]').checked
        }));
        const relations = [...settingsList('relation').children].map((row) => ({
          label: row.querySelector('[name="relation-label"]').value.trim(),
          previous: row.dataset.previous
        }));
        const builtInLabels = new Set(['姓名', ...fields.map(([, label]) => label)]);
        const hasDuplicates = (labels) => new Set(labels.map((label) => label.toLocaleLowerCase())).size !== labels.length;
        const labels = custom.map(({ label }) => label);
        const relationships = relations.map(({ label }) => label);
        const archived = [...archivedFields.values()];
        const archivedLabels = new Set(archived.map(({ label }) => label.toLocaleLowerCase()));
        if ([...labels, ...relationships].some((label) => !label)) return setError(form, '请输入属性和关系的名称。');
        if (hasDuplicates(labels) || labels.some((label) => builtInLabels.has(label))) return setError(form, '请为自定义属性使用不同的名称。');
        if (labels.some((label) => archivedLabels.has(label.toLocaleLowerCase()))) {
          return setError(form, '该名称已用于已移除的属性。可以恢复原属性，或给新属性换个名称。');
        }
        if (hasDuplicates(relationships)) return setError(form, '请为关系选项使用不同的名称。');

        setError(form);
        submit.disabled = true;
        for (const group of form.querySelectorAll('fieldset')) group.disabled = true;
        try {
          const renames = new Map(relations.filter(({ previous, label }) => previous && previous !== label)
            .map(({ previous, label }) => [previous, label]));
          base = await savePeopleSettings({
            fields: values.getAll('field'), relationships, custom: [...custom, ...archived]
          }, base, renames);
          [...settingsList('relation').children].forEach((row, index) => { row.dataset.previous = relationships[index]; });
          showNotice('人物属性设置已保存');
        } catch (error) {
          setError(form, error.message);
        } finally {
          for (const group of form.querySelectorAll('fieldset')) group.disabled = false;
          submit.disabled = false;
          if (form.isConnected && document.activeElement === document.body) submit.focus({ preventScroll: true });
        }
      });
    }

    return { showDetails, showEditor, mountSettings, clearDrafts: () => drafts.clear() };
  }

  globalThis.PeopleCardView = { create };
})();
