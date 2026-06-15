import { useState, useEffect, useCallback } from "react";
import {
  Users, UserCheck, UserX, UserPlus, Crown, TrendingUp,
  DollarSign, Wallet, PlusCircle, Trash2, RefreshCw, AlertCircle, ShieldCheck
} from "lucide-react";
import {
  carregarAdminMetrics, listarPagamentos, registrarPagamento, excluirPagamento
} from "../supabase";
import { showToast } from "../App";

const BRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PLANO_LABEL = { trial: "Trial", mensal: "Mensal", anual: "Anual", vitalicio: "Vitalício", outro: "Outro" };
const FAIXA_LABEL = { "<25": "< 25", "25-34": "25–34", "35-44": "35–44", "45-54": "45–54", "55+": "55+", nao_informado: "Não informado" };

export default function TabAdmin() {
  const [metrics, setMetrics] = useState(null);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ email: "", plano: "mensal", valor: "", metodo: "pix", pago_em: hoje, referencia: "" });

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const [m, p] = await Promise.all([carregarAdminMetrics(), listarPagamentos()]);
      setMetrics(m); setPagamentos(p);
    } catch (e) {
      setErro(e.message || "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    const valorNum = parseFloat(String(form.valor).replace(/\./g, "").replace(",", "."));
    if (!valorNum || valorNum <= 0) { showToast("Informe um valor válido", "error"); return; }
    const planoPago = ["mensal", "anual", "vitalicio"].includes(form.plano);
    if (planoPago && !form.email.trim()) {
      showToast("Informe o e-mail do cliente para ativar o plano", "error");
      return;
    }
    setSalvando(true);
    try {
      const res = await registrarPagamento({
        email: form.email.trim() || null,
        plano: form.plano,
        valor: valorNum,
        metodo: form.metodo,
        referencia: form.referencia.trim() || null,
        pago_em: form.pago_em,
      });
      if (res?.plano_ativado) {
        showToast(`Pagamento registrado e plano ${form.plano} ativado para ${form.email.trim()}`, "success");
      } else if (planoPago && res && !res.usuario_encontrado) {
        showToast(`Pagamento registrado, mas nenhum usuário com "${form.email.trim()}" — plano NÃO ativado`, "warning");
      } else {
        showToast("Pagamento registrado", "success");
      }
      setForm({ email: "", plano: "mensal", valor: "", metodo: "pix", pago_em: hoje, referencia: "" });
      await carregar();
    } catch (e) {
      showToast("Erro ao registrar: " + e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id) => {
    try {
      await excluirPagamento(id);
      await carregar();
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, "error");
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--ui-text-faint)" }}>Carregando painel...</div>;
  }
  if (erro) {
    return (
      <div style={{ padding: 24, color: "var(--ui-danger)", display: "flex", alignItems: "center", gap: 10 }}>
        <AlertCircle size={18} /> {erro === "forbidden" ? "Acesso restrito ao administrador." : erro}
      </div>
    );
  }

  const m = metrics || {};
  const teto = m.teto_cpf || 5000;
  const receitaMes = Number(m.receita_mes) || 0;
  const pctTeto = Math.min(100, (receitaMes / teto) * 100);
  const restante = Math.max(0, teto - receitaMes);
  const perto = pctTeto >= 80;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ShieldCheck size={20} color="var(--ui-accent)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ui-text)" }}>Painel estratégico</div>
          <div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>Visão geral de usuários, planos e receita — acesso exclusivo do administrador</div>
        </div>
        <button onClick={carregar} style={btnSec}><RefreshCw size={13} /> Atualizar</button>
      </div>

      {/* Cards de usuários */}
      <div style={grid}>
        <Card icon={Users} cor="var(--ui-info)" label="Usuários totais" valor={m.usuarios_total} />
        <Card icon={UserCheck} cor="var(--ui-success)" label="Ativos (30d)" valor={m.ativos_30d} />
        <Card icon={UserX} cor="var(--ui-text-muted)" label="Inativos (30d)" valor={m.inativos_30d} />
        <Card icon={UserPlus} cor="var(--ui-accent)" label="Novos (30d)" valor={m.novos_30d} />
        <Card icon={Crown} cor="var(--ui-warning)" label="Pagantes ativos" valor={m.pagantes_ativos} />
        <Card icon={TrendingUp} cor="var(--ui-success)" label="MRR estimado" valor={BRL(m.mrr_estimado)} small />
      </div>

      {/* Receita do mês + teto CPF */}
      <div style={cardBox}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Wallet size={16} color="var(--ui-success)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ui-text)" }}>Receita do mês (caixa real)</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: perto ? "var(--ui-warning)" : "var(--ui-success)", fontFamily: "'JetBrains Mono', monospace" }}>{BRL(receitaMes)}</span>
          <span style={{ fontSize: 13, color: "var(--ui-text-muted)" }}>de {BRL(teto)} (teto CPF) · {m.pagamentos_mes || 0} pagamento(s)</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: "var(--ui-bg-secondary)", overflow: "hidden" }}>
          <div style={{ width: `${pctTeto}%`, height: "100%", background: perto ? "var(--ui-warning)" : "var(--ui-success)", transition: "width .3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--ui-text-faint)" }}>
          <span>{pctTeto.toFixed(0)}% do teto</span>
          <span>Restam {BRL(restante)}</span>
        </div>
        {perto && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(217,119,6,0.10)", border: "1px solid rgba(217,119,6,0.30)", borderRadius: 8, fontSize: 12, color: "var(--ui-warning)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={14} /> Atenção: você está próximo do teto de R$ 5.000 do CPF neste mês.
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--ui-text-muted)" }}>
          Receita últimos 12 meses: <b style={{ color: "var(--ui-text)" }}>{BRL(m.receita_12m)}</b>
        </div>
      </div>

      {/* Distribuições */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <Distribuicao titulo="Por plano" dados={m.por_plano} label={PLANO_LABEL} />
        <Distribuicao titulo="Faixa etária" dados={m.faixas_etarias} label={FAIXA_LABEL} />
        <div style={cardBox}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ui-text)", marginBottom: 10 }}>Trial</div>
          <LinhaKV k="Em teste (ativos)" v={m.trial_ativos} cor="var(--ui-info)" />
          <LinhaKV k="Trial expirado" v={m.trial_expirados} cor="var(--ui-text-muted)" />
        </div>
      </div>

      {/* Registrar pagamento */}
      <div style={cardBox}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <PlusCircle size={16} color="var(--ui-accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ui-text)" }}>Registrar pagamento</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <Campo label="E-mail do cliente">
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="cliente@email.com" style={inp} />
          </Campo>
          <Campo label="Plano">
            <select value={form.plano} onChange={e => setForm({ ...form, plano: e.target.value })} style={inp}>
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
              <option value="vitalicio">Vitalício</option>
              <option value="outro">Outro</option>
            </select>
          </Campo>
          <Campo label="Valor (R$)">
            <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="24,90" style={inp} />
          </Campo>
          <Campo label="Método">
            <select value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value })} style={inp}>
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
              <option value="boleto">Boleto</option>
              <option value="outro">Outro</option>
            </select>
          </Campo>
          <Campo label="Data">
            <input type="date" value={form.pago_em} max={hoje} onChange={e => setForm({ ...form, pago_em: e.target.value })} style={inp} />
          </Campo>
          <Campo label="Referência (opcional)">
            <input value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} placeholder="id transação" style={inp} />
          </Campo>
        </div>
        <button onClick={salvar} disabled={salvando} style={{ ...btnPrim, marginTop: 12 }}>
          <PlusCircle size={14} /> {salvando ? "Salvando..." : "Registrar"}
        </button>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--ui-text-faint)" }}>
          Ao registrar um plano pago (mensal/anual/vitalício), o plano do cliente é <b style={{ color: "var(--ui-text-secondary)" }}>ativado/renovado automaticamente</b> pelo e-mail. Mensal soma 1 mês, anual 1 ano (renovação estende a partir do vencimento atual). Excluir um pagamento NÃO reverte o plano.
        </div>
      </div>

      {/* Lista de pagamentos */}
      <div style={cardBox}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <DollarSign size={16} color="var(--ui-success)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ui-text)" }}>Pagamentos registrados ({pagamentos.length})</span>
        </div>
        {pagamentos.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ui-text-faint)", padding: "8px 0" }}>Nenhum pagamento registrado ainda.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pagamentos.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--ui-bg-secondary)", borderRadius: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: "var(--ui-success)", fontFamily: "'JetBrains Mono', monospace", minWidth: 90 }}>{BRL(p.valor)}</span>
                <span style={{ color: "var(--ui-text-secondary)", minWidth: 70 }}>{PLANO_LABEL[p.plano] || p.plano}</span>
                <span style={{ color: "var(--ui-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email || "—"}</span>
                <span style={{ color: "var(--ui-text-faint)" }}>{p.metodo || ""}</span>
                <span style={{ color: "var(--ui-text-faint)", fontFamily: "'JetBrains Mono', monospace" }}>{p.pago_em ? new Date(p.pago_em).toLocaleDateString("pt-BR") : ""}</span>
                <button onClick={() => remover(p.id)} title="Excluir" style={{ background: "transparent", border: "none", color: "var(--ui-text-disabled)", cursor: "pointer", display: "flex", padding: 4 }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };
const cardBox = { background: "var(--ui-bg-card)", border: "1px solid var(--ui-border)", borderRadius: 12, padding: "16px 18px", boxShadow: "var(--ui-shadow-sm)" };
const btnSec = { background: "var(--ui-bg-elevated)", border: "1px solid var(--ui-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ui-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const btnPrim = { background: "var(--ui-accent)", border: "none", borderRadius: 8, padding: "10px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 };
const inp = { width: "100%", background: "var(--ui-bg-input)", border: "1px solid var(--ui-border)", borderRadius: 6, padding: "8px 10px", color: "var(--ui-text)", fontSize: 12 };

function Card({ icon: Icon, cor, label, valor, small }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={15} color={cor} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ui-text-disabled)", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: small ? 18 : 24, fontWeight: 800, color: "var(--ui-text)", fontFamily: "'JetBrains Mono', monospace" }}>{valor ?? 0}</div>
    </div>
  );
}

function Distribuicao({ titulo, dados, label }) {
  const entradas = Object.entries(dados || {});
  const total = entradas.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <div style={cardBox}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ui-text)", marginBottom: 10 }}>{titulo}</div>
      {entradas.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--ui-text-faint)" }}>Sem dados</div>
      ) : entradas.map(([k, n]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: "var(--ui-text-secondary)" }}>{label[k] || k}</span>
            <span style={{ color: "var(--ui-text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>{n} ({Math.round((n / total) * 100)}%)</span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: "var(--ui-bg-secondary)", overflow: "hidden" }}>
            <div style={{ width: `${(n / total) * 100}%`, height: "100%", background: "var(--ui-accent)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LinhaKV({ k, v, cor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13 }}>
      <span style={{ color: "var(--ui-text-secondary)" }}>{k}</span>
      <span style={{ fontWeight: 700, color: cor || "var(--ui-text)", fontFamily: "'JetBrains Mono', monospace" }}>{v ?? 0}</span>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--ui-text-disabled)", letterSpacing: 0.8, marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}
