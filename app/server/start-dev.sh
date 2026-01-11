#!/bin/bash

maven_args=()

for arg in "$@"; do
  case "$arg" in
    --notask)
      maven_args+=("-Dhuntly.connector-task.enabled=false")
      ;;
    *)
      maven_args+=("$arg")
      ;;
  esac
done

./mvnw spring-boot:run -pl huntly-server "${maven_args[@]}"
