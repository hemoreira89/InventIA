// ─── Normalização de Setores B3 ──────────────────────────────────────────────
// Converte nomes da CVM (formato bizarro) em setores genéricos utilizáveis.
// Define ROE mínimo realista por setor (em vez de 15% fixo para todos).

/**
 * Mapeamento direto: nome CVM → setor genérico.
 * Cobre os principais setores da B3. Para o que não bater, usa heurística.
 */
export const SETOR_CVM_PARA_GENERICO = {
  // Petróleo e energia
  "Petróleo e Gás": "Petróleo e Gás",
  "Petróleo, Gás e Biocombustíveis": "Petróleo e Gás",
  "Emp. Adm. Part. - Petróleo e Gás": "Petróleo e Gás",

  // Energia elétrica
  "Energia Elétrica": "Energia Elétrica",
  "Emp. Adm. Part. - Energia Elétrica": "Energia Elétrica",

  // Saneamento
  "Saneamento, Serv. Água e Gás": "Saneamento",
  "Emp. Adm. Part. - Saneamento, Serv. Água e Gás": "Saneamento",

  // Bancos e financeiro
  "Bancos": "Bancos",
  "Intermediários Financeiros": "Bancos",
  "Emp. Adm. Part. - Bancos": "Bancos",
  "Holdings Diversificadas": "Holdings",
  "Outros Serviços Financeiros": "Serviços Financeiros",
  "Securitizadoras de Recebíveis": "Serviços Financeiros",
  "Seguradoras": "Seguradoras",
  "Previdência e Seguros": "Seguradoras",
  "Bolsas, Balcões e Bancos Centrais": "Bolsa e Custódia",

  // Mineração e siderurgia
  "Extração Mineral": "Mineração",
  "Emp. Adm. Part. - Extração Mineral": "Mineração",
  "Metalurgia e Siderurgia": "Siderurgia",
  "Emp. Adm. Part. - Metalurgia e Siderurgia": "Siderurgia",

  // Indústria e bens de capital
  "Emp. Adm. Part. - Máqs., Equip., Veíc. e Peças": "Bens de Capital",
  "Máqs., Equip., Veíc. e Peças": "Bens de Capital",
  "Materiais Diversos": "Bens de Capital",
  "Construção Civil, Mat. Constr. e Decoração": "Construção",
  "Emp. Adm. Part. - Construção Civil": "Construção",

  // Consumo e varejo
  "Comércio (Atacado e Varejo)": "Varejo",
  "Emp. Adm. Part. - Comércio": "Varejo",
  "Alimentos": "Alimentos",
  "Bebidas": "Bebidas",
  "Tecidos, Vestuário e Calçados": "Vestuário",

  // Saúde
  "Saúde": "Saúde",
  "Emp. Adm. Part. - Saúde": "Saúde",
  "Medicamentos e Outros Produtos": "Saúde",

  // Tecnologia e telecom
  "Telecomunicações": "Telecomunicações",
  "Emp. Adm. Part. - Telecomunicações": "Telecomunicações",
  "Programas e Serviços": "Tecnologia",
  "Computadores e Equipamentos": "Tecnologia",

  // Transporte e logística
  "Transporte e Serviços": "Transporte",
  "Emp. Adm. Part. - Transporte e Serviços": "Transporte",

  // Educação
  "Hospedagem e Turismo": "Hospedagem",
  "Emp. Adm. Part. - Educação": "Educação",
  "Educacional": "Educação",

  // Papel
  "Madeira e Papel": "Papel e Celulose",
  "Emp. Adm. Part. - Madeira e Papel": "Papel e Celulose",

  // Química
  "Química": "Química",
  "Emp. Adm. Part. - Química": "Química",
  "Petroquímicos": "Química",

  // Agricultura
  "Agricultura (Açúcar, Álcool e Cana)": "Agricultura",
  "Emp. Adm. Part. - Agricultura": "Agricultura",
  "Agropecuária": "Agricultura",
};

/**
 * ROE mínimo realista por setor.
 * Baseado em médias históricas observadas na B3 - valores conservadores
 * para evitar falsos negativos em setores capital-intensivos.
 *
 * Lógica:
 * - Setores leves (tech, marca): exigência alta (15-18%)
 * - Setores capital-intensivos (utility): exigência baixa (6-10%)
 * - Default 12% para casos não mapeados
 */
export const ROE_MINIMO_POR_SETOR = {
  // Tech e marca - alto retorno esperado
  "Tecnologia": 18,
  "Bebidas": 15,            // ABEV, etc - margem alta
  "Saúde": 12,
  "Bens de Capital": 12,    // WEGE acima da média setorial

  // Financeiro
  "Bancos": 12,             // grandes bancos > 15%, médios 8-12%
  "Bolsa e Custódia": 18,   // B3 - escala digital
  "Seguradoras": 15,        // float gera retorno
  "Serviços Financeiros": 10,
  "Holdings": 10,           // ITSA acompanha investidas

  // Commodities cíclicas
  "Petróleo e Gás": 10,
  "Mineração": 10,
  "Siderurgia": 8,          // mais cíclico
  "Papel e Celulose": 10,
  "Química": 10,
  "Agricultura": 8,

  // Capital-intensivo / regulado (tarifas baixas, mas estáveis)
  "Energia Elétrica": 8,
  "Saneamento": 6,          // monopólio regional, ROE baixo é ok
  "Telecomunicações": 8,
  "Transporte": 8,

  // Consumo e varejo
  "Alimentos": 12,
  "Varejo": 10,
  "Vestuário": 12,
  "Construção": 8,          // muito cíclico
  "Hospedagem": 8,
  "Educação": 12,
};

const ROE_MINIMO_DEFAULT = 12;

/**
 * Heurística de fallback por palavra-chave quando o setor CVM
 * não está na tabela direta.
 */
function detectarSetorPorPalavra(setorRaw) {
  if (!setorRaw) return null;
  const s = setorRaw.toLowerCase();

  if (/banco|interm.*financ/i.test(s)) return "Bancos";
  if (/segur|previd/i.test(s)) return "Seguradoras";
  if (/petr[óo]le|g[áa]s|combust/i.test(s)) return "Petróleo e Gás";
  if (/energia|el[ée]tric/i.test(s)) return "Energia Elétrica";
  if (/saneament|[áa]gua/i.test(s)) return "Saneamento";
  if (/miner|extra[çc][ãa]o/i.test(s)) return "Mineração";
  if (/sider|metalurg|a[çc]o/i.test(s)) return "Siderurgia";
  if (/papel|celul|madeira/i.test(s)) return "Papel e Celulose";
  if (/qu[íi]mic|petroqu[íi]mic/i.test(s)) return "Química";
  if (/varejo|com[ée]rcio/i.test(s)) return "Varejo";
  if (/aliment/i.test(s)) return "Alimentos";
  if (/bebid/i.test(s)) return "Bebidas";
  if (/sa[úu]de|hospital|cl[íi]nica|farma|medicament/i.test(s)) return "Saúde";
  if (/telecom/i.test(s)) return "Telecomunicações";
  if (/tecnolog|software|programa|computa/i.test(s)) return "Tecnologia";
  if (/transport|log[íi]stic/i.test(s)) return "Transporte";
  if (/m[áa]q|equip|capital|ve[íi]cul/i.test(s)) return "Bens de Capital";
  if (/constru/i.test(s)) return "Construção";
  if (/agricult|agropecu|cana|a[çc][úu]car/i.test(s)) return "Agricultura";
  if (/educa/i.test(s)) return "Educação";
  if (/hospedag|turism|hotel/i.test(s)) return "Hospedagem";
  if (/holding/i.test(s)) return "Holdings";

  return null;
}

/**
 * Normaliza setor CVM para forma genérica.
 * Tenta tabela direta, depois heurística, depois "Outros".
 *
 * @param {string} setorCVM - como vem de /companies/{ticker} bolsai
 * @returns {string} setor genérico para usar nas regras
 */
export function normalizarSetorCVM(setorCVM) {
  if (!setorCVM) return "Outros";

  // 1. Tabela direta (preferível, mais preciso)
  if (SETOR_CVM_PARA_GENERICO[setorCVM]) {
    return SETOR_CVM_PARA_GENERICO[setorCVM];
  }

  // 2. Heurística por palavra-chave
  const detectado = detectarSetorPorPalavra(setorCVM);
  if (detectado) return detectado;

  // 3. Fallback - retorna o original (vai cair no default ROE 12%)
  return setorCVM;
}

/**
 * Retorna ROE mínimo para um setor (forma genérica).
 * @param {string} setor - setor genérico (output de normalizarSetorCVM)
 * @returns {number} ROE mínimo em %
 */
export function roeMinimoSetor(setor) {
  return ROE_MINIMO_POR_SETOR[setor] ?? ROE_MINIMO_DEFAULT;
}

/**
 * Helper conjugado: a partir do setor CVM, retorna direto o ROE mínimo.
 */
export function roeMinimoFromCVM(setorCVM) {
  return roeMinimoSetor(normalizarSetorCVM(setorCVM));
}
