#import "../template.typ": *

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Cria uma ata de reunião focada na Gestão de Inventário e Logística. Junta a perspetiva do Operador de Caixa e da Gerente de Loja. Aborda a transição do controlo manual em Excel para a atualização passiva de stock e a geração de alertas de validade.
  ],
  analise: [
    Este *prompt* permitiu documentar como a equipa técnica debateu as dores logísticas com os stakeholders de loja. A ata gerada sustenta perfeitamente a necessidade arquitetural de ligar o terminal de vendas ao inventário em tempo real (REQ-005, REQ-006, REQ-015).
  ],
)
#llm-end()

#heading(level: 3, outlined: false)[Ata de Reunião 2 - Levantamento de Requisitos: Gestão de Inventário e Logística]

*Data:* 12 de fevereiro de 2026 \
*Hora:* 09:00 – 10:30 \
*Local:* Microsoft Teams \
*Elaborado por:* José Lima e Eduardo Freitas (Equipa de Desenvolvimento)

#heading(level: 4, outlined: false)[Participantes]
- José Lima (Analista - FlashStore)
- Eduardo Freitas (Engenheiro de Software - FlashStore)
- Tiago Mendes (Operador de Caixa - Loja Sul)
- Sofia Almeida (Gerente de Loja - Loja Norte)

#heading(level: 4, outlined: false)[Ordem de Trabalhos]
- Sincronização e visibilidade do inventário em tempo real na loja.
- Definição de regras e alertas automáticos para prevenção de ruturas de stock.
- Controlo de produtos perecíveis e gestão de validades.
- Otimização do processo de receção de mercadorias de fornecedores diretos.

#heading(level: 4, outlined: false)[Resumo da Discussão]

*Visibilidade do Inventário e Atualização Contínua* \
A reunião começou com a exposição da Sofia Almeida sobre a falta de sincronia entre o que está na prateleira e o que está no sistema atual. Explicou que muitas vezes os clientes perguntam por um produto e o operador de caixa não sabe se existe mais em armazém.

Foi consensualizado que o novo sistema deve deduzir a quantidade vendida de forma automática e instantânea após cada venda (REQ-005). Além disso, o operador de caixa tem de conseguir consultar o stock atual de qualquer produto diretamente na interface do PDV (REQ-008), sem necessitar de se deslocar ao terminal de backoffice da gerência.

*Alertas de Rutura e Gestão de Validades* \
O Tiago Mendes partilhou a frustração de apoiar a reposição "às cegas" durante os turnos. Referiu que produtos de alta rotação, como refrigerantes ou tabaco, esgotam frequentemente sem que a equipa dê conta a tempo de repor a prateleira.

Ficou definido que o sistema deverá gerar um alerta visual no backoffice (e opcionalmente no PDV para o gerente) sempre que o stock de um artigo desça abaixo de um limite predefinido, exemplificando-se a marca de 10 unidades para bebidas (REQ-006).

Outro problema grave levantado pelo Tiago foi o desperdício de produtos perecíveis (lacticínios, sanduíches). O sistema atual não controla validades, obrigando a verificações manuais diárias. Foi exigido que, na entrada de produtos frescos, seja possível associar a data de validade do lote, devendo o sistema emitir alertas proativos de "validade próxima" (REQ-015).

*Receção de Mercadorias e Entrada de Faturas* \
A Sofia Almeida abordou o estrangulamento administrativo na receção de mercadorias. Como as lojas recebem entregas diretas dos fornecedores diariamente, o registo manual de cada artigo na folha de cálculo ou no sistema antigo consome horas.

A equipa de desenvolvimento propôs uma funcionalidade onde o gerente possa registar a entrada de mercadoria através da leitura da fatura do fornecedor (ou via importação de ficheiro digital fornecido pela marca), atualizando imediatamente o stock local sem dupla digitação (REQ-007).

#heading(level: 4, outlined: false)[Conclusões e Ações a Tomar]
- A equipa técnica compromete-se a desenhar fluxos de entrada de mercadoria que minimizem o input manual por parte da gerência.
- O módulo de gestão de stock deverá ter um *dashboard* específico para alertas de validade e de reposição, com indicadores de cor (verde, amarelo, vermelho) para rápida identificação visual.
- Estes pontos suportam diretamente a definição das User Stories da "Camada de Gestão de Produtos e Fornecedores".