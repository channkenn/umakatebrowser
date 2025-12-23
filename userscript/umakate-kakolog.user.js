// ==UserScript==
// @name         umakate kakolog filter + logger (IndexedDB版 v2.1)
// @namespace    umakatebrowser
// @version      0.4.1
// @description  あにまん過去ログ専用フィルタ＆保存（IndexedDB対応、CSV入出力、保存一覧から直接インポート可能）
// @match        https://bbs.animanch.com/kakolog*
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  // ====================
  // 設定
  // ====================
  const DEFAULT_MIN_COUNT = 10;
  const AUTOSAVE_KEY = "umakate-kakolog-autosave";
  const DB_NAME = "umakateKakologDB";
  const STORE_NAME = "threads";

  // ====================
  // IndexedDB操作
  // ====================
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore(STORE_NAME, { keyPath: "url" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveThread(thread) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(thread);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async function saveAllThreads(threads) {
    for (const t of threads) await saveThread(t);
  }

  async function getAllThreads() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ====================
  // CSVインポート関数（グローバル登録）
  // ====================
  async function importCSV(text) {
    const lines = text.trim().split("\n");
    if (lines.length <= 1) {
      alert("CSVが空です");
      return;
    }
    const header = lines.shift().split(",");
    const idx = {
      savedAt: header.indexOf("savedAt"),
      title: header.indexOf("title"),
      url: header.indexOf("url"),
      fromPage: header.indexOf("fromPage"),
    };
    if (idx.url === -1) {
      alert("CSV形式が不正です");
      return;
    }

    const imported = lines.map((line) => {
      const cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
      return {
        savedAt: Date.parse(cols[idx.savedAt]) || Date.now(),
        title: cols[idx.title]?.replace(/^"|"$/g, "").replace(/""/g, '"'),
        url: cols[idx.url],
        fromPage: cols[idx.fromPage] || "",
      };
    });

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let added = 0;
    for (const t of imported) {
      const existing = await new Promise((res) => {
        const r = store.get(t.url);
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      });
      if (!existing) {
        store.put(t);
        added++;
      }
    }
    tx.oncomplete = () => {
      alert(added + " 件インポートしました（重複除外）");
    };
  }

  // グローバル登録
  window.umakateImportCSV = importCSV;

  // ====================
  // ページ上スレ取得
  // ====================
  function getThreadsFromPage() {
    return Array.from(
      document.querySelectorAll("#mainThread a.list-group-item")
    )
      .map((item) => {
        const title = item.querySelector(".title")?.textContent?.trim();
        const url = item.href;
        return title && url
          ? { title, url, fromPage: location.href, savedAt: Date.now() }
          : null;
      })
      .filter(Boolean);
  }

  // ====================
  // 表示制御
  // ====================
  function hide(item) {
    item.style.display = "none";
  }
  function showAll() {
    document
      .querySelectorAll("#mainThread a.list-group-item")
      .forEach((i) => (i.style.display = ""));
  }
  function filterByCount(min) {
    document
      .querySelectorAll("#mainThread a.list-group-item")
      .forEach((item) => {
        const count = Number(
          item.querySelector(".threadCount")?.textContent ?? 0
        );
        if (count < min) hide(item);
      });
  }

  // ====================
  // 保存一覧画面
  // ====================
  async function openSavedList() {
    const allData = await getAllThreads();
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <title>umakate kakolog 保存検索</title>
      <style>
        body { font-family: sans-serif; padding: 10px; }
        input { width: 300px; }
        button { margin-left: 4px; }
        li { margin-bottom: 6px; }
        small { color: #666; }
      </style>
      <h1>保存済みスレ検索</h1>
      <div>保存済み総件数: <span id="total">${allData.length}</span></div>
      <input id="q" placeholder="キーワード（タイトル検索）">
      <button id="search">検索</button>
      <button id="export">CSVエクスポート</button>
      <input type="file" id="file" style="display:none;">
      <button id="import">CSVインポート</button>
      <p>検索結果件数: <span id="hit">0</span></p>
      <ul id="result"></ul>

      <script>
        const q = document.getElementById('q');
        const btn = document.getElementById('search');
        const exp = document.getElementById('export');
        const imp = document.getElementById('import');
        const file = document.getElementById('file');
        const result = document.getElementById('result');
        const totalElem = document.getElementById('total');
        const hitElem = document.getElementById('hit');

        const allData = ${JSON.stringify(allData)};

        btn.onclick = () => {
          const word = q.value.trim();
          result.innerHTML = '';
          if (!word) { hitElem.textContent = 0; return; }
          const hits = allData.filter(e => e.title.includes(word) || e.url.includes(word));
          hitElem.textContent = hits.length;
          const frag = document.createDocumentFragment();
          hits.forEach(e => {
            const li = document.createElement('li');
            li.innerHTML = '<a href="' + e.url + '" target="_blank">' + e.title + '</a><br><small>' + new Date(e.savedAt).toLocaleString() + '</small>';
            frag.appendChild(li);
          });
          result.appendChild(frag);
        };

        exp.onclick = () => {
          const header = ['savedAt','title','url','fromPage'];
          const rows = allData.map(e => [
            new Date(e.savedAt).toISOString(),
            '"' + e.title.replace(/"/g, '""') + '"',
            e.url,
            e.fromPage
          ]);
          const csv = header.join(',') + '\\n' + rows.map(r => r.join(',')).join('\\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'umakate_kakolog.csv';
          a.click();
          URL.revokeObjectURL(url);
        };

        imp.onclick = () => file.click();
        file.onchange = () => {
          if (!file.files[0]) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (window.opener && window.opener.umakateImportCSV) {
              window.opener.umakateImportCSV(reader.result).then(() => location.reload());
            } else { alert('インポート関数が見つかりません'); }
          };
          reader.readAsText(file.files[0], 'utf-8');
        };
      </script>
    `);
  }

  // ====================
  // UI
  // ====================
  function createUI() {
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.bottom = "12px";
    box.style.right = "12px";
    box.style.background = "#fff";
    box.style.border = "1px solid #aaa";
    box.style.padding = "6px";
    box.style.fontSize = "12px";
    box.style.zIndex = "9999";

    const title = document.createElement("div");
    title.textContent = "過去ログ操作";

    const input = document.createElement("input");
    input.type = "number";
    input.value = DEFAULT_MIN_COUNT;
    input.style.width = "70px";

    const apply = document.createElement("button");
    apply.textContent = "レス数適用";
    apply.onclick = () => {
      showAll();
      filterByCount(Number(input.value));
    };

    const reset = document.createElement("button");
    reset.textContent = "全表示";
    reset.style.marginLeft = "4px";
    reset.onclick = showAll;

    const autoSave = document.createElement("input");
    autoSave.type = "checkbox";
    autoSave.checked = localStorage.getItem(AUTOSAVE_KEY) !== "off";
    autoSave.onchange = () => {
      localStorage.setItem(AUTOSAVE_KEY, autoSave.checked ? "on" : "off");
    };

    const autoLabel = document.createElement("label");
    autoLabel.style.display = "block";
    autoLabel.append(autoSave, " 自動保存");

    const listBtn = document.createElement("button");
    listBtn.textContent = "保存一覧";
    listBtn.style.display = "block";
    listBtn.style.marginTop = "4px";
    listBtn.onclick = openSavedList;

    box.append(title, input, apply, reset, autoLabel, listBtn);
    document.body.appendChild(box);
  }

  // ====================
  // 初期化
  // ====================
  async function init() {
    if (!document.querySelector("#mainThread")) return;

    createUI();

    if (localStorage.getItem(AUTOSAVE_KEY) !== "off") {
      const threads = getThreadsFromPage();
      await saveAllThreads(threads);
    }
  }

  init();
})();
