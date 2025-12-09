#!/bin/bash

# Huntly Tauri 开发环境准备脚本
# 此脚本用于准备 Tauri 开发所需的文件

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$(dirname "$TAURI_DIR")")"
SERVER_DIR="$ROOT_DIR/app/server"
SERVER_BIN_DIR="$TAURI_DIR/src-tauri/server_bin"

echo "=========================================="
echo "Huntly Tauri 开发环境准备脚本"
echo "=========================================="
echo ""
echo "项目根目录: $ROOT_DIR"
echo "服务器目录: $SERVER_DIR"
echo "目标目录: $SERVER_BIN_DIR"
echo ""

# 创建 server_bin 目录（如果不存在）
mkdir -p "$SERVER_BIN_DIR"

# 检查是否需要构建服务器
BUILD_SERVER=false
JAR_FILE=$(find "$SERVER_DIR/huntly-server/target" -name "huntly-server*.jar" -not -name "*-sources.jar" 2>/dev/null | head -1)

if [ -z "$JAR_FILE" ]; then
    echo "⚠️  未找到编译好的 JAR 文件，需要先构建服务器..."
    BUILD_SERVER=true
elif [ ! -f "$SERVER_BIN_DIR/huntly-server.jar" ]; then
    echo "ℹ️  找到 JAR 文件: $JAR_FILE"
else
    # 检查源文件是否比目标文件新
    if [ "$JAR_FILE" -nt "$SERVER_BIN_DIR/huntly-server.jar" ]; then
        echo "ℹ️  JAR 文件有更新，将重新复制..."
    else
        echo "✅ huntly-server.jar 已是最新"
    fi
fi

# 构建服务器（如果需要）
if [ "$BUILD_SERVER" = true ]; then
    echo ""
    echo "🔨 正在构建 Spring Boot 服务器..."
    cd "$SERVER_DIR"
    ./mvnw clean package -DskipTests
    JAR_FILE=$(find "$SERVER_DIR/huntly-server/target" -name "huntly-server*.jar" -not -name "*-sources.jar" 2>/dev/null | head -1)
    
    if [ -z "$JAR_FILE" ]; then
        echo "❌ 构建失败：未找到 JAR 文件"
        exit 1
    fi
fi

# 复制 JAR 文件
echo ""
echo "📦 正在复制 JAR 文件..."
cp "$JAR_FILE" "$SERVER_BIN_DIR/huntly-server.jar"
echo "✅ JAR 文件已复制: $SERVER_BIN_DIR/huntly-server.jar"

# 检查 JRE 是否存在
if [ ! -d "$SERVER_BIN_DIR/jre11/bin" ]; then
    echo ""
    echo "⚠️  未找到 jre11，正在使用 jlink 创建..."
    
    # 检查 JAVA_HOME
    if [ -z "$JAVA_HOME" ]; then
        echo "❌ 错误：JAVA_HOME 未设置"
        echo "   请设置 JAVA_HOME 环境变量指向 JDK 11 安装目录"
        exit 1
    fi
    
    echo "   JAVA_HOME: $JAVA_HOME"
    
    # 删除旧的 jre11 目录（如果存在）
    rm -rf "$SERVER_BIN_DIR/jre11"
    
    # 使用 jlink 创建精简版 JRE
    cd "$SERVER_BIN_DIR"
    jlink \
        --module-path "$JAVA_HOME/jmods" \
        --add-modules java.compiler,java.sql,java.naming,java.management,java.instrument,java.rmi,java.desktop,jdk.internal.vm.compiler.management,java.xml.crypto,java.scripting,java.security.jgss,jdk.httpserver,java.net.http,jdk.naming.dns,jdk.crypto.cryptoki,jdk.unsupported \
        --verbose \
        --strip-debug \
        --compress 2 \
        --no-header-files \
        --no-man-pages \
        --output jre11
    
    echo "✅ JRE 已创建: $SERVER_BIN_DIR/jre11"
else
    echo "✅ jre11 已存在"
fi

echo ""
echo "=========================================="
echo "✅ 准备完成！现在可以运行："
echo "   cd app/tauri && yarn tauri dev"
echo "=========================================="

