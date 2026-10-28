# TeuVet · Seu guia veterinário

Aplicativo web (instalável no celular) para consulta e organização de conteúdo veterinário. Todo o conteúdo é escrito e publicado pelo Criador e por editores autorizados.

Esta é a **Etapa 1** da especificação: estrutura, identidade visual, navegação, categorias e espécies, login com perfis (Criador, Editor, Usuário), Painel do Criador e banco de dados. Já vêm junto o cadastro de patologias com versão por espécie, histórico de versões, as duas pesquisas, favoritos, histórico de páginas e sugestões de correção.

---

## Instalação (cerca de 30 minutos, sem instalar nada no computador)

Você vai usar duas contas gratuitas:

- **Supabase**: guarda o banco de dados e cuida do login.
- **GitHub**: guarda os arquivos e deixa o site no ar (GitHub Pages).

### 1. Criar o banco de dados no Supabase

1. Acesse **supabase.com**, clique em **Start your project** e crie a conta.
2. Clique em **New project**:
   - **Name:** `teuvet`
   - **Database Password:** crie uma senha forte e guarde (não vai ser usada no dia a dia).
   - **Region:** South America (São Paulo).
3. Espere o projeto terminar de criar (1 a 2 minutos).
4. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
5. Abra o arquivo `supabase/schema.sql` (no Bloco de Notas mesmo), copie **tudo**, cole no Supabase e clique em **Run**.
6. Deve aparecer **Success. No rows returned**. Se aparecer erro, não rode de novo: me mande a mensagem.

### 2. Pegar as duas chaves de conexão

1. No Supabase, clique em **Connect** (no topo da página do projeto).
2. Copie e guarde:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **Publishable key** (começa com `sb_publishable_`). Em projetos mais antigos, ela aparece como **anon public key**; serve do mesmo jeito.

> A publishable key é pública por natureza. Quem protege os dados são as regras do banco. **Nunca** coloque no app a chave *secret* (ou *service_role*).

### 3. Subir os arquivos no GitHub

1. Acesse **github.com** e crie a conta.
2. Clique em **+ › New repository**:
   - **Repository name:** `teuvet`
   - Marque **Public** (o GitHub Pages gratuito exige repositório público; o conteúdo veterinário fica no banco, não aqui).
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Descompacte o `teuvet.zip`, abra a pasta `teuvet` e **arraste tudo o que está dentro dela** (arquivos e pastas) para a página do GitHub.
5. Clique em **Commit changes**.

### 4. Colar as chaves no `config.js`

1. No GitHub, clique no arquivo `config.js` e depois no lápis (**Edit**).
2. Troque `COLE_AQUI_A_PROJECT_URL` pela Project URL e `COLE_AQUI_A_ANON_KEY` pela publishable key. Mantenha as aspas.
3. Clique em **Commit changes**.

### 5. Colocar o site no ar

1. No repositório, vá em **Settings › Pages**.
2. Em **Source**, escolha **Deploy from a branch**; em **Branch**, escolha `main` e `/ (root)`. Clique em **Save**.
3. Espere 1 a 2 minutos e recarregue a página. Vai aparecer o endereço do site, no formato `https://SEU-USUARIO.github.io/teuvet/`.

### 6. Avisar o Supabase sobre o endereço do site

Sem isso, os links de confirmação de e-mail não funcionam.

1. No Supabase, vá em **Authentication › URL Configuration**.
2. Em **Site URL**, cole o endereço do site (com a barra no final).
3. Em **Redirect URLs**, clique em **Add URL** e cole o mesmo endereço.
4. Salve.

### 7. Tornar o seu namorado o Criador

1. Ele abre o endereço do site, toca em **Criar conta**, confirma pelo e-mail e entra.
2. Toda conta nova começa como **Usuário**. Para virar Criador, no Supabase abra **SQL Editor › New query**, cole a linha abaixo com o e-mail dele e clique em **Run**:

   ```sql
   select public.tornar_criador('email-dele@exemplo.com');
   ```

3. Deve aparecer *Pronto: … agora é Criador*. Ele recarrega o site e o botão **Painel** aparece.

Depois disso, ele mesmo muda o perfil de qualquer pessoa em **Painel › Usuários e permissões** (por exemplo, transformar alguém em Editor). Se você também quiser acesso de Criador, rode a mesma linha com o seu e-mail.

### 8. Instalar no celular

- **Android (Chrome):** abrir o site, menu ⋮ › **Instalar app**.
- **iPhone (Safari):** abrir o site, **Compartilhar › Adicionar à Tela de Início**.

---

## Bom saber

- **Projeto parado:** no plano gratuito, o Supabase pausa o projeto depois de 7 dias sem nenhum acesso. Se acontecer, entre no Supabase e clique em **Restore project**. Com uso semanal, não pausa.
- **E-mails de confirmação:** o envio gratuito do Supabase tem limite de poucos e-mails por hora. Para poucos usuários é suficiente; com muitos cadastros, dá para configurar um serviço de e-mail próprio em **Authentication › Emails › SMTP Settings**.
- **Backup:** em **Database › Backups** o Supabase mostra as cópias automáticas do plano gratuito. Para uma cópia extra, use **Table Editor › Export to CSV** em cada tabela.
- **Atualizações:** quando uma nova etapa ficar pronta, basta repetir o passo 3 enviando os arquivos novos por cima (o `config.js` já preenchido deve ser mantido). Se a etapa trouxer mudança no banco, virá um arquivo SQL separado para rodar no SQL Editor.

---

## Para quem for programar

- Sem etapa de build: HTML, CSS e JavaScript (módulos ES) servidos como arquivos estáticos. A biblioteca `@supabase/supabase-js` é carregada do jsDelivr com versão fixa.
- `supabase/schema.sql`: tabelas, regras de acesso (Row Level Security), gatilhos de autoria e de aprovação, e espécies iniciais.
- `src/app.js` telas e eventos · `src/api.js` acesso ao banco · `src/util.js` busca e formatação (funções puras) · `src/constants.js` estrutura fixa da especificação.
- Testes:
  - `npm test`: busca, tolerância a erros de digitação, formatação e conversão de dados (Node 20+, sem dependências).
  - `npm run test:db`: aplica o `schema.sql` num PostgreSQL local e verifica 16 regras de permissão (precisa de `psql`).
  - `python3 tests/e2e/smoke.py`: percorre as telas num navegador com um Supabase simulado (precisa de Playwright).

### O que está pronto (Etapa 1)

- Identidade visual com modo claro e escuro, navegação inferior e endereços por página.
- Login, cadastro, confirmação de e-mail e recuperação de senha.
- Perfis Criador, Editor e Usuário, conferidos pelo banco em cada operação. Opção de exigir aprovação do Criador para o que os editores publicarem.
- Categorias fixas e espécies/subdivisões editáveis, com página de características (15 tópicos).
- Cadastro de patologias com os 13 campos de texto, conteúdo geral e versão individual por espécie, cópia entre espécies, salvamento automático, status (rascunho, em revisão, publicado, arquivado) e histórico com restauração.
- Indicação cirúrgica com procedimentos (a página de cada cirurgia é da Etapa 5).
- Pesquisa por doença (nome, sinônimo, nome popular, científico, agente, espécie, com tolerância a erros) e por sinais clínicos e exames.
- Favoritos, vistos recentemente, sugestões de correção e Painel com indicadores.
- Instalável como app (PWA).

### Próximas etapas

2. Imagens e galerias no editor · 3. Pesquisa clínica completa (diagnósticos diferenciais) · 4. Medicações, doses e calculadora · 5. Cirurgias · 6. Ferramentas clínicas · 7. Anotações pessoais e consulta offline · 8. Finalização.
