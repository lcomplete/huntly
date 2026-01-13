#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to check if install is needed
need_install() {
  local modules=("huntly-common" "huntly-interfaces" "huntly-jpa")

  # Check if any module's target directory or jar is missing
  for module in "${modules[@]}"; do
    if [ ! -d "$module/target" ]; then
      echo "Module $module has no target directory"
      return 0
    fi

    # Check if jar exists
    if ! ls "$module/target/"*.jar 1>/dev/null 2>&1; then
      echo "Module $module has no compiled jar"
      return 0
    fi
  done

  # Check if any pom.xml is newer than the compiled jars
  for module in "${modules[@]}"; do
    local jar_file=$(ls -t "$module/target/"*.jar 2>/dev/null | head -1)
    if [ -n "$jar_file" ]; then
      # Check root pom.xml
      if [ "pom.xml" -nt "$jar_file" ]; then
        echo "Root pom.xml is newer than $module jar"
        return 0
      fi
      # Check module pom.xml
      if [ "$module/pom.xml" -nt "$jar_file" ]; then
        echo "Module $module/pom.xml is newer than its jar"
        return 0
      fi
      # Check if any source file is newer than jar
      local newer_src=$(find "$module/src" -type f \( -name "*.java" -o -name "*.xml" -o -name "*.properties" -o -name "*.yml" \) -newer "$jar_file" 2>/dev/null | head -1)
      if [ -n "$newer_src" ]; then
        echo "Source file $newer_src is newer than $module jar"
        return 0
      fi
    fi
  done

  return 1
}

# Check and run install if needed
if need_install; then
  echo "============================================"
  echo "Dependencies need to be rebuilt. Running install.sh..."
  echo "============================================"
  ./install.sh
  if [ $? -ne 0 ]; then
    echo "Install failed!"
    exit 1
  fi
  echo "============================================"
  echo "Install completed. Starting dev server..."
  echo "============================================"
fi

maven_args=()
jvm_args=()

# Default: disable connector task (notask mode)
enable_task=false

for arg in "$@"; do
  case "$arg" in
    --task)
      enable_task=true
      ;;
    *)
      maven_args+=("$arg")
      ;;
  esac
done

# Only enable connector task if --task is explicitly passed
if [ "$enable_task" = false ]; then
  jvm_args+=("-Dhuntly.connector-task.enabled=false")
fi

if [ ${#jvm_args[@]} -gt 0 ]; then
  jvm_args_str=$(IFS=' '; echo "${jvm_args[*]}")
  maven_args+=("-Dspring-boot.run.jvmArguments=${jvm_args_str}")
fi

./mvnw spring-boot:run -pl huntly-server -Dspring-boot.run.profiles=dev "${maven_args[@]}"
