---
title: "Firefox 支持 X11 下的 VA-API 硬解了"
date: 2020-07-05T23:42:35+08:00
draft: false
toc: true
gitinfo: true
slug: "firefox-80-support-vaapi-in-x11"
tags: [Firefox, 'VA-API', 'Hardware Acceleration']
---

## TL;DL

目前来看火狐应该是初步实现了 X11 下的 VA-API 硬解……期待后续的发展……

## 试用方法

使用最新版 Nightly，开启设置中的 `vaapi` 和 `webrender` 相关选项，使用环境变量 `MOZ_X11_EGL=1` 即可测试

试用了一下目前在我的机子上表现还不错……当然刚刚实现肯定还有很多 bug，只能说我是运气比较好的那批人吧……

Bug Tracker：[Implement ffmpeg/VAAPI video playback](https://bugzilla.mozilla.org/show_bug.cgi?id=1619523)

### Change log

- {}
