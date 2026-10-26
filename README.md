# VOID//DRONE 2D — publicar o site e jogar online

Este pacote contém o jogo, o servidor de salas WebSocket e o placar. Para jogar online pela internet, publique este projeto num serviço que execute Node.js e aceite WebSocket. O guia `COMO_PUBLICAR_O_SITE.html` explica o processo usando GitHub + Render, sem precisar instalar ferramentas no computador.

## Guia rapidíssimo
1. Extraia o ZIP.
2. Entre em https://github.com/new e crie um repositório chamado `void-drone-online`.
3. No repositório, escolha **Add file → Upload files** e envie os arquivos que estão dentro desta pasta (incluindo `index.html`, `server.js`, `package.json`, `render.yaml` e `.gitignore`). Faça o commit.
4. Entre em https://dashboard.render.com/ e escolha **New + → Blueprint**.
5. Conecte o GitHub, selecione o repositório `void-drone-online` e clique em **Deploy Blueprint**.
6. Espere o serviço ficar **Live** e abra o endereço `https://...onrender.com` mostrado pelo Render.
7. No jogo, abra **ONLINE VERSUS**. Um jogador cria a sala e envia o código; o outro abre o mesmo site e entra com esse código.

## Configuração automática
O arquivo `render.yaml` define o serviço Node, o comando de instalação `npm install`, o comando de inicialização `npm start` e o health check `/`.

## Importante
- Este ZIP não publica o site por conta própria: o proprietário precisa entrar em GitHub/Render e autorizar o deploy.
- O serviço gratuito pode suspender-se quando fica sem uso; o primeiro acesso após um período parado pode demorar.
- O ranking usa um arquivo local do servidor e pode ser apagado quando a instância gratuita reinicia ou é recriada. Para manter o ranking permanentemente, será necessário armazenamento persistente ou banco de dados.
- O jogo tem multiplayer online de 2 jogadores por sala; ambos precisam usar o mesmo endereço de site publicado.
