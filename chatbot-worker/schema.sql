-- J3 TECH Agent - Database Schema
-- Cloudflare D1 (SQLite)

-- Tabla de sesiones de chat
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  page_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  message_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Tabla de feedback de usuarios
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  rating INTEGER CHECK(rating IN (1, -1)),
  comment TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Tabla de preguntas frecuentes (caché de respuestas)
CREATE TABLE IF NOT EXISTS faq_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_hash TEXT UNIQUE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Tabla de analytics
CREATE TABLE IF NOT EXISTS analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_data TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Tabla de leads (CRM Express)
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  
  -- Información de contacto
  name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  
  -- Intereses y necesidades
  interests TEXT, -- JSON array de servicios de interés
  needs TEXT, -- Descripción de lo que necesita
  source_page TEXT, -- Página desde donde inició el chat
  
  -- BANT (Budget, Authority, Need, Timeline)
  budget_range TEXT, -- Rango de presupuesto
  decision_maker INTEGER DEFAULT 0, -- ¿Es tomador de decisiones?
  urgency TEXT, -- Urgencia: alta, media, baja
  timeline TEXT, -- Cuándo planea implementar
  
  -- Estado del lead
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  wants_contact INTEGER DEFAULT 0, -- ¿Desea ser contactado?
  contact_preference TEXT, -- email, phone, whatsapp
  
  -- Metadata
  conversation_summary TEXT, -- Resumen de la conversación
  lead_score INTEGER DEFAULT 0, -- Puntuación del lead (0-100)
  
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  contacted_at INTEGER,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_faq_hash ON faq_cache(question_hash);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_wants_contact ON leads(wants_contact);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

-- Trigger para actualizar updated_at en sessions
CREATE TRIGGER IF NOT EXISTS update_session_timestamp 
AFTER UPDATE ON sessions
BEGIN
  UPDATE sessions SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Vista para estadísticas de sesiones
CREATE VIEW IF NOT EXISTS session_stats AS
SELECT 
  s.id,
  s.created_at,
  s.page_url,
  s.message_count,
  s.is_active,
  COUNT(m.id) as actual_messages,
  MIN(m.created_at) as first_message,
  MAX(m.created_at) as last_message
FROM sessions s
LEFT JOIN messages m ON s.id = m.session_id
GROUP BY s.id;
