# Prompt Cheatsheet

Use this file when you want a fast prompt without opening the full playbook.

Related docs:

- `workflows/prompt-playbook.md`
- `workflows/standard-pipeline.md`
- `workflows/context-operating-model.md`
- `workflows/definition-of-done.md`
- `workflows/client-demo-gate.md`

## LCO Helper Pipeline

Use this wrapper when you want an advisory LCO handoff from any folder. Codex remains the executor.

```bash
lco-msg "<message>" [--pipeline] [--tier 1|2|3] [--keywords "..."] [--mode fast|safe|deep] [--dry-run]
```

Examples:

```bash
lco-msg "fix checkout bug" --pipeline --dry-run
lco-msg "implement search feature" --pipeline
lco-msg "refactor auth" --pipeline --tier 2 --keywords auth,session --mode safe --dry-run
```

Behavior:

- Daily default: use Codex directly with scoped repo context.
- LCO helper mode: `--pipeline` runs `compose -> scan -> split -> handoff`.
- Avoid `lco task "<message>"` for daily workflow; it is the Gemma ReAct loop.
- `--tier` values 2 and 3 require `--keywords`.
- Neu `lco` khong co trong PATH: tu fallback ve `node orchestrator/dist/cli/index.js`.

### Setup PATH (chay 1 lan)

PowerShell — them alias vao profile:

```powershell
Set-Alias -Name lco-msg -Value "<repo-root>\scripts\lco-msg.ps1"
```

CMD — them thu muc `scripts/` vao user PATH:

```cmd
setx PATH "%PATH%;<repo-root>\scripts"
```

CMD se goi `scripts\lco-msg.cmd`, script nay chuyen tiep vao PowerShell core script.

## Khi nao dung `/compact`

Dung khi conversation da dai. Tot nhat: dung sau moi giai doan lon (xong design → compact, xong implement → compact).

## Default Template

```text
Muc tieu: ...
Pham vi: ...
Rang buoc: ...
Mode: Express | Standard | Rigorous (neu can)
Che do: ...
Context can doc: ...
Output can cap nhat: ...
Quy trinh: ...
```

Dung template nay cho task non-trivial. Voi task nho, mot file, scope ro, co the bo qua `Context can doc`.

## Copy-Paste Prompts

### 1. Plan first

```text
Dung `planner`, tach bai toan nay thanh milestone, dependency, rui ro va first actionable step. Chua code.
```

### 2. Clarify requirements

```text
Dung `business-analyst`, viet user story, acceptance criteria va out-of-scope cho yeu cau nay. Chua implement.
```

### 3. Design the solution

```text
Dung `system-design`, de xuat data flow, API shape va trade-off cho yeu cau nay.
```

### 4. Implement safely

```text
Muc tieu: implement thay doi ...
Pham vi: ...
Rang buoc: giu API cu neu khong can doi.
Che do: sua code + test.
Context can doc: chi cac file/module lien quan.
Output can cap nhat: bo qua neu task ngan; neu task dai thi chi ro `workspace/tasks/...`.
Quy trinh: doc repo lien quan -> dung `app-coder` implement -> chay test lien quan.
```

### 5. Design then build UI

```text
Dung `ui-design` de chot visual hierarchy, state va component rules. Sau do dung `frontend-web-ui` implement trong pham vi cac file lien quan.
```

### 6. Security review

```text
Dung `secure-coding` review flow nay. Liet ke findings theo muc do uu tien, attack path va remediation. Chua sua code neu chua duoc yeu cau.
```

### 7. Test planning

```text
Dung `tester` lap test plan, regression risk va checklist verify cho thay doi nay.
```

### 8. Infra or deploy review

```text
Dung `secure-devops` review thay doi infra/deploy nay. Chi preview, dry-run, plan hoac validate. Chua apply.
```

### 9. End-to-end execution

```text
Lam theo `standard pipeline` (risk-based): check 4 safety gates -> chon mode (Express/Standard/Rigorous) -> implement -> verify theo mode -> security/devops review neu can. Chua deploy.
```

### 10. Minimal-context kickoff

```text
Doc context toi thieu trong repo roi de xuat cach route skill phu hop nhat cho bai toan nay. Neu con mo ho thi plan truoc, chua code.
```

### 11. Workspace-aware kickoff

```text
Muc tieu: ...
Pham vi: ...
Rang buoc: chi doc context toi thieu.
Che do: chi phan tich.
Context can doc: policy lien quan, task note cu the, artifact cu the; khong quet toan bo `workspace/`.
Output can cap nhat: `workspace/tasks/...` neu task dai hoi; `workspace/memory.md` chi cho assumptions song ngan han.
Quy trinh: doc repo -> doc task note/artifact cu the neu can -> de xuat huong tiep.
```

### 12. Pseudo-OpenClaw mode

```text
Lam theo pseudo-OpenClaw workspace mode: giu repo lean, dung `workspace/tasks/` cho task state, `workspace/artifacts/` cho output can giu, `workspace/automations/` cho y tuong recurring workflow. Khong them runtime moi.
```

### 13. Context-minimal structured prompt

```text
Muc tieu: ...
Pham vi: ...
Rang buoc: ...
Che do: ...
Context can doc: chi ... 
Output can cap nhat: workspace/tasks/... neu can.
Quy trinh: ...
```

### 14. Small task prompt

```text
Muc tieu: ...
Pham vi: mot file/module nho ...
Rang buoc: ...
Che do: ...
Quy trinh: ...
```

### 15. Review-only prompt

```text
Muc tieu: review ...
Pham vi: ...
Rang buoc: khong sua code.
Che do: review only.
Context can doc: chi file/PR/artifact lien quan.
Output can cap nhat: workspace/artifacts/... neu can luu summary.
Quy trinh: review -> test gap -> security/devops note neu lien quan.
```

### 16. Bug triage and fix

```text
Muc tieu: triage va fix bug nay.
Pham vi: [component/flow bi anh huong].
Rang buoc: thay doi nho nhat co the fix; khong refactor ngoai pham vi bug.
Che do: sua code + test.
Context can doc: chi file/module lien quan va bug report neu co.
Output can cap nhat: workspace/tasks/YYYY-MM-DD-bug-[ten].md (tao tu template neu chua co).
Quy trinh: reproduce bug -> xac dinh root cause -> fix voi thay doi nho nhat -> verify AC fix -> check regression -> neu P0/P1 thi viet post-mortem.
```

### 17. Client demo gate

```text
Muc tieu: chuan bi va chay client demo gate truoc khi deploy.
Pham vi: [feature/thay doi cu the].
Rang buoc: deploy len staging truoc, khong deploy production den khi co approval.
Che do: review + chuan bi.
Context can doc: task note lien quan va AC da viet.
Output can cap nhat: them "Client Demo Feedback" va "Demo Approval" vao workspace/tasks/[task-file].md.
Quy trinh: verify tat ca AC pass -> chup screenshot/chuan bi link staging -> gui demo theo mau trong workflows/client-demo-gate.md -> ghi feedback -> neu approved thi proceed deploy.
```

### 18. Chuyen sang client moi

```text
Chuyen sang client [Ten Client].
Cap nhat "Active Client Context" trong workspace/memory.md:
  active_client: [Ten Client]
  project: [Ten Project]
  task_file: workspace/tasks/[file].md
  codebase: projects/[folder]/
  last_switched: [YYYY-MM-DD]
Sau do doc task_file va codebase lien quan. Khong load context client cu.
```

### 20. Post-mortem sau incident

```text
Muc tieu: viet post-mortem cho incident nay.
Pham vi: [mo ta incident].
Rang buoc: khong blame ca nhan, tap trung vao gap he thong.
Che do: chi phan tich va ghi chep.
Context can doc: bug report lien quan, task note, log neu co.
Output can cap nhat: workspace/artifacts/YYYY-MM-DD-postmortem-[ten].md (tao tu template).
Quy trinh: dung template post-mortem -> dien timeline -> xac dinh root cause -> liet ke gate nao bi miss -> de xuat bien phap ngan chan cu the co owner va deadline.
```

### 21. Viet Acceptance Criteria truoc khi implement

```text
Muc tieu: viet AC cho tinh nang/task nay truoc khi bat dau code.
Pham vi: [mo ta tinh nang].
Rang buoc: chua implement, chi viet AC.
Che do: chi phan tich.
Context can doc: requirement hoac task note neu co.
Output can cap nhat: phan "Acceptance Criteria" trong workspace/tasks/[task-file].md.
Quy trinh: dung `business-analyst` -> xac dinh actors, flows, edge cases -> viet AC theo dang observable ("Khi X thi Y") -> chot AC truoc khi handoff sang implementation.
```

---

## Useful Shorthand

- `Chi phan tich`: no code changes
- `Implement luon`: code changes allowed
- `Pham vi ...`: limit blast radius
- `Giu API cu`: avoid breaking changes
- `Chua deploy`: stop before rollout
- `Preview/plan only`: no apply
- `Chi mo workspace can thiet`: avoid loading all workspace state
- `Task-first`: policy/docs truoc, task note cu the sau, khong broad scan
- `Last-resort archive`: chi mo `workspace-full-context.md` khi bi block
- `AC truoc`: viet Acceptance Criteria truoc khi bat dau code
- `DoD tier [1/2/3]`: ap dung checklist DoD dung tier
- `Demo gate`: chay client demo gate truoc khi deploy
- `Chuyen client [Ten]`: cap nhat Active Client Context trong workspace/memory.md truoc khi lam viec
