---
title: "傳奇VB的西山日落"
date: 2020-03-14T20:06:52+08:00
draft: false
toc: true
gitinfo: true
slug: "visual-basic-will-die"
tags: ['Visual Basic', 'History']
summary: "Visual Basic 的誕生，發展與沒落"
---

## 一切的開端

1991年4月，微軟釋出了 Visual Basic 1.0 for Windows，這是新時代的開始。
歷史上第一個“可視”的程式設計軟體誕生了。

## 發展

-   1992年9月，Visual Basic 1.0 for DOS 版本釋出。
-   1992年11月，Visual Basic 2.0 釋出。改善了速度。
-   1993年，VIsual Basic 3.0 釋出，此版本分為標準版和專業版。重大改變是內建了一個數據引擎，可以直接讀取Access資料庫。
-   1995年8月，Visual Basic 4.0 釋出，包括16位版本和32位的版本。從此版本開始，引入了面向物件的程式設計思想；同時引入了“控制元件”的概念，使得可以直接利用大量已經編好的VB程式。
-   1997年2月，Visual Basic 5.0。此版本包含了使用者自建控制元件的支援。從此版本開始，VB支援編譯為本機原生程式碼（需要VB執行庫），在此之前的 Visual Basic 1.0~4.0 都必須將原始碼編譯成VB虛擬碼後解釋執行。
-   1998年夏，Visual Basic 6.0 釋出。這是VB最傳奇的版本。也是VB.NET至今仍無法完全取代的版本。

## 轉變

-   2001年，Visual Basic .NET 和 .NET Framework 一同釋出。使用了新的核心和特性。很多VB程式碼為了遷移必須改寫。
-   2002年Visual Basic .NET 2002（即VB 7.0）問世，此後 Visual Basic 被包含在 Visual Studio 套件中。此版本支援了很多新特性：繼承，多執行緒，異常處理……

## 失寵

-   2005年，微軟宣佈將不會再對非.NET版本的VB進行支援。
-   當微軟釋出 Visual Basic .NET 和 C# 開啟 .NET 時代時，兩種語言是並行發展的，有著幾乎相同的功能集。但隨著時間的遷移，現在微軟的開發文件基本上只提供 C# 示例，而沒有 VB 示例了。

## 日薄西山

-   C#/VB 的同步發展策略在 2017 年結束，只有 C# 獲得新的功能，微軟事實上放棄了 Visual Basic。
-   2020年3月11日，微軟 DevBlogs 宣佈從 .NET 5 開始，Visual Basic 將支援 Class Library、Console、Windows Forms、WPF、Worker Service 和 ASP.NET Core Web API 等，為想要將現有應用遷移到 .NET Core 的 VB 客戶提供一條路徑，而 Visual Basic 語言本身將不會繼續發展或引入新特性，未來將主要著重於穩定性和相容性。正式承認放棄 Visual Basic。

## 何去何從

VB的一生都在爭論中度過：
-   VB的簡單特性使得其在未來具有傷害性。很多人學習了VB，但是並沒有學到好的程式設計習慣。而且很多錯誤和警告的檢查預設情況下都是關閉的，程式設計師很難找到隱藏的錯誤。
-   VB的易用性就是它最大的優勢，可以讓略通皮毛的人都能用自己的方式快速開發程式。
-   VB的程式可以非常簡單的和資料庫連線。

## Only My Opinion

VB的誕生是歷史的必然，也是那個時代的訴求。但是作為一門程式語言來講，和老驥伏櫪的C不同，VB已經不再適應這個時代：過高的平臺繫結（這本身並不是特別嚴重的問題，雖然我不喜歡，但是真正可怕的是VB作為一門和Windows系統繫結的語言，不能很好地綜合 Windows 的基礎API，甚至很多時候要使用低階運算的“小伎倆”來進行程式設計。），不高的執行效率，自身的相容性問題（VB6與VB.NET）；而如果作為入門語言來講，他又會帶來很多不好的程式設計習慣。
