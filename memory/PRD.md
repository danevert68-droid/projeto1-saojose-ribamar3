# PRD - Concurso Prefeitura de São José de Ribamar

## Problema original
Importação do site do GitHub + evoluções: cards reordenados, validação de cargos vs site original, autenticação de candidatos e painel administrativo.

## Arquitetura
- Frontend: React (CRA + Craco) + páginas estáticas HTML em iframe + componentes React (Login/Signup/Admin)
- Backend: FastAPI + MongoDB + JWT (HS256) + bcrypt
- Auth: Bearer token em localStorage (`candidate_token` e `admin_token`)

## Personas
- **Candidato**: cria conta, faz login, inscreve-se em concurso
- **Administrador (Donas)**: acessa painel, vê cadastros + inscrições, gerencia dados

## Implementado
- **2026-05-15:** Importação do GitHub, fix do botão voltar duplicado, navegação voltar funcional em todo o fluxo, reordenação dos cards (Educação > Saúde > Guarda > Cajari), card inteiro clicável → cadastro, header de inscrições corrigido (38 cargos / 1304 vagas)
- **2026-05-17:** **Fase 1 de autenticação completa**:
  - Tela de Login `/login` (CPF ou e-mail) com saudação dinâmica (Bom dia/Boa tarde/Boa noite, concurseiro!)
  - Tela de Signup `/signup` (criar conta gratuita) com máscaras CPF/telefone
  - Login admin `/donaspainel/login` (donas / Seinao10@@)
  - Painel admin `/donaspainel` com 2 abas: **Cadastros** (todos os usuários) e **Inscrições** (efetivadas)
  - 3 KPIs: total cadastros, total inscrições, conversão %
  - Busca por nome/CPF/e-mail e deleção com cascata
  - Backend: register/login/me/admin login/inscrições/admin endpoints (16+ endpoints)
  - Proteção de rotas: `/inscricao`, `/cadastro`, `/cargo/*`, `/cota/*` exigem login do candidato; `/donaspainel` exige admin
  - 100% testes passaram (26 backend + 11 frontend flows)
- **2026-05-17 (cont.):** **Limpeza global + prefill ampliado**:
  - Novo script `public/pages/global-cleanup.js` injetado em todas as 17 páginas HTML
  - **WhatsApp**: remoção total dos botões/links em todas as páginas (incluindo plugin Wayra COC, `.layout-whatsapp-button`, `.wp-social-link-whatsapp`, links `wa.me/*`)
  - **Título dinâmico**: "Inscrições: 04/05/2026 a 04/06/2026" → "Inscrição concurso: NOME COMPLETO" em todas as páginas do funil (cadastro, cargo-*, cota-*, revisão). Slug é descoberto via query string, path `/cargo/{slug}`, fallback do nome do arquivo (`cargo-saude.html` → saude) e localStorage `current_concurso`.
  - **Prefill ampliado**: `prefill-cadastro.js` agora persiste e restaura dropdowns customizados (Sexo, Estado Civil, UF) e o campo de Data de Nascimento (`#birthDate`), além dos campos texto. Os dropdowns são salvos como `dd:<id>` no localStorage `cadastro_form_data`.

- **2026-05-17 (cont.):** **Página de Revisão final + navegação a partir da cota**:
  - Nova rota `/revisao/:concurso` (protegida por `CandidateRoute`) que carrega `public/pages/revisao.html`.
  - **Página de Revisão final** (`revisao.html`) com layout idêntico ao original do template: Dados Pessoais, Contato, Endereço, Resumo da Inscrição (Concurso + Cargo + Modalidade + Vagas) e Termos. Preenchimento dinâmico via novo `revisao-fill.js` (lê do localStorage `cadastro_form_data` + `/api/auth/me` + `selected_cargo`/`selected_cota`/`selected_cota_vagas`/`current_concurso`).
  - **Cota clicável → Revisão**: novo `cota-nav.js` injetado em todas as cota-*.html torna cada card de modalidade (Ampla Concorrência, Pessoa com Deficiência, Cotas Raciais, Opção combinada) clicável; ao clicar, salva a cota selecionada no localStorage e navega para `/revisao/{slug}`.
  - **Cargo clicável → Cota**: o mesmo `cota-nav.js` também é injetado em cargo-*.html para salvar o cargo selecionado antes de seguir para a aba de cotas.
  - Botão "Finalizar Inscrição" da página de revisão fica habilitado somente após marcar o checkbox de termos.

- **2026-05-17 (cont.):** **Finalizar Inscrição salva no MongoDB**:
  - O botão "Finalizar Inscrição" da revisão agora chama `POST /api/inscricoes` (endpoint que já existia) enviando `concurso`, `cargo`, `cota` e `cidade_prova`.
  - Pré-validação dos dados obrigatórios (concurso, cargo e cota) antes do envio.
  - Estado de loading no botão durante o envio ("Enviando..."), recuperação em caso de erro.
  - Mensagem de sucesso ("Inscrição registrada com sucesso! Em breve você receberá instruções de pagamento.") e redirecionamento para `/inscricao` (lista de inscrições do candidato).
  - Limpeza dos dados temporários do fluxo (`selected_cota`, `selected_cota_vagas`, `selected_cargo`) após sucesso; o `cadastro_form_data` é mantido para reutilizar em novas inscrições.
  - Inscrição aparece imediatamente no painel admin `/donaspainel` (testado: candidato `teste-insc2@example.com` criou inscrição via UI, foi gravada no MongoDB e aparece nos endpoints `/api/admin/inscricoes` e `/api/inscricoes/minhas`).

- **2026-05-17 (cont.):** **Página de detalhe da inscrição (pós-finalização)**:
  - Nova rota `/inscricao/:id` (protegida) que carrega `public/pages/pagamento.html`.
  - Layout completo: Status + Taxa + Situação + Prazo, Documentos da Etapa, Dados da Inscrição (Concurso + Edital + Entidade + Cargo + Vagas), Prazos, Timeline e botões Gerar Boleto / Gerar PIX.
  - Novo endpoint `GET /api/inscricoes/{id}` e `pagamento-fill.js` popula os campos visuais.

- **2026-02 (atual):** **Fix MOBILE - CSS estático nas páginas HTML**:
  - **Bug crítico identificado:** o arquivo `/app/frontend/public/pages/global-cleanup.js` NÃO era carregado externamente pelas páginas (a CSP `script-src 'unsafe-inline' data:` bloqueia scripts externos). Toda a CSS mobile estava sendo editada em vão.
  - **Fix:** Injetada uma tag `<style id="ijk-mobile-compact-css">` com o CSS `@media (max-width: 781px){...}` diretamente em cada um dos 20 arquivos `.html` em `/app/frontend/public/pages/`. Script idempotente em `/tmp/inject_mobile_css.py` para futura manutenção.
  - **Regras adicionadas:** `main { padding-top:0 !important }` + zeragem de margens em `.wp-block-group`, `.entry-content`, `<p>`, e `div[align=center]` para subir o banner "FAÇA SUA INSCRIÇÃO" e demais conteúdos logo após o cover.
  - Mantém ajustes existentes (barra amarela compacta, logo menor, ícones sociais, colunas empilhando) — desktop INTOCADO (rules dentro do media query).

## Backlog (Fase 2 — Analytics do painel admin)
- [ ] Dashboard com gráfico de Funil (Acesso → Login → Inscrição → PIX gerado → PIX copiado)
- [ ] Top localizações (cidade da prova / IP) com bandeiras
- [ ] Gráfico atividade últimos 7 dias (line chart)
- [ ] Feed de atividade em tempo real (último login, novo cadastro etc.)
- [ ] Cadastro de CPFs em massa (`+ Cadastrar em massa`) + Download TXT
- [ ] Aba "Usuários" (gerenciar contas admin)
- [ ] Aba "Configurações" (preferências, branding)

## Backlog (Funcional)
- [ ] Integração de pagamento da taxa de inscrição (PIX / Stripe)
- [ ] Geração de comprovante em PDF
- [ ] E-mail de confirmação automático
- [ ] Acompanhar inscrições do candidato (lista no perfil dele)
- [ ] Recuperação de senha (forgot password)
