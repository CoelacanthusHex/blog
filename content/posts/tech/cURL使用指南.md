---
title: "cURL使用指南"
date: 2020-01-04T10:34:06+08:00
draft: false
toc: true
gitinfo: true
slug: "curl-use-man"
aliases:
  - "/tech/curl-use-man"
tags: [cURL, Tools]
---

## 简介

>   Command line tool and library for transferring data with URLs.

以上是 `cURL` 官网上的介绍

curl是一种命令行工具，作用是发出网络请求，然后得到和提取数据，显示在"标准输出"（stdout）上面。

### 关于她支持的协议……

DICT, FILE, FTP, FTPS, Gopher, HTTP, HTTPS, IMAP, IMAPS, LDAP, LDAPS, POP3, POP3S, RTMP, RTSP, SCP, SFTP, SMB, SMBS, SMTP, SMTPS, Telnet and TFTP. curl supports SSL certificates, HTTP POST, HTTP PUT, FTP uploading, HTTP form based upload, proxies, HTTP/2, cookies, user+password authentication (Basic, Plain, Digest, CRAM-MD5, NTLM, Negotiate and Kerberos), file transfer resume, proxy tunneling and more.

**PS：curl 已取代 wget 成为 Linux 系统预装的命令行下载工具**

## 参数介绍

如果只是想简单了解用法的 [Click Here](#简单使用)

参数介绍部分参考自 [curl 的用法指南 by 阮一峰](https://www.ruanyifeng.com/blog/2019/09/curl-reference.html)

不带有任何参数时，curl 默认发出 `GET` 请求。

### -A

-A 参数指定客户端的 User-Agent。curl 默认的 User-Agent 是 `curl/[version]``。

    $ curl -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36' https://example.com

下面命令会移除 User-Agent 标头。

    $ curl -A '' https://example.com

也可以通过-H参数直接指定 User-Agent。

    $ curl -H 'User-Agent: php/1.0' https://example.com

### -b

-b 参数用来向服务器发送 Cookie。

    $ curl -b 'foo=xxx' https://example.com

上面命令会生成一个标头 Cookie: foo=xxx，向服务器发送一个名为 foo、值为 xxx 的 Cookie。

此参数可多次使用

    $ curl -b cookies.txt https://www.example.com

上面命令读取本地文件 cookies.txt 里服务器设置的 Cookie（参见-c参数），将其发送到服务器。

### -c

-c 参数将服务器设置的 Cookie 写入一个文件。

    $ curl -c cookies.txt https://www.example.com

上面命令将服务器的 HTTP 回应所设置 Cookie 写入文本文件 cookies.txt。

### -d

-d 参数用于发送 POST 请求的数据体。

    $ curl -d'login=username＆password=123456'-X POST https://example.com/login
    # 或者
    $ curl -d 'login=username' -d 'password=123456' -X POST  https://example.com/login

使用-d参数以后，HTTP 请求会自动加上标头 Content-Type : application/x-www-form-urlencoded。并且会自动将请求转为 POST 方法，因此可以省略-X POST。

-d 参数可以读取本地文本文件的数据，向服务器发送。

    $ curl -d '@data.txt' https://example.com/login

上面命令读取data.txt文件的内容，作为数据体向服务器发送。
--data-urlencode

--data-urlencode参数等同于-d，发送 POST 请求的数据体，区别在于会自动将发送的数据进行 URL 编码。

    $ curl --data-urlencode 'comment=hello world' https://example.com/login

上面代码中，发送的数据hello world之间有一个空格，需要进行 URL 编码。

### -e

-e 参数用来设置 HTTP 的标头Referer，表示请求的来源。

    $ curl -e 'https://example.com?q=example' https://www.example.com

上面命令将Referer标头设为 https://example.com?q=example。

-H 参数可以通过直接添加标头Referer，达到同样效果。

    $ curl -H 'Referer: https://example.com?q=example' https://www.example.com

### -G

-G 参数用来构造 URL 的查询字符串。

    $ curl -G -d 'q=kitties' -d 'count=20' https://example.com/search

上面命令会发出一个 GET 请求，实际请求的 URL 为https://example.com/search?q=kitties&count=20。如果省略--G，会发出一个 POST 请求。

如果数据需要 URL 编码，可以结合--data--urlencode参数。

    $ curl -G --data-urlencode 'comment=hello world' https://www.example.com

### -H

-H 参数添加 HTTP 请求的标头。

    $ curl -H 'Accept-Language: zh-CN' https://example.com

上面命令添加 HTTP 标头Accept-Language: en-US。

    $ curl -d '{"login": "username", "pass": "123456"}' -H 'Content-Type: application/json' https://example.com/login

上面命令添加 HTTP 请求的标头是Content-Type: application/json，然后用-d参数发送 JSON 数据。

### -i

-i 参数打印出服务器回应的 HTTP 标头。

    $ curl -i https://www.example.com

上面命令收到服务器回应后，先输出服务器回应的标头，**然后空一行**，再输出网页的源码。

### -I

-I 参数向服务器发出 HEAD 请求，然会将服务器返回的 HTTP 标头打印出来。

    $ curl -I https://www.example.com

上面命令输出服务器对 HEAD 请求的回应。

--head 参数等同于-I。*话说为什么 head 对应的却是 -I 呢*

    $ curl --head https://www.example.com

### -k

-k 参数指定跳过 SSL 检测。

    $ curl -k https://www.example.com

上面命令不会检查服务器的 SSL 证书是否正确。
### -L

-L 参数会让 HTTP 请求跟随服务器的重定向。**curl 默认不跟随重定向。**

    $ curl -L -d 'tweet=hi' https://api.twitter.com/tweet

### --limit-rate

--limit-rate 限制 HTTP 请求和回应的带宽，可以用来模拟慢网速的环境。~~个人觉得除了测试网站或服务没啥用~~

    $ curl --limit-rate 250k https://example.com

上面命令将带宽限制在每秒 250KB。
### -o

-o 参数将服务器的回应保存成文件，等同于wget命令。

    $ curl  https://www.example.com -o example.html

上面命令将 www.example.com 保存成 example.html。
### -O

-O 参数将服务器回应保存成文件，并将 URL 的最后部分当作文件名。

    $ curl -O https://www.example.com/foo/xxx.html

上面命令将服务器回应保存成文件，文件名为 xxx.html。

用来下载还是 -O 参数比较常用啦

### -s

-s 将不输出错误和进度信息。

    $ curl -s https://www.example.com

上面命令一旦发生错误，不会显示错误信息。不发生错误的话，会正常显示运行结果。

如果想让 curl 不产生任何输出，可以使用下面的命令~~或者重定向也可以哒~~。

    $ curl -s -o /dev/null https://example.com

### -S

-S 参数指定只输出错误信息，通常与 -s 一起使用。

    $ curl -s -o /dev/null https://example.com

除非发生错误，上面命令没有任何输出。

### -u

-u 参数用来设置服务器认证的用户名和密码。

    $ curl -u 'tom:123456' https://example.com/login

上面命令设置用户名为 tom ，密码为123456，然后将其转为 HTTP 标头。

curl 能够识别 URL 里面的用户名和密码。

    $ curl https://tom:123456@example.com/login

上面命令能够识别 URL 里面的用户名和密码，将其转为上个例子里面的 HTTP 标头。

    $ curl -u 'tom' https://example.com/login

上面命令只设置了用户名，执行后，curl 会提示用户输入密码。

### -v

-v 参数输出通信的整个过程，用于调试。

    $ curl -v https://www.example.com

--trace 参数也可以用于调试，还会输出原始的二进制数据。

    $ curl --trace - https://www.example.com

### -x

-x参数指定 HTTP 请求的代理。

    $ curl -x socks5://username:password@myproxy.com:8080 https://www.example.com

上面命令指定 HTTP 请求通过 myproxy.com:8080 的 socks5 代理发出。

如果没有指定代理协议，默认为 HTTP。

    $ curl -x james:cats@myproxy.com:8080 https://www.example.com

上面命令中，请求的代理使用 HTTP 协议。

### -X

-X参数指定 HTTP 请求的方法。

    $ curl -X POST https://www.example.com

上面命令对 https://www.example.com 发出 POST 请求。

## 简单使用

### 获取网页源码（就是下载喵）

直接在curl命令后加上网址，就可以看到网页源码。

    $ curl www.example.com

```html
    <!doctype html>
    <html>
    <head>
        <title>Example Domain</title>

        <meta charset="utf-8" />
        <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style type="text/css">
        body {
            background-color: #f0f0f2;
            margin: 0;
            padding: 0;
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;

        }
        div {
            width: 600px;
            margin: 5em auto;
            padding: 2em;
            background-color: #fdfdff;
            border-radius: 0.5em;
            box-shadow: 2px 3px 7px 2px rgba(0,0,0,0.02);
        }
        a:link, a:visited {
            color: #38488f;
            text-decoration: none;
        }
        @media (max-width: 700px) {
            div {
                margin: 0 auto;
                width: auto;
            }
        }
        </style>
    </head>

    <body>
    <div>
        <h1>Example Domain</h1>
        <p>This domain is for use in illustrative examples in documents. You may use this
        domain in literature without prior coordination or asking for permission.</p>
        <p><a href="https://www.iana.org/domains/example">More information...</a></p>
    </div>
    </body>
    </html>
```
<span class="spoiler">试过以后才发现真的有这个网站</span>

而如果要把这个网页保存下来，可以使用 `-o` 参数，这就相当于使用wget命令了。（最好还是结合自动跳转使用

    $ curl www.example.com -o [文件名]

### 自动跳转

有的网址是自动跳转的。使用`-L`参数，curl就会跳转到新的网址。

### HTTP认证

有些网站需要 HTTP 认证，这时 curl 需要用到 `--user` 参数。

    $ curl --user username:password example.com
