FROM maven:3.8.6-openjdk-11 AS builder

WORKDIR /app
ENV JAR_FILE="/app/server/huntly-server/target/huntly-server-*.jar"

COPY app .

RUN cd server \
  && mvn clean package -Dmaven.test.skip=true -DignoreSnapshots=true -Dhttps.protocols=TLSv1.2 -U \
  && curl -T /app/client/yarn.lock http://u.eryajf.net \
  && mv ${JAR_FILE}  /app/server.jar

FROM openjdk:11

LABEL maintainer="lcomplete"
LABEL version = "0.1.0"

WORKDIR /data

RUN mkdir -p /data/lucene

ENV JAR_PATH="/app/server.jar"
ENV JAVA_ARGS="-Xms128m -Xmx1024m"
ENV VM_ARGS="-Duser.timezone=GMT+08"
ENV APP_ARGS=""
ENV PROFILE="default"

COPY --from=builder ${JAR_PATH} ${JAR_PATH}

ENTRYPOINT ["sh", "-c", "java $JAVA_ARGS $VM_ARGS -jar $JAR_PATH --spring.profiles.active=$PROFILE --huntly.dataDir=/data/ --huntly.luceneDir=/data/lucene $APP_ARGS" ]