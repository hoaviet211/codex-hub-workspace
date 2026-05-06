# Context Operating Model

Related docs:

- `AGENTS.md`
- `config.yaml`
- `workflows/prompt-cheatsheet.md`
- `workflows/prompt-playbook.md`
- `workflows/definition-of-done.md`
- `workflows/client-demo-gate.md`
- `workspace/README.md`
- `workspace/templates/task.md`
- `workspace/templates/bug-report.md`
- `workspace/templates/post-mortem.md`

## Muc tieu

Tai lieu nay chot cach Codex Hub lam viec voi:

- context va token budget
- cache va kha nang tai su dung context
- prompt template de giam lang phi
- noi lay du lieu va noi luu du lieu van hanh

Nguyen tac tong quat:

1. Khong nap full repo neu bai toan khong can.
2. Chia context thanh lop nho, co expiry ro rang.
3. Chi luu thu giup giam lan doc lai hoac giup handoff.
4. Policy on dinh thi dua vao `AGENTS.md`, `config.yaml`, `workflows/`.
5. State tam thoi va theo task thi dua vao `workspace/`.
6. Mac dinh dung `task-first` reading va `default-deny` cho broad scans.

## 1. Context Tiers

### Tier 0: Always-on policy

Day la context nen on dinh, duoc coi la "nen":

- `AGENTS.md`
- `config.yaml`
- workflow chinh duoc tham chieu truc tiep

Chi dua vao day:

- operating principles
- routing rules
- workspace contract
- security/deploy guardrails

Khong dua vao day:

- task state
- ghi chu tam thoi
- brainstorming dai dong

### Tier 1: Task context

Chi nap khi task can:

- file code lien quan
- 1 task note trong `workspace/tasks/`
- 1 artifact cu the trong `workspace/artifacts/`
- `workspace/memory.md` chi khi task dang song qua nhieu turn hoac can shared assumptions

Day la lop context chinh cho mot phien lam viec.

### Tier 2: Cached summaries

Day la lop giam token, dung de tranh doc lai:

- tom tat module
- tom tat quyet dinh
- summary ket qua review
- checklist verify co the tai su dung

Nen luu duoi dang Markdown ngan, co ngay thang va pham vi.

### Tier 3: Cold archive

Thong tin chi giu de tham khao, khong nap mac dinh:

- context export lon
- review output dai
- rollout notes cu

Vi du: `workspace/artifacts/workspace-full-context.md`

Chi mo Tier 3 khi:

- policy, task note, va artifact summary nho khong du
- task bi block vi thieu snapshot tong quan
- user yeu cau ro rang

## 2. Nguon Du Lieu Va Source Of Truth

Su dung thu tu uu tien nay:

1. Source of truth ky thuat:
   `AGENTS.md`, `config.yaml`, `workflows/`, `skills/`
2. Source of truth theo task:
   `workspace/tasks/<task>.md`
3. Shared short-term memory:
   `workspace/memory.md`
4. Reusable output:
   `workspace/artifacts/*.md`
5. Large export hoac context snapshot:
   chi mo khi that su can

Quy tac:

- Neu thong tin la policy: dua vao `AGENTS.md` hoac `workflows/`.
- Neu thong tin la cau hinh van hanh: dua vao `config.yaml`.
- Neu thong tin chi dung cho 1 bai toan dang mo: dua vao `workspace/tasks/`.
- Neu thong tin co the tai dung cho nhieu bai toan: dua vao `workspace/artifacts/`.
- Neu thong tin chi song ngan han va can nho trong vai task gan nhau: dua vao `workspace/memory.md`.

## 2.2 Canonical Memory Flow

Codex Hub memory uses these runtime roles:

- Codex: primary executor and integrator.
- WebOS: localhost cockpit, scanner, context gateway, and manual review surface.
- `memory-service`: canonical scoped memory backend.
- Gemma4: curator/context compressor only; proposes candidates, never writes canonical memory directly.
- LCO/orchestrator: helper-only and deprecated as Gemma agent layer.

Official memory must preserve the scope chain:

```text
workspaceId -> projectId -> sessionId
```

Canonical flow:

```text
source material -> memory candidate -> manual review -> approved memory item -> retrieval
```

Rules:

- `memory_sources` or equivalent records where a candidate came from.
- `memory_candidates` or equivalent holds proposed/rejected/approved/merged/stale suggestions.
- `memory_reviews` records human/Codex review decisions.
- Canonical retrieval reads approved `memory_items` or equivalent official records only.
- Proposed, rejected, stale, and unreviewed candidates are never included in normal retrieval or vector indexing.
- WebOS may review candidates locally, but source/config/registry mutation stays outside WebOS API scope.

## 2.1 Read Policy

Mac dinh:

1. Doc policy truoc: `AGENTS.md`, workflow, `config.yaml` neu can.
2. Doc task note cu the neu task dai hoi hoac da co state.
3. Doc artifact cu the neu task can summary, spec, hoac checklist.
4. Chi quet metadata ten file trong `workspace/tasks/` va `workspace/artifacts/` khi can tim candidate phu hop.
5. Chi mo `workspace-full-context.md` khi bi block.

Khong duoc doc mac dinh:

- toan bo `workspace/`
- `workspace/artifacts/workspace-full-context.md`
- binary files
- build outputs
- lockfiles
- minified bundles
- generated dumps va exports lon

Co the quet metadata nhung khong doc noi dung:

- danh sach file trong `workspace/tasks/`
- danh sach file trong `workspace/artifacts/`
- ten file trong cac thu muc source lon de tim diem vao

## 3. Luu Tru Cai Gi, O Dau

### `AGENTS.md`

Luu:

- philosophy
- routing rule
- guardrail
- standard operating model

Khong luu:

- task dang lam
- note theo issue

### `workflows/`

Luu:

- prompt template
- operating playbook
- process theo giai doan
- read policy va ignore policy

Khong luu:

- quyet dinh rieng cua 1 task

### `config.yaml`

Luu:

- map skill
- workflow path
- workspace path
- orchestrator metadata
- policy switches ngan gon

Khong luu:

- ghi chu tu do
- long prose

### `workspace/memory.md`

Luu:

- assumption dang song
- recent decisions
- watchouts ngan

Phai ngan. Neu dai len, tach ra artifact hoac dua nguoc ve policy.
Khong dung no nhu task log hoac transcript.

### `workspace/tasks/`

Moi task dai hoi chi nen co 1 file. Su dung `workspace/templates/task.md` lam diem khoi dau, khong tu viet tu dau.

Mau toi thieu (xem template day du tai `workspace/templates/task.md`):

```md
# Task: ...

## Muc tieu

## Pham vi

In-scope: ...
Out-of-scope: ...

## Acceptance Criteria

> MANDATORY truoc khi implement.

- [ ] AC1: ...
- [ ] AC2: ...

## Safety Gate Check

Mode: Express | Standard | Rigorous

## Input / references

## Quyet dinh da chot

## Progress

## Next step

## Done criteria

Ref: workflows/definition-of-done.md Tier [1/2/3]
```

Bug reports dung rieng `workspace/templates/bug-report.md`, luu vao `workspace/tasks/` voi prefix `YYYY-MM-DD-bug-`.

Post-mortem luu vao `workspace/artifacts/` voi prefix `YYYY-MM-DD-postmortem-`.

### `workspace/artifacts/`

Luu:

- spec
- review note
- checklist
- summary co the tai dung
- snapshot doi voi he thong lon
- post-mortem (format: `YYYY-MM-DD-postmortem-*.md`)

Khong luu:

- scratchpad tam
- chat transcript
- execution state

### `workspace/automations/`

Luu:

- workflow draft
- trigger
- input / output
- safety checks
- guardrail

Khong luu:

- execution state
- run logs
- scheduler checkpoint
- task state

## 4. Cache Policy

Khong co cache runtime phuc tap. Dung "Markdown cache" co cau truc.

### Cache nen co

- module summary
- system snapshot
- task summary
- verification checklist
- prompt snippets da chuan hoa

### Cache key nen dua tren

- pham vi
- ngay cap nhat
- owner hoac task
- version neu can

Vi du ten file:

- `workspace/artifacts/2026-04-08-context-operating-model.md`
- `workspace/tasks/2026-04-08-token-cache-redesign.md`

### Cache invalidation

Xoa, sua, hoac bo qua cache khi:

- code structure doi
- workflow doi
- policy doi
- artifact qua 14-30 ngay va khong con phu hop
- task da dong va summary khong con gia tri

Quy tac don gian:

- memory: song ngan, prune thuong xuyen
- tasks: dong task xong thi rut gon hoac archive
- artifacts: giu neu co kha nang tai su dung
- full context export: cold snapshot, khong xem la primary cache

## 5. Prompt Design Rules

Prompt tot phai ngan, co routing, va co gioi han ro rang.

Mau nen dung:

```text
Muc tieu: ...
Pham vi: ...
Rang buoc: ...
Che do: ...
Context can doc: ...
Output can cap nhat: ...
Quy trinh: ...
```

Them 2 truong moi:

- `Context can doc`: chi ro file, folder, artifact can doc
- `Output can cap nhat`: neu task dai hoi, chi ro file trong `workspace/` can update

Bat buoc voi:

- bai toan lon
- bai toan mo ho
- task co `workspace/`
- task can giu blast radius nho

Co the bo qua voi:

- task nho
- mot file
- scope ro va khoanh duoc ngay

### Prompt mac dinh cho bai toan mo ho

```text
Muc tieu: chot lai operating model cho bai toan nay.
Pham vi: chi doc context toi thieu lien quan.
Rang buoc: chua implement code neu chua chot huong.
Che do: chi phan tich.
Context can doc: AGENTS.md, workflows lien quan, workspace neu can.
Output can cap nhat: workspace/tasks/... neu task keo dai.
Quy trinh: dung `planner` -> `business-analyst` -> `architecture-design`.
```

### Prompt mac dinh cho implementation

```text
Muc tieu: implement thay doi ...
Pham vi: ... 
Rang buoc: giu API cu, khong them dependency, chua deploy.
Che do: sua code + test.
Context can doc: chi cac file/module lien quan va task note neu co.
Output can cap nhat: workspace/tasks/... va artifact neu co output can giu.
Quy trinh: check 4 safety gates -> chon mode -> implement -> verify theo mode -> security/devops review neu lien quan.
```

### Prompt mac dinh cho review-only

```text
Muc tieu: review thay doi ...
Pham vi: ...
Rang buoc: khong sua code.
Che do: review only.
Context can doc: chi PR/module/file lien quan va artifact neu can.
Output can cap nhat: workspace/artifacts/... neu can luu summary.
Quy trinh: understand -> review -> test gap -> security/devops note neu lien quan.
```

## 6. Quy Tac Nap Context

Truoc khi mo them file, tu hoi 3 cau:

1. File nay co can de ra quyet dinh tiep theo khong?
2. Co summary nao co the dung thay cho file goc khong?
3. Thong tin nay la policy, task state, hay artifact?

Thu tu nap de tranh lang phi:

1. `AGENTS.md` neu can policy
2. workflow / config lien quan
3. file code, module, hoac task note phuc vu task
4. artifact cu the
5. full context export chi khi bi block

Quy tac override:

- Prompt khong duoc override denylist chi de tien. Chi mo them khi user yeu cau ro rang hoac task bi block.
- Neu phai mo cold archive, ghi assumption hoac ly do vao task note/artifact lien quan.

## 7. Definition Of Done

Xem day du tai `workflows/definition-of-done.md`.

Mot task duoc coi la "sach context" khi:

- prompt co scope va constraint ro
- Acceptance Criteria da duoc viet truoc khi implement
- chi doc file thuc su can
- task state neu co da duoc gom vao 1 noi
- artifact duoc luu dung muc dich
- khong de long chat history dong vai tro bo nho chinh
- DoD checklist tuong ung voi mode da pass

## 8. Quyet Dinh Van Hanh

- Dung `workspace/` nhu bo nho Markdown, khong dung lam runtime database.
- Uu tien cached summary ngan thay vi full-context export.
- Prompt tu nay nen co them `Context can doc` va `Output can cap nhat`.
- Bai toan lon nen tao task note som, bai toan nho thi khong can.
- `Context can doc` la bat buoc cho task non-trivial.
- `workspace/automations/` la design-only, khong phai runtime hay execution log.
- Retention mac dinh la aggressive prune.
