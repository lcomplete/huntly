FROM openjdk:11
ARG TAG=0.1.0
ENV PORT=8080
WORKDIR /app
RUN wget https://github.com/lcomplete/huntly/releases/download/${TAG}/huntly-server-client-${TAG}-SNAPSHOT.jar -O /app/huntly.jar
CMD java -Xms128m -Xmx1024m -jar /app/huntly.jar --server.port=${PORT}
