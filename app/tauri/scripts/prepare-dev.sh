#!/bin/bash

# Huntly Tauri 开发环境准备脚本
# 此脚本用于准备 Tauri 开发所需的文件

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$(dirname "$TAURI_DIR")")"
CLIENT_DIR="$ROOT_DIR/app/client"
SERVER_DIR="$ROOT_DIR/app/server"
SERVER_BIN_DIR="$TAURI_DIR/src-tauri/server_bin"

# 解析命令行参数
FORCE_BUILD=false
SKIP_CLIENT=false
SKIP_SERVER=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_BUILD=true
            shift
            ;;
        --skip-client)
            SKIP_CLIENT=true
            shift
            ;;
        --skip-server)
            SKIP_SERVER=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -f, --force      强制重新构建所有内容"
            echo "  --skip-client    跳过客户端构建"
            echo "  --skip-server    跳过服务器构建"
            echo "  -h, --help       显示帮助信息"
            exit 0
            ;;
        *)
            echo "未知参数: $1"
            exit 1
            ;;
    esac
done

echo "=========================================="
echo "Huntly Tauri 开发环境准备脚本"
echo "=========================================="
echo ""
echo "项目根目录: $ROOT_DIR"
echo "客户端目录: $CLIENT_DIR"
echo "服务器目录: $SERVER_DIR"
echo "目标目录: $SERVER_BIN_DIR"
echo ""

# 创建 server_bin 目录（如果不存在）
mkdir -p "$SERVER_BIN_DIR"

# ==========================================
# Step 1: 构建前端客户端
# ==========================================
BUILD_CLIENT=false

if [ "$SKIP_CLIENT" = true ]; then
    echo "⏭️  跳过客户端构建（--skip-client）"
elif [ "$FORCE_BUILD" = true ]; then
    BUILD_CLIENT=true
    echo "🔨 强制重新构建客户端..."
elif [ ! -d "$CLIENT_DIR/build" ]; then
    BUILD_CLIENT=true
    echo "⚠️  未找到客户端构建目录，需要先构建客户端..."
elif [ ! -f "$CLIENT_DIR/build/index.html" ]; then
    BUILD_CLIENT=true
    echo "⚠️  客户端构建不完整，需要重新构建..."
else
    echo "✅ 客户端已构建"
fi

if [ "$BUILD_CLIENT" = true ]; then
    echo ""
    echo "🔨 正在构建 React 客户端..."
    cd "$CLIENT_DIR"

    # 检查是否需要安装依赖
    if [ ! -d "node_modules" ]; then
        echo "📦 安装客户端依赖..."
        yarn install
    fi

    # 构建客户端
    yarn build

    if [ ! -f "$CLIENT_DIR/build/index.html" ]; then
        echo "❌ 客户端构建失败：未找到 index.html"
        exit 1
    fi
    echo "✅ 客户端构建完成"
fi

# ==========================================
# Step 2: 构建 Spring Boot 服务器
# ==========================================
BUILD_SERVER=false

if [ "$SKIP_SERVER" = true ]; then
    echo "⏭️  跳过服务器构建（--skip-server）"
elif [ "$FORCE_BUILD" = true ]; then
    BUILD_SERVER=true
    echo "🔨 强制重新构建服务器..."
else
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
            # 检查客户端是否比 JAR 文件新（如果刚构建过客户端）
            if [ "$BUILD_CLIENT" = true ]; then
                echo "ℹ️  客户端已更新，需要重新构建服务器..."
                BUILD_SERVER=true
            else
                echo "✅ huntly-server.jar 已是最新"
            fi
        fi
    fi
fi

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
    echo "✅ 服务器构建完成"
else
    JAR_FILE=$(find "$SERVER_DIR/huntly-server/target" -name "huntly-server*.jar" -not -name "*-sources.jar" 2>/dev/null | head -1)
fi

# ==========================================
# Step 3: 复制 JAR 文件到目标目录
# ==========================================
if [ "$SKIP_SERVER" = true ]; then
    echo "⏭️  跳过 JAR 文件复制（--skip-server）"
elif [ -n "$JAR_FILE" ]; then
    echo ""
    echo "📦 正在复制 JAR 文件..."
    cp "$JAR_FILE" "$SERVER_BIN_DIR/huntly-server.jar"
    echo "✅ JAR 文件已复制: $SERVER_BIN_DIR/huntly-server.jar"
else
    echo "⚠️  未找到 JAR 文件，跳过复制"
fi

# ==========================================
# Step 4: 检查并创建 JRE
# ==========================================
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

