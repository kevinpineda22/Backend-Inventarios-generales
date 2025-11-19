# 🚀 Guía de Despliegue - Backend Inventario General

Esta guía te ayudará a desplegar el backend en diferentes plataformas.

---

## 📋 Tabla de Contenido

- [Preparación Pre-Despliegue](#preparación-pre-despliegue)
- [Railway (Recomendado)](#railway)
- [Render](#render)
- [Heroku](#heroku)
- [DigitalOcean](#digitalocean)
- [AWS EC2](#aws-ec2)
- [Servidor VPS Genérico](#servidor-vps-genérico)
- [Docker](#docker)
- [Post-Despliegue](#post-despliegue)

---

## ⚙️ Preparación Pre-Despliegue

### 1. Verificar que el proyecto funciona localmente

```bash
npm install
npm run dev
```

Visita `http://localhost:3001/health` para verificar.

### 2. Configurar Supabase

1. Accede a [supabase.com](https://supabase.com)
2. Crea o selecciona tu proyecto
3. Ve a **Settings** → **API**
4. Copia:
   - `Project URL` (SUPABASE_URL)
   - `anon public` key (SUPABASE_ANON_KEY)
   - `service_role` key (SUPABASE_SERVICE_KEY)

### 3. Ejecutar Script de Base de Datos

1. En Supabase, ve a **SQL Editor**
2. Copia y pega el contenido de `setup_database.sql` (del frontend)
3. Ejecuta el script

### 4. Verificar Variables de Entorno

Asegúrate de tener todas estas variables:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://tu-frontend.com
```

---

## 🚂 Railway (Recomendado)

Railway es la opción más fácil y rápida.

### Paso 1: Crear cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Regístrate con GitHub

### Paso 2: Nuevo Proyecto

1. Click en **New Project**
2. Selecciona **Deploy from GitHub repo**
3. Autoriza Railway para acceder a tu repositorio
4. Selecciona el repositorio del backend

### Paso 3: Configurar Variables de Entorno

1. Ve a tu proyecto en Railway
2. Click en **Variables**
3. Agrega cada variable:

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-role-key
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://tu-frontend.com
RATE_LIMIT_WINDOW_MS=15
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760
```

### Paso 4: Configurar Despliegue

Railway detecta automáticamente Node.js, pero puedes personalizar:

1. Click en **Settings**
2. En **Build Command**: `npm install`
3. En **Start Command**: `npm start`

### Paso 5: Desplegar

1. Railway despliega automáticamente en cada push
2. Espera a que termine el despliegue (1-3 minutos)
3. Railway te dará una URL: `https://tu-proyecto.railway.app`

### Verificar Despliegue

```bash
curl https://tu-proyecto.railway.app/health
```

---

## 🎨 Render

### Paso 1: Crear cuenta en Render

1. Ve a [render.com](https://render.com)
2. Regístrate con GitHub

### Paso 2: Nuevo Web Service

1. Click en **New +** → **Web Service**
2. Conecta tu repositorio de GitHub
3. Selecciona el repositorio del backend

### Paso 3: Configuración del Servicio

```
Name: backend-inventario-general
Environment: Node
Region: Oregon (US West) o el más cercano
Branch: main
Build Command: npm install
Start Command: npm start
```

### Paso 4: Variables de Entorno

En la sección **Environment**, agrega:

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-role-key
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://tu-frontend.onrender.com
```

### Paso 5: Plan

- Selecciona **Free** para pruebas
- O **Starter** ($7/mes) para producción

### Paso 6: Crear Web Service

1. Click en **Create Web Service**
2. Espera 5-10 minutos para el primer despliegue
3. Tu URL será: `https://tu-servicio.onrender.com`

**⚠️ Nota**: El plan gratuito se "duerme" después de 15 minutos de inactividad.

---

## 🦄 Heroku

### Paso 1: Instalar Heroku CLI

```bash
npm install -g heroku
heroku login
```

### Paso 2: Crear Aplicación

```bash
cd backend
heroku create backend-inventario-general
```

### Paso 3: Configurar Variables de Entorno

```bash
heroku config:set SUPABASE_URL=https://tu-proyecto.supabase.co
heroku config:set SUPABASE_ANON_KEY=tu-anon-key
heroku config:set SUPABASE_SERVICE_KEY=tu-service-role-key
heroku config:set NODE_ENV=production
heroku config:set CORS_ORIGIN=https://tu-frontend.herokuapp.com
```

### Paso 4: Configurar Buildpack

```bash
heroku buildpacks:set heroku/nodejs
```

### Paso 5: Desplegar

```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### Paso 6: Verificar

```bash
heroku logs --tail
heroku open
```

---

## 🌊 DigitalOcean

### Opción 1: App Platform (Más Fácil)

1. Ve a [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click en **Create App**
3. Conecta tu repositorio de GitHub
4. Selecciona el repositorio y rama
5. DigitalOcean detecta Node.js automáticamente
6. Configura variables de entorno
7. Selecciona plan ($5/mes básico)
8. Click en **Launch App**

### Opción 2: Droplet (Más Control)

#### 1. Crear Droplet

```
OS: Ubuntu 22.04 LTS
Plan: Basic ($6/mes)
CPU: Regular - 1GB RAM
Region: Más cercano a tus usuarios
```

#### 2. Conectar vía SSH

```bash
ssh root@tu-droplet-ip
```

#### 3. Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y nginx
```

#### 4. Clonar Repositorio

```bash
cd /var/www
git clone https://github.com/tu-usuario/tu-repo.git backend
cd backend
npm install
```

#### 5. Crear archivo .env

```bash
nano .env
```

Pega tus variables de entorno.

#### 6. Instalar PM2

```bash
npm install -g pm2
pm2 start server.js --name backend-inventario
pm2 startup
pm2 save
```

#### 7. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/backend
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 8. SSL con Certbot (HTTPS)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

## ☁️ AWS EC2

### Paso 1: Crear Instancia EC2

1. Ve a AWS Console → EC2
2. Click en **Launch Instance**
3. Selecciona **Ubuntu Server 22.04 LTS**
4. Tipo: `t2.micro` (elegible para free tier)
5. Configura Security Group:
   - SSH (22) - Tu IP
   - HTTP (80) - 0.0.0.0/0
   - HTTPS (443) - 0.0.0.0/0
   - Custom TCP (3001) - 0.0.0.0/0
6. Descarga el archivo `.pem`

### Paso 2: Conectar

```bash
chmod 400 tu-clave.pem
ssh -i "tu-clave.pem" ubuntu@tu-instancia-ip
```

### Paso 3: Instalar Dependencias

Sigue los mismos pasos que DigitalOcean Droplet (pasos 3-8).

### Paso 4: Configurar Elastic IP (Opcional)

Para tener una IP fija:

1. Ve a EC2 → Elastic IPs
2. Allocate new address
3. Associate con tu instancia

---

## 🐳 Docker

### Paso 1: Crear Dockerfile

Crea `Dockerfile` en la raíz del backend:

```dockerfile
# Imagen base
FROM node:18-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]
```

### Paso 2: Crear .dockerignore

```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
```

### Paso 3: Build de la Imagen

```bash
docker build -t backend-inventario:latest .
```

### Paso 4: Ejecutar Contenedor

```bash
docker run -d \
  -p 3001:3001 \
  -e SUPABASE_URL=https://tu-proyecto.supabase.co \
  -e SUPABASE_ANON_KEY=tu-anon-key \
  -e SUPABASE_SERVICE_KEY=tu-service-role-key \
  -e NODE_ENV=production \
  --name backend-inventario \
  backend-inventario:latest
```

### Paso 5: Docker Compose (Opcional)

Crea `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - NODE_ENV=production
      - CORS_ORIGIN=${CORS_ORIGIN}
    restart: unless-stopped
```

Ejecutar:

```bash
docker-compose up -d
```

---

## 🖥️ Servidor VPS Genérico

Para cualquier VPS (Vultr, Linode, etc.):

### 1. Requisitos del Servidor

- Ubuntu 20.04+ o Debian 11+
- Mínimo 1GB RAM
- Node.js 18+
- Nginx
- PM2

### 2. Pasos de Instalación

Sigue los pasos de **DigitalOcean Droplet** (Opción 2) que son aplicables a cualquier VPS.

---

## ✅ Post-Despliegue

### 1. Verificar Health Check

```bash
curl https://tu-backend.com/health
```

Debe responder:

```json
{
  "success": true,
  "message": "Backend Inventario General funcionando correctamente",
  "timestamp": "...",
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. Probar Endpoints

```bash
# Obtener items
curl https://tu-backend.com/api/items/1

# Estructura
curl https://tu-backend.com/api/estructura/1
```

### 3. Configurar Frontend

Actualiza la URL del backend en tu frontend:

```javascript
const API_URL = 'https://tu-backend.com/api';
```

### 4. Monitoreo

- **Logs**: Revisa logs regularmente
- **Uptime**: Usa [UptimeRobot](https://uptimerobot.com) o similar
- **Errores**: Configura alertas para errores 500

### 5. Backup

- Configura backups automáticos de Supabase
- Mantén copias del código en GitHub

---

## 🔧 Troubleshooting

### Error: CORS

Si ves errores de CORS:

1. Verifica `CORS_ORIGIN` en variables de entorno
2. Debe incluir la URL exacta de tu frontend

### Error: Supabase Connection

```bash
# Verifica las credenciales
curl -I https://tu-proyecto.supabase.co
```

### Puerto en Uso

```bash
# En servidor
sudo lsof -i :3001
sudo kill -9 PID
```

### Logs en Producción

```bash
# Railway/Render: Ve al dashboard
# VPS con PM2:
pm2 logs backend-inventario

# Docker:
docker logs backend-inventario
```

---

## 📊 Comparación de Plataformas

| Plataforma | Facilidad | Precio | Free Tier | Recomendado Para |
|------------|-----------|--------|-----------|------------------|
| Railway | ⭐⭐⭐⭐⭐ | $5/mes | $5 crédito | Proyectos pequeños/medianos |
| Render | ⭐⭐⭐⭐ | $7/mes | Sí (limitado) | Startups |
| Heroku | ⭐⭐⭐⭐ | $7/mes | No | Legacy apps |
| DigitalOcean | ⭐⭐⭐ | $6/mes | $200 crédito | Equipos con DevOps |
| AWS EC2 | ⭐⭐ | Variable | Sí (12 meses) | Empresas |

---

## 🎯 Recomendación Final

Para la mayoría de casos, **Railway** es la mejor opción por:

- ✅ Configuración en 5 minutos
- ✅ Deploys automáticos con Git
- ✅ Variables de entorno fáciles
- ✅ $5/mes con buen rendimiento
- ✅ Excelente para equipos

---

**¿Necesitas ayuda?** Abre un issue en el repositorio.
