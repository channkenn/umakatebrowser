# umakatebrowser

あにまん掲示板ウマ娘・競馬カテゴリをより快適に閲覧するためのユーザースクリプト集です。
スレッドの非表示機能やお気に入り、画像付きの過去ログ保存機能を提供します。

## 🛠 主な機能

- **スレ非表示機能**: 興味のないスレッドを一覧から非表示にします。
- **レス非表示機能**: 興味のないレスをスレッドから非表示にします。
- **お気に入り管理**: 右下のパネルでスレッドをクイック管理。
- **過去ログ保存**: お気に入りに入れたスレッドの内容（画像リンク付き）をブラウザ内に保存し、スレ落ち後も閲覧可能にします。
- **直リンクコピー**: ログ画面からパス（src/arc 等）を除外した画像 URL をワンクリックでコピー。

## 🌐 対応ブラウザ

- **Google Chrome** (動作確認済み・推奨)
- **Brave** (動作確認済み)
- **Firefox** (動作確認済み ※設定によりポップアップ許可が必要)

## 📱 モバイル環境での動作実績

- **Android (Firefox + Tampermonkey)** (動作確認済み)
  - ※画面サイズによっては UI が重なる場合がありますが、基本機能（保存・非表示）は動作します。
  - ※iOS 版（Safari/Chrome 等）はユーザースクリプトの制約上、動作を保証していません。

## 🚀 インストール手順

ブラウザにユーザースクリプトを実行するための拡張機能「Tampermonkey」を導入してから、スクリプトをインストールします。

### 1. Tampermonkey をインストール

ご利用の環境に合わせてインストールしてください。

#### **PC (Chrome / Brave / Firefox)**

- **Chrome / Brave**: [Tampermonkey (Chrome ウェブストア)](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
  - **【重要】ブラウザの開発者モードを有効にする**
    - ブラウザの拡張機能管理画面（ `chrome://extensions/` または `brave://extensions/` ）を開きます。
    - 右上の **「デベロッパー モード」** をオンにしてください。
- **Firefox**: [Tampermonkey (Firefox Add-ons)](https://addons.mozilla.org/ja/firefox/addon/tampermonkey/)

#### **Android (Firefox)**

1. Google Play ストアから [Firefox](https://play.google.com/store/apps/details?id=org.mozilla.firefox) をインストールして開きます。
2. メニュー（︙）から **「アドオン」** を選択します。
3. リストから **「Tampermonkey」** を探し、「＋」をタップして追加します。

---

### 2. スクリプトのインストール

Tampermonkey 導入後、以下のリンクをクリックするとインストール画面が自動的に立ち上がります。

- 👉 [umakate.user.js をインストール](https://github.com/channkenn/umakatebrowser/raw/main/userscript/umakate.user.js)

---

### 3. Firefox をお使いの場合の設定 (重要)

Firefox（PC/Android 両方）では、保存ログの表示（別タブ展開）にポップアップ許可が必要です。

1. Firefox のアドレスバーに `about:config` と入力し、設定画面を開きます。
2. 検索窓に `dom.disable_open_during_load` と入力します。
3. 値を **`false`** に切り替えてください。

---

### 4. 使いかた

1. インストール完了後、[あにまん掲示板](https://bbs.animanch.com/) を開きます。
2. 画面の右下にオレンジ色の管理パネルが表示されます。
3. スレッド一覧や詳細画面に表示される「☆（お気に入り）」や「🚫（非表示）」ボタンでスレッドを管理できます。
4. お気に入りに入れたスレッドは、パネル内の「📖 [保存ログを表示]」からいつでも画像付きで読み返すことが可能です。

## ⚠️ 免責事項 (Disclaimer)

- **個人利用限定**: 本スクリプトは個人による閲覧の利便性向上を目的として作成されたものであり、保存されたログを外部サーバーへ公開・転載する機能は含まれていません。
- **著作権について**: 掲示板の投稿内容および画像の著作権は、各投稿者および運営者に帰属します。取得したデータの取り扱いには十分注意し、各サイトの利用規約を遵守してください。
- **自己責任**: 本ツールの利用により生じた損害、トラブル、または利用規約違反によるアカウント停止等について、作者（channkenn）は一切の責任を負いません。
- **非公式**: 本プロジェクトは「あにまん掲示板」公式とは一切関係のない、個人の有志によるプロジェクトです。

---

_This tool is for personal use only. The author is not responsible for any issues or damages arising from the use of this script._
