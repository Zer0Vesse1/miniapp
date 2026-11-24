(() => {
  const storeName = 'recipes';

  function createStore(initialRecords) {
    const ready = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error('当前环境无法打开菜谱存储，请使用支持浏览器存储的页面。'));
        return;
      }
      const request = indexedDB.open('m-app-cooking', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(storeName, { keyPath: 'record.id' });
        initialRecords.forEach((record, index) => store.put({ record, order: initialRecords.length - index }));
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(new Error('浏览器未能打开菜谱存储，请检查存储设置。'));
    });

    async function run(mode, apply) {
      const db = await ready;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result;
        let failure;
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(failure ?? new Error('浏览器未能完成菜谱读写，请检查存储设置或可用空间。'));
        const request = store.getAll();
        request.onsuccess = () => {
          try {
            const rows = request.result.sort((left, right) => right.order - left.order);
            result = apply(store, rows);
          } catch (error) {
            failure = error;
            transaction.abort();
          }
        };
      });
    }

    function read() {
      return run('readonly', (_, rows) => rows.map(({ record }) => record));
    }

    function save(record, previous) {
      return run('readwrite', (store, rows) => {
        if (!previous) {
          store.add({ record, order: (rows[0]?.order ?? 0) + 1 });
          return [record, ...rows.map((row) => row.record)];
        }

        const index = rows.findIndex((row) => row.record.id === previous.id);
        if (index < 0 || JSON.stringify(rows[index].record) !== JSON.stringify(previous)) {
          throw new Error('这份菜谱已在另一个页面被修改或移除。请保留当前编辑内容，重新打开菜谱后再保存。');
        }
        rows[index] = { record, order: rows[index].order };
        store.put(rows[index]);
        return rows.map((row) => row.record);
      });
    }

    function remove(previous) {
      return run('readwrite', (store, rows) => {
        const index = rows.findIndex((row) => row.record.id === previous?.id);
        if (index < 0 || JSON.stringify(rows[index].record) !== JSON.stringify(previous)) {
          throw new Error('这份菜谱已在另一个页面被修改或移除。请重新打开菜谱后再删除。');
        }
        store.delete(previous.id);
        rows.splice(index, 1);
        return rows.map((row) => row.record);
      });
    }

    function replace(records, expectedRecords) {
      return run('readwrite', (store, rows) => {
        if (JSON.stringify(rows.map(({ record }) => record)) !== JSON.stringify(expectedRecords)) {
          throw new Error('其他页面更新了菜谱。请重新检查备份后再确认导入。');
        }
        store.clear();
        records.forEach((record, index) => store.add({ record, order: records.length - index }));
      });
    }

    return { read, save, remove, replace };
  }

  globalThis.CookingStore = { createStore };
})();
