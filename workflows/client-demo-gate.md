# Client Demo Gate

Related docs:

- `AGENTS.md`
- `workflows/standard-pipeline.md`
- `workflows/definition-of-done.md`
- `workspace/templates/task.md`

## Nguyen Tac

Client Demo Gate la buoc bat buoc xay ra **truoc khi deploy len production** voi moi task Standard hoac Rigorous co output client-facing. Muc tieu la dam bao client da thay va approve output truoc khi no duoc ship, tranh viec phat hien van de sau deploy.

---

## Khi Nao Bat Buoc

| Mode | Client-facing? | Demo Gate |
|---|---|---|
| Express | Bat ky | Optional (khuyen khich) |
| Standard | Co | **Bat buoc** |
| Standard | Khong | Optional |
| Rigorous | Bat ky | **Bat buoc** |

Client-facing = thay doi truc tiep anh huong UI, noi dung, user flow, hoac API da published.

---

## Quy Trinh Demo Gate

### Buoc 1: Chuan bi demo

- [ ] Build / deploy len staging hoac preview environment (khong dung production)
- [ ] Kiem tra tat ca Acceptance Criteria da pass truoc khi goi client
- [ ] Chup anh man hinh hoac quay man hinh cac flow chinh de gui kem neu client khong the vao UI truc tiep
- [ ] Ghi lai link staging / preview va ngay het han

### Buoc 2: Gui demo cho client

Mau tin nhan demo gui client:

```text
[Ten project] - Review V[X]

Chao [Ten client],

Minh da hoan thanh [mo ta ngan gon thay doi]. Ban co the xem o:
- Link preview: [URL]
- Huong dan review: [nhung gi can xem, flow nao nen test]

Vui long xac nhan 1 trong 3 trang thai:
[ ] Duyet - deploy duoc
[ ] Can chinh sua nho - [mo ta chinh sua]
[ ] Can chuyen huong - goi/nhan tin rieng

Han feedback: [ngay + gio]
```

### Buoc 3: Thu thap feedback

Ghi lai feedback cua client vao task note theo mau sau:

```md
## Client Demo Feedback

- Ngay demo: YYYY-MM-DD
- Nguoi review: [ten client]
- Kenh review: [email / Zalo / meet / etc.]
- Trang thai: approved | changes-requested | blocked

### Yeu cau chinh sua (neu co)

- [ ] [Mo ta thay doi cu the]
- [ ] [Mo ta thay doi cu the]

### Ghi chu them

[Bat ky luu y nao tu client]
```

### Buoc 4: Xu ly feedback

| Trang thai | Hanh dong |
|---|---|
| `approved` | Chot approval, proceed to deploy |
| `changes-requested` | Tao task moi hoac append vao task hien tai, implement, quay lai demo gate |
| `blocked` | Hop / goi client de clarify, khong deploy cho den khi chot huong |

### Buoc 5: Ghi lai approval

Khi client approve, ghi vao task note:

```md
## Demo Approval

- Ngay approve: YYYY-MM-DD
- Nguoi approve: [ten client]
- Kenh: [email / Zalo / etc.]
- Noi dung approve: [trich dan hoac tom tat loi approve]
- Build / commit da duoc approve: [commit hash hoac build ID]
```

Approval nay la dieu kien bat buoc de proceed sang deploy trong DoD Tier 2/3.

---

## Quy Tac

- Khong deploy production truoc khi co approval ghi lai neu mode la Standard hoac Rigorous.
- Khong demo tren production. Su dung staging, preview, hoac localhost co accessible link.
- Neu client khong phan hoi trong deadline, ping lai 1 lan. Neu van khong co, leo thang cho user / project owner truoc khi tu y deploy.
- Approval cho version X khong co nghia la approval cho version X+1. Moi round changes yeu cau demo gate moi.
- Giu screenshot hoac recording cua demo neu project co tranh chap ve scope sau nay.

---

## Shorthand Prompts

### Chuan bi demo

```text
Muc tieu: chuan bi demo cho client truoc khi deploy.
Pham vi: [feature/thay doi cu the].
Rang buoc: chi staging, chua deploy production.
Che do: review + chuan bi.
Context can doc: task note lien quan, AC da viet.
Output can cap nhat: them "Client Demo Feedback" section vao workspace/tasks/[task-file].md.
Quy trinh: verify AC pass -> chup screenshot -> gui demo -> ghi feedback -> neu approved thi proceed deploy.
```

### Ghi nhan approval

```text
Cap nhat task note voi trang thai demo approval: approved, ngay [YYYY-MM-DD], nguoi approve [ten].
```
