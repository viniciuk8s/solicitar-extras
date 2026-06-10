const regioes = {
  "Rio Grande do Norte": [
    { label: "Parnamirim",   value: "RN - Parnamirim"    },
    { label: "Caicó",        value: "RN - Caicó"         },
    { label: "Mossoró",      value: "RN - Mossoró "      }, 
  ],
  "Paraíba": [
    { label: "João Pessoa",  value: "PB - João Pessoa"   },
  ],
  "Pernambuco": [
    { label: "Caruaru",      value: "PE - Caruaru"       },
  ],
  "Sergipe": [
    { label: "São Cristóvão", value: "SE - São Critovão" }, 
    { label: "Aracaju",       value: "SE - Aracaju"      },
  ],
  "Maranhão": [
    { label: "São Luís",     value: "MA - São Luiz"      },
  ],
  "Paraná": [
    { label: "Telêmaco Borba", value: "PR - Telemaco Borba" },
  ],
  "Rio Grande do Sul": [
    { label: "Porto Alegre", value: "RS - Porto Alegre " }, 
  ],
  "São Paulo": [
    { label: "São Paulo",    value: "SP - São Paulo "    }, 
  ],
  "Alagoas": [
    { label: "Arapiraca",    value: "AL - Arapiraca"     },
  ],
};

const funcoes = ["Garçom", "Cozinheiro", "Auxiliar de cozinha", "Nutricionista", "Motorista"];

// ─── ELEMENTOS ───
const selectUnidade   = document.getElementById("f-unidade");
const extrasContainer = document.getElementById("extras-container");
const btnAddExtra     = document.getElementById("btn-add-extra");
const btnEvento       = document.getElementById("btn-evento");
const btnCozinha      = document.getElementById("btn-cozinha");
const campoEvento     = document.getElementById("campo-evento");
const extrasCount     = document.getElementById("extrasCount");
const progressBar     = document.getElementById("progressBar");

let tipoDemanda = "Evento";
let extraIndex  = 0;


(function popularUnidades() {
  Object.entries(regioes).forEach(([estado, cidades]) => {
    const g = document.createElement("optgroup");
    g.label = estado;
    cidades.forEach(({ label, value }) => {
      const o = document.createElement("option");
      o.value       = value;   
      o.textContent = label;   
      g.appendChild(o);
    });
    selectUnidade.appendChild(g);
  });
})();

// ─── TIPO DEMANDA ───
function alterarTipo(tipo) {
  tipoDemanda = tipo;
  btnEvento.classList.toggle("active",  tipo === "Evento");
  btnCozinha.classList.toggle("active", tipo === "Cozinha");
  campoEvento.classList.toggle("field-hide", tipo !== "Evento");
}

btnEvento.addEventListener("click",  () => alterarTipo("Evento"));
btnCozinha.addEventListener("click", () => alterarTipo("Cozinha"));


function gerarFuncoes() {
  return funcoes.map(f => `<option value="${f}">${f}</option>`).join("");
}


function criarExtra() {
  extraIndex++;
  const id  = `extra-${Date.now()}-${extraIndex}`;
  const num = extraIndex;

  const card = document.createElement("div");
  card.className = "extra-card";
  card.dataset.extraId = id;

  card.innerHTML = `
    <div class="extra-header">
      <div class="extra-num-wrap">
        <div class="extra-avatar" data-avatar="${num}">E${num}</div>
        <div>
          <div class="extra-title" data-title>Extra ${num}</div>
          <div class="extra-subtitle">Preencha os dados do profissional</div>
        </div>
      </div>
      <button type="button" class="btn-remove" data-remove="${id}" title="Remover">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="extra-body">
      <div class="extra-row3">
        <div class="field">
          <label>Nome completo <span class="req">*</span></label>
          <input type="text" class="extra-nome" placeholder="Nome do profissional" required>
        </div>
        <div class="field">
          <label>Função <span class="req">*</span></label>
          <select class="extra-funcao" required>
            <option value="">Selecione</option>
            ${gerarFuncoes()}
          </select>
        </div>
        <div class="field">
          <label>Valor diária (R$) <span class="req">*</span></label>
          <input type="number" class="extra-valor" placeholder="0.00" min="0" step="0.01" required>
        </div>
      </div>
      <div class="extra-row2">
        <div class="field">
          <label>Quantidade de dias <span class="req">*</span></label>
          <input type="number" class="extra-dias" min="1" value="1" required>
        </div>
        <div class="field">
          <label>Chave PIX <span class="req">*</span></label>
          <input type="text" class="extra-pix" placeholder="CPF, e-mail ou telefone" required>
        </div>
      </div>
      <div class="extra-total">
        Total estimado: <strong data-total>R$ 0,00</strong>
      </div>
    </div>
  `;


  const inputValor = card.querySelector(".extra-valor");
  const inputDias  = card.querySelector(".extra-dias");
  const totalEl    = card.querySelector("[data-total]");
  const nomeInput  = card.querySelector(".extra-nome");
  const titleEl    = card.querySelector("[data-title]");

  function calcTotal() {
    const v = parseFloat(inputValor.value || 0);
    const d = parseInt(inputDias.value   || 1);
    const t = v * d;
    totalEl.textContent = "R$ " + t.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  inputValor.addEventListener("input", calcTotal);
  inputDias.addEventListener("input",  calcTotal);


  nomeInput.addEventListener("input", () => {
    const nome = nomeInput.value.trim();
    titleEl.textContent = nome || `Extra ${num}`;
  });

  extrasContainer.appendChild(card);
  atualizarEstado();
  atualizarProgress();

  setTimeout(() => nomeInput.focus(), 50);
}


extrasContainer.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  if (document.querySelectorAll(".extra-card").length === 1) return;
  const card = document.querySelector(`[data-extra-id="${btn.dataset.remove}"]`);
  if (!card) return;
  card.style.opacity    = "0";
  card.style.transform  = "translateY(-8px)";
  card.style.transition = "opacity .2s, transform .2s";
  setTimeout(() => { card.remove(); atualizarEstado(); }, 200);
});


function atualizarEstado() {
  const cards = document.querySelectorAll(".extra-card");
  cards.forEach((card, i) => {
    const n  = i + 1;
    const av = card.querySelector("[data-avatar]");
    if (av) { av.textContent = `E${n}`; av.dataset.avatar = n; }
    const tl   = card.querySelector("[data-title]");
    const nome = card.querySelector(".extra-nome")?.value?.trim();
    if (tl && !nome) tl.textContent = `Extra ${n}`;
  });
  extrasCount.textContent = cards.length;
}


function atualizarProgress() {
  const campos = document.querySelectorAll("input[required], select[required], textarea[required]");
  let preenchidos = 0;
  campos.forEach(c => { if (c.value?.trim()) preenchidos++; });
  const pct = Math.round((preenchidos / campos.length) * 100);
  progressBar.style.width = pct + "%";
}

document.addEventListener("input",  atualizarProgress);
document.addEventListener("change", atualizarProgress);


function obterExtras() {
  return Array.from(document.querySelectorAll(".extra-card")).map(card => ({
    nome:        card.querySelector(".extra-nome")?.value?.trim()          || "",
    funcao:      card.querySelector(".extra-funcao")?.value?.trim()        || "",

    valorDiaria: parseFloat(card.querySelector(".extra-valor")?.value      || 0),
    qtdDias:     parseInt(card.querySelector(".extra-dias")?.value         || 1),
    pix:         card.querySelector(".extra-pix")?.value?.trim()           || ""
  }));
}

function obterPayload() {

  const valorRaw = (document.getElementById("valor")?.value || "0")
    .replace(/\./g, "")  
    .replace(",", ".");  

  return {
    tipoDemanda:   tipoDemanda,
    unidade:       selectUnidade?.value?.trim()                          || "",
    solicitante:   document.getElementById("solicitante")?.value?.trim() || "",
    dataServico:   document.getElementById("data")?.value?.trim()        || "",
    horario:       document.getElementById("horario")?.value?.trim()     || "",
    valorEvento:   parseFloat(valorRaw) || 0,
    justificativa: document.getElementById("justificativa")?.value?.trim() || "",
    extras:        obterExtras()
  };
}

function validar(d) {
  if (!d.unidade)       return ["f-unidade",    "Selecione a unidade."];
  if (!d.solicitante)   return ["solicitante",   "Informe o nome do solicitante."];
  if (!d.dataServico)   return ["data",          "Informe a data do serviço."];
  if (!d.horario)       return ["horario",       "Informe o horário."];
  if (!d.justificativa) return ["justificativa", "Informe a justificativa."];
  for (const [i, e] of d.extras.entries()) {
    const n = i + 1;
    if (!e.nome)        return [null, `Extra ${n}: informe o nome completo.`];
    if (!e.funcao)      return [null, `Extra ${n}: selecione a função.`];
    if (!e.valorDiaria) return [null, `Extra ${n}: informe o valor da diária.`];
    if (!e.pix)         return [null, `Extra ${n}: informe a chave PIX.`];
  }
  return null;
}


function toast(type, title, msg) {
  const wrap = document.getElementById("toastWrap");
  const el   = document.createElement("div");
  el.className = `toast ${type}`;

  const checkIcon = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  const xIcon     = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  el.innerHTML = `
    <div class="toast-icon">${type === "success" ? checkIcon : xIcon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
  `;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  }, 5000);
}

document.getElementById("formSolicitacao").addEventListener("submit", async (e) => {
  e.preventDefault();

  const dados = obterPayload();
  const erro  = validar(dados);

  if (erro) {
    const [fieldId, msg] = erro;
    if (fieldId) {
      const el = document.getElementById(fieldId);
      if (el) {
        el.classList.add("error");
        el.focus();
        setTimeout(() => el.classList.remove("error"), 3000);
      }
    }
    toast("error", "Campo obrigatório", msg);
    return;
  }

  const btn = document.getElementById("btnSubmit");
  btn.disabled = true;
  btn.innerHTML = `
    <svg class="spin" viewBox="0 0 24 24" style="width:17px;height:17px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
    Enviando…
  `;

try {
  console.log("ENVIANDO:", JSON.stringify(dados, null, 2));

const res = await fetch("https://solicitar-extras.onrender.com/api/solicitacao", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(dados)
  });


  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const texto = await res.text();
    console.error("Servidor retornou não-JSON:", texto);
    toast("error", "Erro no servidor", `Status ${res.status} — veja o console do servidor.`);
    return;
  }

  const resultado = await res.json();
  console.log("RESPOSTA:", resultado);

  if (resultado.success) {
    toast("success", "Solicitação enviada!", `${resultado.total_criadas} tarefa(s) criada(s) no ClickUp.`);
    document.getElementById("formSolicitacao").reset();
    extrasContainer.innerHTML = "";
    extraIndex = 0;
    criarExtra();
    alterarTipo("Evento");
    progressBar.style.width = "0%";
  } else {
    console.error("Erro ClickUp:", resultado);
    toast("error", "Erro ao enviar", resultado.erro || "Falha ao criar solicitação.");
  }
} catch (err) {
  console.error("Erro de conexão:", err);
  toast("error", "Falha de conexão", "Não foi possível conectar ao servidor.");
} finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width:17px;height:17px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Enviar solicitação
    `;
  }
});

criarExtra();
btnAddExtra.addEventListener("click", criarExtra);
