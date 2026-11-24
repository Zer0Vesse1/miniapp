(() => {
  const kinds = {
    cooking: ['做了一次', '重要烹饪'],
    people: ['见面', '初识', '纪念日', '其他经历']
  };
  const noteLimit = 300;
  const exact = /^\d{4}-\d{2}-\d{2}$/;
  const approximate = /^([1-9]\d{3})\s*年(?:\s*(春天|夏天|秋天|冬天|(?:1[0-2]|[1-9])\s*月))?$/;

  function dateValue(input, kind) {
    const value = input.trim();
    if (exact.test(value)) {
      const date = new Date(value);
      if (value.slice(0, 4) !== '0000' && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) return value;
    }
    if (kind === 'people') {
      const parts = approximate.exec(value);
      if (parts) return parts[1] + ' 年' + (parts[2] ? parts[2].replace(/\s*月$/, ' 月') : '');
    }
    throw new Error(kind === 'people' ? '请输入日期，例如 2022 年秋天。' : '请选择有效的烹饪日期。');
  }

  function normalize(entries, kind) {
    const types = kinds[kind];
    if (!types || !Array.isArray(entries)) throw new Error('经历记录格式不正确。');
    const ids = new Set();
    return entries.map((entry) => {
      if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(entry.id) || ids.has(entry.id)
        || typeof entry.date !== 'string' || entry.date.length > 24 || !types.includes(entry.type)
        || typeof entry.note !== 'string' || entry.note.length > noteLimit || typeof entry.quick !== 'boolean'
        || (entry.quick && (entry.type !== types[0] || entry.note || !exact.test(entry.date)))) {
        throw new Error('经历记录格式不正确。');
      }
      ids.add(entry.id);
      const date = dateValue(entry.date, kind);
      return { id: entry.id, date, type: entry.type, note: entry.note, quick: entry.quick };
    });
  }

  function dateLabel(value, showYear = true) {
    if (!exact.test(value)) return value;
    const [year, month, day] = value.split('-').map(Number);
    return (showYear ? year + ' 年 ' : '') + month + ' 月 ' + day + ' 日';
  }

  function sortKey(date) {
    if (exact.test(date)) return date;
    const parts = approximate.exec(date);
    if (!parts) return '';
    const season = { 春天: '03', 夏天: '06', 秋天: '09', 冬天: '12' };
    const detail = parts[2] || '';
    const month = season[detail] ?? String(parseInt(detail, 10) || 0).padStart(2, '0');
    return parts[1] + '-' + month + '-00';
  }

  globalThis.RecordExperiences = { kinds, exact, noteLimit, dateValue, normalize, dateLabel, sortKey };
})();
