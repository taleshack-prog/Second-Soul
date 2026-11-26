# Railway: configuração no painel

Desde 01/12/2026 a Railway não lê mais `railway.json` / `railway.toml` (Config as Code).
A configuração de deploy deste repositório vive nas **Settings de cada serviço no painel da Railway**.
Este arquivo só registra os valores, para não se perderem junto com o arquivo removido.
Se mudar algo no painel, atualize esta tabela.

| Serviço | Builder | Dockerfile Path | Start Command | Healthcheck | Restart |
|---|---|---|---|---|---|
| API (`second-soul-production.up.railway.app`) | Dockerfile | `Dockerfile.api` | vazio (usa o CMD do Dockerfile) | `/health` | On Failure |

Atenção: sem o Dockerfile Path no painel a Railway procura `Dockerfile` na raiz, que não existe, e o build falha.
`apps/api/Dockerfile` **não** é o usado em produção (não instala os pacotes de `packages/`).
