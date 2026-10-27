# VOID//DRONE — Online Boss Rush (mecânicas completas)

Esta atualização substitui o minijogo PvP separado pelo motor de jogo 2D original dentro do online. Cada jogador roda o Boss Rush normal no seu navegador: campanha/Infinitо/Pesadelo HELL/Contra-tempo/Treino, cutscenes, 64 chefes da campanha, padrões de tiro, tiros do jogador, dash, EMP, KIRA-7 e upgrades. O criador da sala escolhe o modo; o servidor aplica esse mesmo modo ao segundo jogador. O placar mostra score, chefes derrotados, vida e conclusão ao vivo. É uma corrida competitiva no jogo completo, não uma arena simplificada; as duas simulações são individuais, mas os dados de placar/sala são sincronizados.

## Atualizar o site Render que você já tem
1. Baixe e extraia este ZIP.
2. Abra o repositório GitHub que atualmente publica `void-drone-boss-rush-64-online.onrender.com`. Não crie um repositório diferente se quiser manter o endereço existente.
3. No repositório, substitua os arquivos com o mesmo nome (`index.html`, `server.js`, `package.json`, `render.yaml`, `README.md`, `.gitignore`) pelos desta pasta, e faça **Commit changes**.
4. No Render, abra o serviço existente e aguarde o deploy automático terminar com estado **Live**. O `render.yaml` mantém o nome `void-drone-boss-rush-64-online`.
5. Abra o mesmo endereço HTTPS, selecione o modo desejado no menu, clique em **ONLINE VERSUS**, crie uma sala e compartilhe o código. O segundo jogador entra pelo mesmo site.

## Observações
- O combate usa o motor local do jogo normal; o servidor cuida de salas, modo escolhido, placar, progresso e ranking.
- O ranking é gravado em `scores.json`; em hospedagem grátis, esse arquivo local pode ser perdido quando o serviço é recriado.
- O servidor usa WebSocket na rota `/ws`. O serviço precisa estar publicado como Node.js (não como Static Site).
