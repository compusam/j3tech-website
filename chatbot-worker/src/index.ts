import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SYSTEM_PROMPT } from './knowledge';

type Bindings = {
  AI: Ai;
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  ADMIN_API_KEY?: string;
};

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ChatRequest = {
  message: string;
  sessionId: string;
  pageUrl?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors({
  origin: (origin) => {
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return origin;
    }
    const allowedOrigins = [
      'https://www.j3tech.mx',
      'https://j3tech.mx',
      'https://j3tech-agent.compusam.workers.dev',
      'https://j3tech-website.pages.dev'
    ];
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'x-api-key'],
  maxAge: 86400,
}));

// Middleware de Autenticación para Rutas de Administración
const authMiddleware = async (c: any, next: any) => {
  if (c.req.method !== 'OPTIONS') {
    const apiKey = c.req.header('x-api-key');
    if (!c.env.ADMIN_API_KEY || apiKey !== c.env.ADMIN_API_KEY) {
      return c.json({ error: 'Unauthorized. Invalid API Key.' }, 401);
    }
  }
  await next();
};

app.use('/api/session/*', authMiddleware);
app.use('/api/stats', authMiddleware);
app.use('/api/leads', authMiddleware);
app.use('/api/leads/*', authMiddleware);

app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'J3 TECH Agent',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

async function getOrCreateSession(db: D1Database, sessionId: string, pageUrl?: string, userAgent?: string) {
  const existing = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();
  
  if (existing) {
    await db.prepare('UPDATE sessions SET updated_at = ?, page_url = COALESCE(?, page_url) WHERE id = ?')
      .bind(Math.floor(Date.now() / 1000), pageUrl || null, sessionId)
      .run();
    return existing;
  }
  
  await db.prepare(`
    INSERT INTO sessions (id, page_url, user_agent, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    sessionId, 
    pageUrl || null, 
    userAgent || null,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000)
  ).run();
  
  return { id: sessionId };
}

async function saveMessage(db: D1Database, sessionId: string, role: 'user' | 'assistant', content: string) {
  const result = await db.prepare(`
    INSERT INTO messages (session_id, role, content, created_at) 
    VALUES (?, ?, ?, ?)
  `).bind(sessionId, role, content, Math.floor(Date.now() / 1000)).run();
  
  await db.prepare(`
    UPDATE sessions SET message_count = message_count + 1 WHERE id = ?
  `).bind(sessionId).run();
  
  return result;
}

async function getConversationHistory(db: D1Database, sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
  const messages = await db.prepare(`
    SELECT role, content FROM messages 
    WHERE session_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).bind(sessionId, limit).all();
  
  return (messages.results || []).reverse().map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content as string
  }));
}

async function logAnalytics(db: D1Database, sessionId: string, eventType: string, eventData?: any) {
  try {
    await db.prepare(`
      INSERT INTO analytics (session_id, event_type, event_data, created_at) 
      VALUES (?, ?, ?, ?)
    `).bind(sessionId, eventType, JSON.stringify(eventData || {}), Math.floor(Date.now() / 1000)).run();
  } catch (e) {
    console.error('Analytics error:', e);
  }
}

// Función para extraer datos de lead de la respuesta del agente
function extractLeadData(response: string): any {
  try {
    // Buscar bloque JSON en la respuesta
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (!jsonMatch) {
      return null;
    }
    
    const jsonStr = jsonMatch[1];
    const parsed = JSON.parse(jsonStr);
    
    if (parsed.lead_capture) {
      return parsed.lead_capture;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting lead data:', error);
    return null;
  }
}

// Función para extraer información de lead del historial de conversación
function extractLeadFromHistory(history: ChatMessage[], finalResponse: string): any {
  try {
    const userMessages = history.filter(m => m.role === 'user').map(m => m.content);
    
    // Patrones para extraer información
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/;
    const phonePattern = /[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}/;
    
    let name = '';
    let email = '';
    let phone = '';
    let company = '';
    let needs = '';
    let interests: string[] = [];
    let contactPreference = 'email';
    
    // Extraer información de los mensajes del usuario
    for (let i = 0; i < userMessages.length; i++) {
      const msg = userMessages[i];
      
      // Detectar email
      const emailMatch = msg.match(emailPattern);
      if (emailMatch && !email) {
        email = emailMatch[0];
        continue;
      }
      
      // Detectar teléfono
      const phoneMatch = msg.match(phonePattern);
      if (phoneMatch && !phone && !emailMatch) {
        phone = phoneMatch[0];
        continue;
      }
      
      // Detectar preferencia de contacto
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('correo')) {
        contactPreference = 'email';
        continue;
      }
      if (msg.toLowerCase().includes('teléfono') || msg.toLowerCase().includes('telefono') || msg.toLowerCase().includes('phone')) {
        contactPreference = 'phone';
        continue;
      }
      
      // El primer mensaje suele ser el nombre (si no es la solicitud inicial)
      if (i === 1 && !name && !emailMatch && !phoneMatch) {
        name = msg;
        continue;
      }
      
      // El tercer mensaje suele ser la empresa
      if (i === 3 && !company && !emailMatch && !phoneMatch) {
        company = msg;
        continue;
      }
      
      // El quinto mensaje suele ser las necesidades
      if (i === 5 && !needs && !emailMatch && !phoneMatch) {
        needs = msg;
        continue;
      }
    }
    
    // Detectar intereses del mensaje inicial
    const initialMessage = userMessages[0] || '';
    if (initialMessage.toLowerCase().includes('yelmo')) {
      interests.push('YELMO');
    }
    if (initialMessage.toLowerCase().includes('neuro sostenible') || initialMessage.toLowerCase().includes('sostenibilidad')) {
      interests.push('Sistema Neuro Sostenible');
    }
    if (initialMessage.toLowerCase().includes('consultoría') || initialMessage.toLowerCase().includes('consultoria')) {
      interests.push('Consultoría');
    }
    
    // Solo crear lead si tenemos al menos nombre y un medio de contacto
    if (name && (email || phone)) {
      return {
        name,
        email,
        phone,
        company,
        interests,
        needs,
        wants_contact: true,
        contact_preference: contactPreference
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting lead from history:', error);
    return null;
  }
}

// Función para guardar o actualizar un lead
async function saveLead(db: D1Database, sessionId: string, leadData: any, pageUrl?: string) {
  const {
    name,
    email,
    phone,
    company,
    position,
    interests,
    needs,
    budget_range,
    decision_maker,
    urgency,
    timeline,
    wants_contact,
    contact_preference
  } = leadData;
  
  // Verificar si ya existe un lead para esta sesión
  const existingLead = await db.prepare('SELECT id FROM leads WHERE session_id = ?').bind(sessionId).first();
  
  if (existingLead) {
    // Actualizar lead existente
    await db.prepare(`
      UPDATE leads SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        company = COALESCE(?, company),
        position = COALESCE(?, position),
        interests = COALESCE(?, interests),
        needs = COALESCE(?, needs),
        source_page = COALESCE(?, source_page),
        budget_range = COALESCE(?, budget_range),
        decision_maker = COALESCE(?, decision_maker),
        urgency = COALESCE(?, urgency),
        timeline = COALESCE(?, timeline),
        wants_contact = COALESCE(?, wants_contact),
        contact_preference = COALESCE(?, contact_preference),
        updated_at = ?
      WHERE session_id = ?
    `).bind(
      name || null,
      email || null,
      phone || null,
      company || null,
      position || null,
      interests ? JSON.stringify(interests) : null,
      needs || null,
      pageUrl || null,
      budget_range || null,
      decision_maker !== undefined ? (decision_maker ? 1 : 0) : null,
      urgency || null,
      timeline || null,
      wants_contact !== undefined ? (wants_contact ? 1 : 0) : null,
      contact_preference || null,
      Math.floor(Date.now() / 1000),
      sessionId
    ).run();
  } else {
    // Crear nuevo lead
    await db.prepare(`
      INSERT INTO leads (
        session_id, name, email, phone, company, position,
        interests, needs, source_page, budget_range, decision_maker,
        urgency, timeline, wants_contact, contact_preference,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      name || null,
      email || null,
      phone || null,
      company || null,
      position || null,
      interests ? JSON.stringify(interests) : null,
      needs || null,
      pageUrl || null,
      budget_range || null,
      decision_maker ? 1 : 0,
      urgency || null,
      timeline || null,
      wants_contact ? 1 : 0,
      contact_preference || null,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ).run();
  }
}

app.post('/api/chat', async (c) => {
  const { AI, DB } = c.env;
  let sessionId = '';
  
  try {
    const body: ChatRequest = await c.req.json();
    const { message, sessionId: receivedSessionId, pageUrl } = body;
    
    sessionId = receivedSessionId;
    
    if (!message || !receivedSessionId) {
      return c.json({ 
        response: 'Entiendo tu interés. ¿Podrías contarme más sobre lo que necesitas?',
        sessionId: receivedSessionId || 'temp-session',
        timestamp: new Date().toISOString()
      });
    }
    
    await logAnalytics(DB, sessionId, 'chat_message', { pageUrl });
    
    await getOrCreateSession(DB, sessionId, pageUrl, c.req.header('User-Agent'));
    await saveMessage(DB, sessionId, 'user', message);
    
    const history = await getConversationHistory(DB, sessionId);
    
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
    ];
    
    const aiResponse = await AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages,
      max_tokens: 500,
      temperature: 0.3,
      top_p: 0.8,
      repetition_penalty: 1.2,
      frequency_penalty: 0.5,
    });
    
    let response = aiResponse.response || 'Entiendo tu interés. ¿Podrías especificar un poco más sobre lo que necesitas?';
    
    // Detectar si es el mensaje final de confirmación
    const isConfirmationMessage = response.includes('nuestro equipo te contactará pronto');
    
    if (isConfirmationMessage) {
      // Extraer información del historial de conversación
      const leadData = extractLeadFromHistory(history, response);
      
      if (leadData) {
        try {
          await saveLead(DB, sessionId, leadData, pageUrl);
          console.log('Lead captured from history:', leadData);
        } catch (error) {
          console.error('Error saving lead:', error);
        }
      }
    }
    
    // También intentar extraer JSON si el modelo lo incluyó
    const jsonLeadData = extractLeadData(response);
    
    if (jsonLeadData) {
      try {
        await saveLead(DB, sessionId, jsonLeadData, pageUrl);
        console.log('Lead captured from JSON:', jsonLeadData);
      } catch (error) {
        console.error('Error saving lead:', error);
      }
      
      // Remover el JSON de la respuesta visible al usuario
      response = response.replace(/```json[\s\S]*?```/g, '').trim();
    }
    
    await saveMessage(DB, sessionId, 'assistant', response);
    
    await logAnalytics(DB, sessionId, 'ai_response', { tokensUsed: response.length });
    
    return c.json({ 
      response,
      sessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    
    return c.json({ 
      response: 'Entiendo tu interés. ¿Podrías contarme más sobre lo que necesitas?',
      sessionId: sessionId || 'temp-session',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/session/:sessionId', async (c) => {
  const { DB } = c.env;
  const sessionId = c.req.param('sessionId');
  
  try {
    const session = await DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();
    const messages = await DB.prepare(`
      SELECT role, content, created_at FROM messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `).bind(sessionId).all();
    
    return c.json({
      session,
      messages: messages.results || []
    });
  } catch (error) {
    return c.json({ error: 'Session not found' }, 404);
  }
});

app.get('/api/stats', async (c) => {
  const { DB } = c.env;
  
  try {
    const totalSessions = await DB.prepare('SELECT COUNT(*) as count FROM sessions').first();
    const activeSessions = await DB.prepare('SELECT COUNT(*) as count FROM sessions WHERE is_active = 1').first();
    const totalMessages = await DB.prepare('SELECT COUNT(*) as count FROM messages').first();
    const todayMessages = await DB.prepare(`
      SELECT COUNT(*) as count FROM messages 
      WHERE created_at > ?
    `).bind(Math.floor(Date.now() / 1000) - 86400).first();
    
    return c.json({
      totalSessions: (totalSessions as any)?.count || 0,
      activeSessions: (activeSessions as any)?.count || 0,
      totalMessages: (totalMessages as any)?.count || 0,
      todayMessages: (todayMessages as any)?.count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({ error: 'Error fetching stats' }, 500);
  }
});

app.post('/api/feedback', async (c) => {
  const { DB } = c.env;
  
  try {
    const { messageId, rating, comment } = await c.req.json();
    
    await DB.prepare(`
      INSERT INTO feedback (message_id, rating, comment, created_at) 
      VALUES (?, ?, ?, ?)
    `).bind(messageId, rating, comment || null, Math.floor(Date.now() / 1000)).run();
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Error saving feedback' }, 500);
  }
});

// Endpoint para crear o actualizar un lead
app.post('/api/leads', async (c) => {
  const { DB } = c.env;
  
  try {
    const leadData = await c.req.json();
    const {
      session_id,
      name,
      email,
      phone,
      company,
      position,
      interests,
      needs,
      source_page,
      budget_range,
      decision_maker,
      urgency,
      timeline,
      wants_contact,
      contact_preference,
      conversation_summary
    } = leadData;
    
    // Verificar si ya existe un lead para esta sesión
    const existingLead = await DB.prepare('SELECT id FROM leads WHERE session_id = ?').bind(session_id).first();
    
    let leadId;
    
    if (existingLead) {
      // Actualizar lead existente
      await DB.prepare(`
        UPDATE leads SET
          name = COALESCE(?, name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          company = COALESCE(?, company),
          position = COALESCE(?, position),
          interests = COALESCE(?, interests),
          needs = COALESCE(?, needs),
          source_page = COALESCE(?, source_page),
          budget_range = COALESCE(?, budget_range),
          decision_maker = COALESCE(?, decision_maker),
          urgency = COALESCE(?, urgency),
          timeline = COALESCE(?, timeline),
          wants_contact = COALESCE(?, wants_contact),
          contact_preference = COALESCE(?, contact_preference),
          conversation_summary = COALESCE(?, conversation_summary),
          updated_at = ?
        WHERE session_id = ?
      `).bind(
        name || null,
        email || null,
        phone || null,
        company || null,
        position || null,
        interests ? JSON.stringify(interests) : null,
        needs || null,
        source_page || null,
        budget_range || null,
        decision_maker !== undefined ? (decision_maker ? 1 : 0) : null,
        urgency || null,
        timeline || null,
        wants_contact !== undefined ? (wants_contact ? 1 : 0) : null,
        contact_preference || null,
        conversation_summary || null,
        Math.floor(Date.now() / 1000),
        session_id
      ).run();
      
      leadId = (existingLead as any).id;
    } else {
      // Crear nuevo lead
      const result = await DB.prepare(`
        INSERT INTO leads (
          session_id, name, email, phone, company, position,
          interests, needs, source_page, budget_range, decision_maker,
          urgency, timeline, wants_contact, contact_preference,
          conversation_summary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        session_id || null,
        name || null,
        email || null,
        phone || null,
        company || null,
        position || null,
        interests ? JSON.stringify(interests) : null,
        needs || null,
        source_page || null,
        budget_range || null,
        decision_maker ? 1 : 0,
        urgency || null,
        timeline || null,
        wants_contact ? 1 : 0,
        contact_preference || null,
        conversation_summary || null,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();
      
      leadId = result.meta.last_row_id;
    }
    
    return c.json({ success: true, lead_id: leadId });
  } catch (error) {
    console.error('Error creating lead:', error);
    return c.json({ error: 'Error creating lead' }, 500);
  }
});

// Endpoint para listar leads (CRM)
app.get('/api/leads', async (c) => {
  const { DB } = c.env;
  
  try {
    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    let query = `
      SELECT 
        l.*,
        s.page_url,
        s.message_count
      FROM leads l
      LEFT JOIN sessions s ON l.session_id = s.id
    `;
    
    const params: any[] = [];
    
    if (status) {
      query += ' WHERE l.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const leads = await DB.prepare(query).bind(...params).all();
    
    // Parsear interests de JSON
    const parsedLeads = (leads.results || []).map((lead: any) => ({
      ...lead,
      interests: lead.interests ? JSON.parse(lead.interests) : [],
      decision_maker: Boolean(lead.decision_maker),
      wants_contact: Boolean(lead.wants_contact)
    }));
    
    // Contar total
    let countQuery = 'SELECT COUNT(*) as total FROM leads';
    const countParams: any[] = [];
    
    if (status) {
      countQuery += ' WHERE status = ?';
      countParams.push(status);
    }
    
    const total = await DB.prepare(countQuery).bind(...countParams).first();
    
    return c.json({
      leads: parsedLeads,
      total: (total as any)?.total || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return c.json({ error: 'Error fetching leads' }, 500);
  }
});

// Endpoint para actualizar estado de un lead
app.patch('/api/leads/:id', async (c) => {
  const { DB } = c.env;
  const leadId = c.req.param('id');
  
  try {
    const updates = await c.req.json();
    const { status, contacted_at } = updates;
    
    const updateFields: string[] = [];
    const params: any[] = [];
    
    if (status) {
      updateFields.push('status = ?');
      params.push(status);
    }
    
    if (contacted_at) {
      updateFields.push('contacted_at = ?');
      params.push(contacted_at);
    }
    
    updateFields.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    
    params.push(leadId);
    
    await DB.prepare(`
      UPDATE leads SET ${updateFields.join(', ')} WHERE id = ?
    `).bind(...params).run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating lead:', error);
    return c.json({ error: 'Error updating lead' }, 500);
  }
});

// Endpoint para obtener un lead específico
app.get('/api/leads/:id', async (c) => {
  const { DB } = c.env;
  const leadId = c.req.param('id');
  
  try {
    const lead = await DB.prepare(`
      SELECT 
        l.*,
        s.page_url,
        s.message_count
      FROM leads l
      LEFT JOIN sessions s ON l.session_id = s.id
      WHERE l.id = ?
    `).bind(leadId).first();
    
    if (!lead) {
      return c.json({ error: 'Lead not found' }, 404);
    }
    
    // Parsear datos
    const parsedLead = {
      ...(lead as any),
      interests: (lead as any).interests ? JSON.parse((lead as any).interests) : [],
      decision_maker: Boolean((lead as any).decision_maker),
      wants_contact: Boolean((lead as any).wants_contact)
    };
    
    return c.json(parsedLead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    return c.json({ error: 'Error fetching lead' }, 500);
  }
});

export default app;
