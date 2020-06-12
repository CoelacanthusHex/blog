---
title: "拥抱Fcitx5"
date: 2020-05-26T23:46:00+08:00
draft: false
toc: false
gitinfo: true
slug: "welcome-to-fcitx5"
tags: [Linux, Fcitx, Fcitx5, IME, Tools, 软件]
---

2015年12月，~~计科杀手~~ csslayer 创建了[fcitx/fcitx5](https://github.com/fcitx/fcitx5)代码库，独自开始了对Fcitx5的开发。

如今五年过去了，Fcitx5 也日渐成熟。（个人感觉算法上相当不错

今年年初，我从 fcitx-rime 换到 fcitx5-rime ，感觉并不明显 ~~（毕竟对于 Rime 用户来说从4到5最大的变化是界面~~

然后，~~在 Arch Linux CN 众多群友的诱惑下,~~ 我决定尝试一下 Fcitx5 自带的拼音输入法。
首次使用的体验是相当的棒的，Fcitx5 在默认配置下表现良好，云拼音也有百度，Google，Google CN 三种可选~~尽管我不怎么用云拼音~~，整句输入也是相当的棒，还有输入预测功能。

但这并不是让我抛弃我在Rime积攒下的词库投靠~~老K输入法~~Fcitx5自带拼音的理由……真正的原因是最近发生的几件事……

- 首先是非常好的反馈体验，开发者老K对待用户非常友好，而且生产力十足
- 然后是 Felix 爬了维基百科制作了[肥猫百万大词库](https://github.com/felixonmars/fcitx5-pinyin-zhwiki)，随后大佬 outloudvi 制作了[萌娘百科词库](https://github.com/outloudvi/fcitx5-pinyin-moegirl)，Fcitx5 的日用词库基本满足
- 肥猫大词库中的[一个讨论](https://github.com/felixonmars/fcitx5-pinyin-zhwiki/issues/6)促使Fcitx5引入了一项新功能——根据前缀生成候选项，效果如图：
![fcitx5-prefix-input](/images/fcitx5-prefix-input.webp)
这个功能我觉得对于长词输入是很棒的
- 添加了类似搜狗U模式的拆字模式，效果如图：
![fcitx5-prefix-input](/images/fcitx5-chaizi.webp)
- 还有一件事是 Fcitx5 可以使用 `fcitx`, `fcitx5`, `ibus` 的输入法模块（感觉黑科技

在经历了一天的过渡之后，我的主力输入法从 Rime 迁移到了 Fcitx5,到目前为止体验良好

### 关于安装

#### Arch

开发者老K有一篇 [官方博文](https://www.csslayer.info/wordpress/fcitx-dev/%e5%a6%82%e4%bd%95%e7%8e%b0%e5%9c%a8%e5%b0%b1%e5%9c%a8-arch-linux-%e7%94%a8%e4%b8%8a-fcitx-5/) 可供参考，此外 Arch Linux CN 提供了Git版本的打包，虽然 Fcitx5 还没有发布正式版，但是Arch的`[community]`源已经提供了打包

#### Ubuntu

李先生有一篇 [如何现在就在 Ubuntu 20.04 用上 Fcitx 5](https://plumz.me/archives/11740/)

#### Debian

参考 [Ubuntu](#Ubuntu)

### 关于设置

推荐以下设置：
- 预测看个人喜好
- 启用颜文字
- 云拼音根据需要来，但是不推荐 Google 后端，原因显然
- preedit 也就是单行显示自己选择
- 安装肥猫百万大词库（墙裂推荐
- Lua 插件！！！自带日期和时间，另外[推荐几个](https://github.com/glaumar/fcitx5-lua-scripts)，内含进制转换、简易计算器和密码生成器

#### 主题美化

有以下几种选择：
- `kimpanel`(KDE)/`gnome-shell-extension-kimpanel`(Gnome)
- [Material Color 主题](https://github.com/hosxy/Fcitx5-Material-Color)，有多种颜色以及单行双行两种模式，Arch 官方源有打包
![Fcitx5-Material-Color](https://raw.githubusercontent.com/hosxy/Fcitx5-Material-Color/master/screenshot/No-Preedit.png)
- [黑色透明主题](https://github.com/hosxy/fcitx5-dark-transparent)
![fcitx5-dark-transparent](https://raw.githubusercontent.com/hosxy/fcitx5-dark-transparent/master/screenshot-1.png)
- [黑色主题](https://github.com/evansan/fcitx5-dark)
![fcitx5-dark](https://raw.githubusercontent.com/evansan/fcitx5-dark/master/2019-01-27_02-33.png)
- [Materia EXP 主题](https://github.com/hosxy/Fcitx5-Materia-EXP)，系统使用暗色主题的用户请谨慎使用
![Fcitx5-Materia-EXP](https://raw.githubusercontent.com/hosxy/Fcitx5-Materia-EXP/master/screenshot/screenshot.png)
- [Simple Blue 主题](https://github.com/weearc/fcitx5-skin-simple-blue)
![fcitx5-skin-simple-blue](https://raw.githubusercontent.com/weearc/fcitx5-skin-simple-blue/master/screenshot/screenshot-input.png)
- [Adwaita-dark](https://github.com/escape0707/fcitx5-adwaita-dark)，推荐 Gnome 用户使用
![fcitx5-adwaita-dark](https://raw.githubusercontent.com/escape0707/fcitx5-adwaita-dark/master/img/fcitx5-adwaita-dark-theme.png)
- 经典的[Material 主题](https://github.com/hrko99/fcitx-skin-material)，这个主题同时支持4和5 ~~我都没注意这个主题更新了 fcitx5 支持~~
- 自制主题 ~~（顺便写份主题文档吧~~

先写到这里，有需要再补充

### Change log

- 2020-05-27 15:17 Edit: 增加几个皮肤
- 2020-06-13 18:27 Edit: 添加拆字模式介绍
