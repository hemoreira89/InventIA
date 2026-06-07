// ─── Catálogo curado de tickers da B3 ────────────────────────────────────────
// Organizados por categoria e setor para facilitar seleção pelo usuário.
// Atualizado em junho/2026: categorias corrigidas + cobertura ampliada
// (financeiro, combustíveis, siderurgia, alimentos/agro, papel&celulose,
//  telecom, logística, FoF imobiliário).
//
// `popular: true` = pré-selecionado no padrão (botão "Restaurar padrão").

export const CATEGORIAS = [
  // ─── AÇÕES ─────────────────────────────────────────────────────────────────
  {
    id: "bancos",
    nome: "Bancos & Financeiro",
    icone: "Landmark",
    cor: "#00b4d8",
    tipo: "acao",
    descricao: "Bancos, bolsa e seguradoras — dividendos consistentes",
    ativos: [
      { ticker: "ITUB4", nome: "Itaú Unibanco PN", popular: true },
      { ticker: "BBAS3", nome: "Banco do Brasil ON", popular: true },
      { ticker: "BBDC4", nome: "Bradesco PN", popular: true },
      { ticker: "ITSA4", nome: "Itaúsa PN", popular: true },
      { ticker: "B3SA3", nome: "B3 (Bolsa) ON", popular: true },
      { ticker: "SANB11", nome: "Santander Units" },
      { ticker: "BPAC11", nome: "BTG Pactual Units" },
      { ticker: "BBSE3", nome: "BB Seguridade ON" },
      { ticker: "PSSA3", nome: "Porto Seguro ON" },
    ]
  },
  {
    id: "energia",
    nome: "Energia Elétrica",
    icone: "Zap",
    cor: "#ffd60a",
    tipo: "acao",
    descricao: "Defensivas, alto DY, estáveis",
    ativos: [
      { ticker: "TAEE11", nome: "Taesa Units", popular: true },
      { ticker: "EGIE3", nome: "Engie Brasil ON", popular: true },
      { ticker: "EQTL3", nome: "Equatorial ON", popular: true },
      { ticker: "ELET3", nome: "Eletrobras ON" },
      { ticker: "CMIG4", nome: "Cemig PN" },
      { ticker: "CPLE6", nome: "Copel PN" },
      { ticker: "CPFE3", nome: "CPFL Energia ON" },
      { ticker: "ENGI11", nome: "Energisa Units" },
    ]
  },
  {
    id: "petroleo",
    nome: "Petróleo & Combustíveis",
    icone: "Fuel",
    cor: "#ff6b35",
    tipo: "acao",
    descricao: "Petróleo, distribuição de combustíveis",
    ativos: [
      { ticker: "PETR4", nome: "Petrobras PN", popular: true },
      { ticker: "PRIO3", nome: "PRIO ON", popular: true },
      { ticker: "PETR3", nome: "Petrobras ON" },
      { ticker: "RECV3", nome: "PetroRecôncavo ON" },
      { ticker: "VBBR3", nome: "Vibra Energia ON" },
      { ticker: "UGPA3", nome: "Ultrapar ON" },
      { ticker: "CSAN3", nome: "Cosan ON" },
    ]
  },
  {
    id: "mineracao",
    nome: "Mineração & Siderurgia",
    icone: "Factory",
    cor: "#b08968",
    tipo: "acao",
    descricao: "Minério e aço — commodities cíclicas",
    ativos: [
      { ticker: "VALE3", nome: "Vale ON", popular: true },
      { ticker: "GGBR4", nome: "Gerdau PN", popular: true },
      { ticker: "GOAU4", nome: "Metalúrgica Gerdau PN" },
      { ticker: "CSNA3", nome: "CSN ON" },
      { ticker: "USIM5", nome: "Usiminas PNA" },
    ]
  },
  {
    id: "saneamento",
    nome: "Saneamento",
    icone: "Droplet",
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
    icone: "ShoppingCart",
    cor: "#e040fb",
    tipo: "acao",
    descricao: "Cíclicas, mais voláteis",
    ativos: [
      { ticker: "ABEV3", nome: "Ambev ON", popular: true },
      { ticker: "LREN3", nome: "Lojas Renner ON" },
      { ticker: "ASAI3", nome: "Assaí ON" },
      { ticker: "CRFB3", nome: "Carrefour Brasil ON" },
      { ticker: "PCAR3", nome: "Grupo Pão de Açúcar ON" },
      { ticker: "NTCO3", nome: "Natura &Co ON" },
      { ticker: "MGLU3", nome: "Magazine Luiza ON" },
    ]
  },
  {
    id: "alimentos_agro",
    nome: "Alimentos & Agro",
    icone: "Wheat",
    cor: "#a3b18a",
    tipo: "acao",
    descricao: "Frigoríficos, alimentos e agronegócio",
    ativos: [
      { ticker: "JBSS3", nome: "JBS ON", popular: true },
      { ticker: "BRFS3", nome: "BRF ON" },
      { ticker: "SLCE3", nome: "SLC Agrícola ON" },
      { ticker: "SMTO3", nome: "São Martinho ON" },
    ]
  },
  {
    id: "saude",
    nome: "Saúde",
    icone: "Stethoscope",
    cor: "#ff4d6d",
    tipo: "acao",
    descricao: "Crescimento de longo prazo",
    ativos: [
      { ticker: "RADL3", nome: "Raia Drogasil ON", popular: true },
      { ticker: "RDOR3", nome: "Rede D'Or ON", popular: true },
      { ticker: "HAPV3", nome: "Hapvida ON" },
      { ticker: "FLRY3", nome: "Fleury ON" },
      { ticker: "HYPE3", nome: "Hypera ON" },
      { ticker: "PNVL3", nome: "Panvel ON" },
    ]
  },
  {
    id: "industria",
    nome: "Indústria & Bens de Capital",
    icone: "Factory",
    cor: "#a8dadc",
    tipo: "acao",
    descricao: "Máquinas, aeroespacial, bens de capital",
    ativos: [
      { ticker: "WEGE3", nome: "WEG ON", popular: true },
      { ticker: "EMBR3", nome: "Embraer ON", popular: true },
      { ticker: "RANI3", nome: "Irani Papel e Embalagem ON" },
    ]
  },
  {
    id: "papel_celulose",
    nome: "Papel & Celulose",
    icone: "Trees",
    cor: "#52796f",
    tipo: "acao",
    descricao: "Celulose e papel — exposição global e ao dólar",
    ativos: [
      { ticker: "SUZB3", nome: "Suzano ON", popular: true },
      { ticker: "KLBN11", nome: "Klabin Units" },
    ]
  },
  {
    id: "logistica",
    nome: "Logística & Transporte",
    icone: "Truck",
    cor: "#577590",
    tipo: "acao",
    descricao: "Ferrovias, rodovias, portos e locação",
    ativos: [
      { ticker: "RENT3", nome: "Localiza ON", popular: true },
      { ticker: "RAIL3", nome: "Rumo ON", popular: true },
      { ticker: "CCRO3", nome: "CCR ON" },
      { ticker: "STBP3", nome: "Santos Brasil ON" },
    ]
  },
  {
    id: "telecom",
    nome: "Telecom",
    icone: "Phone",
    cor: "#4895ef",
    tipo: "acao",
    descricao: "Defensivas, fluxo de caixa e dividendos",
    ativos: [
      { ticker: "VIVT3", nome: "Vivo (Telefônica) ON", popular: true },
      { ticker: "TIMS3", nome: "TIM ON" },
    ]
  },
  {
    id: "tecnologia",
    nome: "Tecnologia",
    icone: "Cpu",
    cor: "#7b61ff",
    tipo: "acao",
    descricao: "Crescimento, mais voláteis",
    ativos: [
      { ticker: "TOTS3", nome: "TOTVS ON", popular: true },
      { ticker: "INTB3", nome: "Intelbras ON" },
      { ticker: "POSI3", nome: "Positivo Tech ON" },
      { ticker: "LWSA3", nome: "LWSA ON" },
    ]
  },

  // ─── FIIs ──────────────────────────────────────────────────────────────────
  {
    id: "fii_logistica",
    nome: "FIIs Logística",
    icone: "Package",
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
    icone: "Building2",
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
      { ticker: "HGRE11", nome: "CSHG Real Estate (lajes)" },
      { ticker: "RBRP11", nome: "RBR Properties (lajes)" },
    ]
  },
  {
    id: "fii_papel",
    nome: "FIIs Papel (Recebíveis)",
    icone: "FileText",
    cor: "#ffd60a",
    tipo: "fii",
    descricao: "Carteiras de CRIs, alta renda mensal",
    ativos: [
      { ticker: "MXRF11", nome: "Maxi Renda", popular: true },
      { ticker: "IRDM11", nome: "Iridium Recebíveis", popular: true },
      { ticker: "KNCR11", nome: "Kinea Rendimentos (CDI)" },
      { ticker: "KNIP11", nome: "Kinea Índices de Preços (IPCA)" },
      { ticker: "RBRR11", nome: "RBR Rendimento High Grade" },
      { ticker: "CPTS11", nome: "Capitânia Securities" },
      { ticker: "HCTR11", nome: "Hectare CE (high yield)" },
    ]
  },
  {
    id: "fii_fof",
    nome: "FIIs FoF & Híbridos",
    icone: "Layers",
    cor: "#00b4d8",
    tipo: "fii",
    descricao: "Fundos que investem em outros FIIs (diversificação)",
    ativos: [
      { ticker: "BCFF11", nome: "BTG Fundo de Fundos", popular: true },
      { ticker: "KFOF11", nome: "Kinea FoF" },
      { ticker: "HFOF11", nome: "Hedge Top FoFII" },
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

// Retorna o setor do ticker baseado no catálogo (fallback quando IA não traz)
export function getSetorPorTicker(ticker) {
  const found = findAtivo(ticker);
  if (found) return found.categoria.nome;

  // Heurística para FIIs não catalogados (terminam em 11)
  if (/11$/.test(ticker)) return "Fundos Imobiliários";

  return "Outros";
}
