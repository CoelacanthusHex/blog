---
title: "擁抱 Fcitx5"
#subtitle: "Fcitx5 遷移及使用雜記"
date: 2020-05-26T23:46:00+08:00
katex: true
draft: false
toc: true
gitinfo: true
slug: "welcome-to-fcitx5"
tags: [Linux, Fcitx, Fcitx5, IME, Tools, Guide, Rime, 軟體]
#description: "Fcitx5 遷移及使用雜記"
summary: "Fcitx5 遷移及使用雜記"
---

## 起因

2015年12月，~~計科殺手~~ csslayer 建立了[fcitx/fcitx5](https://github.com/fcitx/fcitx5)程式碼庫，獨自開始了對 Fcitx5 的開發。

如今五年過去了，Fcitx5 也日漸成熟。（個人感覺演算法上相當不錯

今年年初，我從 `fcitx-rime` 換到 `fcitx5-rime` ，感覺並不明顯 ~~（畢竟對於 Rime 使用者來說從4到5最大的變化是介面~~

然後，~~在 Arch Linux CN 眾多群友的誘惑下,~~ 我決定嘗試一下 Fcitx5 自帶的拼音輸入法。

首次使用的體驗是相當的棒的，Fcitx5 在預設配置下表現良好，雲拼音也有百度，Google，Google CN 三種可選~~儘管我不怎麼用雲拼音~~，整句輸入也是相當的棒，還有輸入預測功能。

但這並不是讓我拋棄我在 Rime 積攢下的詞庫投靠~~老K輸入法~~Fcitx5自帶拼音的理由……真正的原因是最近發生的幾件事……

- 首先是非常好的反饋體驗，開發者老K對待使用者非常友好，而且生產力十足
- 然後是 Felix 爬了維基百科製作了[肥貓百萬大詞庫](https://github.com/felixonmars/fcitx5-pinyin-zhwiki)，隨後大佬 outloudvi 製作了[萌娘百科詞庫](https://github.com/outloudvi/fcitx5-pinyin-moegirl)，Fcitx5 的日用詞庫基本滿足（AUR 上皆有打包，且在 Arch CN 源有打包
- 肥貓大詞庫中的[一個討論](https://github.com/felixonmars/fcitx5-pinyin-zhwiki/issues/6)促使Fcitx5引入了一項新功能——根據字首生成候選項，效果如圖：
![fcitx5-prefix-input](/images/fcitx5-prefix-input.webp)
這個功能我覺得對於長詞輸入是很棒的
- 添加了類似搜狗U模式的拆字模式，效果如圖：
![fcitx5-prefix-input](/images/fcitx5-chaizi.webp)
- 還有一件事是 Fcitx5 可以使用 `fcitx`, `fcitx5`, `ibus` 的輸入法模組（感覺黑科技
- 我從 rime 移植過來一份[符號表](https://github.com/ayalhw/dotfiles/blob/master/fcitx5/.local/share/fcitx5/pinyin/symbolic.dict.txt)，這樣輸入就方便了很多

## 正文

在經歷了一天的過渡之後，我的主力輸入法從 Rime 遷移到了 Fcitx5, 到目前為止體驗良好

### 優勢

- 上述幾條個人認為皆為優勢
- `fcitx5-rime` 支援載入動態庫形式的 Rime 外掛，在設定中填寫外掛名稱即可使用，注意 octagram 外掛名稱與檔名並不一樣（`fcitx-rime` 無此支援，`ibus-rime` 有此支援但是似乎配置檔案有點問題（喜訊：Arch 官方倉庫中的 `librime` 已經打包了 lua 和 octagram（即語料庫）外掛
- 自帶一套 $\LaTeX$ 簡易輸入表（雖然只能輸入一小部分特殊字元
- 筆畫過濾: 參見 [Fcitx5_使用筆畫過濾](https://wiki.archlinux.org/index.php?title=Fcitx5_%28%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87%29#%E4%BD%BF%E7%94%A8%E7%AC%94%E7%94%BB%E8%BF%87%E6%BB%A4)
- 以詞定字
- 檢視選中文字的 Unicode 編碼：選中文字，然後使用快捷鍵 <kbd>ctrl</kbd> + <kbd>alt</kbd> + <kbd>shift</kbd> + <kbd>u</kbd> 可以檢視選中文字的編碼
- 更好的支援（Fcitx4 已經停止支援

### 關於安裝

#### Arch

開發者老K有一篇 [官方博文](https://www.csslayer.info/wordpress/fcitx-dev/%e5%a6%82%e4%bd%95%e7%8e%b0%e5%9c%a8%e5%b0%b1%e5%9c%a8-arch-linux-%e7%94%a8%e4%b8%8a-fcitx-5/) 可供參考，此外 Arch Linux CN 提供了 Git 版本的打包，雖然 Fcitx5 還沒有釋出正式版，但是Arch的`[community]`源已經提供了打包

可 `sudo pacman -S fcitx5-im fcitx5-chinese-addons` 直接安裝，另外 CN 源有詞庫可用 `sudo pacman -S fcitx5-pinyin-{zhwiki,moegirl}`

#### Ubuntu

李先生有一篇 [如何現在就在 Ubuntu 20.04 用上 Fcitx 5](https://plumz.me/archives/11740/)

hosxy 大佬提供了[一個 PPA](https://launchpad.net/~hosxy/+archive/ubuntu/test)，將 Debian Sid 的 Fcitx5 port 到 Ubuntu 20.04 (Ubuntu 官方源中的 Fcitx5 是較舊版本，而 Fcitx5 最近幾個月活躍開發並更新，很多東西都跟不上時代了 （ 與此相關的是一個 [bug fix](https://github.com/fcitx/libime/commit/0a186aadf8891df53dab6f832280fae30bd3d9d8) 修正了一個拼音：聒噪（guo zao）僅記錄了古音“聒（gua）”，此外，Ubuntu 20.04 打包的版本未打包配置工具。


來自一個朋友的安裝配置方法（不能保證一定可行）：
```
用Ubuntu官方源安裝fcitx5

sudo apt install fcitx5 fcitx5-pinyin fcitx5-chinese-addons fcitx5-frontend-gtk2 fcitx5-frontend-gtk3 fcitx5-frontend-qt5

然後再新增ppa安裝kde-config-fcitx5

sudo add-apt-repository ppa:hosxy/test

sudo apt update

然後千萬不要升級任何軟體包

```

若要嘗試自行編譯，請參考 Debian 官方包打包指令碼

PS1：Ubuntu 官方只為20.04及以後的版本提供了包

PS2: 若嘗試在 Ubuntu 18.04 編譯，請注意[依賴問題](https://github.com/fcitx/fcitx5-qt/issues/2)，另外最新版 `kcm-fcitx5` 依賴 Qt 5.14+ 版本

#### Debian && Kali && etc.

參考 [Ubuntu](#Ubuntu)

#### Gentoo

[Gentoo-zh Overlay](https://github.com/microcai/gentoo-zh) 有提供打包

#### AOSC OS

其官方有提供[打包](https://packages.aosc.io/packages/fcitx5)

#### openSUSE

M17N 源有打包，~~但是似乎遇上了 `json-c` 的依賴問題，等待維護者更新中~~已修復

#### Manjaro && other distributions based on Arch

Manjaro Dev. 應該已經把肥貓的包偷過去了吧（

Parabola 有包，看簽名應該 x86_64 的包是從 Arch 拿過去的

#### NixOS

已提交請求，位於 [NixOS/nixpkgs#102626](https://github.com/NixOS/nixpkgs/issues/102626)

#### Fedora and etc.

~~目前似乎無人打包，~~

~~已經有打包者在嘗試打包了[^try-package-on-fedora]，~~

現在 Copr 有包了 [yanqiyu/fcitx5](https://copr.fedorainfracloud.org/coprs/yanqiyu/fcitx5/)，

~~目前已在 [Fedora 32 testing 有包](https://bodhi.fedoraproject.org/updates/FEDORA-2020-5465c02630)[^fedora-32-packgae-in-telegram]，~~

目前已在 [Fedora 32 stable 有包](https://bodhi.fedoraproject.org/updates/FEDORA-2020-5465c02630)，

打包者寫有一篇介紹部落格 [如何下週就在 Fedora 32 用上 Fcitx 5](https://yanqiyu.info/2020/08/30/fcitx5-fedora/)（這文章名頗有 Fcitx5 部落格一貫風格，還有一篇 [如何更加優雅的在 fedora 上安裝 fcitx5](https://yanqiyu.info/2020/11/06/fcitx5-fedora-updated/)


自行編譯請注意[依賴問題](https://github.com/fcitx/fcitx5-qt/issues/7)

#### Flatpak

有 Flatpak 版本啦，參見 [如何现在就用上 Fcitx 5 (Flatpak)](https://www.csslayer.info/wordpress/fcitx-dev/fcitx5-on-flatpak/)

### 關於設定

推薦以下設定：
- 預測看個人喜好
- 啟用顏文字
- 雲拼音根據需要來，但是不推薦 Google 後端，原因顯然
- preedit 也就是單行顯示自己選擇
- 安裝肥貓百萬大詞庫（牆裂推薦
- Lua 外掛！！！自帶日期和時間，另外[推薦幾個](https://github.com/glaumar/fcitx5-lua-scripts)，內含進位制轉換、簡易計算器和密碼生成器

### 主題美化

有以下幾種選擇：
- `kimpanel`(KDE)/`gnome-shell-extension-kimpanel`(Gnome) （同時這也應該是目前 Wayland 下唯一的方案）
- [Material Color 主題](https://github.com/hosxy/Fcitx5-Material-Color)，有多種顏色以及單行雙行兩種模式，Arch 官方源有打包
![Fcitx5-Material-Color](/images/Fcitx5-Material-Color-No-Preedit.webp)
- [黑色透明主題](https://github.com/hosxy/fcitx5-dark-transparent)
![fcitx5-dark-transparent](/images/fcitx5-skin-dark-transparent.webp)
- [黑色主題](https://github.com/evansan/fcitx5-dark)
![fcitx5-dark](/images/fcitx5-skin-dark.webp)
- [Materia EXP 主題](https://github.com/hosxy/Fcitx5-Materia-EXP)，系統使用暗色主題的使用者請謹慎使用
![Fcitx5-Materia-EXP](/images/Fcitx5-Materia-EXP.webp)
- [Simple Blue 主題](https://github.com/weearc/fcitx5-skin-simple-blue)
![fcitx5-skin-simple-blue](/images/fcitx5-skin-simple-blue.webp)
- [Adwaita-dark](https://github.com/escape0707/fcitx5-adwaita-dark)，推薦 Gnome 使用者使用
![fcitx5-adwaita-dark](/images/fcitx5-skin-adwaita-dark.webp)
- 經典的[Material 主題](https://github.com/hrko99/fcitx-skin-material)，這個主題同時支援4和5 ~~我都沒注意這個主題更新了 fcitx5 支援~~（fcitx5 版本有人[在 AUR 上打了包](https://aur.archlinux.org/packages/fcitx5-skin-material/)，包名：`fcitx5-skin-material`
- [base16 material darker 主題](https://github.com/btstream/fcitx5-skin-base16-material-darker)
- 自制主題 ~~（順便寫份主題文件吧~~

以上主題在 AUR 皆有打包(似乎目前已有主題在 AUR 上都有打包了

### 關於配置工具

開發者明確表示不會考慮開發基於 GTK 的圖形配置工具，但在 `fcitx5-configtool` 中可以同時編譯出 KCM 版本和純 Qt 版本的配置工具（至於會不會依賴 KDE 就看你的發行版拆不拆包了（Arch 的做法是 KDE 相關依賴作為可選依賴，因此其他桌面環境使用者安裝 `fcitx5-configtool` 並不會引入 KDE

PS1: ~~老K終於想起來把那個極易引起誤解的 repo 名改掉了~~

PS2: Ubuntu 20.04 打包的版本未打包配置工具。(不知道他們怎麼想的)

### 關於從 Fcitx4 遷移

最新版本的 `fcitx5-configtool` 已經添加了遷移工具[^fcitx5-migrator]，可執行檔名為 `fcitx5-migrator`，GUI 工具。

目前支援 pinyin, skk, rime, kkc, table(碼錶輸入)和全域性設定的遷移。

<video loop controls preload=metadata>
    <source src="/videos/fcitx5-migrator.webm" type="video/webm">
    <source src="/videos/fcitx5-migrator.mp4" type="video/mp4">
    <p>Your browser doesn't support HTML5 video.</p>
</video>

### 關於 Rime 使用者

Fcitx5 相比 Fcitx4 增加了對於動態庫形式（即 .so）的 `librime` 外掛支援，幾乎是你使用 `librime` 外掛的唯一途徑（Arch 官方的 `librime` 已經打包了 `lua` 和 `octagram` 外掛

### FAQ

- 在5月25日之前的 fcitx5 的主題程式碼中存在 bug [fcitx/fcitx5#65](https://github.com/fcitx/fcitx5/issues/65)，如果主題中直接使用了 RGB 顏色程式碼，那麼顯示時顏色會出現問題，表現出類似反色的效果。
該問題在5月25日修復[^2]；
如果是 [Material Color 主題](https://github.com/hosxy/Fcitx5-Material-Color) 使用者，可 checkout 至 [hosxy/Fcitx5-Material-Color#commit=e57e56](https://github.com/hosxy/Fcitx5-Material-Color/commit/e57e5674f003a3e9b2d10faf31fcf588023fed06) 或更新 fcitx5 使用。[^3]

- 在10月2日之前的 Fcitx5 中，詞庫不會預先載入，而是會在第一次切換到對應輸入法時載入，這使得使用較大詞庫時最初幾秒不可用，此問題在10月2日修復[^4], 現在 Fcitx5 會在啟動時預先載入預設的輸入法的詞庫。

### 倡議

現在的問題是沒有（很少有）其他發行版使用者嘗試 Fcitx5 來找出在其他發行版上的問題…… Arch 上的蟲已經捉的差不多了……其他發行版上體驗的改進需要你們的參與……


先寫到這裡，有需要再補充

## Change log

- 2020-05-27 15:17 Edit: 增加幾個面板
- 2020-06-13 18:27 Edit: 新增拆字模式介紹
- 2020-07-05 01:17 Edit: 增加幾個面板，補充 PPA，新增倡議，補充說明一些編譯相關問題，新增配置工具說明，補充一些發行版的安裝方法
- 2020-07-05 11:28 Edit: 補充部分特性
- 2020-07-14 04:10 Edit: 更新部分包的狀態，新增 Rime 相關問題
- 2020-08-07 11:04 Edit: 更新 `kcm-fcitx5` 到 `fcitx5-configtool` 的包名變更，新增詞庫安裝方案（Arch）
- 2020-08-12 18:17 Edit: 更新 Fedora 打包狀態
- 2020-08-16 12:37 Edit: 更新 Fedora 打包狀態（Copr），更新 openSUSE 打包狀態（M17N），補充關於 Ubuntu 20.04 中配置工具問題的解釋，新增符號表
- 2020-08-16 14:20 Edit: 新增來自一個朋友的安裝配置方法（Ubuntu）
- 2020-08-16 19:59 Edit: 更新一個與主題顯示有關的 bug
- 2020-08-31 00:46 Edit: 更新 Fedora 打包狀態（Fedora 32 testing）
- 2020-09-08 00:46 Edit: 更新 Fedora 打包狀態（Fedora 32 stable）
- 2020-09-12 12:45 Edit: 新增遷移工具（fcitx5-configtool/fcitx5-migrator）
- 2020-09-29 11:57 Edit: 更新 openSUSE 打包狀態（M17N）
- 2020-10-04 15:58 Edit: 更新關於詞典預載入的問題
- 2020-11-04 15:04 Edit: Fcitx5 發 5.0 正式版啦
- 2020-11-06 21:37 Edit: 新增 NixOS 打包狀態，更新 Fedora 打包狀態
- 2020-11-29 00:01 Edit: 新增 Flatpak 打包狀態

---
[^try-package-on-fedora]: [https://t.me/fedorazh/63659](https://t.me/fedorazh/63659)
[^2]: [fcitx/fcitx5@bd83a9](https://github.com/fcitx/fcitx5/commit/bd83a9841e1dc3e7296174d32f5ee7655f680689)
[^3]: 群內相關討論連結：[https://t.me/loverime/17779](https://t.me/loverime/17779)
[^fedora-32-packgae-in-telegram]: 群內相關討論連結：[https://t.me/fedorazh/65263](https://t.me/fedorazh/65263)
[^fcitx5-migrator]: [fcitx/fcitx5-configtool@8f113a](https://github.com/fcitx/fcitx5-configtool/commit/8f113a78e334ecc962d5aa92022887ca077df588)
[^4]: [fcitx/fcitx5@982e8cf](https://github.com/fcitx/fcitx5/commit/982e8cf184489c879c91e992ba1e6257535dfdb5)

