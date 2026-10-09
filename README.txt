CORRIDA CHEGA DE INTOCÁVEIS — PROTÓTIPO WEB 3D 0.3
================================================

IMPORTANTE
Este é um protótipo independente e inicial, feito para testar a base da recriação.
Os modelos, a pista e a decoração são formas provisórias geradas por código; não são os
modelos oficiais do jogo original.

COMO EXECUTAR
1. Extraia a pasta ZIP inteira.
2. Abra a pasta corrida-chega-de-intocaveis.
3. A forma recomendada é abrir um servidor local simples, pois o projeto usa módulos ES.
   No VS Code, instale a extensão "Live Server" (se ainda não tiver).
   Clique com o botão direito em index.html e escolha "Open with Live Server".
4. Também pode executar, caso tenha Python instalado:
      python -m http.server 8000
   Depois abra no navegador:
      http://localhost:8000
5. É necessário internet para carregar Three.js pelo CDN e a fonte do Google. O projeto
   ainda não inclui as bibliotecas localmente.

CONTROLES
- W ou seta para cima: acelerar
- S ou seta para baixo: frear / marcha à ré
- A/D ou setas esquerda/direita: virar
- Espaço: usar nitro
- Esc: pausar / retomar
- R: reposicionar o kart na pista
- Celular: botões na tela

O QUE JÁ ESTÁ IMPLEMENTADO
- Cena 3D renderizada com Three.js
- Pista oval com superfície, bordas, linha central, grama, árvores e arquibancadas
- Kart do jogador construído com geometria 3D
- Cinco adversários com movimento automático
- Câmera de perseguição
- Aceleração, freio, ré, direção, nitro e perda de velocidade fora da pista
- Colisões simples entre karts
- Caixas de impulso que recarregam o nitro
- HUD com velocidade, volta, posição e nitro
- Contagem regressiva (os adversários só largam quando termina), pausa, reinício e tela de fim
- Controles de toque básicos para celular

LIMITAÇÕES CONHECIDAS DA VERSÃO 0.1
- A pista é oval genérica, não uma reprodução exata das pistas originais.
- Os personagens, carros, itens, efeitos sonoros e interface não são os assets oficiais.
- Física e inteligência artificial são simplificadas.
- A posição e a contagem de voltas ainda são simplificadas e podem precisar de ajustes adicionais.
- Não há multijogador online, menu de seleção de pista/personagem, nem salvamento.
- A tecla de nitro usa a barra de espaço; o item coletado aumenta o nitro.
- Os arquivos usam CDN externo para Three.js, portanto precisam de conexão à internet.

PRÓXIMA FASE SUGERIDA
Execute o site e teste primeiro:
1. Se o cenário 3D aparece corretamente.
2. Se o kart acelera e vira.
3. Se a câmera acompanha o kart.
4. Se a contagem de voltas funciona.
5. Se aparecem erros no console do navegador (F12 > Console).

Depois envie capturas de tela ou copie as mensagens de erro. Vamos corrigir a partir do que você encontrar.

Este projeto é uma recriação independente para fins de estudo. Para uma distribuição pública,
use apenas materiais próprios, autorizados ou que você tenha permissão para utilizar.
