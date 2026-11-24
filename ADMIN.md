# Painel do site (admin)

Endereço: `https://SEU-SITE/admin`

O painel edita:

- **Portfólio**: criar e excluir trabalhos, trocar títulos, adicionar e excluir fotos e vídeos (MP4, até 100 MB), escolher a capa e a ordem. Os 3 primeiros trabalhos aparecem em "Trabalhos recentes" na página inicial.
- **Disponíveis**: os desenhos do carrossel "O próximo traço". É possível adicionar, excluir, reordenar, trocar a foto, o nome e a linha de preço. O card "Um projeto seu" fica fixo no final.
- **Textos**: capa, Sobre, Disponíveis, Serviços, contato, região e WhatsApp. Os títulos grandes ficam fixos para não quebrar o layout.

Nada muda no site até clicar em **Publicar no site**. Depois de publicar, o site atualiza em até 1 minuto.
Enquanto você edita, um rascunho fica guardado no navegador.

## Configuração na Vercel (uma vez só)

1. **Criar o armazenamento**
   Projeto na Vercel → aba **Storage** → **Create Database** → **Blob**.
   Se for perguntado o tipo de acesso, escolha **Public**.
   Conecte o Blob a este projeto em todos os ambientes. A Vercel cria sozinha a variável `BLOB_READ_WRITE_TOKEN`.

2. **Criar as variáveis do login**
   Projeto → **Settings** → **Environment Variables**. Adicione em *Production* e *Preview*:

   | Nome | Valor |
   |---|---|
   | `ADMIN_USER` | o usuário do login, por exemplo `victor` |
   | `ADMIN_TEMP_PASSWORD` | uma senha provisória com pelo menos 8 caracteres, inventada por você |
   | `SESSION_SECRET` | um texto aleatório longo (veja abaixo) |

   Para gerar o `SESSION_SECRET`, rode no terminal e cole o resultado:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

3. **Publicar**
   Envie o código ao GitHub, ou use **Deployments → ⋯ → Redeploy**. As variáveis só valem a partir do deploy seguinte.

4. **Primeiro acesso**
   Abra `/admin`, entre com o usuário e a senha provisória. O painel pede para criar uma senha pessoal.
   A partir daí a senha provisória deixa de funcionar.

## Esqueceu a senha?

Na Vercel, troque o valor de `ADMIN_TEMP_PASSWORD` por uma nova senha provisória e faça um Redeploy.
A nova provisória passa a valer, e no primeiro login o painel pede uma nova senha pessoal.

## Rodar no computador

`npm.cmd run dev` também sobe o painel em http://localhost:3000/admin.
Sem `BLOB_READ_WRITE_TOKEN`, as fotos e os textos ficam na pasta `.local-data`, só neste computador.
Para isso, copie `.env.example` para `.env.local` e preencha `ADMIN_USER`, `ADMIN_TEMP_PASSWORD` e `SESSION_SECRET`.

## Como funciona (para quem for mexer no código)

- `api/`: funções da Vercel (login, troca de senha, conteúdo, upload). `api/_lib/` tem o código compartilhado.
- A senha pessoal fica guardada só como hash (scrypt) no Blob. O login usa um cookie assinado, HttpOnly, válido por 7 dias.
- O conteúdo publicado fica no Blob. As páginas o carregam por `/api/content?format=js`, e `site-content.js` aplica os textos (`data-edit` no HTML), o carrossel e o portfólio.
  Antes da primeira publicação, o site mostra o conteúdo escrito no HTML e em `portfolio-data.js`.
- As fotos são reduzidas e convertidas para WEBP no navegador antes do envio. Os vídeos vão direto para o Blob.
  Arquivos que deixaram de ser usados são apagados do Blob a cada publicação, depois de 6 horas.
