# Tutorial — Subir o site da Agência Eden na Contabo (EasyPanel)

O site é um app Node (Express) que serve a landing, recebe o formulário em
`POST /api/aplicacoes` e mostra as aplicações em `/dashboard`. Repo:
**https://github.com/Difroide/agenciaeden**

---

## 0. O que você precisa antes

- VPS da Contabo com Ubuntu e acesso SSH (`ssh root@IP-DA-VPS`)
- (Opcional, mas recomendado) um domínio com acesso ao DNS

## 1. Instalar o EasyPanel na VPS (pular se já tiver)

```bash
ssh root@IP-DA-VPS
curl -sSL https://get.easypanel.io | sh
```

Quando terminar, acesse `http://IP-DA-VPS:3000` no navegador e crie o
usuário admin do painel.

## 2. Criar o projeto

1. No EasyPanel, clique em **+ New Project**
2. Nome: `eden`

## 3. Criar o banco Postgres

1. Dentro do projeto `eden`: **+ Service → Postgres**
2. Nome do serviço: `db`
3. Defina usuário, senha e nome do banco (ex: `eden` / senha forte / `eden`)
4. Depois de criado, abra o serviço e copie a **Internal Connection URL**
   (algo como `postgres://eden:SENHA@eden_db:5432/eden`)

> O banco interno não usa SSL. Na hora de colar a URL no app (passo 5),
> **adicione `?sslmode=disable` no final** — o server já entende isso.

## 4. Criar o app a partir do GitHub

1. No projeto `eden`: **+ Service → App**
2. Nome do serviço: `site`
3. Em **Source**, escolha **GitHub** e aponte para:
   - Owner: `Difroide`
   - Repository: `agenciaeden`
   - Branch: `main`
   - (Se o repo for privado, conecte a conta GitHub no EasyPanel em
     Settings → GitHub e autorize o repositório)
4. Em **Build**, deixe **Nixpacks** (ele detecta o Node pelo `package.json`
   e roda `npm start` sozinho — não precisa de Dockerfile)

## 5. Variáveis de ambiente

No serviço `site`, aba **Environment**, adicione:

```
DATABASE_URL=postgres://eden:SENHA@eden_db:5432/eden?sslmode=disable
ADMIN_PASS=uma-senha-forte-aqui
```

- `DATABASE_URL`: a Internal Connection URL do passo 3 **+ `?sslmode=disable`**
- `ADMIN_PASS`: a senha do `/dashboard` (NÃO deixe sem — o padrão é fraco)
- `PORT` não precisa: o EasyPanel injeta e o server já lê `process.env.PORT`

## 6. Porta e domínio

1. No serviço `site`, aba **Domains & Proxy**:
   - Confira se a porta do proxy aponta para a porta do app (`3000` se o
     EasyPanel não tiver injetado `PORT` próprio — em caso de dúvida, veja
     nos logs a linha `[eden] rodando em http://localhost:XXXX`)
2. Sem domínio ainda: use o host gratuito que o EasyPanel gera
   (`site-eden.IP.sslip.io` ou similar) — já sai com HTTPS
3. Com domínio próprio:
   - No DNS do domínio, crie um registro **A** apontando para o IP da VPS
   - No EasyPanel, **Add Domain** → digite o domínio → ative **HTTPS**
     (Let's Encrypt automático)

## 7. Deploy e verificação

1. Clique em **Deploy** no serviço `site` e acompanhe os logs do build
2. Logs devem mostrar: `[eden] usando Postgres` e `[eden] rodando em...`
   - Se aparecer `[eden] sem DATABASE_URL`, a variável não foi salva
   - Se der erro `The server does not support SSL connections`, faltou o
     `?sslmode=disable` na URL
3. Teste no navegador:
   - Abrir o site e conferir a página
   - Enviar uma aplicação de teste pelo formulário
   - Abrir `/dashboard`, entrar com a `ADMIN_PASS` e ver se o teste chegou
   - Apagar a aplicação de teste

## 8. Atualizações futuras

Sempre que mudar o site:

```bash
cd C:\Users\gvieira\Documents\OFM\site
git add -A
git commit -m "descricao da mudanca"
git push
```

Depois, no EasyPanel, clique em **Deploy** no serviço `site`.
Para automatizar: no serviço `site` → **Deployments → Enable Auto Deploy**
(cria um webhook no GitHub e todo push na `main` publica sozinho).

## Checklist antes de rodar tráfego

- [ ] Contatos reais no footer (WhatsApp e Instagram ainda são placeholder)
- [ ] Páginas de Termos de uso e Privacidade (links estão mortos)
- [ ] Unificar prazo de resposta (página diz 24h, modal diz 12h)
- [ ] `og:image` com URL absoluta do domínio final
- [ ] Pixel/tracking de ads, se for rodar tráfego pago
