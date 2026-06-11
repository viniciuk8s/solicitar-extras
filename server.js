/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  BACKEND — Solicitação de Extras → ClickUp
 *  Leve Refeições Coletivas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Stack : Node.js + Express + Axios
 *  Porta : 3000 (configurável via .env → PORT)
 *
 *  Configuração necessária (arquivo .env):
 *    CLICKUP_TOKEN    — API Token pessoal (pk_...)
 *    CLICKUP_LIST_ID  — ID da lista onde as tarefas serão criadas
 *    ALLOWED_ORIGINS  — domínios do front-end separados por vírgula
 *    API_KEY          — chave compartilhada enviada no header x-api-key
 *    PORT             — (opcional) porta do servidor, padrão 3000
 * ─────────────────────────────────────────────────────────────────────────────
 */

require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const axios   = require("axios");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARES ──────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(o => o.trim()).filter(Boolean);

const API_KEY = process.env.API_KEY;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Origem bloqueada: ${origin}`);
    callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));

app.use(express.json());

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  if (req.get("x-api-key") === API_KEY) return next();
  return res.status(401).json({ success: false, erro: "Não autorizado." });
}

// ─── CONFIG CLICKUP ───────────────────────────────────────────────────────────
const CU_TOKEN   = process.env.CLICKUP_TOKEN;
const CU_LIST_ID = process.env.CLICKUP_LIST_ID;

const clickup = axios.create({
  baseURL: "https://api.clickup.com/api/v2",
  timeout: 15000,
  headers: {
    Authorization: CU_TOKEN,
    "Content-Type": "application/json",
  },
});

// ─── CAMPOS CUSTOMIZADOS ──────────────────────────────────────────────────────
const FIELD_IDS = {
  tipoDemanda:      "90e16639-6f23-45b2-b7c9-1c01ac5d2552",
  unidade:          "13c4fa90-46d1-4ae2-a352-dbf604f574bc",
  solicitante:      "e8f671fe-9b9b-46fb-b0e7-1d702bfbcaad",
  dataServico:      "5d7cdefb-44c8-4da2-bc7f-8d44003fdd69",
  dataServicoText:  "da2285b2-82f0-4667-ba7b-98a4e43f26ed",
  horario:          "b177b7de-514a-47b7-8e2e-a9ceca5180c9",
  justificativa:    "6a00a137-a96f-4ff8-9b3f-5ef4618a87e8",
  valorEvento:      "ed687ec0-f64e-46d7-a149-004cda5043f3",
  nomeProfissional: "4108b928-d271-45c1-94bf-1374184a346c",
  funcao:           "75be94f3-a544-422f-9525-4954c11f8730",
  valorDiaria:      "5f8243cd-9d48-4770-b029-88da71b3024a",
  qtdDias:          "7535b259-e844-403d-b8a0-a78e4bb951c3",
  chave_pix:        "a287615a-8e21-45ae-9086-0b5396ede5ba",
};

const DROPDOWN_OPTIONS = {
  tipoDemanda: {
    "Evento":  "3bf52cb0-3f21-4d2b-b1f5-efd644a6c083",
    "Cozinha": "fd7fc7f4-0453-49a7-bbf0-dd99a070869e",
  },
  funcao: {
    "Garçom":               "32768a6e-a0ec-4990-9e82-390639597464",
    "Cozinheiro":           "52a6b374-5378-4a0c-b941-f261022b8b6d",
    "Auxiliar de cozinha":  "61da521b-aff1-48fc-983e-79c97ffa2c9a",
    "Nutricionista":        "39e00bfd-6aa7-4224-9bad-92226401d153",
    "Auxiliar de serviços": "04c7421e-a8bb-4641-b12c-089c7cbdcd45",
    "Motorista":            "1ebc219f-e097-4c1b-81b3-01baf70ac233",
    "Outro":                "91b0f955-d7ae-4152-aec2-e9add0bebe62",
  },
};

// Orderindex retornado pelo ClickUp para o campo tipoDemanda (drop_down)
// Confirmado via /api/debug-tasks: value=0 → Evento, value=1 → Cozinha
const TIPO_POR_ORDERINDEX = { 0: "Evento", 1: "Cozinha" };

const LABEL_IDS = {
  "RN - Parnamirim":    "dd64cbfc-e8e6-4dc0-b5ad-6e50afd1cd25",
  "RN - Caicó":         "595aad2b-f5f9-40b2-93c4-e49811673e2f",
  "RN - Mossoró ":      "ac0d369a-629f-4b2f-91af-0b2ec770cf9c",
  "PB - João Pessoa":   "2290170a-c511-457d-9c8b-9294e7ca61cc",
  "PE - Caruaru":       "5ac1bbae-576c-44ec-a8e9-b6dec5397d5c",
  "SE - São Critovão":  "ade3eb69-cccf-4b04-a70b-41388c07cba8",
  "SE - Aracaju":       "dd444b2f-c5f9-422c-ac2a-6327c0937583",
  "PR - Telemaco Borba":"ee43212d-6ad4-4903-9228-d1465ad6d983",
  "RS - Porto Alegre ": "56ba1a90-7c86-423e-b10c-c789690b1f93",
  "SP - São Paulo ":    "8110f5e6-6a1e-4b0d-8eef-7fb566b07a3c",
  "MA - São Luiz":      "f0623c1d-6a48-4bb4-8fe6-669740a65b6b",
  "AL - Arapiraca":     "7173051b-5bab-460c-9c62-f1d166d9e0dd",
};

// ─── CONTADOR EM MEMÓRIA POR UNIDADE ─────────────────────────────────────────
//
//  Lê todas as tarefas da lista UMA VEZ no startup e monta o mapa
//  { "PE - Caruaru": 13, "RN - Parnamirim": 27, ... }.
//  A cada nova tarefa criada, incrementa atomicamente (JS é single-thread).
//
//  promiseContadores: garante que nenhuma requisição seja processada antes
//  de a leitura inicial terminar — resolve a race condition.
//
const contadores = {};
let contadoresOk = false;
let promiseContadores = null;   // ← promise que resolve quando a leitura termina

async function inicializarContadores() {
  console.log("[INFO] Lendo tarefas existentes para montar contadores…");

  const labelParaUnidade = Object.fromEntries(
    Object.entries(LABEL_IDS).map(([u, uuid]) => [uuid, u])
  );

  // Zera antes de recarregar (usado também pelo /api/renumerar)
  Object.keys(contadores).forEach(k => delete contadores[k]);
  contadoresOk = false;

  let page = 0, total = 0;
  while (true) {
    const { data } = await clickup.get(`/list/${CU_LIST_ID}/task`, {
      params: { page, include_closed: true, subtasks: false },
    });
    const tasks = data.tasks || [];
    total += tasks.length;

    for (const task of tasks) {
      const campo  = (task.custom_fields || []).find(f => f.id === FIELD_IDS.unidade);
      const valores = Array.isArray(campo?.value) ? campo.value : [];
      for (const v of valores) {
        const uuid    = typeof v === "string" ? v : v?.id;
        const unidade = labelParaUnidade[uuid];
        if (unidade) contadores[unidade] = (contadores[unidade] || 0) + 1;
      }
    }

    if (data.last_page || tasks.length === 0) break;
    page++;
  }

  contadoresOk = true;
  console.log(`[INFO] Contadores prontos (${total} tarefas lidas):`, contadores);
}

/**
 * Retorna o próximo número sequencial para a unidade e já incrementa.
 */
function proximoNumero(unidade) {
  contadores[unidade] = (contadores[unidade] || 0) + 1;
  return contadores[unidade];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function dateToTimestamp(dateStr) {
  if (!dateStr) return null;
  const ts = new Date(dateStr + "T12:00:00Z").getTime();
  return isNaN(ts) ? null : ts;
}

function dropdownIndex(campo, valor) {
  const map = DROPDOWN_OPTIONS[campo];
  if (!map) { console.warn(`[WARN] Mapa não encontrado: ${campo}`); return null; }
  const idx = map[valor] ?? null;
  if (idx === null) console.warn(`[WARN] Opção "${valor}" não mapeada em "${campo}"`);
  return idx;
}

function buildCustomFields(dados, extra) {
  const fields = [];
  const add = (id, value) => {
    if (id && value !== null && value !== undefined && value !== "")
      fields.push({ id, value });
  };

  const tipoIdx = dropdownIndex("tipoDemanda", dados.tipoDemanda);
  if (tipoIdx !== null) add(FIELD_IDS.tipoDemanda, tipoIdx);

  if (dados.unidade) {
    const labelId = LABEL_IDS[dados.unidade];
    if (labelId) fields.push({ id: FIELD_IDS.unidade, value: [labelId] });
    else console.warn(`[WARN] UUID não encontrado para unidade: "${dados.unidade}"`);
  }

  add(FIELD_IDS.solicitante,   dados.solicitante);
  add(FIELD_IDS.horario,       dados.horario);
  add(FIELD_IDS.justificativa, dados.justificativa);

  const ts = dateToTimestamp(dados.dataServico);
  if (ts) add(FIELD_IDS.dataServico, ts);

  if (dados.tipoDemanda === "Evento" && dados.valorEvento)
    add(FIELD_IDS.valorEvento, Math.round(dados.valorEvento * 100) / 100);

  add(FIELD_IDS.nomeProfissional, extra.nome);

  const funcaoIdx = dropdownIndex("funcao", extra.funcao);
  if (funcaoIdx !== null) add(FIELD_IDS.funcao, funcaoIdx);

  add(FIELD_IDS.valorDiaria, Math.round((extra.valorDiaria || 0) * 100) / 100);
  add(FIELD_IDS.qtdDias,     Number(extra.qtdDias));
  add(FIELD_IDS.chave_pix,   extra.pix);

  return fields;
}

/**
 * Nome da tarefa: "014 - Solicitação Evento"
 */
function buildTaskName(tipoDemanda, numero) {
  const seq = String(numero).padStart(3, "0");
  return `${seq} - Solicitação ${tipoDemanda || "Solicitação"}`;
}

/**
 * Descrição rica em markdown.
 */
function buildTaskDescription(dados, extra) {
  const total = ((extra.valorDiaria || 0) * (extra.qtdDias || 1))
    .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const valorEvento = dados.valorEvento
    ? `R$ ${dados.valorEvento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "—";

  let dataBR = "—";
  if (dados.dataServico) {
    const [y, m, d] = dados.dataServico.split("-");
    dataBR = `${d}/${m}/${y}`;
  }

  return [
    `**Tipo de demanda:** ${dados.tipoDemanda}`,
    `**Unidade:** ${dados.unidade}`,
    `**Solicitante:** ${dados.solicitante}`,
    `**Data do serviço:** ${dataBR}`,
    `**Horário:** ${dados.horario}`,
    dados.tipoDemanda === "Evento" ? `**Valor do evento:** ${valorEvento}` : null,
    ``,
    `---`,
    ``,
    `**Profissional:** ${extra.nome}`,
    `**Função:** ${extra.funcao}`,
    `**Valor da diária:** R$ ${(extra.valorDiaria || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `**Quantidade de dias:** ${extra.qtdDias}`,
    `**Total estimado:** R$ ${total}`,
    `**Chave PIX:** ${extra.pix}`,
    ``,
    `---`,
    ``,
    `**Justificativa:**`,
    dados.justificativa,
  ].filter(l => l !== null).join("\n");
}

// ─── BUSCAR CAMPOS (utilitário) ───────────────────────────────────────────────
app.get("/api/campos", async (req, res) => {
  if (!CU_TOKEN || !CU_LIST_ID)
    return res.status(500).json({ erro: "CLICKUP_TOKEN ou CLICKUP_LIST_ID não configurados." });
  try {
    const { data } = await clickup.get(`/list/${CU_LIST_ID}/field`);
    const campos = (data.fields || []).map(f => ({
      id:      f.id,
      name:    f.name,
      type:    f.type,
      options: (f.type_config?.options || []).map(o => ({
        uuid: o.id, name: o.name, orderindex: o.orderindex,
      })),
    }));
    res.json({ campos });
  } catch (err) {
    res.status(500).json({ erro: "Falha ao buscar campos.", detalhe: err.response?.data || err.message });
  }
});

// ─── CRIAR TAREFAS ────────────────────────────────────────────────────────────
app.post("/api/solicitacao", requireApiKey, async (req, res) => {
  if (!CU_TOKEN || !CU_LIST_ID)
    return res.status(500).json({ success: false, erro: "Servidor mal configurado." });

  // ── Aguarda inicialização dos contadores se ainda não terminou ──
  if (!contadoresOk && promiseContadores) {
    try { await promiseContadores; } catch (_) {}
  }

  const dados = req.body;

  const erros = [];
  if (!dados.unidade)       erros.push("unidade");
  if (!dados.solicitante)   erros.push("solicitante");
  if (!dados.dataServico)   erros.push("dataServico");
  if (!dados.horario)       erros.push("horario");
  if (!dados.justificativa) erros.push("justificativa");
  if (!Array.isArray(dados.extras) || dados.extras.length === 0) erros.push("extras");
  if (erros.length > 0)
    return res.status(400).json({ success: false, erro: `Campos ausentes: ${erros.join(", ")}` });

  // Pré-aloca números antes do loop paralelo (síncrono → sem race condition)
  const numeros = dados.extras.map(() => proximoNumero(dados.unidade));
  console.log(`[INFO] Números alocados para "${dados.unidade}":`, numeros);

  const resultados = await Promise.allSettled(
    dados.extras.map(async (extra, i) => {
      const numero      = numeros[i];
      const taskName    = buildTaskName(dados.tipoDemanda, numero);
      const description = buildTaskDescription(dados, extra);
      const customFields = buildCustomFields(dados, extra);

      console.log(`[INFO] Criando: ${taskName}`);

      const { data: task } = await clickup.post(`/list/${CU_LIST_ID}/task`, {
        name:          taskName,
        description,
        custom_fields: customFields,
        priority:      3,
      });

      console.log(`[OK]   ${task.id} — ${task.url}`);
      return { extra: extra.nome, task_id: task.id, url: task.url };
    })
  );

  const criadas = [], falhas = [];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") {
      criadas.push(r.value);
    } else {
      const detail = r.reason?.response?.data || r.reason?.message || "Erro desconhecido";
      console.error(`[ERROR] Extra ${i + 1}:`, detail);
      falhas.push({ extra: dados.extras[i]?.nome || `Extra ${i + 1}`, erro: detail });
    }
  });

  const success = falhas.length === 0;
  return res.status(success ? 200 : falhas.length === dados.extras.length ? 500 : 207).json({
    success,
    total_criadas: criadas.length,
    total_falhas:  falhas.length,
    tarefas:  criadas,
    falhas:   falhas.length > 0 ? falhas : undefined,
    erro:     !success && falhas.length === dados.extras.length
              ? "Todas as tarefas falharam. Verifique os logs do servidor."
              : undefined,
  });
});

// ─── RENUMERAR TAREFAS EXISTENTES ─────────────────────────────────────────────
//  GET  /api/renumerar  → simulação (não altera nada)
//  POST /api/renumerar  → executa a renumeração
//
app.get("/api/renumerar", async (req, res) => {
  try {
    const preview = await montarRenumeracao();
    res.json({ simulacao: true, total: preview.length, tarefas: preview });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post("/api/renumerar", requireApiKey, async (req, res) => {
  try {
    const plano = await montarRenumeracao();
    const resultados = [];

    for (const item of plano) {
      try {
        await clickup.put(`/task/${item.id}`, { name: item.novoNome });
        console.log(`[RENUMERAR] ${item.nomeAtual} → ${item.novoNome}`);
        resultados.push({ id: item.id, de: item.nomeAtual, para: item.novoNome, ok: true });
      } catch (err) {
        console.error(`[RENUMERAR] Falha ${item.id}:`, err.message);
        resultados.push({ id: item.id, de: item.nomeAtual, para: item.novoNome, ok: false, erro: err.message });
      }
    }

    // Ressincroniza contadores após renumeração
    promiseContadores = inicializarContadores();
    await promiseContadores;

    const ok = resultados.filter(r => r.ok).length;
    res.json({ total: resultados.length, renomeadas: ok, falhas: resultados.length - ok, resultados });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

async function montarRenumeracao() {
  const labelParaUnidade = Object.fromEntries(
    Object.entries(LABEL_IDS).map(([u, uuid]) => [uuid, u])
  );

  const todasTarefas = [];
  let page = 0;
  while (true) {
    const { data } = await clickup.get(`/list/${CU_LIST_ID}/task`, {
      params: { page, include_closed: true, subtasks: false },
    });
    todasTarefas.push(...(data.tasks || []));
    if (data.last_page || (data.tasks || []).length === 0) break;
    page++;
  }

  // Agrupa por unidade
  const porUnidade = {};
  for (const task of todasTarefas) {
    const campo   = (task.custom_fields || []).find(f => f.id === FIELD_IDS.unidade);
    const valores = Array.isArray(campo?.value) ? campo.value : [];
    let unidade   = "__sem_unidade__";
    for (const v of valores) {
      const uuid = typeof v === "string" ? v : v?.id;
      const u    = labelParaUnidade[uuid];
      if (u) { unidade = u; break; }
    }
    if (!porUnidade[unidade]) porUnidade[unidade] = [];
    porUnidade[unidade].push(task);
  }

  const plano = [];
  for (const [unidade, tasks] of Object.entries(porUnidade)) {
    if (unidade === "__sem_unidade__") continue;

    // Ordena do mais antigo para o mais novo
    tasks.sort((a, b) => Number(a.date_created) - Number(b.date_created));

    tasks.forEach((task, i) => {
      const seq = String(i + 1).padStart(3, "0");

      // Detecta tipo: primeiro pelo campo customizado (orderindex), depois pelo nome
      const campTipo = (task.custom_fields || []).find(f => f.id === FIELD_IDS.tipoDemanda);
      let tipo = TIPO_POR_ORDERINDEX[campTipo?.value] || null;
      if (!tipo) {
        const n = (task.name || "").toLowerCase();
        if (n.includes("cozinha")) tipo = "Cozinha";
        else if (n.includes("evento")) tipo = "Evento";
        else tipo = "Solicitação";
      }

      plano.push({
        id:        task.id,
        nomeAtual: task.name,
        novoNome:  `${seq} - Solicitação ${tipo}`,
        unidade,
      });
    });
  }

  return plano;
}

// ─── DIAGNÓSTICO ──────────────────────────────────────────────────────────────
app.get("/api/contadores", (req, res) => {
  res.json({ contadoresOk, contadores });
});

app.get("/api/debug-tasks", async (req, res) => {
  try {
    const { data } = await clickup.get(`/list/${CU_LIST_ID}/task`, {
      params: { page: 0, include_closed: true, subtasks: false },
    });
    const tasks = (data.tasks || []).slice(0, 3).map(t => ({
      id:            t.id,
      name:          t.name,
      date_created:  t.date_created,
      custom_fields: (t.custom_fields || []).map(f => ({ id: f.id, name: f.name, type: f.type, value: f.value })),
    }));
    res.json({ contadores_atuais: contadores, tasks });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get("/api/health", (req, res) => {
  res.json({
    status:        "ok",
    token_ok:      !!CU_TOKEN,
    list_id_ok:    !!CU_LIST_ID,
    contadores_ok: contadoresOk,
    contadores,
    timestamp:     new Date().toISOString(),
  });
});

// ─── ERRO GLOBAL ──────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[CRASH]", err.stack || err.message);
  res.status(500).json({ success: false, erro: "Erro interno.", detalhe: err.message });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟢  Servidor rodando em http://localhost:${PORT}`);
  console.log(`    Health:     GET  http://localhost:${PORT}/api/health`);
  console.log(`    Contadores: GET  http://localhost:${PORT}/api/contadores`);
  console.log(`    Renumerar:  POST http://localhost:${PORT}/api/renumerar`);
  console.log(`    Submit:     POST http://localhost:${PORT}/api/solicitacao\n`);

  if (!CU_TOKEN)   console.warn("⚠️  CLICKUP_TOKEN não definido no .env");
  if (!CU_LIST_ID) console.warn("⚠️  CLICKUP_LIST_ID não definido no .env");

  if (CU_TOKEN && CU_LIST_ID) {
    promiseContadores = inicializarContadores().catch(err => {
      console.error("⚠️  Falha ao inicializar contadores:", err.message);
    });
  }
});
