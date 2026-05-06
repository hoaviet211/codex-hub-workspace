# Prompt Playbook

Related docs:

- `workflows/prompt-cheatsheet.md`
- `workflows/standard-pipeline.md`
- `workflows/context-operating-model.md`

## Muc tieu

Tai lieu nay giup ban ra lenh cho Codex Hub theo dung cach van hanh da cau hinh:

- scope ro rang
- route dung skill
- tiet kiem context
- uu tien plan truoc khi implement voi bai to lon hoac mo ho

## Cong thuc Prompt Tot

Su dung mau 5 thanh phan sau khi can:

1. `Muc tieu`: ban muon ket qua gi
2. `Pham vi`: file, module, man hinh, service nao duoc dung vao
3. `Rang buoc`: khong doi schema, khong them dependency, khong deploy, giu API cu
4. `Che do`: chi phan tich, hay duoc phep sua code, test, review
5. `Context can doc`: file, task note, artifact nao duoc phep mo
6. `Output can cap nhat`: file nao trong `workspace/` can duoc cap nhat
7. `Quy trinh`: skill nao can dung truoc va can lam den buoc nao

Mau tong quat:

```text
Muc tieu: ...
Pham vi: ...
Rang buoc: ...
Mode: Express | Standard | Rigorous (neu can)
Che do: ...
Context can doc: ...
Output can cap nhat: ...
Quy trinh: check 4 safety gates -> chon mode -> dung <skill-1> -> <skill-2> -> verify theo mode -> security/devops review neu can.
```

## Rule Blocks Bat Buoc (Non-trivial Task)

### 1. Scope Confirmation Gate (truoc khi implement)

Prompt phai co day du 4 truong:

- `Muc tieu`
- `Pham vi`
- `Rang buoc`
- `Mode` (`Express` | `Standard` | `Rigorous`)

Neu thieu 1 trong 4 truong, dung o pha phan tich/lam ro, chua vao implement.

### 2. Tool Error Handling Contract

Khi tool loi, bao cao theo mau:

```text
Tool Error: <tool/lenh>
Severity: S1 blocking | S2 degraded | S3 recoverable
Impact: <anh huong truc tiep>
Fallback de xuat: <1 cach duy nhat>
Can xac nhan truoc khi retry bang cach khac.
```

### 3. Status Reporting Contract

Moi buoc kham pha tom tat bang 1 dong:

```text
Action | Evidence | Risk | Next
```

### 4. Task Lifecycle Contract

Dung bo trang thai chuan trong task note/handoff:

`Context Ready -> Scope Locked -> Plan Ready -> Execute -> Verify -> Close`

## Prompt Ngan Gon Nen Dung

### 1. Khi y tuong con mo ho

```text
Muc tieu: lam ro bai toan nay.
Pham vi: chi doc context toi thieu lien quan.
Rang buoc: chua code.
Che do: chi phan tich.
Context can doc: policy lien quan, file/module lien quan, task note neu co.
Output can cap nhat: `workspace/tasks/...` neu task dai.
Quy trinh: dung `planner`, chia bai toan nay thanh milestone, dependency, rui ro va buoc dau tien.
```

```text
Muc tieu: chot yeu cau buildable.
Pham vi: ...
Rang buoc: chua implement.
Che do: chi phan tich.
Context can doc: policy lien quan va tai lieu requirement cu the.
Output can cap nhat: `workspace/artifacts/...` neu can luu spec.
Quy trinh: dung `business-analyst`, viet user story, acceptance criteria, out-of-scope cho tinh nang nay.
```

### 2. Khi can thiet ke ky thuat

```text
Dung `system-design`, de xuat data flow, API shape, thanh phan chinh va trade-off cho yeu cau nay.
```

```text
Dung `architecture-design`, de xuat module boundary, trach nhiem tung phan va cach tach implementation.
```

### 3. Khi can code

```text
Muc tieu: implement tinh nang nay.
Pham vi: ...
Rang buoc: chi sua trong pham vi da khoa.
Che do: sua code + test.
Context can doc: chi file/module lien quan va task note neu co.
Output can cap nhat: `workspace/tasks/...` neu task dai, artifact neu co output can giu.
Quy trinh: doc repo lien quan -> dung `app-coder` implement -> chay test lien quan.
```

```text
Muc tieu: implement man hinh nay theo pattern hien co.
Pham vi: ...
Rang buoc: khong doi API neu khong can.
Che do: sua code + test.
Context can doc: chi component/page/style lien quan.
Output can cap nhat: `workspace/tasks/...` neu task dai.
Quy trinh: dung `ui-design` truoc neu layout chua ro, sau do dung `frontend-web-ui`.
```

### 4. Khi can review

```text
Muc tieu: lap test plan cho thay doi nay.
Pham vi: ...
Rang buoc: chua sua code.
Che do: review only.
Context can doc: chi file/PR/module lien quan.
Output can cap nhat: `workspace/artifacts/...` neu can luu checklist.
Quy trinh: dung `tester` de lap test plan, regression risk va cac case can verify.
```

```text
Muc tieu: security review flow nay.
Pham vi: ...
Rang buoc: chua sua code neu chua duoc yeu cau.
Che do: review only.
Context can doc: chi flow/file lien quan va artifact neu can.
Output can cap nhat: `workspace/artifacts/...` neu can luu finding summary.
Quy trinh: dung `secure-coding` review flow nay. Uu tien liet ke lo hong, trust boundary, attack path, sau do moi de xuat fix.
```

### 5. Khi lien quan deploy, infra, production

```text
Dung `secure-devops` review thay doi nay theo huong plan truoc, preview truoc, chua apply bat ky lenh production nao.
```

```text
Dung `devops-pipeline` review CI/CD, rollback, health check, canh bao va thu tu rollout cho thay doi nay.
```

```text
Dung `cloudflare-deploy` de plan thay doi Workers/Pages/DNS/WAF. Chi tao preview hoac plan, chua apply khi chua co xac nhan.
```

## Prompt Muc Tieu Theo Tinh Huong

### Sua bug

```text
Doc repo lien quan, tim nguyen nhan bug nay, neu xac dinh duoc thi sua voi thay doi nho nhat. Sau do chay test lien quan va `secure-coding` review nhanh phan bi anh huong.
```

### Lam feature end-to-end

```text
Lam theo `standard pipeline` (risk-based): check 4 safety gates -> chon mode (Express/Standard/Rigorous) -> (neu can) dung `planner` tach scope -> `app-coder` implement -> verify theo mode -> security/devops review neu can. Chua deploy.
```

### Tao UI moi

```text
Dung `ui-design` de de xuat visual direction, state va component rules cho man nay. Sau khi chot huong, dung `frontend-web-ui` implement trong pham vi cac file lien quan.
```

### Danh gia code truoc khi sua

```text
Chi phan tich. Doc phan lien quan va cho toi biet: nguyen nhan, rui ro, file can sua, cach sua de xuat. Chua viet code.
```

### Bai toan lon, nhieu buoc

```text
Day la bai toan lon. Hay toi uu context, tach thanh phase, neu hop ly thi de xuat cac luong cong viec song song. Bat dau bang ke hoach ngan gon va first actionable step.
```

### 6. Khi muon dung pseudo-OpenClaw workspace

```text
Lam theo pseudo-OpenClaw workspace mode. Chi doc them cac file can thiet trong `workspace/`. Neu task keo dai, tao hoac cap nhat mot note trong `workspace/tasks/`, ghi quyet dinh quan trong vao `workspace/memory.md`, va dat output can luu vao `workspace/artifacts/`.
```

### 7. Khi can xu ly loi tool ma van giu dung scope

```text
Neu tool loi, bao cao theo mau Tool Error + Severity + Impact + 1 fallback. Xin xac nhan truoc khi thu phuong an khac.
```

## Cach Yeu Cau Dung Theo Muc Tu Chu

### Chi muon plan

```text
Chi plan, chua sua file nao.
```

### Cho phep sua code

```text
Ban co the sua code trong pham vi ... va chay cac check an toan lien quan.
```

### Cam deploy hoac thao tac nguy hiem

```text
Khong deploy, khong apply, khong chay lenh destructive. Neu can, dung o muc preview/plan.
```

### Muon toi uu toc do

```text
Chi doc context toi thieu can thiet. Neu du thong tin thi dung hoi lai.
```

## Muc Thong Tin Nen Dua Ngay Tu Dau

- van de hoac muc tieu cu the
- file, folder, service, man hinh lien quan
- output mong muon
- rang buoc ky thuat
- co duoc phep sua code hay khong
- co duoc chay test, build, lint hay khong
- co lien quan staging hay production hay khong
- task nay co can ghi nho vao `workspace/` hay khong

## Cach Dung Workspace Layer

Chi dung `workspace/` khi no giup giam context va giu state qua nhieu buoc. Khong bien no thanh noi chat nhat ky dong.

- `workspace/memory.md`: assumptions dang con song, quyet dinh vua chot, thong tin can nhac lai cho cac task gan day.
- `workspace/tasks/`: task note co owner, scope, next step, va done criteria. Moi task dai hoi nen co 1 file rieng.
- `workspace/artifacts/`: spec, review note, checklist, summary, command snippet, hoac handoff output ma ban muon tai su dung.
- `workspace/automations/`: chi de draft recurring workflow, trigger, input, output, va guardrail. Chua co runtime thi khong coi day la scheduler that.

Nguyen tac:

- Chi mo file workspace lien quan den task hien tai.
- Mac dinh `task-first`: policy/docs truoc, sau do den 1 task note hoac 1 artifact cu the.
- Co the quet metadata ten file trong `workspace/tasks/` hoac `workspace/artifacts/`, nhung khong doc noi dung hang loat.
- Khong mo `workspace/artifacts/workspace-full-context.md` tru khi cac summary nho khong du hoac user yeu cau ro rang.
- Dinh ky lam gon hoac hop nhat task note khi no het gia tri van hanh.
- Cai gi tro thanh policy on dinh thi dua nguoc ve `AGENTS.md`, `config.yaml`, `workflows/`, hoac `skills/`.

## Anti-Patterns Nen Tranh

- `Fix giup minh` khi khong noi bug o dau, he thong nao, hoac dau vao nao bi loi
- `Lam feature X` khi khong noi pham vi, rang buoc, output mong muon
- `Deploy giup` khi khong chi ro environment, blast radius, rollback expectation
- `Review code nay` nhung khong chi file, PR, module, hoac muc tieu review
- don nhieu muc tieu vao mot prompt ma khong chi thu tu uu tien

## 10 Prompt Sao Chep Nhanh

```text
Dung `planner`, tach yeu cau nay thanh 3-5 milestone va buoc dau tien. Chua code.
```

```text
Dung `business-analyst`, viet user story, acceptance criteria va out-of-scope cho yeu cau nay.
```

```text
Dung `system-design`, de xuat giai phap high-level, API, data flow va trade-off.
```

```text
Doc repo lien quan roi dung `app-coder` implement thay doi nay trong pham vi ... Sau do chay test lien quan.
```

```text
Dung `ui-design` de chot layout, state, visual hierarchy cho man nay. Chua implement.
```

```text
Dung `frontend-web-ui` implement UI nay theo design system/pattern hien co. Khong doi API.
```

```text
Dung `secure-coding` review thay doi nay. Liet ke findings theo muc do uu tien truoc, sau do de xuat fix.
```

```text
Dung `tester` lap checklist test va regression risk cho feature nay.
```

```text
Dung `secure-devops` review thay doi infra/deploy nay, chi preview va plan, chua apply.
```

```text
Lam theo `standard pipeline` (risk-based): check 4 safety gates -> chon mode -> implement -> verify theo mode -> security/devops review neu can. Dung hoi lai neu co the tu doc repo de suy ra.
```

## Quy Uoc Ngan De Dung Hang Ngay

- `chi phan tich`: khong sua code
- `implement luon`: duoc phep sua code
- `pham vi ...`: gioi han thay doi
- `giu API cu`: tranh breaking change
- `chua deploy`: dung truoc buoc rollout
- `review theo security`: uu tien skill bao mat
- `review theo production readiness`: uu tien devops va rollback

## First Step Mac Dinh Nen Yeu Cau

Neu ban khong chac bat dau the nao, dung cau nay:

```text
Doc context toi thieu trong repo roi de xuat cach route skill phu hop nhat cho bai toan nay. Neu bai toan con mo ho thi plan truoc, chua code.
```

Neu muon agent dung workspace layer ngay tu dau, them dong nay:

```text
Chi doc them `workspace/` neu can va cap nhat state vao dung cho.
```

## Quy Tac Moi Cho Token Hygiene

- Luon chi ro `Context can doc` neu bai toan co the gioi han pham vi.
- Luon chi ro `Output can cap nhat` neu task keo dai hon 1 buoc.
- Uu tien task note va cached summary thay vi full repo context.
- Chi mo `workspace/artifacts/workspace-full-context.md` khi cac summary nho khong du.
- Khong override denylist de tien. Chi mo them binary, lockfile, minified bundle, build output, hoac generated dump khi task thuc su can.
- `Context can doc` la bat buoc cho task non-trivial; task nho, mot file co the bo qua.
