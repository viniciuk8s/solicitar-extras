/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  BACKEND — Solicitação de Extras → ClickUp
 *  Leve Refeições Coletivas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Stack : Node.js + Express + Axios
 *  Porta : 3000 (configurável via .env → PORT)
 *
 *  Fluxo :
 *    1. Recebe POST /api/solicitacao com o payload do formulário
 *    2. Valida os dados obrigatórios
 *    3. Para cada "extra" cria uma tarefa na lista do ClickUp com:
 *         - Nome, função, valor, dias, PIX no campo da tarefa
 *         - Todos os campos custom preenchidos (incluindo dropdowns)
 *    4. Devolve JSON com resultado de cada criação
 *
 *  Configuração necessária (arquivo .env):
 *    CLICKUP_TOKEN    — API Token pessoal (pk_...)
 *    CLICKUP_LIST_ID  — ID da lista onde as tarefas serão criadas
 *    ALLOWED_ORIGINS  — domínios do front-end separados por vírgula
 *                       (ex.: https://leverefeicoes.com.br,http://leverefeicoes.com.br)
 *    API_KEY          — (opcional) chave compartilhada; se definida, o front
 *                       precisa enviar o header "x-api-key" com o mesmo valor
 *    PORT             — (opcional) porta do servidor, padrão 3000
 * ─────────────────────────────────────────────────────────────────────────────
 */
 
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const axios   = require("axios");
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
// ─── MIDDLEWARES ─────────────────────────────────────────────────────────────
// Lista de origens permitidas — adicione aqui todos os domínios do front-end
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Chave compartilhada simples (opcional). Se definida no .env, toda requisição
// ao POST /api/solicitacao precisa enviar o header "x-api-key" com este valor.
// Se não definida, a verificação é ignorada (não bloqueia).
const API_KEY = process.env.API_KEY;

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: Postman, curl, health checks)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Rejeita de forma limpa: o navegador bloqueia, mas sem stack trace no log
    console.warn(`[CORS] Origem bloqueada: ${origin}`);
    callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));

app.use(express.json());

// Middleware de autorização por chave compartilhada
function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // não configurado → não bloqueia
  if (req.get("x-api-key") === API_KEY) return next();
  return res.status(401).json({ success: false, erro: "Não autorizado." });
}

 
// ─── CONFIG CLICKUP ──────────────────────────────────────────────────────────
const CU_TOKEN   = process.env.CLICKUP_TOKEN;
const CU_LIST_ID = process.env.CLICKUP_LIST_ID;
 
const clickup = axios.create({
  baseURL: "https://api.clickup.com/api/v2",
  timeout: 15000, // 15s — evita requisições penduradas se o ClickUp travar
  headers: {
    Authorization: CU_TOKEN,
    "Content-Type": "application/json",
  },
});
 
// ─── MAPA DE CAMPOS CUSTOMIZADOS ─────────────────────────────────────────────
//
//  UUIDs mapeados a partir da lista 901327002938.
//
//  Notas:
//    • "Data do Serviço" (5d7cdefb) é tipo date — recebe timestamp em ms.
//      A data legível também aparece na descrição da tarefa.
//    • "Unidade" (13c4fa90) é tipo labels — envia array de UUIDs da opção.
//    • Campos currency (Valor, Valor do Evento) recebem o valor decimal direto
//      (ex.: 100 = R$ 100,00), NÃO centavos.
//    • "Valor Total" (3900ec9b) é formula — só leitura, não é enviado.
//
const FIELD_IDS = {
  // ── Cabeçalho ──
  tipoDemanda:      "90e16639-6f23-45b2-b7c9-1c01ac5d2552", // "Tipo de demanda" drop_down
  unidade:          "13c4fa90-46d1-4ae2-a352-dbf604f574bc", // "Unidade" labels
  solicitante:      "e8f671fe-9b9b-46fb-b0e7-1d702bfbcaad", // "Nome solicitante" short_text
  dataServico:      "5d7cdefb-44c8-4da2-bc7f-8d44003fdd69", // "Data do Serviço" date (timestamp ms)
  dataServicoText:  "da2285b2-82f0-4667-ba7b-98a4e43f26ed", // "Data do Serviço" short_text (DD/MM/YYYY)
  horario:          "b177b7de-514a-47b7-8e2e-a9ceca5180c9", // "Horário de início" short_text
  justificativa:    "6a00a137-a96f-4ff8-9b3f-5ef4618a87e8", // "Justificativa" text longo
  valorEvento:      "ed687ec0-f64e-46d7-a149-004cda5043f3", // "Valor do Evento" currency (centavos)

  // ── Profissional ──
  nomeProfissional: "4108b928-d271-45c1-94bf-1374184a346c", // "Nome Completo" short_text
  funcao:           "75be94f3-a544-422f-9525-4954c11f8730", // "Função" drop_down
  valorDiaria:      "5f8243cd-9d48-4770-b029-88da71b3024a", // "Valor" currency (centavos)
  qtdDias:          "7535b259-e844-403d-b8a0-a78e4bb951c3", // "Quantidade" number
  chave_pix:        "a287615a-8e21-45ae-9086-0b5396ede5ba", // "Forma de Pagamento" short_text
  // "Valor Total" (3900ec9b) é campo formula — calculado automaticamente pelo ClickUp, não enviado
};

//
//  Mapeamento texto → UUID da opção para campos do tipo drop_down.
//
//  ⚠️  ATENÇÃO: os valores abaixo são PLACEHOLDERS.
//  Para obter os UUIDs reais, acesse: GET http://localhost:3000/api/campos
//  Procure pelos campos "Tipo de demanda" e "Função", e copie o "id" de cada
//  opção dentro de type_config.options[]. Substitua os valores abaixo.
//
//  Exemplo de retorno da API ClickUp:
//    { "id": "abc123-uuid", "name": "Cozinheiro", "orderindex": 1 }
//                ↑ este "id" é o que deve ser usado como value
//
const DROPDOWN_OPTIONS = {
  // "Tipo de demanda" — 90e16639-6f23-45b2-b7c9-1c01ac5d2552
  tipoDemanda: {
    "Evento":  "3bf52cb0-3f21-4d2b-b1f5-efd644a6c083",
    "Cozinha": "fd7fc7f4-0453-49a7-bbf0-dd99a070869e",
  },

  // "Função" — 75be94f3-a544-422f-9525-4954c11f8730
  funcao: {
    "Garçom":              "32768a6e-a0ec-4990-9e82-390639597464",
    "Cozinheiro":          "52a6b374-5378-4a0c-b941-f261022b8b6d",
    "Auxiliar de cozinha": "61da521b-aff1-48fc-983e-79c97ffa2c9a",
    "Nutricionista":       "39e00bfd-6aa7-4224-9bad-92226401d153",
    "Auxiliar de serviços":"04c7421e-a8bb-4641-b12c-089c7cbdcd45",
    "Motorista":           "1ebc219f-e097-4c1b-81b3-01baf70ac233",
    "Outro":               "91b0f955-d7ae-4152-aec2-e9add0bebe62",
  },
};
 
// Mapeamento valor → UUID para o campo "Unidade" (tipo labels)
// A API do ClickUp para labels exige o UUID da opção, não o texto
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
 
// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Converte data "YYYY-MM-DD" em timestamp Unix (ms) — exigido por campos tipo date.
 */
function dateToTimestamp(dateStr) {
  if (!dateStr) return null;
  // T12:00:00Z ancora ao meio-dia UTC — evita regressão de 1 dia em UTC-3
  const ts = new Date(dateStr + "T12:00:00Z").getTime();
  return isNaN(ts) ? null : ts;
}

function dropdownIndex(campo, valor) {
  const map = DROPDOWN_OPTIONS[campo];
  if (!map) {
    console.warn(`[WARN] Mapa não encontrado: ${campo}`);
    return null;
  }
  // ?? null garante que índice 0 retorna 0, e ausente retorna null (nunca undefined)
  const idx = map[valor] ?? null;
  if (idx === null) {
    console.warn(`[WARN] Opção "${valor}" não mapeada em "${campo}"`);
  }
  return idx;
}

function buildCustomFields(dados, extra) {
  const fields = [];

  const add = (id, value) => {
    if (id && value !== null && value !== undefined && value !== "") {
      fields.push({ id, value });
    }
  };

  // ── Tipo de demanda (drop_down → orderindex) ──
  const tipoIdx = dropdownIndex("tipoDemanda", dados.tipoDemanda);
  if (tipoIdx !== null) add(FIELD_IDS.tipoDemanda, tipoIdx);

  // ── Unidade (labels → array de UUIDs da opção) ──
  if (dados.unidade) {
    const labelId = LABEL_IDS[dados.unidade];
    if (labelId) {
      fields.push({ id: FIELD_IDS.unidade, value: [labelId] });
    } else {
      console.warn(`[WARN] UUID não encontrado para unidade: "${dados.unidade}"`);
    }
  }

  // ── Campos de texto do cabeçalho ──
  add(FIELD_IDS.solicitante,   dados.solicitante);
  add(FIELD_IDS.horario,       dados.horario);
  add(FIELD_IDS.justificativa, dados.justificativa);

  // ── Data do Serviço ──
  // NÃO é enviada aqui: o campo date (5d7cdefb) é setado após a criação,
  // via endpoint dedicado de custom field, que é mais confiável para datas.

  if (dados.tipoDemanda === "Evento" && dados.valorEvento) {
    add(FIELD_IDS.valorEvento, Math.round(dados.valorEvento * 100) / 100);
  }

  // ── Nome do profissional ──
  add(FIELD_IDS.nomeProfissional, extra.nome);

  // ── Função (drop_down → orderindex) ──
  const funcaoIdx = dropdownIndex("funcao", extra.funcao);
  if (funcaoIdx !== null) add(FIELD_IDS.funcao, funcaoIdx);

// ── Valor da diária (currency → valor decimal direto) ──
add(FIELD_IDS.valorDiaria, Math.round((extra.valorDiaria || 0) * 100) / 100);

  // ── Quantidade de dias (number) ──
  add(FIELD_IDS.qtdDias, Number(extra.qtdDias));

  // ── Chave PIX / Forma de Pagamento (short_text) ──
  add(FIELD_IDS.chave_pix, extra.pix);

  // Nota: "Valor Total" (3900ec9b) é campo formula — calculado automaticamente,
  // não é enviado na criação da tarefa.

  return fields;
}
 
/**
 * Monta o nome da tarefa no ClickUp.
 * Exemplo: "[Evento] Garçom — João Silva | Mossoró | 15/06/2025"
 */
function buildTaskName(dados, extra) {
  const tipo  = dados.tipoDemanda || "Solicitação";
  const nome  = extra.nome        || "Profissional";
  const func  = extra.funcao      || "";
  const unid  = dados.unidade     || "";
 
  let data = "";
  if (dados.dataServico) {
    const [y, m, d] = dados.dataServico.split("-");
    data = `${d}/${m}/${y}`;
  }
 
  return `[${tipo}] ${func} — ${nome} | ${unid} | ${data}`;
}
 
/**
 * Monta a descrição rica da tarefa (markdown do ClickUp).
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
  ]
    .filter(l => l !== null)
    .join("\n");
}



 
// ─── BUSCAR CAMPOS DA LISTA (utilitário de configuração) ─────────────────────
app.get("/api/campos", async (req, res) => {
  if (!CU_TOKEN || !CU_LIST_ID) {
    return res.status(500).json({ erro: "CLICKUP_TOKEN ou CLICKUP_LIST_ID não configurados no .env" });
  }
  try {
    const { data } = await clickup.get(`/list/${CU_LIST_ID}/field`);
    const campos = (data.fields || []).map(f => ({
      id:      f.id,
      name:    f.name,
      type:    f.type,
      // Para drop_down e labels: lista cada opção com seu UUID e nome
      options: (f.type_config?.options || []).map(o => ({
        uuid:       o.id,          // ← use este valor em DROPDOWN_OPTIONS
        name:       o.name,
        orderindex: o.orderindex,
      })),
    }));

    // Log amigável no servidor para facilitar configuração
    const dropdowns = campos.filter(c => c.type === "drop_down" && c.options.length > 0);
    if (dropdowns.length > 0) {
      console.log("\n📋  UUIDs dos campos drop_down (cole em DROPDOWN_OPTIONS):");
      dropdowns.forEach(c => {
        console.log(`\n  Campo: "${c.name}" (${c.id})`);
        c.options.forEach(o => console.log(`    "${o.name}": "${o.uuid}",`));
      });
      console.log("");
    }

    res.json({ campos });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("[ERROR] GET /api/campos:", detail);
    res.status(500).json({ erro: "Falha ao buscar campos do ClickUp", detalhe: detail });
  }
});
 
// ─── CRIAR TAREFAS (rota principal) ──────────────────────────────────────────
app.post("/api/solicitacao", requireApiKey, async (req, res) => {
  // Verificação de configuração
  if (!CU_TOKEN || !CU_LIST_ID) {
    return res.status(500).json({
      success: false,
      erro: "Servidor mal configurado: CLICKUP_TOKEN ou CLICKUP_LIST_ID ausentes no .env",
    });
  }
 
  const dados = req.body;
 
  // ── Validação básica ──
  const erros = [];
  if (!dados.unidade)       erros.push("unidade");
  if (!dados.solicitante)   erros.push("solicitante");
  if (!dados.dataServico)   erros.push("dataServico");
  if (!dados.horario)       erros.push("horario");
  if (!dados.justificativa) erros.push("justificativa");
  if (!Array.isArray(dados.extras) || dados.extras.length === 0) erros.push("extras (vazio)");
 
  if (erros.length > 0) {
    return res.status(400).json({
      success: false,
      erro: `Campos obrigatórios ausentes: ${erros.join(", ")}`,
    });
  }
 
  // ── Processar extras em paralelo ──
  const resultados = await Promise.allSettled(
    dados.extras.map(async (extra, i) => {
      const taskName    = buildTaskName(dados, extra);
      const description = buildTaskDescription(dados, extra);
      const customFields = buildCustomFields(dados, extra);
 
      const payload = {
        name:          taskName,
        description:   description,
        custom_fields: customFields,
        // Prioridade padrão: Normal (3). Ajuste se necessário.
        priority: 3,
      };
 
      console.log(`[INFO] Criando tarefa ${i + 1}: ${taskName}`);

        console.log("PAYLOAD ClickUp:", JSON.stringify({
        name: taskName,
        custom_fields: customFields
      }, null, 2));
      
 
      const { data: task } = await clickup.post(`/list/${CU_LIST_ID}/task`, payload);
 
      console.log(`[OK]   Tarefa criada: ${task.id} — ${task.url}`);

      // ── Setar a Data do Serviço (campo date) via endpoint dedicado ──
      // Mais confiável que enviar na criação. Timestamp em ms; time:false = só data.
      const ts = dateToTimestamp(dados.dataServico);
      if (ts) {
        try {
          await clickup.post(`/task/${task.id}/field/${FIELD_IDS.dataServico}`, {
            value: ts,
            value_options: { time: false },
          });
          console.log(`[OK]   Data setada na tarefa ${task.id}`);
        } catch (e) {
          console.warn(`[WARN] Falha ao setar data na tarefa ${task.id}:`,
            e.response?.data || e.message);
        }
      }
 
      return {
        extra:   extra.nome,
        task_id: task.id,
        url:     task.url,
      };
    })
  );


  // ── Separar sucessos e falhas ──
  const criadas = [];
  const falhas  = [];
 
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") {
      criadas.push(r.value);
    } else {
      const detail = r.reason?.response?.data || r.reason?.message || "Erro desconhecido";
      console.error(`[ERROR] Extra ${i + 1}:`, detail);
      falhas.push({
        extra:   dados.extras[i]?.nome || `Extra ${i + 1}`,
        erro:    detail,
      });
    }
  });
 
  // ── Resposta ──
  const success = falhas.length === 0;
  const status  = success ? 200 : falhas.length === dados.extras.length ? 500 : 207;
 
  return res.status(status).json({
    success,
    total_criadas: criadas.length,
    total_falhas:  falhas.length,
    tarefas:       criadas,
    falhas:        falhas.length > 0 ? falhas : undefined,
    erro: !success && falhas.length === dados.extras.length
      ? "Todas as tarefas falharam. Verifique os logs do servidor."
      : undefined,
  });
});
 
// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status:          "ok",
    token_ok:        !!CU_TOKEN,
    list_id_ok:      !!CU_LIST_ID,
    timestamp:       new Date().toISOString(),
  });
});

// ─── MIDDLEWARE DE ERRO GLOBAL ────────────────────────────────────────────────
// Garante que qualquer crash no servidor responda JSON, nunca HTML
app.use((err, req, res, next) => {
  console.error("[CRASH]", err.stack || err.message || err);
  res.status(500).json({
    success: false,
    erro: "Erro interno no servidor",
    detalhe: err.message || String(err),
  });
});
 
// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟢  Servidor rodando em http://localhost:${PORT}`);
  console.log(`    Health:  GET  http://localhost:${PORT}/api/health`);
  console.log(`    Campos:  GET  http://localhost:${PORT}/api/campos`);
  console.log(`    Submit:  POST http://localhost:${PORT}/api/solicitacao\n`);
 
  if (!CU_TOKEN)   console.warn("⚠️  CLICKUP_TOKEN não definido no .env");
  if (!CU_LIST_ID) console.warn("⚠️  CLICKUP_LIST_ID não definido no .env");
});
