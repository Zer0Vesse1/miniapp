(() => {
  const MIN_SERVINGS = 1;
  const MAX_SERVINGS = 99;
  const MAX_ROWS = 100;
  const DEMO_IMAGE = 'demo:scallion-noodles';
  const DEMO_RECIPE = {
    servings: 2,
    coverImage: DEMO_IMAGE,
    ingredients: [
      { name: '细面条', quantity: '200', unit: '克' },
      { name: '小葱', quantity: '60', unit: '克' },
      { name: '食用油', quantity: '3', unit: '汤匙' },
      { name: '生抽', quantity: '2', unit: '汤匙' },
      { name: '老抽', quantity: '1/2', unit: '汤匙' },
      { name: '白糖', quantity: '1', unit: '茶匙' },
      { name: '煮面用水', quantity: '适量', unit: '' },
    ],
    steps: [
      { heat: '无需加热', text: '小葱洗净擦干，切成约 5 厘米的长段，葱白和葱绿分开。把生抽、老抽和白糖调匀。', image: '' },
      { heat: '小火', text: '锅里倒入油，先放葱白慢炸。葱白边缘变黄时加入葱绿，继续炸到葱段干脆、呈深金黄色，捞出葱段。', image: '' },
      { heat: '关火，利用余温', text: '关火后让葱油稍微降温，再倒入调好的料汁，搅拌到白糖溶解。', image: '' },
      { heat: '大火煮沸', text: '另起一锅水，大火烧开后下面，按包装时间煮到喜欢的软硬程度。捞出沥干。', image: '' },
      { heat: '无需加热', text: '把面条趁热拌入葱油酱汁，先加一半，尝过再补。最后放上炸好的葱段。', image: DEMO_IMAGE },
    ],
    tips: '小葱擦干再下锅更不容易溅油。小火慢炸，葱段变成深金黄色即可捞出。'
  };

  function normalizeRecipe(value, { strict = false } = {}) {
    function invalid(label) {
      if (strict) throw new Error('菜谱中的' + label + '格式不正确。');
    }

    function object(value, label) {
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
      invalid(label);
      return {};
    }

    function text(value, label, limit, required = false) {
      if (value === undefined && !required) return '';
      if (typeof value === 'string' && value.length <= limit && (!required || value.trim())) return value.trim();
      invalid(label);
      return '';
    }

    function list(value, label) {
      if (Array.isArray(value) && value.length <= MAX_ROWS) return value;
      invalid(label);
      return [];
    }

    function image(value, label) {
      const url = text(value, label, 2048);
      if (!url || url === DEMO_IMAGE) return url;
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return url;
      } catch {
        // Invalid URLs are rejected below.
      }
      if (strict) throw new Error(label + '需要使用有效的 HTTPS 链接。');
      return '';
    }

    const recipe = object(value, '菜谱');
    const validServings = Number.isInteger(recipe.servings) && recipe.servings >= MIN_SERVINGS && recipe.servings <= MAX_SERVINGS;
    if (!validServings) invalid('原始份数');
    const ingredients = list(recipe.ingredients, '用料清单').map((value) => {
      const item = object(value, '用料');
      return {
        name: text(item.name, '食材', 60, true),
        quantity: text(item.quantity, '用量', 40),
        unit: text(item.unit, '单位', 20),
      };
    }).filter((item) => item.name);
    const steps = list(recipe.steps, '步骤清单').map((value) => {
      const step = object(value, '步骤');
      return {
        heat: text(step.heat, '火候', 60, true),
        text: text(step.text, '做法', 2000, true),
        image: image(step.image, '步骤图片'),
      };
    }).filter((step) => step.text);
    if (!steps.length) invalid('步骤清单');
    return {
      servings: validServings ? recipe.servings : 2,
      ingredients, steps,
      tips: text(recipe.tips, '小贴士', 2000),
      coverImage: image(recipe.coverImage, '成品图片'),
    };
  }

  function readRecipe(record) {
    if (record.recipe) return normalizeRecipe(record.recipe);
    return {
      servings: 2,
      ingredients: [],
      steps: record.detail?.trim() ? [{ text: record.detail, heat: '', image: '' }] : [],
      tips: '',
      coverImage: '',
    };
  }

  function parseQuantity(value) {
    const fraction = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(value);
    if (fraction && Number(fraction[3])) return Number(fraction[1] || 0) + Number(fraction[2]) / Number(fraction[3]);
    if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return Number(value);
    return NaN;
  }

  const quantityFormat = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 5, useGrouping: false });

  function formatIngredientAmount({ quantity, unit }, servings, baseServings) {
    const parts = quantity.normalize('NFKC').split(/\s*[-–—~至]\s*/);
    const amounts = parts.map(parseQuantity);
    const scaled = parts.length <= 2 && amounts.every(Number.isFinite) && servings !== baseServings
      ? amounts.map((amount) => quantityFormat.format(amount * servings / baseServings)).join('–')
      : quantity;
    return [scaled, unit].filter(Boolean).join(' ') || '—';
  }

  globalThis.CookingGuide = { MIN_SERVINGS, MAX_SERVINGS, MAX_ROWS, DEMO_RECIPE, normalizeRecipe, readRecipe, formatIngredientAmount };
})();
