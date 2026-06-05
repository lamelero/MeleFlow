# Instalación de MeleFlow en Linux (modo producción)

## Requisitos
- Linux con Docker + Docker Compose plugin (v2)
- `curl`, `openssl`
- Puerto `3001` libre

## Procedimiento

```bash
# 1. Crear directorio
sudo mkdir -p /opt/meleflow
sudo chown $USER:$USER /opt/meleflow
cd /opt/meleflow

# 2. Descargar compose de producción
curl -L -o docker-compose.yml \
  "https://raw.githubusercontent.com/lamelero/MeleFlow/refs/heads/main/docker-compose.prod.yml"

# 3. Generar secrets
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# 4. Crear .env
#    Cambiar FRONTEND_URL por la IP pública o dominio si es necesario
cat > .env << EOF
DOCKER_USER=meleflow
TAG=latest
NGINX_PORT=3001
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://taskflow:${POSTGRES_PASSWORD}@postgres:5432/taskflow
REDIS_URL=redis://redis:6379
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}
FRONTEND_URL=http://localhost:3001
ALLOW_REGISTRATION=true
MAX_UPLOAD_SIZE=50
EOF

# 5. Crear directorio de uploads
mkdir -p uploads

# 6. Descargar imágenes y arrancar
docker compose pull
docker compose up -d

# 7. Verificar
docker compose ps
curl -s http://localhost:3001/api/health
```

## Contenedores

| Contenedor | Puerto | Imagen |
|---|---|---|
| `meleflow-postgres` | — | `postgres:16-alpine` |
| `meleflow-redis` | — | `redis:7-alpine` |
| `meleflow-backend` | — | `meleflow/meleflow-backend:latest` |
| `meleflow-worker` | — | `meleflow/meleflow-backend:latest` |
| `meleflow-nginx` | `3001` | `meleflow/meleflow-frontend:latest` |

## Actualizar a nueva versión

```bash
cd /opt/meleflow
docker compose pull
docker compose up -d
```

## Borrar completamente (incluye DB)

```bash
cd /opt/meleflow
docker compose down -v
rm -rf /opt/meleflow
```
