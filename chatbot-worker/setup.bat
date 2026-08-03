@echo off
REM J3 TECH Agent - Script de Configuración para Windows
REM Este script configura todos los servicios de Cloudflare necesarios

echo.
echo 🚀 J3 TECH Agent - Configuración de Cloudflare
echo ================================================
echo.

REM Verificar que wrangler esté instalado
where wrangler >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Wrangler no está instalado. Instálalo con: npm install -g wrangler
    exit /b 1
)

REM Verificar que esté autenticado
echo 🔐 Verificando autenticación...
wrangler whoami >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ No estás autenticado. Ejecuta: wrangler login
    exit /b 1
)
echo ✅ Autenticación verificada
echo.

REM Paso 1: Instalar dependencias
echo 📦 Paso 1: Instalando dependencias...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error instalando dependencias
    exit /b 1
)
echo ✅ Dependencias instaladas
echo.

REM Paso 2: Crear base de datos D1
echo 🗄️  Paso 2: Creando base de datos D1...
echo.
echo Ejecutando: wrangler d1 create j3tech-chatbot-db
echo.
wrangler d1 create j3tech-chatbot-db
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  La base de datos puede que ya exista. Continuando...
)
echo.

REM Paso 3: Ejecutar schema
echo 📋 Paso 3: Ejecutando schema SQL...
wrangler d1 execute j3tech-chatbot-db --file=schema.sql --remote
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error ejecutando schema. Verifica que la base de datos exista.
    exit /b 1
)
echo ✅ Schema ejecutado
echo.

REM Paso 4: Crear KV Namespace
echo 💾 Paso 4: Creando KV Namespace...
echo.
wrangler kv:namespace create CACHE
echo.
echo ⚠️  IMPORTANTE: Copia el namespace_id del output de arriba
echo    y actualízalo manualmente en wrangler.toml
echo.

REM Paso 5: Recordar actualizar wrangler.toml
echo ⚙️  Paso 5: Actualiza wrangler.toml manualmente
echo.
echo    Reemplaza estos valores en wrangler.toml:
echo    - database_id = "TU_DATABASE_ID_AQUI"
echo    - namespace_id = "TU_KV_NAMESPACE_ID_AQUI"
echo.

REM Paso 6: Deploy
echo 🚀 Paso 6: Desplegando worker...
set /p DEPLOY="¿Deseas desplegar ahora? (s/N): "
if /i "%DEPLOY%"=="s" (
    call npm run deploy
    echo.
    echo ✅ Worker desplegado
) else (
    echo Puedes desplegar después con: npm run deploy
)

echo.
echo ================================================
echo ✅ ¡Configuración completada!
echo.
echo 📝 Próximos pasos:
echo    1. Actualiza wrangler.toml con los IDs correctos
echo    2. Actualiza la URL del API en tu sitio Astro:
echo       PUBLIC_CHATBOT_API=https://j3tech-agent.TU_SUBDOMAIN.workers.dev
echo.
echo    3. Verifica el worker en: https://dash.cloudflare.com
echo.
echo    4. Para ver logs en tiempo real: npm run tail
echo.
echo ================================================
pause
