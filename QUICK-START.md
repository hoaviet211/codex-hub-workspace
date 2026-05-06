# Quick Start - Codex Hub

Landing page ngan. Source of truth cho operator usage la [workflows/prompt-cheatsheet.md](workflows/prompt-cheatsheet.md).

## 3 cau hoi truoc khi go prompt

1. Toi muon **gi**?
2. File/folder **nao** lien quan?
3. Dieu gi **khong duoc** thay doi?

## Prompt template toi thieu

```text
[Mo ta viec muon lam].
File lien quan: [path hoac "chua biet"].
Khong duoc: [gioi han, hoac "khong co"].
```

## Daily flow

1. Dung Codex trong repo voi scope ro.
2. Dang ky project trong `projects/registry.md` neu day la project moi.
3. Tao task note tu `workspace/templates/task.md` khi viec co nhieu buoc hoac co AC.
4. Mo WebOS neu can xem context/review queue: `apps/webos/README.md`.
5. Dung skills khi task can workflow chuyen mon.
6. Dung LCO chi nhu helper pipeline/dry-run khi can handoff tu dong.

## Setup workspace cho project moi

```powershell
New-Item -ItemType Directory -Force projects/my-project
Copy-Item workspace/templates/task.md workspace/tasks/2026-05-06-my-task.md
```

Sau do cap nhat `projects/registry.md`:

```markdown
| my-project | `projects/my-project/` | `(not set)` | private | active | 2026-05-06 |
```

Folder source trong `projects/` duoc ignore mac dinh de tranh commit nham code/client data vao workspace repo.

## Chay WebOS

```powershell
cd apps/webos
npm install
npm start
```

Mo `http://127.0.0.1:5173`.

## LCO helper pipeline

```bash
lco-msg "<message>" --pipeline --dry-run
```

Khong dung `lco task` lam default daily workflow. LCO chi tao context/handoff; Codex van la executor.

Setup PATH va chi tiet flag xem [workflows/prompt-cheatsheet.md](workflows/prompt-cheatsheet.md#lco-helper-pipeline).

## Doc them

- [AGENTS.md](AGENTS.md) - policy, routing, safety baseline
- [workspace/README.md](workspace/README.md) - cach dung task/artifact/template
- [projects/README.md](projects/README.md) - cach quan ly project source
- [workflows/prompt-cheatsheet.md](workflows/prompt-cheatsheet.md) - cheatsheet day du
- [workflows/standard-pipeline.md](workflows/standard-pipeline.md) - pipeline end-to-end
- [workflows/context-operating-model.md](workflows/context-operating-model.md) - read policy va workspace governance
