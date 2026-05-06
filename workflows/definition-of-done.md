# Definition of Done

Related docs:

- `AGENTS.md`
- `workflows/standard-pipeline.md`
- `workflows/client-demo-gate.md`
- `workspace/templates/task.md`

## Nguyen Tac

DoD la tap hop cac dieu kien bat buoc phai thoa man truoc khi mot task duoc coi la "done". Moi task phai chon mot trong 3 tier tuong ung voi mode da chon tu safety gates. Khong duoc giam tier vi deadline hoac tien loi.

---

## Tier 1: Express DoD

Su dung khi mode la **Express** (all safety gates pass, khong cham schema/auth/payment/prod infra).

### Bat buoc truoc khi mark done

- [ ] Thay doi dung khop voi Acceptance Criteria da viet truoc khi implement
- [ ] Spot check truc tiep tren man hinh, output, hoac config lien quan
- [ ] Khong co regression ro rang tren cac chuc nang gan ke
- [ ] Khong co hardcoded secret, credential, hoac debug artifact trong code
- [ ] Commit message mo ta dung thay doi da lam

### Co the bo qua

- Automated test suite day du
- Formal security review
- Client sign-off (tru khi client-facing va user yeu cau)

---

## Tier 2: Standard DoD

Su dung khi mode la **Standard** (rui ro trung binh, trong pattern hien co, targeted testing du).

### Bat buoc truoc khi mark done

- [ ] Acceptance Criteria da duoc viet truoc khi implement va tat ca AC passed
- [ ] Unit / integration test lien quan da chay va pass
- [ ] Lint va type check clean (neu ap dung)
- [ ] Build thanh cong (neu ap dung)
- [ ] Happy path va cac edge case chinh da duoc test
- [ ] Regression risk vung lan can da duoc check
- [ ] Khong co tinh nang ngoai scope loi vao (blast radius nho)
- [ ] Khong co secret, credential, debug code, hoac TODO chua xu ly nghiem trong
- [ ] Code da duoc review boi tester skill hoac peer review
- [ ] Client demo gate da pass (neu task la client-facing, xem `workflows/client-demo-gate.md`)

### Co the bo qua

- Full security audit (tru khi cham auth/payment/public API)
- Formal devops review (tru khi cham infra hoac production routing)

---

## Tier 3: Rigorous DoD

Su dung khi mode la **Rigorous** (impact cao, rollback kho, observability yeu, hoac domain khong chac).

### Bat buoc truoc khi mark done

- [ ] Acceptance Criteria da duoc viet truoc khi implement, duoc review boi business-analyst skill, va tat ca AC passed
- [ ] Test plan day du da duoc lap boi tester skill
- [ ] Automated test (unit + integration + e2e neu co) da chay va pass
- [ ] Lint, type check, build clean
- [ ] Security review da duoc chay boi secure-coding skill, tat ca critical/high finding da fix
- [ ] DevOps / infra review da duoc chay boi devops-pipeline hoac secure-devops skill
- [ ] Rollback steps da duoc viet va xac nhan truoc khi deploy
- [ ] Health checks, observability, alerting da san sang
- [ ] Backup production config da duoc tao truoc khi apply production change
- [ ] Client demo gate da pass va approval da duoc ghi lai (xem `workflows/client-demo-gate.md`)
- [ ] Khong co open critical/high bug chua xu ly
- [ ] Post-deploy verification checklist da duoc chay

### Khong duoc bo qua

- Security review
- DevOps review
- Rollback plan
- Client sign-off (voi client projects)

---

## DoD Theo Loai Task

Su dung them cac muc nay tuy loai task, ngoai tier checklist o tren.

### Feature moi

- [ ] Acceptance Criteria viet truoc khi bat dau (MANDATORY)
- [ ] Tat ca in-scope flows da duoc test
- [ ] Khong co out-of-scope behavior bi thay doi

### Bug fix

- [ ] Bug da duoc reproduce voi steps ro rang truoc khi fix
- [ ] Root cause da duoc xac dinh (khong chi fix symptom)
- [ ] Test case bao phong bug da duoc them hoac ghi lai
- [ ] Regression check tren area lien quan da pass

### UI / visual change

- [ ] Desktop, tablet, mobile screenshots da pass checklist
- [ ] Khong co regression tren cac section khac cua trang
- [ ] Client screenshot review da duoc thuc hien (neu client-facing)
- [ ] Khong co hardcoded style override ma nen la design token

### Infra / deploy change

- [ ] Plan / dry-run da duoc review truoc khi apply
- [ ] Rollback co the thuc hien trong vong 5-10 phut
- [ ] Post-deploy health check da pass
- [ ] Khong co secret bi lo trong config, log, hoac output

---

## Quy Tac Su Dung

1. Viet Acceptance Criteria **truoc** khi bat dau implement, khong phai sau.
2. Chon tier tuong ung voi mode da chon. Khong tu ha tier.
3. Neu chua chac tier, chon tier cao hon.
4. Neu mot muc chua pass, task **chua done**. Tao bug hoac follow-up task neu chua xu ly duoc ngay.
5. Luu DoD checklist vao task note neu task dai hon 1 session.
