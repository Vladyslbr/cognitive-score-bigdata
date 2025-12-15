# Cognitive Score (mock) — Terraform + SageMaker Endpoint + щомісячне перетренування

Цей проєкт піднімає:
- 1 S3 bucket для даних і артефактів (`train/`, `models/`, `artifacts/`)
- ECR репозиторії для **inference** та **training** контейнерів (ви пушите Docker-образи)
- SageMaker Endpoint, який **завжди** повертає:
  `{"cognitive_score": 72, "model_version": "v1-mock"}`
- Step Functions state machine + EventBridge schedule, який **раз на місяць** запускає SageMaker Training Job і робить `UpdateEndpoint` на новий артефакт.

> Дані для навчання очікуються як **окремі JSON-файли** в `s3://<bucket>/train/<uuid>.json`.

---

## 0) Перевірити хто ви в AWS CLI

```bash
aws sts get-caller-identity
```

---

## 1) Залежності локально

- AWS CLI (вже має бути налаштовано `aws configure`)
- Docker (для білду та пуша в ECR)
- Terraform >= 1.6

---

## 2) Створити інфру без endpoint (рекомендовано)

Спочатку створимо bucket + ECR + ролі + Step Functions.

```bash
cd terraform
terraform init
terraform apply -var="create_endpoint=false"
```

Після apply у outputs ви побачите:
- `ml_bucket_name`
- `inference_repo_url`, `training_repo_url`

---

## 3) Зібрати і запушити Docker-образи (inference + training)

Поверніться в корінь проєкту:

```bash
./scripts/build_and_push.sh \
  --region <ваш-регіон> \
  --inference-repo <repo_url_з_outputs> \
  --training-repo <repo_url_з_outputs>
```

---

## 4) Підняти endpoint

```bash
cd terraform
terraform apply -var="create_endpoint=true"
```

---

## 5) Завантажити дані для тренування (JSON-масив -> багато JSON-ів)

Якщо у вас локально є файл з JSON-масивом (як `september_2025_cognitive.json`), скрипт нижче розібʼє його на окремі JSON-и і закине в `train/`:

```bash
python3 scripts/upload_json_array_to_s3.py \
  --bucket <ml_bucket_name> \
  --prefix train \
  --file ./data/september_2025_cognitive.json
```

---

## 6) Тестовий виклик endpoint

```bash
python3 scripts/invoke_endpoint.py --endpoint-name <endpoint_name_з_outputs>
```

Очікувана відповідь:
```json
{"cognitive_score": 72, "model_version": "v1-mock"}
```

---

## Нотатки про schedule

EventBridge cron за замовчуванням: **кожного 1 числа місяця о 03:00 UTC**.
Можна змінити змінною `monthly_cron_expression`.

---

## Важливо про безпеку / вартість

Endpoint на інстансі буде коштувати гроші (навіть якщо ним не користуватись).
Змінюйте `endpoint_instance_type` або вимикайте `create_endpoint`, якщо не треба.
