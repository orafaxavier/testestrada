# STRADA H&G · versão de teste "testestrada"

Mesmo app do artifact, agora como site próprio (PWA) com banco no Supabase.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `public/index.html` | Página do app (visual, ícone, instalação no celular) |
| `public/app.js` | O código do app, igual ao do artifact |
| `public/boot.js` | Liga o app ao Supabase (logística, ao vivo, chat, fotos) |
| `public/config.js` | Onde entram o endereço e a chave pública do Supabase |
| `public/seed-state.json` | A logística atual, sobe sozinha no primeiro acesso |
| `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` | PWA: ícone STRADA na tela inicial e abertura sem sinal |
| `supabase/schema.sql` | Cria o banco (rodar uma vez no Supabase) |
| `vercel.json` | Configuração da hospedagem na Vercel |

## Como funciona

- Quando um ADM (Dandan, Julia, Luizmar) edita, o app salva no banco em poucos segundos e todo mundo recebe: quem está com o app aberto vê o botão "Logística atualizada · toque para ver"; quem abrir depois já vê a versão nova.
- Ao vivo, chat, reações e fotos do reconhecimento aparecem na hora para todos.
- Sem sinal (ônibus, avião), o app abre com a última versão salva no celular.
- CPF e data de nascimento ficam fora: não existem nos dados, e o banco recusa qualquer CPF no formato 000.000.000-00.
- Leitor automático de PDF/texto (assistente) fica desligado no teste. O material colado vai para "Recebidos" para aplicar à mão.

## Limites da versão de teste

- Login continua só pelo nome (como no protótipo). Quem tiver o link consegue ver e editar. Não divulgar o link fora da equipe de teste.
- Na versão da empresa: login de verdade (Supabase Auth), regras por pessoa no banco, e push no celular.

## Passo a passo

### 1. Supabase (banco)
1. Entrar em supabase.com e criar a conta.
2. New project · nome `testestrada` · região South America (São Paulo) · plano Free. Guardar a senha do banco.
3. Menu SQL Editor · New query · colar o conteúdo de `supabase/schema.sql` · Run.
4. Project Settings · API Keys: copiar a **Project URL** e a chave **publishable** (ou a **anon public**, na aba Legacy). Essas duas são públicas.
5. Nunca enviar a chave **secret / service_role**.

### 2. Vercel (site)
Com GitHub (recomendado, cada ajuste sobe sozinho):
1. Criar o repositório `testestrada` no GitHub (pode ser privado) e conectar o GitHub ao Claude.
2. O Claude sobe os arquivos.
3. Em vercel.com, entrar com o GitHub · Add New · Project · importar `testestrada` · Deploy.
4. Endereço: `testestrada.vercel.app` (Settings · Domains, se precisar ajustar o nome).

### 3. Instalar no celular
- iPhone: abrir o link no Safari · Compartilhar · Adicionar à Tela de Início.
- Android: abrir no Chrome · menu · Instalar app.

## Passar para a conta da empresa depois

- Supabase: Project Settings · General · Transfer project para a organização da empresa.
- Vercel: Project Settings · General · Transfer para o time da empresa.
- GitHub: Settings · Transfer ownership para a organização da empresa.
- Ou recriar do zero na conta da empresa: novo Supabase + `schema.sql` + copiar a linha `main` da tabela `app_state`. Leva uns 15 minutos.
