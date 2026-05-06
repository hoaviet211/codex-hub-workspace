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
2. Mo WebOS neu can xem context/review queue: `projects/codex-hub-webos/README.md`.
3. Dung skills khi task can workflow chuyen mon.
4. Dung LCO chi nhu helper pipeline/dry-run khi can handoff tu dong.

## LCO helper pipeline

```bash
lco-msg "<message>" --pipeline --dry-run
```

Khong dung `lco task` lam default daily workflow. LCO chi tao context/handoff; Codex van la executor.

Setup PATH va chi tiet flag xem [workflows/prompt-cheatsheet.md](workflows/prompt-cheatsheet.md#lco-helper-pipeline).

## Doc them

- [AGENTS.md](AGENTS.md) - policy, routing, safety baseline
- [workflows/prompt-cheatsheet.md](workflows/prompt-cheatsheet.md) - cheatsheet day du
- [workflows/standard-pipeline.md](workflows/standard-pipeline.md) - pipeline end-to-end
- [workflows/context-operating-model.md](workflows/context-operating-model.md) - read policy va workspace governance
