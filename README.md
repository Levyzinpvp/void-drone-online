# VOID//DRONE 2D — Online Modes Update

Esta versão mantém o motor de combate 2D do jogo (sprites, tiros, dash, cutscenes, chefes e KIRA-7) e acrescenta cinco filas online.

## Filas online

- **Co-op (2 jogadores):** os dois lutam contra o mesmo chefe e compartilham a barra de vida do chefe. EMP ativo.
- **Boss Rush Race (2 jogadores):** cada piloto faz a própria campanha; o primeiro a morrer perde, e os chefes/pontuação servem como desempate quando ambos concluem. EMP ativo.
- **Versus PvP (1×1):** os jogadores usam o drone, tiro e dash da campanha; o primeiro eliminado perde. EMP desativado.
- **Battle Royale (até 10):** todos contra todos, último vivo vence. Cada sala recebe um dos seis mapas planetários. EMP desativado. O anfitrião pode começar com pelo menos 2 participantes ou aguardar a sala cheia.
- **Deathmatch 2×2 (4 jogadores):** duas equipes de dois, tiros aliados não causam dano, respawn e vitória ao chegar a 15 eliminações. Exige 4 jogadores. EMP desativado.

## Atualizar o site Render existente

1. Extraia o ZIP.
2. Abra no GitHub o mesmo repositório que publica `void-drone-boss-rush-64-online.onrender.com`.
3. Substitua `index.html`, `server.js`, `package.json`, `render.yaml`, `README.md`, `.gitignore` e `COMO_PUBLICAR_O_SITE.html` pelos arquivos desta pasta.
4. Faça **Commit changes**. O serviço existente deve iniciar um deploy automático.
5. Aguarde o Render mostrar **Live**, depois recarregue o site com `Ctrl+F5`.

## Hospedagem

O serviço tem de ser um Web Service Node.js com WebSocket (não Static Site). `render.yaml` mantém o nome do serviço atual. `npm install` instala `ws` e `npm start` inicia `server.js`.

## EMP

O EMP fica disponível no Co-op, Boss Rush Race e modos PvE solo. Nas filas PvP (Versus, Battle Royale, Deathmatch) fica oculto no HUD e o servidor não processa dano via EMP.

## Observações

A atualização não é publicada automaticamente na conta do usuário; é preciso enviar os arquivos para o repositório conectado. Não foi possível testar uma sessão WebSocket pública real neste ambiente, então publique e faça uma partida com dois navegadores para confirmar conectividade.
