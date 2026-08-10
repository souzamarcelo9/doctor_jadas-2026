# Modelagem de dados — Firestore (multi-tenant)

## Princípios que guiaram o desenho

1. **Isolamento por clínica (tenant) em primeiro lugar.** Prontuário é dado sensível de saúde — cada clínica só pode enxergar os próprios pacientes e atendimentos. Isso é o requisito não-negociável do desenho.
2. **Profissional pode atuar em várias clínicas.** Um médico não pertence a uma clínica — ele tem um **vínculo** com uma ou mais clínicas, cada vínculo com seu próprio papel/permissões. Isso vira uma coleção de junção (`membros`), não um campo fixo no usuário.
3. **Paciente pertence à clínica, não ao profissional.** Vários profissionais da mesma clínica atendem o mesmo paciente — por isso o paciente não tem "dono", e cada atendimento referencia qual profissional o realizou.
4. **Histórico do prontuário é feito de listas cronológicas, não de um documento gigante.** Cada aba do protótipo (Queixa, Problemas, Alergias, Conduta...) é uma subcoleção própria — é assim que conseguimos consultas ordenadas por data, independentes do atendimento, exatamente como as telas já mostram.

---

## Estrutura de coleções

```
usuarios/{uid}
clinicas/{clinicaId}
  membros/{uid}
  pacientes/{pacienteId}
    queixas/{id}
    historico/{id}
    exameFisico/{id}
    problemas/{id}
    alergias/{id}
    sinaisVitais/{id}
    examesSolicitados/{id}
    imagens/{id}
    condutas/{id}
    prescricoes/{id}
    encaminhamentos/{id}
    formulariosRespondidos/{id}
  atendimentos/{atendimentoId}        ← direto na clínica, não sob pacientes (ver nota abaixo)
  agendamentos/{agendamentoId}
  convenios/{convenioId}
  formularios/{formularioId}
  notasFiscais/{notaId}
  contasPagar/{id}
  contasReceber/{id}
  avaliacoes/{id}
  notificacoes/{id}
auditoria/{logId}
```

> **Por que `atendimentos` não fica dentro de `pacientes`?** Na primeira versão ficava (`pacientes/{id}/atendimentos/{id}`), mas isso exigia `collectionGroup` para agregações no nível da clínica (ex: "quantos atendimentos finalizados este mês", usado na Página Inicial e em Relatórios). Na prática, consultas `collectionGroup` combinadas com nossas Security Rules devolveram "Missing or insufficient permissions" de forma consistente — então movemos `atendimentos` para uma coleção direta da clínica, com um campo `pacienteId`, e as telas que precisam do histórico de um paciente específico (ex: aba Histórico) filtram com `where("pacienteId", "==", ...)` em vez de depender do aninhamento.

> **Por que não existe uma pasta `prontuario/` agrupando esses módulos?** O Firestore não permite coleção dentro de coleção — sempre precisa alternar coleção/documento/coleção/documento. Colocar um nível `prontuario` entre `pacientes/{id}` e `queixas/{id}` exigiria um documento intermediário sem uso real, então cada módulo vira subcoleção direta do paciente. Nada muda na lógica de consulta — cada aba do protótipo continua sendo uma query isolada e independente.

> Regra prática usada aqui: **tudo que precisa ser filtrado ou listado por clínica vive dentro de `clinicas/{clinicaId}/...`.** Isso simplifica MUITO as Security Rules (uma única variável — `clinicaId` no path — controla o isolamento) e as queries (nunca precisa de `where("clinicaId", "==", ...)` manual, o path já filtra).

---

## Coleções em detalhe

### `usuarios/{uid}`
Espelha a conta do Firebase Auth (`uid` = mesmo ID). É o único lugar realmente "global" — tudo o resto é escopado por clínica.

```ts
{
  nome: string,
  email: string,
  telefone?: string,
  fotoUrl?: string,
  criadoEm: timestamp,
  clinicasVinculadas: string[]   // cache dos clinicaId em que tem vínculo ativo — evita
                                  // consulta de "collectionGroup" só pra montar o seletor de clínica no login
}
```

### `clinicas/{clinicaId}`
```ts
{
  nome: string,
  cnpj: string,
  endereco: { ... },
  configuracoes: {
    modoExibicaoPadrao: "horizontal" | "vertical",
    tempoConsultaPadrao: number   // minutos
  },
  integracoes: {
    nfse: { certificadoConfigurado: boolean, ambiente: "homologacao" | "producao" },
    whatsapp: { bspProvider: string, numeroConectado: string, ativo: boolean },
    memed: { tokenConfigurado: boolean }
  },
  criadoEm: timestamp,
  ativa: boolean
}
```

### `clinicas/{clinicaId}/membros/{uid}`
**A coleção mais importante do desenho** — é ela que resolve "vários profissionais, várias clínicas" e é a fonte de verdade que as Security Rules vão consultar para autorizar qualquer leitura/escrita dentro da clínica.

```ts
{
  uid: string,                  // = doc id, redundante de propósito p/ facilitar query
  nome: string,                 // cache do nome, evita join no client
  papel: "medico" | "secretaria" | "financeiro" | "admin",
  especialidade?: string,
  crm?: string,
  corAgenda?: string,
  ativo: boolean,
  horariosTrabalho: [           // é exatamente a tabela da tela "Cadastrar horários"
    {
      dia: "segunda" | "terca" | ... ,
      primeiraConsulta: "08:00",
      ultimaConsulta: "18:00",
      inicioIntervalo?: "12:00",
      fimIntervalo?: "13:00",
      tempoConsulta: "00:30",
      ativo: boolean
    }
  ],
  favoritos: {                  // itens de acesso rápido, por módulo — específicos de CADA profissional
    queixa: string[],
    conduta: string[],
    exameFisico: string[]
  },
  vinculadoEm: timestamp
}
```

### `clinicas/{clinicaId}/pacientes/{pacienteId}`
```ts
{
  nome: string,
  nascimento: date,
  sexo: string,
  cpf: string,
  convenioId?: string,
  telefone: string,
  email?: string,
  alergiasResumo: boolean,      // flag rápida p/ mostrar o ícone de alerta sem ler a subcoleção inteira
  criadoEm: timestamp,
  criadoPor: string              // uid do membro que cadastrou
}
```

### `clinicas/{clinicaId}/atendimentos/{atendimentoId}`
Representa **uma consulta** — é o "envelope" que agrupa tudo que foi feito naquele encontro. As entradas do prontuário (queixa, conduta etc.) referenciam este ID. Fica direto na clínica (não sob `pacientes`) para permitir agregações simples por clínica sem `collectionGroup` — ver nota acima.
```ts
{
  pacienteId: string,
  profissionalId: string,       // uid do membro que atendeu
  dataHora: timestamp,
  status: "em_andamento" | "finalizado" | "cancelado",
  duracaoSegundos?: number,
  convenioId?: string,
  origem: "presencial" | "teleconsulta",
  queixaResumo?: string,         // espelhado pela aba Queixa Paciente ao salvar
  condutaResumo?: string         // espelhado pela aba Conduta ao salvar
}
```

### `.../pacientes/{pacienteId}/{modulo}/{id}`
Um documento por entrada, em cada subcoleção do prontuário (`queixas`, `problemas`, `alergias`, `sinaisVitais`, `condutas`, `prescricoes`, `encaminhamentos`, `examesSolicitados`, `imagens`, `formulariosRespondidos`, `exameFisico`, `historico`), cada uma como subcoleção direta do paciente. Todos compartilham o mesmo formato-base:

```ts
{
  atendimentoId: string,        // a qual consulta pertence
  profissionalId: string,
  criadoEm: timestamp,
  origemIA: boolean,             // true quando veio da transcrição/sumarização automática
  ativo: boolean,                // usado pelo "Inativar" que já existe nas telas
  // + campos específicos do módulo:
  //   queixas: { texto }
  //   problemas: { cid, descricao, grau, observacao }
  //   alergias: { tipo, agente, reacao, grau }
  //   sinaisVitais: { peso, altura, imc, pulso, temperatura, ... }
  //   prescricoes: { medicamento, posologia, memedId }
  //   imagens: { titulo, categoria, storagePath }
}
```
Por que subcoleções separadas por módulo, e não uma única `prontuarioEntries` com campo `tipo`? Porque cada aba do protótipo já é uma **query own** ("me dê todas as alergias ativas deste paciente, ordenadas por data") — separar por módulo deixa o índice simples (`orderBy("criadoEm")` sem precisar filtrar por tipo) e os documentos mais enxutos.

### `clinicas/{clinicaId}/agendamentos/{agendamentoId}`
```ts
{
  profissionalId: string,
  pacienteId: string,
  dataHora: timestamp,
  duracaoMinutos: number,
  status: "livre" | "agendado" | "confirmado" | "presente" | "atendendo" | "faltou" | "cancelado",
  convenioId?: string,
  tipoAtendimento: string,
  canalConfirmacao?: "whatsapp" | "manual",
  observacao?: string
}
```

### `auditoria/{logId}` (top-level, fora de qualquer clínica)
Toda leitura/escrita de dado sensível deveria gerar um evento aqui via Cloud Function (não direto do client, pra não poder ser burlado). Essencial pra LGPD.
```ts
{
  clinicaId: string,
  uid: string,
  acao: "leitura" | "criacao" | "edicao" | "exclusao",
  recurso: string,     // path do documento afetado
  timestamp: timestamp,
  ip?: string
}
```

---

## Índices compostos necessários

O Firestore cria índices simples automaticamente; estes precisam ser declarados em `firestore.indexes.json`:

| Coleção | Campos | Uso |
|---|---|---|
| `.../pacientes/{id}/problemas` | `ativo ASC, criadoEm DESC` | aba Problemas, "Exibir inativos" |
| `.../pacientes/{id}/alergias` | `ativo ASC, criadoEm DESC` | aba Alergias |
| `.../atendimentos` | `profissionalId ASC, dataHora DESC` | histórico por profissional |
| `agendamentos` | `profissionalId ASC, dataHora ASC` | grade da Agenda do dia |
| `agendamentos` | `pacienteId ASC, dataHora DESC` | próximos agendamentos do paciente |
| `membros` (collection group) | `uid ASC, ativo ASC` | descobrir em quais clínicas um usuário atua, no login |

---

## Esqueleto de Security Rules

A ideia central: **qualquer acesso dentro de `clinicas/{clinicaId}/...` primeiro verifica se existe `clinicas/{clinicaId}/membros/{request.auth.uid}` ativo**, e o papel dentro desse documento decide o que é permitido.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function souMembro(clinicaId) {
      return exists(/databases/$(database)/documents/clinicas/$(clinicaId)/membros/$(request.auth.uid))
        && get(/databases/$(database)/documents/clinicas/$(clinicaId)/membros/$(request.auth.uid)).data.ativo == true;
    }

    function meuPapel(clinicaId) {
      return get(/databases/$(database)/documents/clinicas/$(clinicaId)/membros/$(request.auth.uid)).data.papel;
    }

    match /usuarios/{uid} {
      allow read, update: if request.auth.uid == uid;
    }

    match /clinicas/{clinicaId} {
      allow read: if souMembro(clinicaId);
      allow write: if souMembro(clinicaId) && meuPapel(clinicaId) == "admin";

      match /membros/{uid} {
        allow read: if souMembro(clinicaId);
        allow write: if souMembro(clinicaId) && meuPapel(clinicaId) == "admin";
      }

      match /pacientes/{pacienteId} {
        allow read, write: if souMembro(clinicaId);

        match /atendimentos/{atendimentoId} {
          allow read, write: if souMembro(clinicaId);
        }

        // subcoleções diretas: queixas, problemas, alergias, condutas, prescricoes...
        match /{modulo}/{entryId} {
          allow read: if souMembro(clinicaId) && modulo != "atendimentos";
          // só médico edita conduta/prescrição — secretaria não deveria poder
          allow write: if souMembro(clinicaId) && modulo != "atendimentos" &&
            (modulo != "condutas" && modulo != "prescricoes" || meuPapel(clinicaId) == "medico");
        }
      }

      match /agendamentos/{id} {
        allow read, write: if souMembro(clinicaId);
      }

      match /financeiro/{doc=**} {
        allow read, write: if souMembro(clinicaId) &&
          (meuPapel(clinicaId) == "admin" || meuPapel(clinicaId) == "financeiro");
      }
    }
  }
}
```

Isso já reflete a preocupação que você levantou antes (secretária não deveria editar Conduta/Prescrição) — o exemplo acima já bloqueia isso por papel.

---

## Convenções

- IDs de documento: deixar o Firestore auto-gerar (`addDoc`), exceto `usuarios/{uid}` e `membros/{uid}`, que usam o UID do Firebase Auth de propósito.
- Datas: sempre `Timestamp` do Firestore, nunca string — evita bug de fuso horário e permite `orderBy` nativo.
- Campos monetários: salvar em **centavos (inteiro)**, não float, para não ter erro de arredondamento no financeiro.
- Soft delete: os "Inativar" que já existem nas telas usam `ativo: false`, não exclusão real — mantém o histórico íntegro (importante para prontuário médico, que tem obrigação legal de retenção).

## Próximos passos técnicos

1. Escrever `firestore.rules` completo (o esqueleto acima cobre o essencial, falta cobrir `convenios`, `formularios`, `notasFiscais`).
2. Escrever `firestore.indexes.json` com a tabela acima.
3. Criar um script de seed (`scripts/seed.js`) que popula uma clínica de teste com os mesmos dados que hoje estão em `mockData.js` — facilita comparar se a migração de cada tela ficou equivalente.
4. Migrar tela por tela: comece por **Queixa Paciente** (mais simples) para validar o padrão de leitura/escrita em subcoleção antes de replicar para as demais 11 abas.
