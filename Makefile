.PHONY: setup dev-api dev-web import test docker-up docker-down

setup:
	pip install -e packages/importer
	pip install -r apps/api/requirements.txt
	cd apps/web && npm install
	cp -n .env.example .env || true
	cp -n apps/web/.env.local.example apps/web/.env.local || true
	@echo "Setup pronto. Preencha .env e rode 'make dev-api' (e 'make dev-web' noutra aba)."

dev-api:
	cd apps/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd apps/web && npm run dev

# Ex.: make import FILE=~/Downloads/export.zip USER=mae
import:
	ss-import $(FILE) --user $(USER) --pii strict --out $(USER).jsonl

test:
	cd packages/importer && pytest -q

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
