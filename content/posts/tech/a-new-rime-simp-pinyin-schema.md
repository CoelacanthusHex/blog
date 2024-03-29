---
title: "一个新的 Rime 简体中文拼音输入方案: 极光拼音"
date: 2020-08-12T16:34:14+08:00
draft: false
toc: true
gitinfo: true
mathjax: true
slug: "a-new-rime-simp-pinyin-schema"
aliases:
  - "/tech/a-new-rime-simp-pinyin-schema"
tags: [IME, Rime]
summary: "一个新的 Rime 简体中文拼音输入方案: 极光拼音"
---

## TL;DR;

打字的时候基本没有生僻字出来干扰视线（当然这也导致如果你想打生僻字基本打不出来），没有用 OpenCC，避免了使用这种方式实时转换遇到的问题

GitHub 地址：[hosxy/rime-aurora-pinyin](https://github.com/hosxy/rime-aurora-pinyin)

AUR 地址：[rime-aurora-pinyin](https://aur.archlinux.org/packages/rime-aurora-pinyin/)

AOSC 的 `rime-data` 中已包含了此方案

## 诞生缘由

Rime 的简体中文输入主要有两种思路：
- 繁体和简体分别维护一套码表和词库
- 简体和繁体共用一套码表和词库，使用上最后输出时使用 OpenCC 转换

前者的优势是用词和词频等都比较准确，简单来说就是用户体验比较好，缺点是**总**维护量大；

后者则恰好相反，虽然维护量骤减至不到原来的一半，但是用词和词频的准确性大幅度下降，表现为经常出现一些简体中文和现代汉语（大陆）不常用的词汇排在候选词的前面，同时，这种方案采用了实时繁简转换，还会遇到另外一个非常影响用户体验的问题：

**部分可被认作繁体的简体字可能会被错误的再次翻译**

例如：“徴羽摩柯”这个词中的“徵”就很容易被当作繁体而错误转换为“征”（当然这个字的问题已经修复，但是还有很多很多这样的字，同时又有新词不断产生，怎么能改得完呢？

同样的例子还有“复投”

官方为了减轻工作量采用第一种方法制作了 luna-pinyin-simp 朙月拼音简化字方案，完美的撞上了这两个问题（此外官方给出的理由竟然是选择繁体码表和词库更准确？

后来，官方又制作了 pinyin-simp 袖珍简化字方案和 c2h6-pinyin 乙烷拼音（这次是简体码表了），但是，这个方案延续了官方一贯的态度，不管你用不用的上，先都塞给你，哪怕牺牲用户体验也在所不惜：生僻字比例极高，大量的古音（甚至不是专门研究古代汉语音韵的人都不一定知道这个音……这里就有一个小故事：
```
AOSC rime-data 维护者：c2h6 打出来的都是那种万年不见一次的生僻字，最重要的是没人用，于是我就 drop 了

一位群友：我就知道佛振搞简体方案会变成这样……

一位群友：这个方案名起的非常应景……
        还有一堆古音……
        给简体汉语拼音方案上古音……

綾香姐姐：其实有可能是台湾国语（

一位群友：下次让他给繁体方案用大陆简化字音（
        https://github.com/lotem/rime-c2h6-pinyin/commit/5fcd1228d35d64f99d334c75114eaf7f3d34a081#diff-6ca64afcf64d153d02639c5e12253dc5R8601 比如这里……我完全没找到出处……
        而且有很多字……noto字体都没有……
        只有 ttf-hanazono 才有……

綾香姐姐：《集韻》䉷/厂「說文隿射所蔽者也」（打鳥的用來掩蔽的物體）魚杴切 = yán 😂
        不知道佛振怎麼找到這讀音的（

一位群友：如果一个汉字 noto 这种字体都没的显示……那么大概率一般人也不会用到……除了研究古文……但是研究古文用繁体啊……
```
本人保证这个故事的真实性，不信者可自行尝试乙烷拼音以及前往 Rime Telegram 群组观看聊天记录查证

## 起步

这个方案，其实最初只是 hosxy 自用的方案，可能是处于备份或者分享还是其他的目的，hosxy 将它发布到了 GitHub 上。这个时间点，是2020年3月19日。

后来，由于官方的简化字八股文注音能力过于生草……hosxy 将其从方案中移除。

再后来，hosxy 从 sunpinyin 拿来了约5w条词语……

然后，因为词频问题，hosxy 简单的为其按照教育部标准一二三级字添加了粗略的字频

随后，这个方案被群友发现大家开始合理试图改进这个方案：綾香姐姐根据 Unihan 数据库调整了单字字频，hosxy 又单独将简化字八股文的词库抽出使用

渐渐的，这个方案变得越来越好用了……

## 一些观点

我觉得，官方关于分别维护繁简码表工作量大的理由不成立，先不说官方最后还是维护了单独的简体码表，就说一件事：这简体码表何必官方维护？官方在群里的发言更是令人气愤，他们说我们自立门户自行维护简体码表是增加官方负担，“徒增混乱”。粗俗一点说，他们这和主动去吃屎又说屎难吃不能吃有什么区别呢？没有人强求官方维护简体码表
