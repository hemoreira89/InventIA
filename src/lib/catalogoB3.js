// ─── Catálogo curado de tickers da B3 ────────────────────────────────────────
// Organizados por categoria e setor para facilitar seleção pelo usuário
// Atualizado em janeiro/2026 com os principais ativos negociados

export const CATEGORIAS = [
  // ─── AÇÕES ─────────────────────────────────────────────────────────────────
  {
    id: "bancos",
    nome: "Bancos",
    icone: "🏦",
    cor: "#00b4d8",
    tipo: "acao",
    descricao: "Setor financeiro, dividendos consistentes",
    ativos: [
      { ticker: "ITUB4", nome: "Itaú Unibanco PN", popular: true },
      { ticker: "BBAS3", nome: "Banco do Brasil ON", popular: true },
      { ticker: "BBDC4", nome: "Bradesco PN", popular: true },
      { ticker: "SANB11", nome: "Santander Units" },
      { ticker: "ITSA4", nome: "Itaúsa PN", popular: true },
      { ticker: "BPAC11", nome: "BTG Pactual Units" },
      { ticker: "BBSE3", nome: "BB Seguridade ON" },
    ]
  },
  {
    id: "energia",
    nome: "Energia Elétrica",
    icone: "⚡",
    cor: "#ffd60a",
    tipo: "acao",
    descricao: "Defensivas, alto DY, estáveis",
    ativos: [
      { ticker: "TAEE11", nome: "Taesa Units", popular: true },
      { ticker: "EGIE3", nome: "Engie Brasil ON", popular: true },
      { ticker: "ELET3", nome: "Eletrobras ON" },
      { ticker: "CMIG4", nome: "Cemig PN" },
      { ticker: "CPLE6", nome: "Copel PN" },
      { ticker: "ENGI11", nome: "Energisa Units" },
      { ticker: "EQTL3", nome: "Equatorial ON", popular: true },
    ]
  },
  {
    id: "petroleo",
    nome: "Petróleo & Mineração",
    icone: "🛢️",
    cor: "#ff6b35",
    tipo: "acao",
    descricao: "Commodities, cíclicas, alto DY",
    ativos: [
      { ticker: "PETR4", nome: "Petrobras PN", popular: true },
      { ticker: "PETR3", nome: "Petrobras ON" },
      { ticker: "VALE3", nome: "Vale ON", popular: true },
      { ticker: "PRIO3", nome: "PRIO ON" },
      { ticker: "RECV3", nome: "PetroRecôncavo ON" },
      { ticker: "CSNA3", nome: "CSN ON" },
      { ticker: "USIM5", nome: "Usiminas PNA" },
    ]
  },
  {
    id: "saneamento",
    nome: "Saneamento",
    icone: "💧",
    cor: "#00e5a0",
    tipo: "acao",
    descricao: "Defensivas com viés regulado",
    ativos: [
      { ticker: "SAPR11", nome: "Sanepar Units", popular: true },
      { ticker: "SBSP3", nome: "Sabesp ON", popular: true },
      { ticker: "CSMG3", nome: "Copasa ON" },
    ]
  },
  {
    id: "consumo",
    nome: "Consumo & Varejo",
    icone: "🛒",
    cor: "#e040fb",
    tipo: "acao",
    descricao: "Cíclicas, mais voláteis",
    ativos: [
      { ticker: "ABEV3", nome: "Ambev ON", popular: true },
      { ticker: "LREN3", nome: "Lojas Renner ON" },
      { ticker: "MGLU3", nome: "Magazine Luiza ON" },
      { ticker: "AMER3", nome: "Americanas ON" },
      { ticker: "CRFB3", nome: "Carrefour Brasil ON" },
      { ticker: "ASAI3", nome: "Assaí ON" },
    ]
  },
  {
    id: "saude",
    nome: "Saúde",
    icone: "🏥",
    cor: "#ff4d6d",
    tipo: "acao",
    descricao: "Crescimento de longo prazo",
    ativos: [
      { ticker: "RDOR3", nome: "Rede D'Or ON" },
      { ticker: "HAPV3", nome: "Hapvida ON" },
      { ticker: "FLRY3", nome: "Fleury ON" },
      { ticker: "RADL3", nome: "Raia Drogasil ON", popular: true },
      { ticker: "PNVL3", nome: "Panvel ON" },
    ]
  },
  {
    id: "industria",
    nome: "Indústria & Logística",
    icone: "🏭",
    cor: "#a8dadc",
    tipo: "acao",
    descricao: "Diversas, exposição global",
    ativos: [
      { ticker: "WEGE3", nome: "WEG ON", popular: true },
      { ticker: "SUZB3", nome: "Suzano ON" },
      { ticker: "KLBN11", nome: "Klabin Units" },
      { ticker: "RAIL3", nome: "Rumo ON" },
      { ticker: "CCRO3", nome: "CCR ON" },
      { ticker: "RENT3", nome: "Localiza ON", popular: true },
    ]
  },
  {
    id: "tecnologia",
    nome: "Tecnologia",
    icone: "💻",
    cor: "#7b61ff",
    tipo: "acao",
    descricao: "Crescimento, mais voláteis",
    ativos: [
      { ticker: "TOTS3", nome: "TOTVS ON" },
      { ticker: "POSI3", nome: "Positivo Tech ON" },
      { ticker: "LWSA3", nome: "LWSA ON" },
    ]
  },

  // ─── FIIs ──────────────────────────────────────────────────────────────────
  {
    id: "fii_logistica",
    nome: "FIIs Logística",
    icone: "📦",
    cor: "#00e5a0",
    tipo: "fii",
    descricao: "Galpões logísticos, locação para grandes empresas",
    ativos: [
      { ticker: "HGLG11", nome: "CSHG Logística", popular: true },
      { ticker: "BTLG11", nome: "BTG Logística", popular: true },
      { ticker: "VILG11", nome: "Vinci Logística" },
      { ticker: "LVBI11", nome: "VBI Logística" },
      { ticker: "BRCO11", nome: "Bresco Logística" },
    ]
  },
  {
    id: "fii_tijolo",
    nome: "FIIs Tijolo (Comercial)",
    icone: "🏢",
    cor: "#7b61ff",
    tipo: "fii",
    descricao: "Lajes corporativas, shoppings, escritórios",
    ativos: [
      { ticker: "XPML11", nome: "XP Malls", popular: true },
      { ticker: "KNRI11", nome: "Kinea Renda Imobiliária", popular: true },
      { ticker: "VISC11", nome: "Vinci Shopping Centers" },
      { ticker: "PVBI11", nome: "VBI Prime Properties" },
      { ticker: "HSML11", nome: "HSI Mall" },
      { ticker: "MALL11", nome: "Malls Brasil Plural" },
    ]
  },
  {
    id: "fii_papel",
    nome: "FIIs Papel (Recebíveis)",
    icone: "📄",
    cor: "#ffd60a",
    tipo: "fii",
    descricao: "Carteiras de CRIs, alta renda mensal",
    ativos: [
      { ticker: "MXRF11", nome: "Maxi Renda", popular: true },
      { ticker: "IRDM11", nome: "Iridium Recebíveis", popular: true },
      { ticker: "KNCR11", nome: "Kinea Rendimentos" },
      { ticker: "RBRR11", nome: "RBR Rendimento High Grade" },
      { ticker: "CPTS11", nome: "Capitânia Securities" },
      { ticker: "BCFF11", nome: "BTG Fundo de Fundos" },
    ]
  },
  {
    id: "fii_residencial",
    nome: "FIIs Residencial",
    icone: "🏘️",
    cor: "#00b4d8",
    tipo: "fii",
    descricao: "Renda de aluguel residencial",
    ativos: [
      { ticker: "HCTR11", nome: "Hectare CE" },
      { ticker: "RBRP11", nome: "RBR Properties" },
    ]
  },
];

// Tickers marcados como populares vão estar pré-selecionados na primeira visita
export function getDefaultUniverso() {
  return CATEGORIAS.flatMap(cat =>
    cat.ativos.filter(a => a.popular).map(a => a.ticker)
  );
}

// Lista todos os tickers do catálogo
export function getAllTickers() {
  return CATEGORIAS.flatMap(cat => cat.ativos.map(a => a.ticker));
}

// Busca um ativo pelo ticker (retorna info da categoria também)
export function findAtivo(ticker) {
  for (const cat of CATEGORIAS) {
    const ativo = cat.ativos.find(a => a.ticker === ticker);
    if (ativo) return { ...ativo, categoria: cat };
  }
  return null;
}
