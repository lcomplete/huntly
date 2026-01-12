#!/bin/bash

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
