// ==UserScript==
// @name         あにまん掲示板 快適化ツール (URLコピー機能付き)
// @match        https://bbs.animanch.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const DB_NAME = "umakateDB_v2";
  const HIDDEN_STORE = "hiddenThreads";
  const FAVORITE_STORE = "favoriteThreads";
  let db;

  function initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onupgradeneeded = (e) => {
        const database = req.result;
        if (!database.objectStoreNames.contains(HIDDEN_STORE))
          database.createObjectStore(HIDDEN_STORE, { keyPath: "id" });
        if (!database.objectStoreNames.contains(FAVORITE_STORE))
          database.createObjectStore(FAVORITE_STORE, { keyPath: "id" });
      };
    });
  }

  const dbOp = {
    getAll: (store) =>
      new Promise((res) => {
        const tx = db.transaction(store, "readonly");
        tx.objectStore(store).getAll().onsuccess = (e) => res(e.target.result);
      }),
    getOne: (store, id) =>
      new Promise((res) => {
        const tx = db.transaction(store, "readonly");
        tx.objectStore(store).get(id).onsuccess = (e) => res(e.target.result);
      }),
    put: (store, item) =>
      new Promise((res) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(item).onsuccess = () => res();
      }),
    del: (store, id) =>
      new Promise((res) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(id).onsuccess = () => res();
      }),
  };

  function cleanTitle(text) {
    return text
      .split("\n")[0]
      .replace(/☆ お気に入り|★ お気に入り中|非表示にして戻る/g, "")
      .trim();
  }

  // ====================
  // ログ保存（特定のリンクプレビューを簡略化）
  // ====================
  async function saveThreadLog(threadId) {
    const threadArea =
      document.querySelector("#res-list") ||
      document.querySelector(".thread") ||
      document.querySelector("article");
    if (!threadArea) return;

    const clone = threadArea.cloneNode(true);

    // 1. 指定された形式のリンクプレビューを簡略化
    // col-8 col-md-10 というクラスを持つ要素内の strong 以外を削除
    clone
      .querySelectorAll(".col-8.col-md-10.position-relative")
      .forEach((container) => {
        const strongTag = container.querySelector("strong");
        if (strongTag) {
          // strongの中身だけ残して、コンテナをそれだけに書き換える
          container.innerHTML = "<strong>" + strongTag.innerHTML + "</strong>";
        }
      });

    // 2. 画像の処理（前回までの仕様を維持）
    clone.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.dataset.src || "";
      img.src = src;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "10px 0 8px 0";
      img.removeAttribute("loading");
      img.removeAttribute("data-src");
    });

    const threadData = await dbOp.getOne(FAVORITE_STORE, threadId);
    if (threadData) {
      const newHtml = clone.innerHTML;
      if (threadData.htmlLog !== newHtml) {
        threadData.htmlLog = newHtml;
        threadData.lastUpdate = new Date().toLocaleString("ja-JP");
        await dbOp.put(FAVORITE_STORE, threadData);
        renderPanels();
      }
    }
  }

  // ====================
  // ログ閲覧画面（厳格なURL変換＆メッセージ通知版）
  // ====================
  // ====================
  // ログ閲覧画面（外枠フィット版）
  // ====================
  function viewOfflineLog(html, title) {
    const logWindow = window.open("", "_blank");
    if (!logWindow) {
      alert("ポップアップを許可してください");
      return;
    }

    logWindow.document.write(`
      <html>
      <head>
        <title>Log: ${title}</title>
        <style>
          body{max-width:850px;margin:auto;padding:20px;background:#f0f2f5;font-family:sans-serif;line-height:1.6;}
          .header{background:#444;color:#fff;padding:15px;position:sticky;top:0;border-radius:0 0 8px 8px;font-weight:bold;z-index:100;}
          .content{background:#fff;padding:20px;margin-top:15px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}
          
          /* 画像の幅に枠をフィットさせる設定 */
          .img-wrapper { 
            margin: 15px 0; 
            border: 1px solid #ddd; 
            padding: 10px; 
            border-radius: 5px; 
            background: #fff; 
            display: table;    /* これで中身の幅に縮小します */
            word-break: break-all;
          }
          
          img { 
            max-width: 100%; 
            height: auto; 
            border-radius: 4px; 
            display: block; 
            margin-bottom: 8px; 
          }
          
          .copy-btn { 
            display: block;
            width: 100%;      /* 画像の幅いっぱいのボタンにする */
            box-sizing: border-box;
            font-size: 12px; 
            padding: 8px; 
            cursor: pointer; 
            background: #6c757d; 
            border: none; 
            border-radius: 4px; 
            color: #fff; 
            font-weight: bold; 
            transition: 0.2s;
            text-align: center;
          }
          .copy-btn:hover { background: #5a6268; }
          .copy-btn.success { background: #28a745 !important; }
          .copy-btn.error { background: #dc3545 !important; }
        </style>
      </head>
      <body>
        <div class="header">【保存ログ】 ${title}</div>
        <div id="main-content" class="content">${html}</div>

        <script>
          document.querySelectorAll('img').forEach(img => {
            const parentLink = img.closest('a');
            if (parentLink) {
              parentLink.onclick = (e) => e.preventDefault();
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'img-wrapper';
            img.parentNode.replaceChild(wrapper, img);
            wrapper.appendChild(img);

            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.textContent = '画像URLをコピー';
            
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();

              const rawUrl = img.src;
              
              // ドメインチェック
              if (!rawUrl.includes('bbs.animanch.com')) {
                showStatus(btn, '外部リンクは対象外です', 'error');
                return;
              }

              // 正規パスチェック
              const validPathMatch = rawUrl.match(/\\/(img|thumb|thumb_m|thumb_l|arc|src)\\//);
              if (!validPathMatch) {
                showStatus(btn, '対象外のURL形式です', 'error');
                return;
              }

              // URL再構築
              const parts = rawUrl.split('animanch.com/')[1].split('/');
              parts.shift(); 
              const imagePath = parts.join('/').replace('src/', '').replace('arc/', '');
              const finalUrl = 'https://bbs.animanch.com/img/' + imagePath;

              // コピー実行
              if (navigator.clipboard) {
                navigator.clipboard.writeText(finalUrl).then(() => showStatus(btn, 'コピー完了！', 'success'));
              } else {
                const t = document.createElement("textarea");
                t.value = finalUrl; document.body.appendChild(t);
                t.select(); document.execCommand("copy");
                document.body.removeChild(t);
                showStatus(btn, 'コピー完了！', 'success');
              }
            };
            wrapper.appendChild(btn);
          });

          function showStatus(btn, message, type) {
            const originalText = '直リンクをコピー';
            btn.textContent = message;
            btn.classList.add(type);
            setTimeout(() => {
              btn.textContent = originalText;
              btn.classList.remove(type);
            }, 2000);
          }
        </script>
      </body>
      </html>
    `);
    logWindow.document.close();
  }

  // --- 以下、以前のUI・管理パネル・初期化処理 ---

  async function processUI() {
    if (!db) return;
    const [hiddenList, favList] = await Promise.all([
      dbOp.getAll(HIDDEN_STORE),
      dbOp.getAll(FAVORITE_STORE),
    ]);
    const hMap = new Map(hiddenList.map((e) => [e.id, e]));
    const fMap = new Map(favList.map((e) => [e.id, e]));

    document.querySelectorAll('a.card[href*="/board/"]').forEach((card) => {
      const id = card.href.match(/board\/(\d+)/)?.[1];
      if (!id || card.querySelector(".custom-btn")) return;
      if (hMap.has(id)) {
        card.style.display = "none";
        return;
      }
      card.style.position = "relative";
      const hBtn = document.createElement("button");
      hBtn.className = "custom-btn";
      hBtn.textContent = "非";
      hBtn.style.cssText =
        "position:absolute; top:4px; left:4px; font-size:0.7em; z-index:10; cursor:pointer;";
      hBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await dbOp.put(HIDDEN_STORE, {
          id,
          title: cleanTitle(card.innerText),
          url: card.href,
        });
        card.style.display = "none";
        renderPanels();
      };
      const fBtn = document.createElement("button");
      fBtn.className = "custom-btn";
      fBtn.textContent = fMap.has(id) ? "★" : "☆";
      fBtn.style.cssText = `position:absolute; top:4px; left:30px; font-size:0.7em; color:orange; z-index:10; cursor:pointer;`;
      fBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (fMap.has(id)) {
          await dbOp.del(FAVORITE_STORE, id);
          fBtn.textContent = "☆";
        } else {
          await dbOp.put(FAVORITE_STORE, {
            id,
            title: cleanTitle(card.innerText),
            url: card.href,
          });
        }
        renderPanels();
      };
      card.appendChild(hBtn);
      card.appendChild(fBtn);
    });

    const titleEl =
      document.querySelector(".thread-title") || document.querySelector("h1");
    const tid = location.pathname.match(/board\/(\d+)/)?.[1];
    if (titleEl && tid && !titleEl.querySelector(".custom-detail-group")) {
      const container = document.createElement("span");
      container.className = "custom-detail-group";
      container.style.cssText =
        "margin-left:10px; display:inline-flex; gap:8px; font-weight:normal; font-size:12px;";
      const isFav = fMap.has(tid);
      const dfBtn = document.createElement("button");
      dfBtn.textContent = isFav ? "★ お気に入り中" : "☆ お気に入り";
      dfBtn.style.color = isFav ? "orange" : "#555";
      dfBtn.onclick = async () => {
        if (fMap.has(tid)) {
          await dbOp.del(FAVORITE_STORE, tid);
        } else {
          await dbOp.put(FAVORITE_STORE, {
            id: tid,
            title: cleanTitle(titleEl.innerText),
            url: location.href,
          });
        }
        location.reload();
      };
      const dhBtn = document.createElement("button");
      dhBtn.textContent = "非表示にして戻る";
      dhBtn.onclick = async () => {
        if (confirm("非表示にして戻りますか？")) {
          await dbOp.put(HIDDEN_STORE, {
            id: tid,
            title: cleanTitle(titleEl.innerText),
            url: location.href,
          });
          history.back();
        }
      };
      container.appendChild(dfBtn);
      container.appendChild(dhBtn);
      titleEl.appendChild(container);
    }
  }

  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed; bottom:10px; right:10px; width:280px; z-index:9999; display:flex; flex-direction:column; gap:5px;";
  document.body.appendChild(panel);

  const createAcc = (label, color) => {
    const w = document.createElement("div");
    w.style.cssText =
      "background:#fff; border:1px solid #ccc; border-radius:4px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1);";
    const h = document.createElement("div");
    h.style.cssText = `background:${color}; color:#fff; padding:8px 10px; cursor:pointer; font-weight:bold; font-size:12px; display:flex; justify-content:space-between;`;
    h.innerHTML = `<span>${label}</span><span class="ico">＋</span>`;
    const c = document.createElement("div");
    c.style.cssText =
      "max-height:0; overflow:hidden; transition:0.2s; background:#fff; font-size:11px;";
    h.onclick = () => {
      const open = c.style.maxHeight !== "0px";
      c.style.maxHeight = open ? "0px" : "400px";
      c.style.overflowY = open ? "hidden" : "auto";
      h.querySelector(".ico").textContent = open ? "＋" : "－";
    };
    w.appendChild(h);
    w.appendChild(c);
    panel.appendChild(w);
    return c;
  };

  const hideBox = createAcc("非表示リスト", "#666");
  const favBox = createAcc("お気に入り (ログ閲覧)", "#f39c12");

  async function renderPanels() {
    if (!db) return;
    const [hides, favs] = await Promise.all([
      dbOp.getAll(HIDDEN_STORE),
      dbOp.getAll(FAVORITE_STORE),
    ]);
    hideBox.innerHTML = hides.length
      ? ""
      : '<div style="padding:10px;color:#999">なし</div>';
    hides.forEach((v) => {
      const r = document.createElement("div");
      r.style.cssText =
        "padding:6px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
      r.innerHTML = `<span style="text-decoration:underline; cursor:pointer; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${v.title}</span><button style="font-size:9px; padding:2px 4px;">戻す</button>`;
      r.querySelector("span").onclick = () => (location.href = v.url);
      r.querySelector("button").onclick = async () => {
        await dbOp.del(HIDDEN_STORE, v.id);
        renderPanels();
      };
      hideBox.appendChild(r);
    });
    favBox.innerHTML = favs.length
      ? ""
      : '<div style="padding:10px;color:#999">なし</div>';
    favs.forEach((v) => {
      const r = document.createElement("div");
      r.style.cssText = "padding:8px; border-bottom:1px solid #eee;";
      r.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:5px;">
          <span class="t-link" style="text-decoration:underline; cursor:pointer; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:bold;">${
            v.title
          }</span>
          <button class="d-btn" style="font-size:9px; padding:2px 4px;">×</button>
        </div>
        ${
          v.htmlLog
            ? `<div class="l-btn" style="color:#004085; cursor:pointer; font-size:10px; margin-top:5px; background:#e1f5fe; padding:6px; border-radius:4px; border:1px solid #b3e5fc; text-align:center;">📖 [保存ログを表示]<br><small style="color:#546e7a;font-size:8px;">更新: ${v.lastUpdate}</small></div>`
            : '<div style="font-size:9px; color:#999; margin-top:4px; text-align:center; background:#f5f5f5; padding:4px;">(スレを開くとログが生成されます)</div>'
        }
      `;
      r.querySelector(".t-link").onclick = () => (location.href = v.url);
      r.querySelector(".d-btn").onclick = async () => {
        if (confirm("解除しますか？")) {
          await dbOp.del(FAVORITE_STORE, v.id);
          renderPanels();
        }
      };
      if (v.htmlLog)
        r.querySelector(".l-btn").onclick = () =>
          viewOfflineLog(v.htmlLog, v.title);
      favBox.appendChild(r);
    });
  }

  async function init() {
    try {
      await initDB();
      const tid = location.pathname.match(/board\/(\d+)/)?.[1];
      if (
        tid &&
        (document.title.includes("404") ||
          !document.querySelector(".thread-title"))
      ) {
        const saved = await dbOp.getOne(FAVORITE_STORE, tid);
        if (saved?.htmlLog) viewOfflineLog(saved.htmlLog, saved.title);
      }
      await renderPanels();
      setInterval(() => {
        processUI();
        if (tid) {
          dbOp.getOne(FAVORITE_STORE, tid).then((res) => {
            if (res) saveThreadLog(tid);
          });
        }
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  }
  init();
})();
