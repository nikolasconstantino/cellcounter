# Contador de Células · versão 2.4

Aplicação de contagem diferencial desenvolvida por **Nikolas R. Constantino**.
HTML, CSS e JavaScript, sem dependências externas e sem etapa de compilação.

## Usar

Abra `index.html` ou acesse a página publicada. Clique/toque em uma célula ou pressione sua tecla para adicionar um registro. Para corrigir, use o botão **−**, **Shift + tecla** ou **Desfazer** (**Ctrl/⌘ + Z**). No toque, pressionar e segurar por 500 ms também subtrai; movimentar o dedo cancela o gesto.

As teclas dos cartões usam `<kbd>` em tamanho responsivo. A cada alteração registrada, **+1 verde** ou **−1 vermelho** sobe a partir do número da célula, inclusive ao desfazer. O botão de subtração tem fundo vermelho suave, intensificado ao passar o mouse e ao pressionar.

**Nova contagem** fica no painel de progresso, ao lado de **Pausar**, e mantém a confirmação antes de zerar os valores. A barra fica alinhada ao total numérico no computador e muda suavemente entre vermelho pastel, amarelo, azul, verde claro e verde mais escuro ao completar a meta. Em **Preferências → Cor conforme o progresso**, é possível desligar esse efeito e manter a cor fixa do tema. A escolha fica salva neste navegador e funciona nos temas claro e escuro.

As três metas do modo aparecem juntas no canto inferior direito, abaixo da grade, como indicadores em arco. No computador, os indicadores compactos aproveitam a faixa livre do rodapé sem reservar altura adicional ou reduzir a área dos cartões. Cada um mostra o total contado no centro, o alvo na abertura inferior e o progresso relativo àquela meta, com as mesmas cores da barra principal. Clique no indicador para selecionar uma meta; o contorno e o texto **Selecionada** identificam o alvo ativo. Uma troca com registros existentes exige confirmação e preserva a contagem. Metas abaixo do total contado ficam com o arco completo, mas não podem ser selecionadas.

Ao selecionar outra janela ou aba, o contador mostra **Janela sem foco** sobre a interface desfocada. Contar, corrigir e desfazer ficam bloqueados até o retorno à janela. Isso não altera a pausa salva nem fecha um diálogo em edição. O botão **ⓘ**, ao lado da ajuda, mostra os dados do autor e os links do Instagram e LinkedIn, também disponíveis no rodapé.

Escolha **Sangue periférico** ou **Medula óssea** no seletor do cabeçalho. Cada modo mantém sua própria contagem, histórico, meta, células, posições e teclas. Trocar de modo preserva a sessão anterior. A última escolha também fica salva no navegador.

No sangue periférico, as metas disponíveis são 100, 200 e 500 células, com 100 como padrão. **Eritroblastos não entram no total nem no denominador dos percentuais deste modo**, seguindo a regra da versão anterior. Na medula, as metas são 200, 500 e 1.000 células, com 500 como padrão; os quatro estágios eritrocíticos participam do total. Ao atingir a meta, novos registros do diferencial são bloqueados e a correção continua disponível. Células em contagem separada continuam disponíveis.

O resumo informa se a contagem está parcial ou concluída. Os percentuais usam o total efetivamente contado. É possível copiar o texto ou baixar CSV com separador `;`, decimais com vírgula e codificação UTF-8 com BOM.

## Células da medula óssea

O catálogo inicial reproduz as **29 categorias** da folha manual fornecida. Os campos clínicos e descritivos do formulário não foram convertidos em contadores.

| Série | Categorias | Quantidade |
| --- | --- | ---: |
| Granulocítica | Mieloblasto; promielócito, mielócito, metamielócito, bastonete e segmentado de cada linhagem: neutrofílica, eosinofílica e basofílica | 16 |
| Monocítica | Monócito e célula monocitoide | 2 |
| Eritrocítica | Proeritroblasto; eritroblasto basófilo, policromático e ortocromático | 4 |
| Linfo-plasmocitária | Linfócito, célula linfoide e plasmócito | 3 |
| Outras | Outras células, macrófago, mastócito e célula blástica | 4 |

Os cartões usam **N**, **Eo** e **Ba** antes do estágio de maturação para distinguir as três linhagens granulocíticas mesmo em tamanhos compactos. O nome completo aparece ao passar o mouse, no rótulo acessível, no resumo e no CSV. Mieloblasto e célula blástica permanecem em categorias distintas, como na folha.

Os macrófagos têm contagem separada e não entram no denominador diferencial; mastócitos e precursores eritrocíticos entram. A composição do diferencial segue as [diretrizes ICSH de 2008](https://islh.org/web/downloads/ICSH_Standards/ICSH_Guidelines_for_Bone_Marrow_Lee_Oct_2008.pdf), com os princípios de contagem revistos pela [orientação ICSH de 2026](https://doi.org/10.1111/ijlh.70214). A fotografia fornece as categorias, mas não especifica o denominador. “Outras células” foi mantida como categoria incluída; uma categoria personalizada pode ser criada como separada quando necessário.

O resumo da medula mostra subtotais por série e seus percentuais no diferencial. As contagens separadas aparecem abaixo da tabela. Não há classificação diagnóstica nem interpretação automática dos resultados.

## Organizar e adicionar células

1. Clique em **Editar células**. A contagem fica suspensa durante a edição.
2. Segure um cartão e arraste até a posição de outro. O cartão é elevado, os vizinhos se deslocam e uma área pontilhada mostra onde ele será colocado. Solte para salvar. **Esc** cancela o movimento; pelo teclado, foque o cartão e use **Alt + setas**.
3. Clique na tecla com o pequeno **lápis** para abrir **Editar célula**. É possível mudar o nome, o atalho e a cor de qualquer célula, incluindo as padrão. Nomes vazios, repetidos ou com mais de 40 caracteres são recusados. Se a tecla pertencer a outra célula, o diálogo informa o conflito e permite confirmar a troca das duas teclas. Nome, atalho e cor são salvos juntos.
4. Use o slot claro e pontilhado com **+**, no fim da grade, para adicionar uma célula. Informe o nome e selecione o campo pulsante de tecla: **pressione uma letra ou um número** para gravar o atalho. O campo é somente leitura e não aceita digitação livre nem colagem. Uma tecla ocupada provoca três piscadas vermelhas e um aviso que identifica a célula em conflito; pressione outra para continuar. No celular, use **Teclado na tela**. Escolha **Sim** ou **Não** em **Incluir na contagem global?**.
5. Clique em **Concluir edição** para voltar à contagem. Se a sessão estava pausada, ela continuará pausada.

Em **Editar células → Grupos e cores**, crie ou edite um grupo: informe o nome, escolha uma cor e marque as células participantes. A busca e **Selecionar visíveis** ajudam a selecionar várias células. O nome aparece apenas nesse gerenciamento; nos cartões, aparece uma faixa da cor escolhida no topo. Cada célula pode pertencer a um grupo; selecioná-la em outro grupo transfere sua participação. Os grupos iniciais da medula podem ser editados. Excluir um grupo mantém suas células e contagens. Essa organização visual não altera as séries do resumo nem as regras de contagem.

Os modais de criação e edição de célula oferecem uma paleta de cores, **Personalizar** e **Inserir código de cor**, que aceita HEX de três ou seis dígitos, com ou sem `#`. Uma cor individual tem prioridade sobre a cor do grupo. Selecione **Automática** para voltar a usar a cor do grupo ou o padrão do cartão. Grupos e cores são salvos separadamente para cada modo e permanecem ao iniciar outra contagem ou restaurar posições e atalhos.

Para **excluir**, use a **lixeira** do cartão durante a edição. É possível excluir células originais ou personalizadas. O diálogo mostra o nome e a quantidade de registros que será removida. Confirmar exclui o cartão, libera sua tecla, remove os registros dessa célula do histórico e recalcula o total e os percentuais. As demais contagens são preservadas. Cancelar mantém tudo. A exclusão permanece após recarregar e iniciar uma nova contagem; o outro modo não é afetado.

Nomes, posições, atalhos, células personalizadas e exclusões são salvos automaticamente neste navegador e continuam disponíveis nas próximas contagens. Mudar um nome, posição ou tecla não altera valores nem histórico. O novo nome aparece no cartão, no resumo e nas exportações; na medula, substitui também a abreviação do cartão. **Restaurar padrão** reorganiza posições e teclas, mantendo os nomes editados, as células personalizadas, as exclusões e os números contados. Cada modo mantém seus próprios nomes.

São aceitos nomes de até 40 caracteres e atalhos de uma letra (A–Z ou Ç) ou um número. Há 37 atalhos únicos por modo: até 37 células ativas. Sem excluir categorias originais, cabem 23 adicionais no sangue e 8 na medula. Excluir libera espaço e tecla para outra célula. **Shift + tecla** também funciona nos novos atalhos.

No computador, a grade usa a altura disponível da janela e ajusta colunas, espaçamento e tamanho dos cartões para manter todas as células visíveis durante a contagem. Nomes longos podem ser abreviados visualmente nos cartões compactos; o nome completo aparece ao passar o mouse e permanece disponível para leitores de tela. Em telas com menos de 800 px de largura, o layout mantém rolagem para preservar alvos de toque utilizáveis.

## Publicar no GitHub Pages

1. Extraia o ZIP.
2. Copie o **conteúdo** da pasta `cellcounter-main` para a pasta que seu repositório já publica pelo GitHub Pages. Substitua os arquivos existentes e inclua também `session.js`, `color-picker.js` e `color-picker.css`.
3. Preserve `index.html`, `style.css`, `color-picker.css`, `color-picker.js`, `counter.js`, `layout.js`, `editor.js`, `session.js`, `script.js`, `icon.svg` e `sounds/finish.mp3` na estrutura fornecida. Os caminhos são relativos e funcionam também em páginas de projeto (`/cellcounter/`).
4. Faça commit/push e aguarde a publicação habitual. A pasta `tests` e este README são opcionais na publicação.

Não é necessário executar `npm install`, configurar servidor de aplicação ou alterar o endereço do site.

## Sessões e preferências

- A sessão, a organização das células e as preferências ficam no `localStorage` deste navegador; não são sincronizadas entre dispositivos.
- Contagens existentes (`cellCounterState_v2` e `cellCounterState_v3`) e a organização da versão 2.1 são migradas para sangue periférico. Valores, histórico, células personalizadas e atalhos válidos são preservados. As chaves antigas são mantidas como cópia de migração, sem serem usadas depois que existe uma sessão nova salva.
- Sessões anteriores também são atualizadas para permitir renomeação, grupos e cores individuais, preservando contagem, histórico, modo, exclusões, posições e teclas. As cores tradicionais da medula tornam-se grupos editáveis.
- Cada modo grava contagem e organização juntas em uma única entrada. Assim, uma exclusão não deixa um catálogo antigo capaz de fazer a célula reaparecer após recarregar.
- Ao reabrir com uma contagem salva, a entrada fica suspensa até escolher continuar ou iniciar outra.
- O histórico guarda até 1.000 operações de contagem/alteração de meta e permite desfazer após recarregar.
- Ações no mesmo modo em outra aba fazem a interface pedir revisão antes de continuar. O salvamento confere se a sessão mudou para evitar sobrescrever uma versão mais recente.
- Falhas de armazenamento aparecem na tela. O aviso ao sair só é acionado se houver alterações ainda não salvas.
- Limpar os dados do navegador remove a sessão e as personalizações. Para guardar um resultado independentemente do navegador, copie ou baixe o CSV.
- Tema automático, claro ou escuro; controle de volume; som por registro opcional e aviso de conclusão. O aviso final mantém o arquivo de áudio original.

## Estrutura

- `index.html`: interface, diálogos e ícones.
- `style.css`: temas e adaptação a diferentes telas.
- `counter.js`: modelo da contagem, grupos e cores, validação, histórico, atalhos e exportação.
- `color-picker.js` e `color-picker.css`: seletor compartilhado com paleta, cor personalizada e código HEX.
- `layout.js`: células personalizadas, validação de teclas, ordem e dimensões da grade.
- `editor.js`: arraste por mouse/toque, animação, cancelamento e organização pelo teclado.
- `session.js`: sessões independentes, migração e gravação conjunta da contagem e da organização.
- `script.js`: interação, áudio e persistência.
- `sounds/finish.mp3`: aviso final original.
- `tests/*.cjs`: testes sem dependências adicionais.

## Verificação

Com Node.js 18 ou superior:

```sh
node --test tests/*.cjs
```

Os 118 testes cobrem o catálogo da folha, as regras da medula e do sangue, limites de contagem, células personalizadas, exclusão e liberação de teclas, correções, desfazer, pausa, metas, migração, restauração, percentuais, CSV e dimensões da grade. O controlador de arraste usa eventos e geometria simulados. A integração da interface com armazenamento e eventos também é verificada: alternância de modos, inclusão, exclusão, renomeação, confirmação, recarga, conflito entre abas, falha de armazenamento, captura de teclas, conflitos, duração dos indicadores, cores progressivas, seleção e progresso simultâneo das metas bloqueio por falta de foco, criação e edição de grupos, transferência de participantes, prioridade de cores individuais, cor automática, paleta e códigos HEX. Esses testes não substituem a inspeção visual em um navegador.

A interface usa botões nativos para Enter/Espaço, suspende atalhos enquanto um diálogo ou o editor está aberto e respeita a preferência do sistema por movimento reduzido.
