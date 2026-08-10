# AGENTS.md — J3Tech Website

## Acerca del Proyecto

Sitio web de **J3 TECH** (`https://j3tech.mx`), firma mexicana de consultoría estratégica fundada por **Julia López**. El sitio promueve **YELMO®** (Inteligencia de Mercados) y **Sistema Neuro Sostenible®** (Sostenibilidad como Competitividad), más los servicios de implementación de **J3 TECH**.

- **Stack**: Astro 6 + TypeScript
- **Hosting**: Cloudflare Pages (proyecto `j3tech-website`)
- **Dominio**: `j3tech.mx` (configurado en Cloudflare), `j3tech-website.pages.dev` (directo)
- **Repositorio**: `https://github.com/compusam/j3tech-website.git`, rama `main`
- **Chatbot**: Worker separado en `chatbot-worker/` (proyecto `j3tech-agent`), desplegado con `npm run deploy` desde esa carpeta

---

## Despliegue en Cloudflare Pages

El proyecto de Pages **NO está conectado a Git**. Cada cambio se despliega manualmente:

```bash
npm run build
git add -A && git commit -m "mensaje" && git push origin main
npx wrangler pages deploy dist --project-name j3tech-website --branch main
```

Futuros agentes deben verificar autenticación con `npx wrangler whoami` (cuenta `informacion@compusam.com`).

---

## Estructura clave

```
src/
├── components/
│   ├── BlogCard.astro
│   ├── ChatWidget.astro
│   ├── Hero.astro
│   ├── JsonLd.astro          # JSON-LD schema reusable
│   └── Navigation.astro
├── content/
│   ├── blog/
│   │   ├── de-la-geopolitica-a-la-oportunidad.md
│   │   └── resiliencia-empresarial-en-el-nuevo-orden-comercial.md
│   └── projects/             # contenido de plantilla, no usado activamente
├── content.config.ts         # define colecciones blog + projects
├── layouts/
│   ├── BaseLayout.astro      # HTML shell, SEO, OG/Twitter, JSON-LD
│   └── BlogPostLayout.astro  # layout de artículo con hero, compartir, schemas
├── pages/
│   ├── index.astro           # Home
│   ├── servicios.astro        # Servicios
│   ├── about.astro            # Sobre Nosotros
│   └── blog/
│       ├── index.astro        # listado del Centro de Inteligencia
│       └── [...slug].astro    # artículo individual
├── styles/
│   └── global.css
public/
├── images/
│   ├── blog/                 # imágenes destacadas (WebP 400/800/1200/1600)
│   └── j3tech/               # hero-bg.webp, logos de marca/alianzas, solucion*.png
├── robots.txt                # indexación permitida, link al sitemap
├── llms.txt                  # resumen del sitio para agentes AI
└── favicon.svg
```

---

## Lo que ya se hizo (historial completo)

### Infraestructura y diseño
- [x] Sitio basado en el theme Astro "Darkness", migrado a Astro 6
- [x] Reemplazo del fondo Three.js animado por imagen estática (`public/images/j3tech/hero-bg.webp`)
- [x] Eliminación del gradiente animado y `background-attachment: fixed` (mejor responsive en mobile)
- [x] Navegación con glassmorphism, custom cursor, mobile menu

### Contenido de marca
- [x] Logos de marca agregados en Home, Servicios y About (YELMO, SNS, J3 TECH)
- [x] Eliminación de referencias a "huella de carbono" y "huella hídrica" en todo el sitio y chatbot
- [x] Sección "Alianzas Estratégicas" en `about.astro` con logos de IyETZ, UNID, UPZMG y Desarrollo Energético Sustentable
- [x] Video corporativo (mux-player) en About

### Blog / Centro de Inteligencia
- [x] Reemplazo de 3 artículos de plantilla por 2 artículos reales extraídos de `.docx`/PDF
- [x] Tablas con diseño personalizado en los artículos
- [x] Botones de compartir (X/Twitter, Facebook, LinkedIn, WhatsApp)
- [x] Meta tags Open Graph y Twitter Card por artículo
- [x] Imágenes destacadas responsive (WebP 400/800/1200/1600 px) en `public/images/blog/`
- [x] Prop `heroImage` en frontmatter y paso correcto del prop al layout

### SEO y GEO (sesión actual)
- [x] `BaseLayout.astro` refactorizado con:
  - `lang="es"`
  - Canonical URL
  - Open Graph completo (`og:site_name`, `og:locale=es_MX`, `og:title`, `og:image`, etc.)
  - Twitter Card `summary_large_image`
  - Meta `robots` (index, follow) y `theme-color`
  - Inyección de `article:published_time`, `article:author`, `article:section`, `article:tag`
  - Soporte para inyectar schemas JSON-LD desde cada página
- [x] Componente reutilizable `JsonLd.astro` para schemas
- [x] Schemas JSON-LD implementados por página:
  - **Home**: `Organization` + `WebSite`
  - **Servicios**: 3x `Service` + `BreadcrumbList`
  - **About**: `Organization` (con email), `Person` (Julia López) + `BreadcrumbList`
  - **Blog index**: `Blog` (con `blogPost` items) + `BreadcrumbList`
  - **Artículo**: `Article` (con author, publisher, image, dates, keywords) + `BreadcrumbList`
- [x] `robots.txt` con link al sitemap automático
- [x] `llms.txt` con descripción completa del sitio, servicios y datos de contacto para agentes AI
- [x] Campo `author` y `authorRole` en `content.config.ts` y frontmatter de artículos

### Chatbot Worker
- [x] Base de datos D1 con tabla `leads` (metodología BANT)
- [x] API endpoints protegidos con `x-api-key`
- [x] Middleware de seguridad contra acceso no autorizado
- [x] Re-desplegado para eliminar referencias a huella de carbono/hídrica
- [ ] Pendiente: Rate limiting en Cloudflare WAF para `/api/chat`

---

## Estado actual (agosto 2026)

**Último despliegue**: commit `3b0bd15` — URL: `https://48a7eb54.j3tech-website.pages.dev`

Todo el SEO/GEO está implementado y funcionando. El sitio tiene:
- Meta tags completos para buscadores y redes sociales
- Schema.org JSON-LD en cada página
- `robots.txt` y `llms.txt`
- Contenido real de marca (no plantilla)

---

## Posibles próximos pasos

1. Agregar página de contacto con formulario funcional
2. Conectar el dominio `j3tech.mx` como custom domain en Cloudflare Pages
3. Configurar rate limiting en WAF para el endpoint `/api/chat` del chatbot
4. Agregar más artículos al Centro de Inteligencia
5. Implementar página de proyectos reales (actualmente tiene contenido de plantilla)
6. Agregar `sameAs` (LinkedIn, etc.) a los schemas de Organization y Person cuando estén disponibles
7. Configurar Google Search Console y Bing Webmaster Tools
8. Agregar `hreflang` si se planea contenido multilingüe
9. Mejorar accesibilidad (contraste, roles ARIA, navegación por teclado)

---

## Convenciones del código

- Usar `Astro.site?.toString().replace(/\/$/, '') ?? 'https://j3tech.mx'` para construir URLs absolutas en schemas JSON-LD
- `new URL(path, siteUrl).href` para rutas de imágenes en OG y JSON-LD
- Props de imagen: pasar la variante `-800.webp`; el `srcset` se construye en `BlogPostLayout`
- Los esquemas JSON-LD se definen en cada página y se pasan como array al prop `schemas` de `BaseLayout`
- Fechas en español (`es-MX`) para `toLocaleDateString`
- `title` de página usa el formato `Título | J3 TECH` o `Título | J3 TECH — Subtítulo`

---

## Comandos útiles

```bash
npm run dev          # servidor local en http://localhost:4321
npm run build        # compilar a dist/
npm run preview      # previsualizar build local
npx wrangler whoami  # verificar autenticación Cloudflare
```
