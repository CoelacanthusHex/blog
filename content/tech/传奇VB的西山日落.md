---
title: "传奇VB的西山日落"
date: 2020-03-14T20:06:52+08:00
draft: false
toc: true
gitinfo: true
slug: "visual-basic-will-die"
tags: ['Visual Basic', 'History']
summary: "Visual Basic 的诞生，发展与没落"
---

## 一切的开端

1991年4月，微软发布了 Visual Basic 1.0 for Windows，这是新时代的开始。
历史上第一个“可视”的编程软件诞生了。

## 发展

-   1992年9月，Visual Basic 1.0 for DOS 版本发布。
-   1992年11月，Visual Basic 2.0 发布。改善了速度。
-   1993年，VIsual Basic 3.0 发布，此版本分为标准版和专业版。重大改变是内置了一个数据引擎，可以直接读取Access数据库。
-   1995年8月，Visual Basic 4.0 发布，包括16位版本和32位的版本。从此版本开始，引入了面向对象的程序设计思想；同时引入了“控件”的概念，使得可以直接利用大量已经编好的VB程序。
-   1997年2月，Visual Basic 5.0。此版本包含了用户自建控件的支持。从此版本开始，VB支持编译为本机原生代码（需要VB运行库），在此之前的 Visual Basic 1.0~4.0 都必须将源代码编译成VB伪代码后解释执行。
-   1998年夏，Visual Basic 6.0 发布。这是VB最传奇的版本。也是VB.NET至今仍无法完全取代的版本。

## 转变

-   2001年，Visual Basic .NET 和 .NET Framework 一同发布。使用了新的核心和特性。很多VB代码为了迁移必须改写。
-   2002年Visual Basic .NET 2002（即VB 7.0）问世，此后 Visual Basic 被包含在 Visual Studio 套件中。此版本支持了很多新特性：继承，多线程，异常处理……

## 失宠

-   2005年，微软宣布将不会再对非.NET版本的VB进行支持。
-   当微软发布 Visual Basic .NET 和 C# 开启 .NET 时代时，两种语言是并行发展的，有着几乎相同的功能集。但随着时间的迁移，现在微软的开发文档基本上只提供 C# 示例，而没有 VB 示例了。

## 日薄西山

-   C#/VB 的同步发展策略在 2017 年结束，只有 C# 获得新的功能，微软事实上放弃了 Visual Basic。
-   2020年3月11日，微软 DevBlogs 宣布从 .NET 5 开始，Visual Basic 将支持 Class Library、Console、Windows Forms、WPF、Worker Service 和 ASP.NET Core Web API 等，为想要将现有应用迁移到 .NET Core 的 VB 客户提供一条路径，而 Visual Basic 语言本身将不会继续发展或引入新特性，未来将主要着重于稳定性和兼容性。正式承认放弃 Visual Basic。

## 何去何从

VB的一生都在争论中度过：
-   VB的简单特性使得其在未来具有伤害性。很多人学习了VB，但是并没有学到好的编程习惯。而且很多错误和警告的检查默认情况下都是关闭的，程序员很难找到隐藏的错误。
-   VB的易用性就是它最大的优势，可以让略通皮毛的人都能用自己的方式快速开发程序。
-   VB的程序可以非常简单的和数据库连接。

## Only My Opinion

VB的诞生是历史的必然，也是那个时代的诉求。但是作为一门编程语言来讲，和老骥伏枥的C不同，VB已经不再适应这个时代：过高的平台绑定（这本身并不是特别严重的问题，虽然我不喜欢，但是真正可怕的是VB作为一门和Windows系统绑定的语言，不能很好地综合 Windows 的基础API，甚至很多时候要使用低级运算的“小伎俩”来进行编程。），不高的运行效率，自身的兼容性问题（VB6与VB.NET）；而如果作为入门语言来讲，他又会带来很多不好的编程习惯。
