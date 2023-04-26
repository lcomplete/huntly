# Huntly

**中文** | [English](./README.en.md)

## 目录

- [Huntly](#huntly)
  - [目录](#目录)
  - [系统截图](#系统截图)
  - [运行前提](#运行前提)
  - [使用](#使用)
    - [运行服务端](#运行服务端)
      - [使用服务端安装包](#使用服务端安装包)
      - [使用 docker 运行](#使用-docker-运行)
      - [使用 Java 命令运行](#使用-java-命令运行)
      - [安装为 windows 服务](#安装为-windows-服务)
    - [安装浏览器插件](#安装浏览器插件)
    - [浏览器插件设置](#浏览器插件设置)
    - [登录并使用](#登录并使用)
  - [请作者喝杯咖啡](#请作者喝杯咖啡)

Huntly 是一个信息管理工具，它不仅可以自托管，也可以通过客户端在本地运行。简单来说，它包含以下功能：

- RSS 订阅和阅读。
- 自动保存浏览过的网页，随后以保存、稍后读、收藏或存档的方式将其保存。
- 针对推特网站有特殊的处理，会自动保存请求过的推特 timeline，记录是否浏览过，在 huntly 中你甚至可以用更方便的方式重新查看这些推文。
- 可以从标题、内容、类型、收藏方式等维度进行搜索。
- 连接其他服务，目前支持 GitHub，所以它也是一个 Github stars 管理工具。

未来可能会支持连接到 Pocket、Hypothesis 等服务。

## 系统截图

![intro1](static/images/intro1.png)

![intro2](static/images/intro2.png)

## 运行前提

- Java 11

## 使用

### 运行服务端

可以使用以下方式之一运行服务端。

#### 使用服务端安装包

在 [Releases](https://github.com/lcomplete/huntly/releases) 中下载对应操作系统的安装包，安装后运行即可。

在 Mac 中，如果碰到 `"Huntly.app" is damaged and can't be opened` 的提示消息，请先执行以下命令再进行安装。

```sh
sudo xattr -r -d com.apple.quarantine /YOUR_PATH/huntly.dmg
```

#### 使用 docker 运行

```sh
mkdir huntly && cd huntly
docker run -itd --name huntly --restart=always -p <host port>:80 -v `pwd`/data:/data lcomplete/huntly
```

总是拉取 latest 的镜像，如需要升级，可删除本地的 latest，然后再次运行启动命令即可。

#### 使用 Java 命令运行

下载 [Releases](https://github.com/lcomplete/huntly/releases) 中的 jar 包，react 客户端也打包在其中。

下载后在命令行中 cd 到当前目录，通过以下 Java 命令运行：

```sh
java -Xms128m -Xmx1024m -jar huntly-server.jar
```

默认以 8080 端口运行，你可以打开 [http://localhost:8080/](http://localhost:8080/) 端口进行访问，若需要使用其他端口，比如 80 端口，可运行以下命令：


```sh
java -Xms128m -Xmx1024m -jar huntly-server.jar --server.port=80
```

注意，Jar 包名称需要根据下载的包名做适当的修改。

#### 安装为 windows 服务

新建 Huntly 目录，以下操作在该目录中进行。

下载 [Releases](https://github.com/lcomplete/huntly/releases) 中的 jar 包。

下载 [WinSW exe](https://github.com/winsw/winsw/releases), 并将其重命名为 `app.exe` 。

新建 `app.xml`，内容如下：

```xml
<service>
  <id>huntly</id>
  <name>huntly</name>
  <description>huntly</description>
  <executable>java</executable>
  <arguments>-Xms128m -Xmx1024m -jar huntly-server.jar --server.port=8123</arguments>
  <log mode="roll"></log>
</service>
```

打开终端运行命令：

```sh
.\app.exe install .\app.xml
```

执行完上面的命令后，Huntly 已经被安装为 windows 服务，并设置为开机自动启动。当前为未启动状态，使用以下命令启动服务：

```sh
.\app.exe start .\app.xml
```

启动成功后可访问 [http://localhost:8123](http://localhost:8123) 。

若提示 java 命令无法执行，可将 `executable` 的值改为完整的 `java.exe` 路径。

还支持 uninstall、stop、restart、status、refresh、customize 等命令，具体使用方式请查看 [https://github.com/winsw/winsw](https://github.com/winsw/winsw)。

### 安装浏览器插件

插件已上架 chrome 应用商店，可直接在 [chrome 应用商店 huntly 扩展页面](https://chrome.google.com/webstore/detail/huntly/cphlcmmpbdkadofgcedjgfblmiklbokm) 安装。

如果你想使用最新的功能，可下载 [Releases](https://github.com/lcomplete/huntly/releases) 中的 browser-extension.zip ，将其解压缩。

在浏览器中管理扩展，启用开发者模式，加载已解包的扩展即可。

### 浏览器插件设置

点击插件图标，选择设置 huntly 的服务端地址（huntly 网站首页地址），对于远程地址，在正式使用时，强烈建议使用 https 协议，毕竟浏览记录是相当私密的。若服务端在本机运行，则设置为本地地址即可。

### 登录并使用

首次打开 huntly 网站时，会提示注册一个管理员用户，目前仅支持单用户。

注册后将自动登录到系统中，在登录的情况下，huntly 插件才能将浏览记录发送到服务端。

## 请作者喝杯咖啡

<p align="center">
	<img height="360" src="static/images/wechat.JPG" />
	<img height="360" src="static/images/zfb.JPG" />
</p>
