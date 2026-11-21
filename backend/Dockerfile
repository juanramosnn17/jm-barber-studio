# =====================================================================
# Dockerfile multi-etapa · API JM Barber Studio (Spring Boot 4.2 + Java 21)
# Compatible con Render, Railway y AWS App Runner / ECS (tarea 4.15).
# - Nunca incluye backend/.env (bloqueado en .dockerignore).
# - Corre como usuario sin privilegios (appuser).
# - Limita heap al 70% de la RAM del contenedor (~350 MB en Render Free 512 MB).
# =====================================================================

# --- Etapa 1: compilación del .jar con Maven Wrapper -----------------
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# Garantiza finales LF y permiso de ejecución si el repo se clonó desde Windows
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src/ src/
RUN ./mvnw -B -DskipTests package

# --- Etapa 2: imagen final liviana solo con JRE 21 -------------------
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Zona horaria Colombia por defecto (alineada con TimeConfig y Hibernate)
ENV TZ=America/Bogota

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/target/api-*.jar /app/app.jar
RUN chown appuser:appgroup /app/app.jar

USER appuser
EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=70.0", "-XX:InitialRAMPercentage=40.0", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/app/app.jar"]
