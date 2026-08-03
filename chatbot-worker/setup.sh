#!/bin/bash

# J3 TECH Agent - Script de Configuración
# Este script configura todos los servicios de Cloudflare necesarios

set -e

echo "🚀 J3 TECH Agent - Configuración de Cloudflare"
echo "================================================"
echo ""

# Verificar que wrangler esté instalado
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler no está instalado. Instálalo con: npm install -g wrangler"
    exit 1
fi

# Verificar que esté autenticado
echo "🔐 Verificando autenticación..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ No estás autenticado. Ejecuta: wrangler login"
    exit 1
fi
echo "✅ Autenticación verificada"
echo ""

# Paso 1: Instalar dependencias
echo "📦 Paso 1: Instalando dependencias..."
npm install
echo "✅ Dependencias instaladas"
echo ""

# Paso 2: Crear base de datos D1
echo "🗄️  Paso 2: Creando base de datos D1..."
echo ""

# Verificar si ya existe
if wrangler d1 list 2>/dev/null | grep -q "j3tech-chatbot-db"; then
    echo "⚠️  La base de datos 'j3tech-chatbot-db' ya existe."
    read -p "¿Deseas eliminarla y crear una nueva? (s/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        wrangler d1 delete j3tech-chatbot-db
        D1_OUTPUT=$(wrangler d1 create j3tech-chatbot-db)
    else
        echo "Usando base de datos existente..."
        D1_OUTPUT=$(wrangler d1 list | grep j3tech-chatbot-db)
    fi
else
    D1_OUTPUT=$(wrangler d1 create j3tech-chatbot-db)
fi

# Extraer database_id
DATABASE_ID=$(echo "$D1_OUTPUT" | grep -o '[a-f0-9]\{8\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{12\}' | head -1)

if [ -z "$DATABASE_ID" ]; then
    echo "❌ No se pudo obtener el database_id. Verifica manualmente."
    echo "   Ejecuta: wrangler d1 list"
    exit 1
fi

echo "✅ Base de datos creada con ID: $DATABASE_ID"
echo ""

# Paso 3: Ejecutar schema
echo "📋 Paso 3: Ejecutando schema SQL..."
wrangler d1 execute j3tech-chatbot-db --file=schema.sql --remote
echo "✅ Schema ejecutado"
echo ""

# Paso 4: Crear KV Namespace
echo "💾 Paso 4: Creando KV Namespace..."
echo ""

# Verificar si ya existe
if wrangler kv:namespace list 2>/dev/null | grep -q "j3tech-agent-CACHE"; then
    echo "⚠️  El KV namespace ya existe."
    KV_OUTPUT=$(wrangler kv:namespace list | grep j3tech-agent-CACHE)
else
    KV_OUTPUT=$(wrangler kv:namespace create CACHE)
fi

# Extraer namespace_id
KV_ID=$(echo "$KV_OUTPUT" | grep -o '[a-f0-9]\{32\}' | head -1)

if [ -z "$KV_ID" ]; then
    echo "❌ No se pudo obtener el namespace_id. Verifica manualmente."
    echo "   Ejecuta: wrangler kv:namespace list"
    exit 1
fi

echo "✅ KV Namespace creado con ID: $KV_ID"
echo ""

# Paso 5: Actualizar wrangler.toml
echo "⚙️  Paso 5: Actualizando wrangler.toml..."

# Crear backup
cp wrangler.toml wrangler.toml.backup

# Actualizar database_id
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/TU_DATABASE_ID_AQUI/$DATABASE_ID/g" wrangler.toml
    sed -i '' "s/TU_KV_NAMESPACE_ID_AQUI/$KV_ID/g" wrangler.toml
else
    sed -i "s/TU_DATABASE_ID_AQUI/$DATABASE_ID/g" wrangler.toml
    sed -i "s/TU_KV_NAMESPACE_ID_AQUI/$KV_ID/g" wrangler.toml
fi

echo "✅ wrangler.toml actualizado"
echo ""

# Paso 6: Deploy
echo "🚀 Paso 6: Desplegando worker..."
read -p "¿Deseas desplegar ahora? (s/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    npm run deploy
    echo ""
    echo "✅ Worker desplegado"
else
    echo "Puedes desplegar después con: npm run deploy"
fi

echo ""
echo "================================================"
echo "✅ ¡Configuración completada!"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Actualiza la URL del API en tu sitio Astro:"
echo "      PUBLIC_CHATBOT_API=https://j3tech-agent.TU_SUBDOMAIN.workers.dev"
echo ""
echo "   2. Verifica el worker en: https://dash.cloudflare.com"
echo ""
echo "   3. Para ver logs en tiempo real: npm run tail"
echo ""
echo "================================================"
