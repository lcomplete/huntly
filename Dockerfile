FROM openjdk:11

LABEL maintainer="lcomplete"
LABEL version = "0.1.0"

WORKDIR /app

VOLUME /data

RUN mkdir -p /data /data/lucene

ARG JAR_FILE=./app/server/huntly-server/target/huntly-server-*.jar
ARG JAR_PATH=/app/server.jar

COPY ${JAR_FILE} ${JAR_PATH}

ENV JAVA_ARGS="-Xms128m -Xmx1024m"
ENV VM_ARGS="-Duser.timezone=GMT+08"
ENV APP_ARGS=""
ENV PROFILE="default"
ENV PORT=80
ENV JAR_PATH=${JAR_PATH}

EXPOSE ${PORT}
EXPOSE 443

ENTRYPOINT ["sh", "-c", "java $JAVA_ARGS $VM_ARGS -jar $JAR_PATH --spring.profiles.active=$PROFILE --server.port=$PORT --huntly.dataDir=/data/ --huntly.luceneDir=/data/lucene $APP_ARGS" ]