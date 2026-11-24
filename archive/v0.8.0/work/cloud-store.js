(() => {
  function createStore(applyRemote) {
    const revisions = new Map();
    let loaded = false;
    let reading;
    let writing = false;

    async function request(path, method = 'GET', body) {
      let response;
      try {
        response = await fetch(path, {
          method, cache: 'no-store', redirect: 'error',
          ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        });
      } catch {
        throw new Error('无法连接云端。请检查网络后重试。');
      }
      if (response.status === 401) throw new Error('登录已过期。请保留当前输入，重新打开网站登录。');
      if (response.status === 409) throw new Error('数据已在另一台设备更新。请保留当前输入，关闭编辑后重新同步再试。');
      if (response.status === 413) throw new Error('数据超过单次同步大小限制。');
      if (!response.ok) throw new Error('云端操作未完成，请稍后重试。');
      if (response.status === 204) return;
      return response.json();
    }

    function revision(scope) {
      return revisions.get(scope) ?? 0;
    }

    function refresh() {
      if (reading) return reading;
      if (writing) return Promise.reject(new Error('正在保存云端数据，请稍后再同步。'));
      reading = request('/api/data').then(({ scopes }) => {
        const changes = Object.fromEntries(Object.entries(scopes).filter(([scope, entry]) => entry.revision > revision(scope)));
        if (Object.keys(changes).length) applyRemote(changes);
        for (const [scope, entry] of Object.entries(changes)) revisions.set(scope, entry.revision);
        loaded = true;
      }).finally(() => { reading = undefined; });
      return reading;
    }

    async function write(payload, send) {
      if (writing) throw new Error('正在保存云端数据，请稍后再试。');
      if (reading) await reading;
      if (!loaded) throw new Error('云端记录还未读取，请先重试同步。');
      if (writing) throw new Error('正在保存云端数据，请稍后再试。');
      for (const [scope, entry] of Object.entries(payload)) {
        if (entry.revision !== revision(scope)) {
          throw new Error('数据已更新。请关闭编辑，查看最新记录后再试。');
        }
      }
      writing = true;
      try {
        const scopes = await send();
        for (const [scope, entry] of Object.entries(scopes)) revisions.set(scope, entry.revision);
        return scopes;
      } finally {
        writing = false;
      }
    }

    async function save(scope, data, expected = revision(scope)) {
      const entry = { revision: expected, data };
      await write({ [scope]: entry }, async () => ({
        [scope]: await request(`/api/data/${scope}`, 'PUT', entry)
      }));
    }

    function replace(data, expected) {
      const scopes = Object.fromEntries(Object.entries(data).map(([scope, value]) => [
        scope, { revision: expected[scope] ?? 0, data: value }
      ]));
      return write(scopes, async () => (await request('/api/data', 'PUT', { scopes })).scopes);
    }

    return {
      get loaded() { return loaded; },
      refresh, revision, save, replace,
      revisions: () => Object.fromEntries(revisions),
      logout: () => request('/api/auth/logout', 'POST', {})
    };
  }

  globalThis.MAppCloud = { createStore };
})();
