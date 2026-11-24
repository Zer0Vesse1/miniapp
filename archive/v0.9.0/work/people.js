(() => {
  const storageKey = 'm-app-people-v1';
  const limits = {
    title: 30, name: 80, label: 30, value: 180, notes: 1000, relationships: 40,
    contacts: 20, custom: 32, customTotal: 256, avatar: 90000, id: 64, summary: 180, time: 32, age: 150
  };
  const fields = [
    ['avatar', '头像'], ['nickname', '昵称／称呼'], ['birthday', '生日和年龄'], ['location', '所在地'],
    ['relationships', '关系'], ['contacts', '联系方式'], ['notes', '备注']
  ];
  const fieldKeys = fields.map(([key]) => key);
  const defaultRelationships = ['家人', '朋友', '同学', '同事', '其他'];
  const recordIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
  const fieldIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

  function invalid(label, strict) {
    if (strict) throw new Error(`人物卡片的${label}格式不正确。`);
  }

  function objectValue(value, label, strict) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
    if (value !== undefined) invalid(label, strict);
    return {};
  }

  function textValue(value, maxLength, label, strict) {
    if (typeof value === 'string' && value.length <= maxLength) return value.trim();
    if (value !== undefined) invalid(label, strict);
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  }

  function listValue(value, maxLength, label, strict) {
    if (Array.isArray(value)) {
      if (value.length > maxLength) invalid(label, strict);
      return value.slice(0, maxLength);
    }
    if (value !== undefined) invalid(label, strict);
    return [];
  }

  function relationshipList(value, strict) {
    const labels = [];
    for (const item of listValue(value, limits.relationships, '关系列表', strict)) {
      const label = textValue(item, limits.label, '关系名称', strict);
      if (label && !labels.includes(label)) labels.push(label);
      else invalid('关系列表', strict);
    }
    return labels;
  }

  function validFieldId(id) {
    return typeof id === 'string' && fieldIdPattern.test(id) && !Object.hasOwn(Object.prototype, id);
  }

  function normalizeSettings(value, { strict = false } = {}) {
    const settings = objectValue(value, '设置', strict);
    const visible = settings.fields === undefined ? fieldKeys : listValue(settings.fields, fields.length, '内置属性设置', strict);
    if (visible.some((key) => !fieldKeys.includes(key)) || new Set(visible).size !== visible.length) {
      invalid('内置属性设置', strict);
    }

    const custom = [];
    const ids = new Set();
    let activeCount = 0;
    for (const item of listValue(settings.custom, limits.customTotal, '自定义属性设置', strict)) {
      const field = objectValue(item, '自定义属性', strict);
      const label = textValue(field.label, limits.label, '自定义属性名称', strict);
      if (!validFieldId(field.id) || !label || ids.has(field.id)) {
        invalid('自定义属性', strict);
        continue;
      }
      if (field.visible !== undefined && typeof field.visible !== 'boolean') invalid('自定义属性显示设置', strict);
      if (field.archived !== undefined && typeof field.archived !== 'boolean') invalid('自定义属性移除状态', strict);
      const archived = field.archived === true;
      if (!archived && activeCount >= limits.custom) {
        invalid('自定义属性数量', strict);
        continue;
      }
      if (!archived) activeCount++;
      ids.add(field.id);
      custom.push({ id: field.id, label, visible: field.visible !== false, ...(archived && { archived }) });
    }

    return {
      fields: fieldKeys.filter((key) => visible.includes(key)),
      relationships: settings.relationships === undefined ? [...defaultRelationships] : relationshipList(settings.relationships, strict),
      custom
    };
  }

  function birthdayValue(year = '', month = '', day = '', now = new Date()) {
    year = String(year).trim();
    month = String(month).trim();
    day = String(day).trim();
    if (!year && !month && !day) return '';
    if ((year && !/^\d{4}$/.test(year)) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;

    const birthYear = Number(year);
    const birthMonth = Number(month);
    const birthDay = Number(day);
    if (year && birthYear < 1) return null;
    const calendarYear = year ? birthYear : 2000;
    const leap = calendarYear % 4 === 0 && (calendarYear % 100 !== 0 || calendarYear % 400 === 0);
    const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (birthDay < 1 || birthDay > (daysInMonth[birthMonth - 1] ?? 0)) return null;

    const monthDay = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    if (!year) return `--${monthDay}`;
    const birthDate = `${year}-${monthDay}`;
    const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part, index) =>
      String(part).padStart(index === 0 ? 4 : 2, '0')).join('-');
    return birthDate <= today ? birthDate : null;
  }

  function birthdayParts(value) {
    const match = /^(?:(\d{4})-|--)(\d{2})-(\d{2})$/.exec(value);
    const [, year = '', month = '', day = ''] = match ?? [];
    return { year, month, day };
  }

  function birthdayLabel(value) {
    const { year, month, day } = birthdayParts(value);
    if (!month) return '';
    return `${year ? `${Number(year)}年` : ''}${Number(month)}月${Number(day)}日`;
  }

  function age(value, now = new Date()) {
    const { year, month, day } = birthdayParts(value);
    if (!year || birthdayValue(year, month, day, now) !== value) return null;
    const beforeBirthday = now.getMonth() + 1 < Number(month)
      || (now.getMonth() + 1 === Number(month) && now.getDate() < Number(day));
    const years = now.getFullYear() - Number(year) - Number(beforeBirthday);
    return years >= 0 ? years : null;
  }

  function normalizePerson(value, { strict = false } = {}) {
    const person = objectValue(value, '属性', strict);
    let avatar = textValue(person.avatar, limits.avatar, '头像', strict);
    if (avatar && (!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(avatar)
      || (avatar.length - 'data:image/jpeg;base64,'.length) % 4 !== 0)) {
      invalid('头像', strict);
      avatar = '';
    }
    let birthday = textValue(person.birthday, 10, '生日', strict);
    if (birthday) {
      const { year, month, day } = birthdayParts(birthday);
      if (birthdayValue(year, month, day) !== birthday) {
        invalid('生日', strict);
        birthday = '';
      }
    }
    const validManualAge = Number.isInteger(person.manualAge) && person.manualAge >= 0 && person.manualAge <= limits.age;
    if (person.manualAge != null && !validManualAge) invalid('年龄', strict);

    const contacts = [];
    for (const item of listValue(person.contacts, limits.contacts, '联系方式列表', strict)) {
      const contact = objectValue(item, '联系方式', strict);
      const label = textValue(contact.label, limits.label, '联系方式名称', strict);
      const value = textValue(contact.value, limits.value, '联系方式内容', strict);
      if (label && value) contacts.push({ label, value });
      else invalid('联系方式', strict);
    }

    const custom = [];
    const customEntries = Object.entries(objectValue(person.custom, '自定义属性', strict));
    for (const [id, rawValue] of listValue(customEntries, limits.customTotal, '自定义属性', strict)) {
      if (validFieldId(id)) {
        const value = textValue(rawValue, limits.value, '自定义属性内容', strict);
        if (value) custom.push([id, value]);
      } else invalid('自定义属性编号', strict);
    }

    return {
      avatar,
      nickname: textValue(person.nickname, limits.name, '昵称／称呼', strict),
      birthday,
      manualAge: validManualAge ? person.manualAge : null,
      location: textValue(person.location, limits.name, '所在地', strict),
      relationships: relationshipList(person.relationships, strict),
      contacts,
      notes: textValue(person.notes, limits.notes, '备注', strict),
      custom: Object.fromEntries(custom)
    };
  }

  function personFor(record) {
    return record?.person ? normalizePerson(record.person) : normalizePerson({ notes: record?.detail || record?.summary });
  }

  function initial(title) {
    return [...title.trim()][0] || '人';
  }

  function summary(person, settings) {
    const { fields: visible } = settings;
    const birthdayOrAge = birthdayLabel(person.birthday) || (person.manualAge === null ? '' : `${person.manualAge} 岁`);
    const values = [
      visible.includes('relationships') && person.relationships.join('、'),
      visible.includes('nickname') && person.nickname,
      visible.includes('location') && person.location,
      visible.includes('birthday') && birthdayOrAge
    ];
    return values.filter(Boolean).join(' · ').slice(0, limits.summary);
  }

  function readStore() {
    try {
      const raw = globalThis.localStorage.getItem(storageKey);
      if (!raw) return null;
      const { records, settings, sort } = JSON.parse(raw);
      if (!Array.isArray(records)) return null;
      const ids = new Set();
      const normalizedRecords = records.map((record) => {
        if (record?.kind !== 'people' || typeof record.id !== 'string' || !recordIdPattern.test(record.id)
          || ['parking', 'none'].includes(record.id) || ids.has(record.id)) invalid('记录编号', true);
        ids.add(record.id);
        const title = textValue(record.title, limits.title, '姓名', true);
        const time = textValue(record.time, limits.time, '时间', true);
        if (!title || !time) invalid('记录', true);
        const person = record.person === undefined ? personFor(record) : normalizePerson(record.person, { strict: true });
        return {
          id: record.id, kind: 'people', title, time, person,
          summary: textValue(record.summary, limits.summary, '摘要', true),
          detail: textValue(record.detail, limits.notes, '内容', true),
          ...(Object.hasOwn(record, 'experiences') && {
            experiences: globalThis.RecordExperiences.normalize(record.experiences, 'people')
          })
        };
      });
      return { records: normalizedRecords, settings: normalizeSettings(settings, { strict: true }), sort: sort === 'name' ? 'name' : 'recent' };
    } catch {
      return null;
    }
  }

  function writeStore(bundle) {
    globalThis.localStorage.setItem(storageKey, JSON.stringify(bundle));
  }

  function withStoreLock(callback) {
    const locks = globalThis.navigator?.locks;
    return locks ? locks.request(storageKey, callback) : Promise.resolve().then(callback);
  }

  globalThis.PeopleCards = {
    fields, limits, storageKey, normalizeSettings, normalizePerson, personFor, birthdayValue, birthdayParts,
    birthdayLabel, age, initial, summary, readStore, writeStore, withStoreLock
  };
})();
