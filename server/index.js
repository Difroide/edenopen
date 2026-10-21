const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || 'eden123';

/* ---------- armazenamento ----------
   Com DATABASE_URL (Railway Postgres): usa pg.
   Sem: salva em server/data/aplicacoes.json pra testar local. */
let store;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  // Railway exige SSL; Postgres interno do EasyPanel/Docker não tem SSL —
  // use ?sslmode=disable na DATABASE_URL para desligar
  const ssl = /sslmode=disable/.test(process.env.DATABASE_URL)
    ? false
    : { rejectUnauthorized: false };
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    connectionTimeoutMillis: 10000,
    keepAlive: true
  });
  // conexão ociosa que cair não pode derrubar o processo
  pool.on('error', e => console.error('[eden] pool pg:', e.message));
  const init = pool.query(`CREATE TABLE IF NOT EXISTS aplicacoes(
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    idade INT,
    instagram TEXT,
    origem TEXT,
    user_agent TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  store = {
    async add(a) {
      await init;
      const r = await pool.query(
        `INSERT INTO aplicacoes(nome,whatsapp,idade,instagram,origem,user_agent)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id, criado_em`,
        [a.nome, a.whatsapp, a.idade, a.instagram, a.origem, a.user_agent]
      );
      return r.rows[0];
    },
    async list() {
      await init;
      const r = await pool.query(`SELECT * FROM aplicacoes ORDER BY criado_em DESC`);
      return r.rows;
    },
    async remove(id) {
      await init;
      await pool.query(`DELETE FROM aplicacoes WHERE id = $1`, [id]);
    }
  };
  console.log('[eden] usando Postgres');
} else {
  const fs = require('fs');
  const file = path.join(__dirname, 'data', 'aplicacoes.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } };
  const write = l => fs.writeFileSync(file, JSON.stringify(l, null, 2));
  store = {
    async add(a) {
      const l = read();
      const row = { id: (l[0]?.id || 0) + 1, ...a, criado_em: new Date().toISOString() };
      l.unshift(row);
      write(l);
      return row;
    },
    async list() { return read(); },
    async remove(id) { write(read().filter(r => r.id !== Number(id))); }
  };
  console.log('[eden] sem DATABASE_URL — salvando em server/data/aplicacoes.json');
}

app.use(express.json());

/* ---------- API pública: recebe o formulário ---------- */
app.post('/api/aplicacoes', async (req, res) => {
  try {
    const { nome, whatsapp, idade, instagram, origem } = req.body || {};
    if (!nome || !whatsapp) return res.status(400).json({ erro: 'nome e whatsapp são obrigatórios' });
    const row = await store.add({
      nome: String(nome).trim().slice(0, 120),
      whatsapp: String(whatsapp).trim().slice(0, 40),
      idade: parseInt(idade, 10) || null,
      instagram: String(instagram || '').trim().slice(0, 80),
      origem: String(origem || '').slice(0, 200),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300)
    });
    res.json({ ok: true, id: row.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'falha ao salvar' });
  }
});

/* ---------- API admin (Bearer = ADMIN_PASS) ---------- */
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (t !== ADMIN_PASS) return res.status(401).json({ erro: 'não autorizado' });
  next();
}
app.get('/api/aplicacoes', auth, async (req, res) => {
  try { res.json(await store.list()); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'falha ao listar' }); }
});
app.delete('/api/aplicacoes/:id', auth, async (req, res) => {
  try { await store.remove(req.params.id); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'falha ao apagar' }); }
});

/* ---------- páginas ---------- */
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// nada do server/ nem dos .md de trabalho pode vazar como estático
app.use((req, res, next) => {
  if (req.path.startsWith('/server') || /\.md$/i.test(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => console.log(`[eden] rodando em http://localhost:${PORT}`));
