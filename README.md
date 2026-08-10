# DoctorPEP — Release 1

Sistema de prontuário eletrônico, inspirado no DoctorPEP,
construído para apresentação a cliente. **Esta release é um protótipo visual/funcional
no front-end**: os dados são mockados em memória (`src/data/mockData.js`) e os recursos
de IA e emissão de NFS-e estão **simulados** com temporizadores, para demonstrar o fluxo
de uso sem depender de back-end real.

## Stack

- **React 19 + Vite**
- **Tailwind CSS 3** (tema customizado em `tailwind.config.js`, paleta teal/petróleo igual ao sistema atual)
- **React Router** para navegação entre telas
- **Recharts** para os gráficos (pizza de agenda, barras de ocupação, linha de IMC)
- **lucide-react** para ícones

> Firebase Auth já está plugado — veja "Configurar o Firebase" abaixo para ativar o login real.

## Configurar o Firebase

1. Crie um projeto em https://console.firebase.google.com.
2. Em **Build → Authentication → Sign-in method**, ative o provedor **E-mail/senha**.
3. Em **Build → Firestore Database**, crie o banco (modo produção, escolha a região `southamerica-east1` para ficar no Brasil).
4. Em **Configurações do projeto → Seus apps**, crie um app Web e copie as credenciais.
5. Copie `.env.example` para `.env` e preencha com essas credenciais.
6. Crie ao menos um usuário em **Authentication → Users → Add user** (e-mail/senha) para conseguir logar.
7. (Opcional, mas recomendado) Crie o documento `usuarios/{uid}` no Firestore com o mesmo UID do usuário criado, contendo campos como `nome`, `papel` (ex: "medico", "secretaria", "admin") e `clinicaId` — é esse documento que a tela já busca automaticamente após o login para exibir o nome e permitir controle de permissões mais adiante.

## Publicar as Security Rules e os índices

As coleções do Firestore se criam sozinhas na primeira escrita — não é preciso criar nada manualmente no console. **Mas Security Rules e índices compostos precisam ser publicados explicitamente**, eles não vêm "de graça" com o código:

```bash
npm install -g firebase-tools   # se ainda não tiver o Firebase CLI
firebase login
firebase use --add                        # selecione seu projeto e dê um alias (ex: default)
firebase deploy --only firestore:rules,firestore:indexes
```

O `firestore.rules` já cobre isolamento por clínica (multi-tenant), papéis (médico/secretária/financeiro/admin) e a regra de que só médico edita Conduta/Prescrição/Encaminhamento. O `firestore.indexes.json` declara os índices compostos que as telas de Problemas, Alergias, Agenda e Histórico vão precisar.

## Popular dados de teste (seed)

```bash
# 1. Baixe a chave de conta de serviço em:
#    Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada
# 2. Salve como serviceAccountKey.json na raiz do projeto (já está no .gitignore)
npm run seed
```

Isso cria uma clínica de teste (`teste-clinica-diniz`), um profissional (`jessica@testeclinicadiniz.com.br` / `Doutor123!`) e o paciente Mario Acca com os mesmos dados que hoje vivem em `mockData.js` — útil para comparar visualmente se a migração de cada tela para dados reais ficou equivalente ao protótipo.

## O que já lê/escreve no Firestore de verdade

**As 12 abas do Atendimento** (Queixa Paciente, Histórico, Exame físico, Problemas, Alergias, Hist. Exames, Sinais Vitais, Imagens, Formulários, Encaminhamento, Conduta, Prescrições) já leem e escrevem direto no Firestore, em tempo real (`onSnapshot`), usando a estrutura de `docs/modelagem-firestore.md`. Upload de imagem vai para o Firebase Storage de verdade.

- **`src/lib/firestore.js`** — camada genérica reusada por todas as abas: `useFirestoreCollection` (leitura em tempo real), `criarDocumento`, `atualizarDocumento`, `alternarAtivo` (toggle dos "Inativar"), `salvarDocumentoComId` (para o Exame Físico, que é 1 documento por atendimento).
- **`src/context/TenantContext.jsx`** — resolve `clinicaId`, `pacienteId` e garante que existe um `atendimento` com `status: "em_andamento"` para a sessão atual (cria um automaticamente se não existir, e marca `finalizado` ao clicar em "Finalizar"). Queixa e Conduta também gravam um resumo (`queixaResumo`/`condutaResumo`) direto no documento do atendimento — é isso que faz a aba Histórico funcionar sem precisar cruzar várias coleções.
- **`clinicaId` e `pacienteId` agora são dinâmicos.** As clínicas em que o profissional atua vêm de um **custom claim no token de autenticação** (`clinicas: [clinicaId, ...]`, definido pelo `npm run seed` via Admin SDK) — o app lê isso do próprio token no login, sem precisar de uma query `collectionGroup` logo de cara (esse era um padrão mais frágil que trocamos depois de esbarrar em "Missing or insufficient permissions" mesmo com as regras corretas). Para cada clínica do claim, o app faz um `get()` direto em `clinicas/{id}/membros/{uid}` para pegar papel/nome — muito mais previsível para as Security Rules do que uma consulta em grupo de coleções. Se o profissional tiver vínculo com mais de uma clínica, um seletor aparece no topo (`ClinicSwitcher`). O paciente vem da rota — **`/pacientes`** lista, busca e cadastra pacientes da clínica ativa, e **"Iniciar atendimento"** leva para `/atendimento/:pacienteId`.

  > **Importante:** custom claims só chegam ao cliente quando o token é renovado. O app já força um refresh do token a cada login (`getIdTokenResult(true)`), mas se você rodar `npm run seed` com o navegador **já logado**, precisa fazer logout e login de novo (ou esperar ~1h) para o novo claim aparecer.

  > Para testar a troca de clínica: crie um segundo documento em `clinicas/{outraClinicaId}` e um `clinicas/{outraClinicaId}/membros/{seuUid}` com `ativo: true` — **e também** adicione `outraClinicaId` ao array `clinicas` do custom claim desse usuário (`auth.setCustomUserClaims(uid, { clinicas: [...] })` via Admin SDK). Sem o claim, o app nem tenta buscar o vínculo. Depois, faça logout/login para o token renovar.

**Também migradas nesta etapa:**

- **Página inicial** — KPIs (consultas de hoje, confirmadas via WhatsApp, atendimentos finalizados no mês, NFS-e emitidas) e os dois gráficos, todos calculados a partir de dados reais (`agendamentos` e `atendimentos` via `collectionGroup`).
- **Agenda** — a grade de horários agora é **gerada a partir dos horários de trabalho reais do profissional** (`membros/{uid}.horariosTrabalho`) cruzados com os agendamentos do dia. Clicar num horário livre abre uma busca de paciente e agenda de verdade; clicar num horário ocupado permite mudar o status (confirmado/presente/atendendo/faltou/cancelado) ou ir direto para o atendimento. "Cadastrar horários" agora lê/escreve o array real no documento do profissional. A aba de lembretes grava um log real de notificações (`clinicas/{id}/notificacoes`).
- **Financeiro** — contas a pagar/receber em coleções reais (`clinicas/{id}/contasPagar` e `contasReceber`), com cadastro de nova conta e "marcar como pago".
- **Relatórios** — faturamento por convênio (agregado das contas a receber pagas), meta de atendimento (real vs. configurado em `clinicas/{id}.configuracoes.metaAtendimentoMensal`), e avaliações do paciente (`clinicas/{id}/avaliacoes`) — o botão de enviar pesquisa por e-mail continua simulado (não há envio de e-mail real integrado ainda).
- **Notas Fiscais** — a emissão já persiste um documento real em `clinicas/{id}/notasFiscais`; o que continua simulado é só a chamada ao web service SOAP da Prefeitura (fica para quando entrar a integração com certificado A1).

**Simplificação consciente:** o gráfico que no protótipo original chamava "Ocupação por período" virou "Atendimentos finalizados por mês" — calcular ocupação percentual de verdade exigiria conhecer a capacidade total de horários possíveis por mês (não só os preenchidos), o que é mais complexidade do que vale a pena agora. Pode ser retomado depois se fizer sentido.



- **`atendimentos` não fica mais aninhado sob `pacientes`.** Virou uma coleção direta em `clinicas/{id}/atendimentos` (com um campo `pacienteId`) depois de esbarrarmos, duas vezes, em "Missing or insufficient permissions" ao usar `collectionGroup` para agregações no nível da clínica — mesmo com regras corretas para leituras diretas (`get`). Hoje nenhuma parte do app usa `collectionGroup`; toda agregação por clínica é uma consulta direta numa coleção conhecida.

Veja `docs/modelagem-firestore.md` para o desenho completo das coleções, os campos de cada documento, os índices e o racional por trás de cada decisão (por que `membros` é uma subcoleção, por que cada aba do prontuário é uma subcoleção separada, etc.).

**Sem o `.env` preenchido**, o app roda em **modo demo**: pula a autenticação e libera a navegação livremente (é assim que o protótipo funcionou até agora). Isso facilita continuar mexendo no layout sem depender do Firebase, mas assim que o `.env` for preenchido o login passa a ser obrigatório.

## Como rodar

```bash
npm install
cp .env.example .env   # depois preencha com suas credenciais do Firebase
npm run dev
```

Abra `http://localhost:5173`.

Para gerar o build de produção:

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
  components/        # Sidebar, Topbar, PatientHeader, Tabs, IA (transcrição, percepções)
  components/atendimento/   # Abas do prontuário: Queixa Paciente, Problemas, Sinais Vitais...
  pages/             # Página inicial, Agenda, Atendimento, IA Clínica, Notas Fiscais, Config
  data/mockData.js   # Dados mockados (paciente, agenda, histórico, sugestões de IA)
```

## Telas incluídas nesta release

0. **Login** — tela de autenticação com foto médica de fundo, Firebase Auth (e-mail/senha), opção "manter conectado" (sessão persistente vs. só na aba), tratamento de erros e modo demo automático quando o Firebase ainda não está configurado.
1. **Página inicial** — KPIs, gráfico de agenda por período (pizza) e ocupação por período (barras), réplica do dashboard enviado.
2. **Atendimento** — cabeçalho do paciente e abas do prontuário, agora com as **12 abas totalmente funcionais**:
   - **Queixa Paciente** — editor de texto, chips de favoritos, histórico de registros, transcrição por IA.
   - **Histórico** — linha do tempo com todas as consultas/procedimentos anteriores, queixa e conduta de cada uma, com busca.
   - **Exame físico** — seções por sistema (estado geral, pele, cardiovascular, respiratório, abdômen, membros) em acordeão, com itens de acesso rápido.
   - **Problemas** — tabela com graus Leve/Moderada/Severa.
   - **Alergias** — tabela de alergias medicamentosas/alimentares/ambientais com grau de gravidade e alerta destacado quando há alergias ativas.
   - **Hist. Exames** — solicitação e acompanhamento de exames, upload de laudo, réplica do print enviado.
   - **Sinais Vitais** — campos + gráfico de evolução do IMC.
   - **Imagens** — galeria de imagens clínicas, exames de imagem e documentos, com preview em modal.
   - **Formulários** — biblioteca de formulários dinâmicos configuráveis pelo próprio consultório.
   - **Encaminhamento** — encaminhamento a especialidades com histórico e status.
   - **Conduta** — editor com favoritos e histórico de condutas.
   - **Prescrições** — integração simulada com a Receita Digital Memed.
   - Painel de **"Percepções da IA"** (drawer lateral) acessível pelo botão no cabeçalho do paciente.
3. **IA Clínica** — vitrine dos 4 recursos de IA pedidos: transcrição instantânea, anotações automáticas, sumarização inteligente e itens sugeridos.
4. **Agenda** — agora com duas visões:
   - **Agenda do dia** — réplica da grade real do DoctorPEP: KPIs (pacientes, ocupação, faltas, previsão de saída, sala de espera), navegação por data/profissional/clínica, ações (Encaixe, Lista de Espera, Localizar, Alteração em Bloco, Atualizar) e a tabela de horários com status colorido (Atendendo, Presente, Faltou, Livre).
   - **Cadastrar horários** — modal acessível pelo botão no topo da agenda, onde o profissional configura, por dia da semana, o horário de início/fim de atendimento, intervalo e tempo de consulta — réplica do segundo print enviado, com formulário para adicionar novos horários replicando para múltiplos dias de uma vez.
   - **Lembretes WhatsApp** — segunda aba, mantém a automação de lembretes, confirmação de presença e envio de formulários.
5. **Notas Fiscais** — formulário de emissão de NFS-e Paulistana com status simulado de integração ao web service da Prefeitura de São Paulo (certificado A1, ambiente de homologação/produção).
6. **Relatórios** — faturamento por convênio, meta de atendimento (gauge) e avaliação do paciente com envio de pesquisa por e-mail.
7. **Financeiro** — contas a pagar e a receber, com saldo projetado.
8. **Configurações → Preferências** — modal de configuração de exibição do prontuário (modo horizontal/vertical, seções, ordenação), réplica do print enviado.

## Próximos passos (fora do escopo desta release)

- ~~Conectar Firebase Auth~~ ✅ feito nesta etapa — falta apenas modelar o Firestore (coleções de clínicas, profissionais, pacientes, atendimentos) e trocar `mockData.js` por dados reais, tela por tela.
- Perfis de usuário e permissões (médico, secretária, administrativo) usando o campo `papel` do documento `usuarios/{uid}` + Firestore Security Rules.
- Implementar a integração real de transcrição de voz (ex.: Web Speech API ou provedor de STT) e a chamada a um modelo de IA para sumarização e sugestões clínicas.
- Implementar a integração real com o web service da Prefeitura de São Paulo (NFS-e Paulistana) — ou avaliar um gateway (Focus NFe, eNotas) para abstrair a complexidade SOAP/XML.
- Enviar lembretes reais via WhatsApp Business API, através de um BSP homologado pela Meta (Twilio, Zenvia, 360dialog, etc.).
