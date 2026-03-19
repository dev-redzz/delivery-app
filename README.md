# 🔥 Brasa & Pizza — Sistema de Delivery

Sistema completo de delivery para churrascaria e pizzaria com painel administrativo.

## 🚀 Deploy no Railway

### 1. Pré-requisitos
- Conta no [Railway](https://railway.app)
- Conta no GitHub

### 2. Passos para Deploy

```bash
# 1. Clone ou faça upload deste projeto para um repositório GitHub

# 2. Acesse railway.app e clique em "New Project"

# 3. Selecione "Deploy from GitHub repo"

# 4. Selecione seu repositório

# 5. O Railway detectará automaticamente o Node.js
```

### 3. Variáveis de Ambiente no Railway

No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `JWT_SECRET` | Uma string aleatória longa e segura |
| `PORT` | `3000` (ou deixe o Railway definir) |
| `DB_PATH` | `/app/data/delivery.db` |

### 4. Volume Persistente (IMPORTANTE!)

Para que o banco de dados persista entre deploys:

1. No Railway, vá em seu serviço
2. Clique em **"Add Volume"**
3. Mount path: `/app/data`

> ⚠️ Sem volume persistente, os dados serão perdidos a cada deploy!

---

## 🔑 Acesso Inicial

Após o deploy:

- **Site:** `https://seu-app.railway.app`
- **Admin:** `https://seu-app.railway.app/admin`
- **Login:** `admin@brasa.com`
- **Senha:** `admin123`

> ⚠️ Mude a senha após o primeiro acesso (em breve via painel)

---

## 📱 Funcionalidades

### Frontend (Cliente)
- ✅ Cardápio completo por categorias
- ✅ Carrossel de banners promocionais com swipe
- ✅ Sistema de pizza meio a meio
- ✅ Remoção de ingredientes
- ✅ Carrinho de compras com persistência
- ✅ Finalização com endereço e pagamento
- ✅ Envio automático para WhatsApp
- ✅ Design premium (preto, vermelho e dourado)
- ✅ Mobile-first e totalmente responsivo

### Painel Admin
- ✅ Login seguro com JWT
- ✅ Dashboard com estatísticas
- ✅ CRUD completo de produtos
- ✅ CRUD de categorias e subcategorias
- ✅ Gerenciamento de banners
- ✅ Gestão de pedidos com status
- ✅ Upload de imagens
- ✅ Configurações gerais (WhatsApp, horário, status aberto/fechado)

---

## 🛠️ Tecnologias

- **Backend:** Node.js + Express
- **Banco:** SQLite via sql.js (zero configuração)
- **Auth:** JWT + bcryptjs
- **Upload:** Multer
- **Frontend:** HTML + CSS + JavaScript Vanilla
- **Deploy:** Railway

---

## 💻 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Criar arquivo de ambiente
cp .env.example .env

# Iniciar servidor
npm start

# Acesse http://localhost:3000
```

---

## 📞 Configurar WhatsApp

No painel admin, vá em **Configurações** e informe o número do WhatsApp no formato:
```
5598912345678
```
(55 = Brasil, 98 = DDD, 912345678 = número)
