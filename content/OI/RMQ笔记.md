+++
title = "RMQ笔记"
date = 2019-12-12T18:45:58+08:00
draft = true
slug = "rmq-note"
[taxonomies]
tags = ["OI", "RMQ", "ST表", "线段树"]
categories = ["OI"]
+++

### 简介

RMQ是区间最值询问（Range Maximum/Minimum Query）的缩写

### 算法

*题设*：给定 $n$ 个数，有 $m$ 个询问，对于每个询问，你需要回答区间 $[x,y]$ 中的最大值

#### 朴素做法

每次对区间 $[x,y]$ 扫描一遍，求出最值
时间复杂度为 $O(mn)$

#### ST表

> 时间复杂度
> > 预处理 $O(n\,log\,n)$ 
> > 单次询问 $O(1)$

> 空间复杂度
>
> > $O(n\,log\,n)$

**不支持修改**

ST表的基本思想是倍增。
要降低时间复杂度，首先要分析朴素算法慢在哪里。显然，朴素算法每次要遍历区间中每个点，如果我们用区间取代点就能有效提升效率。
同时，区间最值允许区间重叠，所以我们使用倍增。
令 $f[i,j]$ 表示区间 $[i,i+2^j-1]$ 的最大值，那么有 $f[i,0]=a[i]$ .


无法直接查到的用两个互有重叠的区间覆盖该区间来查找，即 $max(f[l,x], f[r - 2^x+1,x])$ ，其中 $x=\log_2(r-l+1)$
```cpp
//下段代码用于当区间长度为r-l+1使用的对数
logn[1] = 0; logn[2] = 1;
for (int i = 3; i <= maxn; i++) {
    logn[i] = logn[i >> 1] + 1;
}
```
```cpp
//预处理
for (int i = 1; i <= n; i++) f[i][0] = read();
for (int j = 1; j <= logn[n]; j++)
    for (int i = 1; i + (1 << j) - 1 <= n; i++)
        f[i][j] = max(f[i][j - 1], f[i + (1 << (j - 1))][j - 1]);
```
```cpp
//单次询问
int x=logn[r-l+1];
printf("%d\n",max(f[l][x], f[r - (1<<x)+1][x]));
```

#### 线段树

参见[线段树笔记](https://blog.coelacanthus.moe/404.html)
