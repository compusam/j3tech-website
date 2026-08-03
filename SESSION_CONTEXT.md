# Contexto de Sesión - J3Tech Website

## Proyecto
- **Cliente**: J3Tech (j3tech.mx)
- **Fundadora**: Julia López
- **Productos**: Sistema Neuro Sostenible® y YELMO®
- **Stack**: Astro 6 + Three.js + TypeScript

## Lo que hemos hecho

### 1. Análisis del Codebase ✅
- Sitio Astro estático con tema oscuro
- Componentes: Hero, Navigation, Skills, BlogCard, ProjectCard
- Fondo 3D con Three.js (partículas y torus)
- Colecciones de contenido: blog y projects
- Build exitoso con `npm run build`

### 2. Servidor MCP para Documentos ✅
- **Ubicación**: `mcp-server/`
- **Configuración**: Ya agregado a `~/.config/opencode/opencode.jsonc`
- **Dependencias instaladas**: PyMuPDF, python-docx, mcp
- **Estado**: Probado y funcionando

### 3. CRM y Seguridad Backend (Auditado e Implementado) ✅
- **Base de Datos (D1)**: Revisión de tabla `leads` con soporte para metodología BANT (Budget, Authority, Need, Timeline).
- **Lógica de Chatbot**: Se verificó la extracción de datos de lead a partir del historial y de respuestas JSON del LLM (`index.ts`).
- **API Endpoints**: Rutas listas para frontend de administración (`GET /api/leads`, `PATCH /api/leads/:id`).
- **Auditoría de Seguridad (OWASP Top 10)**:
  - *SQL Injection (A03)*: Protegido nativamente (Parameterized Queries).
  - *Broken Access Control (A01)*: **Corregido**. Se implementó Middleware exigiendo `x-api-key` coincidente con `ADMIN_API_KEY` para proteger endpoints de administración de extracción de datos.
  - *Session ID Spoofing (A07)*: Verificado. El frontend genera identificadores aleatorios suficientemente seguros en `ChatWidget.astro`.
  - *Rate Limiting (A04)*: **Pendiente**: Configurar regla gratuita en Cloudflare WAF para limitar peticiones a `/api/chat` (ej. 15 req/min) y evitar sobrecostos de IA.

### Herramientas MCP disponibles:
```
list_documents(folder) - Lista archivos PDF/DOCX/TXT/MD
read_document(file_path) - Lee documento completo
extract_document(file_path) - Extrae texto para análisis
extract_document_pages(file_path, start, end) - Páginas específicas de PDF
extract_all_documents(folder) - Extrae todos los documentos
```

## Archivos del cliente
Ubicación: `docs/j3tech/`
- `ACTUALIZACIÓN DE PAGINA WEB.pdf` - Requerimientos (6,319 chars)
- `LogoCONFONDOAltaresolución.jpg` - Logo principal
- `LOGO YELMO.png` - Logo YELMO
- `LOGO SNS.png` - Logo SNS
- `IyETZ.jpeg` - Imagen adicional

## Siguiente paso
Leer el PDF completo con las herramientas MCP para entender los requerimientos del cliente y empezar a implementar los cambios.

## Comandos útiles
```bash
# Iniciar servidor de desarrollo
npm run dev

# Build
npm run build

# Probar MCP manualmente
cd mcp-server && source venv/bin/activate && python server.py
```
