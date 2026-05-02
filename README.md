# InvestIA Advisor

Plataforma de análise de investimentos com IA + Google Search em tempo real.

## Stack
- React + Vite (frontend)
- Vercel Functions (backend/proxy)
- Gemini 2.5 Pro + Google Search (IA)

## Deploy

1. Clone o repositório
2. No Vercel, importe o projeto
3. Adicione a variável de ambiente: `GEMINI_API_KEY=sua_chave`
4. Deploy automático via push na `main`

## Desenvolvimento local

```bash
npm install
npm run dev
```

Para testar as funções serverless localmente:
```bash
npm install -g vercel
vercel dev
```
