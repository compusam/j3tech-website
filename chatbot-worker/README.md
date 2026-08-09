# J3 TECH Agent - Chatbot con Cloudflare AI

Chatbot inteligente para el sitio web de J3 TECH, desarrollado con Cloudflare Workers, Workers AI, D1 (SQLite) y KV Storage.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Astro Site)                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              ChatWidget.astro                           ││
│  │  - Widget flotante con diseño dark/glassmorphism        ││
│  │  - Sesiones persistentes en localStorage                ││
│  │  - Sugerencias rápidas de preguntas                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (j3tech-agent)                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  API Endpoints:                                         ││
│  │  • POST /api/chat      - Mensajes del chatbot           ││
│  │  • GET  /api/session   - Historial de sesión            ││
│  │  • GET  /api/stats     - Estadísticas                   ││
│  │  • POST /api/feedback  - Feedback de usuarios           ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                              │
│  ┌─────────────┐  ┌─────────┴─────────┐  ┌─────────────┐  │
│  │  KV Cache   │  │   Workers AI      │  │   D1 (SQL)  │  │
│  │  - FAQ      │  │   - Llama 3.1     │  │  - Sesiones │  │
│  │  - Response │  │   - 8B Instruct   │  │  - Mensajes │  │
│  │    caching  │  │                   │  │  - Analytics│  │
│  └─────────────┘  └───────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Servicios de Cloudflare Utilizados

| Servicio | Uso |
|----------|-----|
| **Workers** | Backend del chatbot |
| **Workers AI** | Modelo Llama 3.1 8B para respuestas |
| **D1 Database** | SQLite para sesiones, mensajes, analytics |
| **KV Storage** | Caché de respuestas frecuentes |

---

## 🚀 Instalación Rápida (Automática)

### En Mac/Linux:

```bash
# 1. Ir a la carpeta del chatbot
cd chatbot-worker

# 2. Dar permisos al script
chmod +x setup.sh

# 3. Ejecutar el script de configuración
./setup.sh
```

### En Windows:

```cmd
REM 1. Ir a la carpeta del chatbot
cd chatbot-worker

REM 2. Ejecutar el script de configuración
setup.bat
```

---

## 📋 Instalación Manual (Paso a Paso)

Si prefieres hacerlo manualmente o el script automático no funciona:

### Paso 0: Prerequisitos

```bash
# Instalar Wrangler CLI (si no lo tienes)
npm install -g wrangler

# Iniciar sesión en Cloudflare
wrangler login
```

### Paso 1: Ir a la carpeta del chatbot

**IMPORTANTE**: Todos los comandos siguientes deben ejecutarse DENTRO de la carpeta `chatbot-worker`:

```bash
cd chatbot-worker
```

### Paso 2: Instalar dependencias

```bash
npm install
```

### Paso 3: Crear base de datos D1

```bash
wrangler d1 create j3tech-chatbot-db
```

**Output esperado:**
```
✅ Successfully created DB 'j3tech-chatbot-db'
Add the following to your configuration file in your d1_databases array:
[[d1_databases]]
binding = "DB"
database_name = "j3tech-chatbot-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  ← COPIA ESTE ID
```

📝 **Guarda el `database_id`** que aparece en el output.

### Paso 4: Ejecutar el schema SQL

**IMPORTANTE**: Debes estar en la carpeta `chatbot-worker` donde está el archivo `schema.sql`:

```bash
# Verifica que estás en la carpeta correcta
ls schema.sql   # En Mac/Linux
dir schema.sql  # En Windows

# Ejecutar el schema (remoto)
wrangler d1 execute j3tech-chatbot-db --file=schema.sql --remote
```

Si marca error, intenta con la ruta completa:

```bash
# Mac/Linux
wrangler d1 execute j3tech-chatbot-db --file=./schema.sql --remote

# Windows
wrangler d1 execute j3tech-chatbot-db --file=.\schema.sql --remote
```

Cuando pregunte, escribe `y` y presiona Enter para confirmar.

### Paso 5: Crear KV Namespace

```bash
wrangler kv:namespace create CACHE
```

**Output esperado:**
```
🌀 Creating namespace with title "j3tech-agent-CACHE"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "CACHE"
namespace_id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  ← COPIA ESTE ID
```

📝 **Guarda el `namespace_id`** que aparece en el output.

### Paso 6: Actualizar wrangler.toml

Abre el archivo `wrangler.toml` y reemplaza los placeholders con los IDs que guardaste:

```toml
name = "j3tech-agent"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "j3tech-chatbot-db"
database_id = "TU_DATABASE_ID_AQUI"  # ← Reemplaza con el ID real

[[kv_namespaces]]
binding = "CACHE"
namespace_id = "TU_KV_NAMESPACE_ID_AQUI"  # ← Reemplaza con el ID real

[vars]
ENVIRONMENT = "production"
```

**Ejemplo:**
```toml
database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
namespace_id = "1234567890abcdef1234567890abcdef"
```

### Paso 7: Desarrollo Local (Opcional)

```bash
# Iniciar servidor de desarrollo
npm run dev
```

El worker estará disponible en `http://localhost:8787`

### Paso 8: Deploy a Producción

```bash
npm run deploy
```

**Output esperado:**
```
Published j3tech-agent
  https://j3tech-agent.tu-subdomain.workers.dev
```

📝 **Guarda la URL** de tu worker.

### Paso 9: Configurar el Frontend

En tu proyecto Astro principal, actualiza la variable de entorno:

**Opción A: Usando .env**

Crea o edita el archivo `.env` en la raíz del proyecto:

```bash
PUBLIC_CHATBOT_API=https://j3tech-agent.tu-subdomain.workers.dev
```

**Opción B: Editando directamente**

Edita `src/components/ChatWidget.astro` y cambia la línea:

```typescript
const apiEndpoint = import.meta.env.PUBLIC_CHATBOT_API || 'https://j3tech-agent.tu-subdomain.workers.dev';
```

Reemplaza `tu-subdomain` con tu subdominio real de Cloudflare Workers.

---

## 🧪 Verificar que Funciona

### 1. Probar el Worker

```bash
curl https://j3tech-agent.tu-subdomain.workers.dev/
```

Deberías ver:
```json
{"status":"ok","service":"J3 TECH Agent","version":"1.0.0","timestamp":"..."}
```

### 2. Probar el Chat

```bash
curl -X POST https://j3tech-agent.tu-subdomain.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"¿Qué servicios ofrece J3 TECH?","sessionId":"test123"}'
```

### 3. Ver Logs en Tiempo Real

```bash
npm run tail
```

O:
```bash
wrangler tail
```

### 4. Verificar Base de Datos

```bash
wrangler d1 execute j3tech-chatbot-db --command="SELECT * FROM sessions;" --remote
```

---

## 📁 Estructura del Proyecto

```
chatbot-worker/
├── src/
│   ├── index.ts          # Worker principal con endpoints
│   └── knowledge.ts      # Base de conocimiento de J3 TECH
├── schema.sql            # Schema de base de datos D1
├── wrangler.toml         # Configuración de Cloudflare
├── package.json
├── tsconfig.json
├── setup.sh              # Script automático (Mac/Linux)
├── setup.bat             # Script automático (Windows)
└── README.md             # Esta documentación
```

---

## 🧠 Base de Conocimiento

El chatbot tiene información sobre:

### YELMO® - Inteligencia de Mercados
- 13 servicios de inteligencia empresarial
- Inteligencia de Mercados, Competitiva, ESG, Climática, etc.

### Sistema Neuro Sostenible®
- 11 soluciones de sostenibilidad
- ESG, ODS, Economía Circular, etc.

### J3 TECH - Implementación
- 9 servicios de implementación
- Consultoría, Capacitación, Eventos, Tecnología, etc.

### Editar Base de Conocimiento

Edita `src/knowledge.ts` para actualizar:
- `COMPANY_INFO` - Información de la empresa
- `SYSTEM_PROMPT` - Instrucciones para el AI
- `FAQ_RESPONSES` - Respuestas predefinidas para preguntas frecuentes

Después de editar, redeploya:
```bash
npm run deploy
```

---

## 🔌 Endpoints de la API

### POST /api/chat
Envía un mensaje y recibe respuesta del chatbot.

```json
// Request
{
  "message": "¿Qué servicios ofrece J3 TECH?",
  "sessionId": "session_123456",
  "pageUrl": "https://j3tech.mx/servicios"
}

// Response
{
  "response": "J3 TECH ofrece tres líneas de negocio...",
  "sessionId": "session_123456",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /api/session/:sessionId
Obtiene el historial de una sesión.

### GET /api/stats
Obtiene estadísticas del chatbot (admin).

### POST /api/feedback
Envía feedback sobre una respuesta.

```json
{
  "messageId": 123,
  "rating": 1,
  "comment": "Muy útil"
}
```

---

## 🗄️ Queries Útiles para D1

```bash
# Ver sesiones activas hoy
wrangler d1 execute j3tech-chatbot-db --command="SELECT * FROM sessions WHERE created_at > unixepoch() - 86400;" --remote

# Ver mensajes de una sesión
wrangler d1 execute j3tech-chatbot-db --command="SELECT * FROM messages WHERE session_id = 'session_id' ORDER BY created_at;" --remote

# Estadísticas de uso
wrangler d1 execute j3tech-chatbot-db --command="SELECT COUNT(DISTINCT session_id) as total_sessions, COUNT(*) as total_messages FROM messages WHERE created_at > unixepoch() - 86400 * 7;" --remote

# Preguntas más frecuentes
wrangler d1 execute j3tech-chatbot-db --command="SELECT content, COUNT(*) as count FROM messages WHERE role = 'user' GROUP BY content ORDER BY count DESC LIMIT 20;" --remote
```

---

## 💰 Costos Estimados (Cloudflare)

| Servicio | Free Tier | Pago |
|----------|-----------|------|
| Workers | 100K requests/día | $0.30/millón |
| Workers AI | 10K neurons/día | Varía por modelo |
| D1 | 5GB storage, 5M reads/día | $0.75/GB/mes |
| KV | 100K reads/día | $0.30/millón |

Para un sitio con tráfico moderado, el free tier debería ser suficiente.

---

## ⚙️ Personalización

### Cambiar el Modelo AI

En `src/index.ts`, modifica la llamada al AI:

```typescript
// Modelos disponibles:
// @cf/meta/llama-3.1-8b-instruct
// @cf/meta/llama-2-7b-chat-int8
// @cf/mistral/mistral-7b-instruct-v0.1

const aiResponse = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
  messages,
  max_tokens: 500,
  temperature: 0.7,
});
```

### Cambiar Estilo del Widget

Edita `src/components/ChatWidget.astro` para modificar:
- Colores (usa las variables CSS del sitio)
- Posición del botón flotante
- Tamaño del panel
- Animaciones

---

## 🐛 Troubleshooting

### Error: "schema.sql: no such file"

**Causa**: No estás en la carpeta correcta.

**Solución**:
```bash
cd chatbot-worker
ls schema.sql  # Verifica que el archivo existe
wrangler d1 execute j3tech-chatbot-db --file=schema.sql --remote
```

### Error: "database not found"

**Causa**: La base de datos no existe o el nombre es incorrecto.

**Solución**:
```bash
# Listar bases de datos
wrangler d1 list

# Si no existe, crearla
wrangler d1 create j3tech-chatbot-db
```

### Error: "namespace not found"

**Causa**: El KV namespace no existe.

**Solución**:
```bash
# Listar namespaces
wrangler kv:namespace list

# Si no existe, crearlo
wrangler kv:namespace create CACHE
```

### El chatbot no responde

**Causa**: El worker no está desplegado o la URL es incorrecta.

**Solución**:
```bash
# Verificar deployments
wrangler deployments list

# Ver logs
wrangler tail

# Verificar URL en el frontend
echo $PUBLIC_CHATBOT_API
```

### Error de CORS

**Causa**: Los dominios no están permitidos.

**Solución**: Edita `src/index.ts` y agrega tus dominios:

```typescript
app.use('/*', cors({
  origin: ['https://www.j3tech.mx', 'https://j3tech.mx', 'http://localhost:4321'],
  // ...
}));
```

### Error de AI

**Causa**: Workers AI no está habilitado o excediste el quota.

**Solución**:
1. Verifica en Cloudflare Dashboard > Workers AI
2. Considera upgrading a un plan pago si excedes el free tier

---

## 📊 Monitoreo

```bash
# Ver logs en tiempo real
wrangler tail

# Ver estadísticas del worker
wrangler deployments list

# Ver uso de recursos
wrangler deployments list --with-usage
```

---

## 🔄 Actualizaciones

Después de hacer cambios en el código:

```bash
# Redeployar
npm run deploy

# O para desarrollo
npm run dev
```

---

## 📄 Licencia

Propietario - J3 TECH
