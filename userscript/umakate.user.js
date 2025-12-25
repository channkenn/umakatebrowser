// ==UserScript==
// @name         あにまん掲示板 快適化ツール (URLコピー機能付き)
// @version      1.2
// @description  お気に入り・非表示・過去ログ保存・画像URLコピー・レス単位非表示
// @author       channkenn
// @match        https://bbs.animanch.com/*
// @updateURL    https://github.com/channkenn/umakatebrowser/raw/main/userscript/umakate.user.js
// @downloadURL  https://github.com/channkenn/umakatebrowser/raw/main/userscript/umakate.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const DB_NAME = "umakateDB_v2";
  const HIDDEN_STORE = "hiddenThreads";
  const FAVORITE_STORE = "favoriteThreads";
  let db;
  let lastSaveTime = 0;

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
      .replace(/☆ お気に入り|★ お気に入り中|🚫 非表示にして戻る/g, "")
      .trim();
  }

  // ====================
  // ログ保存
  // ====================
  async function saveThreadLog(threadId) {
    const now = Date.now();
    if (now - lastSaveTime < 10000) return;

    const threadArea =
      document.querySelector("#res-list") ||
      document.querySelector(".thread") ||
      document.querySelector("article");
    if (!threadArea) return;

    const clone = threadArea.cloneNode(true);
    // ツール独自のUIはログから削除
    clone
      .querySelectorAll(".res-hide-btn, .res-show-btn, .custom-detail-group")
      .forEach((el) => el.remove());

    clone
      .querySelectorAll(".col-8.col-md-10.position-relative")
      .forEach((container) => {
        const strongTag = container.querySelector("strong");
        if (strongTag)
          container.innerHTML = "<strong>" + strongTag.innerHTML + "</strong>";
      });

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
        lastSaveTime = now;
        renderPanels();
      }
    }
  }

  // ====================
  // ログ閲覧画面
  // ====================
  function viewOfflineLog(html, title) {
    const logWindow = window.open("", "_blank");
    if (!logWindow) {
      alert("ポップアップを許可してください");
      return;
    }
    logWindow.document.write(
      `<html><head><title>Log: ${title}</title><style>body{max-width:850px;margin:auto;padding:20px;background:#f0f2f5;font-family:sans-serif;line-height:1.6;}.header{background:#444;color:#fff;padding:15px;position:sticky;top:0;border-radius:0 0 8px 8px;font-weight:bold;z-index:100;}.content{background:#fff;padding:20px;margin-top:15px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}.img-wrapper{margin:15px 0;border:1px solid #ddd;padding:10px;border-radius:5px;background:#fff;display:table;word-break:break-all;}img{max-width:100%;height:auto;border-radius:4px;display:block;margin-bottom:8px;}.copy-btn{display:block;width:100%;box-sizing:border-box;font-size:12px;padding:8px;cursor:pointer;background:#6c757d;border:none;border-radius:4px;color:#fff;font-weight:bold;transition:0.2s;text-align:center;}.copy-btn:hover{background:#5a6268;}.copy-btn.success{background:#28a745!important;}.copy-btn.error{background:#dc3545!important;}</style></head><body><div class="header">【保存ログ】 ${title}</div><div id="main-content" class="content">${html}</div><script>document.querySelectorAll('img').forEach(img=>{const parentLink=img.closest('a');if(parentLink){parentLink.onclick=(e)=>e.preventDefault();}const wrapper=document.createElement('div');wrapper.className='img-wrapper';img.parentNode.replaceChild(wrapper,img);wrapper.appendChild(img);const btn=document.createElement('button');btn.className='copy-btn';btn.textContent='画像URLをコピー';btn.onclick=(e)=>{e.preventDefault();const rawUrl=img.src;if(!rawUrl.includes('bbs.animanch.com')){showStatus(btn,'外部リンクは対象外です','error');return;}const parts=rawUrl.split('animanch.com/')[1].split('/');parts.shift();const imagePath=parts.join('/').replace('src/','').replace('arc/','').replace('thumb/','').replace('thumb_m/','').replace('thumb_l/','');const finalUrl='https://bbs.animanch.com/img/'+imagePath;navigator.clipboard.writeText(finalUrl).then(()=>showStatus(btn,'コピー完了！','success')).catch(()=>{const t=document.createElement("textarea");t.value=finalUrl;document.body.appendChild(t);t.select();document.execCommand("copy");document.body.removeChild(t);showStatus(btn,'コピー完了！','success');});};wrapper.appendChild(btn);});function showStatus(btn,message,type){const originalText='画像URLをコピー';btn.textContent=message;btn.classList.add(type);setTimeout(()=>{btn.textContent=originalText;btn.classList.remove(type);},2000);}<\/script></body></html>`
    );
    logWindow.document.close();
  }

  // ====================
  // UI処理
  // ====================
  async function processUI() {
    if (!db) return;

    // A. スレッド一覧の処理
    const [hiddenList, favList] = await Promise.all([
      dbOp.getAll(HIDDEN_STORE),
      dbOp.getAll(FAVORITE_STORE),
    ]);
    const hMap = new Map(hiddenList.map((e) => [e.id, e]));
    const fMap = new Map(favList.map((e) => [e.id, e]));

    document.querySelectorAll('a.card[href*="/board/"]').forEach((card) => {
      const id = card.href.match(/board\/(\d+)/)?.[1];
      if (!id) return;

      if (hMap.has(id)) {
        if (card.style.display !== "none") card.style.display = "none";
        return;
      } else {
        if (card.style.display === "none") card.style.display = "";
      }

      const existingBtns = card.querySelectorAll(".custom-btn");
      if (existingBtns.length > 0) {
        if (existingBtns[1]) {
          const targetChar = fMap.has(id) ? "★" : "☆";
          if (existingBtns[1].textContent !== targetChar)
            existingBtns[1].textContent = targetChar;
        }
        return;
      }

      card.style.position = "relative";
      // --- 非表示ボタン (🚫) ---
      const hBtn = document.createElement("button");
      hBtn.className = "custom-btn";
      hBtn.textContent = "🚫";
      hBtn.style.cssText = `
        position: absolute;
        top: 4px;
        left: 4px;
        font-size: 14px;
        z-index: 10;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.7); /* さらに透過(0.8→0.7) */
        border: 1px solid rgba(200, 200, 200, 0.5);
        border-radius: 4px;
        padding: 4px 6px;
        line-height: 1;
        transition: 0.2s;
      `;
      // ホバー時に透過を解除して見やすくする
      hBtn.onmouseover = () => {
        hBtn.style.background = "rgba(255, 255, 255, 1)";
        hBtn.style.border = "1px solid #bbb";
      };
      hBtn.onmouseout = () => {
        hBtn.style.background = "rgba(255, 255, 255, 0.3)";
        hBtn.style.border = "1px solid rgba(200, 200, 200, 0.5)";
      };

      hBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.style.display = "none";
        await dbOp.put(HIDDEN_STORE, {
          id,
          title: cleanTitle(card.innerText),
          url: card.href,
        });
        renderPanels();
      };

      // --- お気に入りボタン (☆/★) ---
      const fBtn = document.createElement("button");
      fBtn.className = "custom-btn";
      fBtn.textContent = fMap.has(id) ? "★" : "☆";
      fBtn.style.cssText = `
        position: absolute;
        top: 4px;
        left: 42px; /* 非表示ボタンの横幅に合わせた位置 */
        font-size: 14px;
        color: orange;
        z-index: 10;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.7); /* さらに透過 */
        border: 1px solid rgba(200, 200, 200, 0.5);
        border-radius: 4px;
        padding: 4px 6px;
        line-height: 1;
        transition: 0.2s;
      `;
      fBtn.onmouseover = () => {
        fBtn.style.background = "rgba(255, 255, 255, 1)";
        fBtn.style.border = "1px solid #bbb";
      };
      fBtn.onmouseout = () => {
        fBtn.style.background = "rgba(255, 255, 255, 0.3)";
        fBtn.style.border = "1px solid rgba(200, 200, 200, 0.5)";
      };
      fBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isCurrentlyFav = fMap.has(id);
        fBtn.textContent = isCurrentlyFav ? "☆" : "★";
        if (isCurrentlyFav) {
          await dbOp.del(FAVORITE_STORE, id);
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

    // B. スレッド詳細 (レス単位)
    const tid = location.pathname.match(/board\/(\d+)/)?.[1];
    if (tid) {
      document.querySelectorAll("li.list-group-item").forEach((res) => {
        // 「報告」ボタンを取得してその横に置く
        const reportBtn = res.querySelector(".report");
        if (!reportBtn || res.querySelector(".res-hide-btn")) return;

        const header = res.querySelector(".resheader");
        if (header) {
          const rBtn = document.createElement("button");
          rBtn.className = "res-hide-btn";
          rBtn.textContent = "🚫";
          // 周囲のボタン（報告）と高さを合わせるため margin-left を調整
          rBtn.style.cssText =
            "margin-left:5px; cursor:pointer; background:none; border:1px solid #ccc; border-radius:3px; font-size:10px; padding:0 4px; color:#999; vertical-align:middle; line-height:1.5; height:22px;";

          rBtn.onclick = (e) => {
            e.preventDefault();
            const content = res.querySelector(".resbody");
            if (content) content.style.display = "none";
            header.style.opacity = "0.4";
            if (!res.querySelector(".res-show-btn")) {
              const sBtn = document.createElement("button");
              sBtn.className = "res-show-btn";
              sBtn.textContent = "[非表示のレスを表示]";
              sBtn.style.cssText =
                "display:block; font-size:11px; color:#007bff; background:none; border:none; cursor:pointer; padding:10px; text-decoration:underline;";
              sBtn.onclick = () => {
                if (content) content.style.display = "";
                header.style.opacity = "1";
                sBtn.remove();
              };
              res.appendChild(sBtn);
            }
          };
          // 報告ボタンの直後に挿入
          reportBtn.after(rBtn);
        }
      });
    }

    // C. スレッド詳細タイトル部分
    const titleEl =
      document.querySelector(".thread-title") || document.querySelector("h1");
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
      dhBtn.textContent = "🚫 非表示にして戻る";
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

  // ====================
  // 管理パネル
  // ====================
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed; bottom:10px; right:10px; z-index:9999; display:flex; flex-direction:column; gap:5px; align-items: flex-end;";
  document.body.appendChild(panel);

  const createAcc = (label, icon, color) => {
    const w = document.createElement("div");
    w.style.cssText =
      "background:#fff; border:1px solid #ccc; border-radius:8px; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1); transition: width 0.2s; width:40px;";
    const h = document.createElement("div");
    h.style.cssText = `background:${color}; color:#fff; padding:8px; cursor:pointer; font-weight:bold; font-size:14px; text-align:center; display:flex; justify-content:center; align-items:center; min-height:36px; box-sizing:border-box;`;
    h.innerHTML = `<span class="txt">${icon}</span>`;
    const c = document.createElement("div");
    c.style.cssText =
      "max-height:0; overflow:hidden; transition:0.2s; background:#fff; font-size:11px; width:280px;";
    h.onclick = () => {
      const isOpen = c.style.maxHeight !== "0px";
      if (isOpen) {
        c.style.maxHeight = "0px";
        w.style.width = "40px";
        h.innerHTML = `<span class="txt">${icon}</span>`;
      } else {
        c.style.maxHeight = "400px";
        c.style.overflowY = "auto";
        w.style.width = "280px";
        h.innerHTML = `<span class="txt" style="font-size:12px;">${icon} ${label}</span>`;
      }
    };
    w.appendChild(h);
    w.appendChild(c);
    panel.appendChild(w);
    return c;
  };

  const hideBox = createAcc("非表示リスト", "🚫", "#666");
  const favBox = createAcc("お気に入り", "⭐", "#f39c12");

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
      r.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; gap:5px;"><span class="t-link" style="text-decoration:underline; cursor:pointer; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:bold;">${
        v.title
      }</span><button class="d-btn" style="font-size:9px; padding:2px 4px;">×</button></div>${
        v.htmlLog
          ? `<div class="l-btn" style="color:#004085; cursor:pointer; font-size:10px; margin-top:5px; background:#e1f5fe; padding:6px; border-radius:4px; border:1px solid #b3e5fc; text-align:center;">📖 [保存ログを表示]<br><small style="color:#546e7a;font-size:8px;">更新: ${v.lastUpdate}</small></div>`
          : '<div style="font-size:9px; color:#999; margin-top:4px; text-align:center; background:#f5f5f5; padding:4px;">(スレを開くとログが生成されます)</div>'
      }`;
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
      if (tid) {
        const isErrorPage =
          document.title.includes("404") ||
          document.title.includes("500") ||
          document.body.innerText.includes("見つかりませんでした");
        if (isErrorPage) {
          const saved = await dbOp.getOne(FAVORITE_STORE, tid);
          if (saved?.htmlLog) viewOfflineLog(saved.htmlLog, saved.title);
        }
      }
      await renderPanels();
      setInterval(() => {
        processUI();
        if (tid)
          dbOp.getOne(FAVORITE_STORE, tid).then((res) => {
            if (res) saveThreadLog(tid);
          });
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  }
  init();
})();
