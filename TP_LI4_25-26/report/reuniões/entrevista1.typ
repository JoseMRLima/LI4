Entrevista 1 — Gerente Central da Cadeia FlashStore
 
Entrevistado: Carlos Mendes (Gerente Central)
Entrevistador: Gonçalo Ribeiro, José Lima
Data: 10 de Fevereiro de 2026
Local: Sede da FlashStore, Braga
 
---
 
Contexto e Motivação
 
E: Bom dia, Carlos. Para começar, pode descrever como funciona atualmente a gestão de dados das oito lojas da cadeia?
 
C.M.: Bom dia. Atualmente, cada loja envia-me diariamente, ao fim do dia, um relatório em folha de cálculo — normalmente Excel — com as vendas do dia, o stock existente e as encomendas pendentes. Tenho uma pessoa que consolida esses ficheiros manualmente todas as manhãs. É um processo moroso, sujeito a erros, e que nos impede de ter uma visão em tempo real do que se passa em cada loja.
 
E: Quais são os maiores problemas que enfrenta com este processo atual?
 
C.M.: Os maiores problemas são três: primeiro, a demora — quando acordo de manhã, os dados de ontem ainda não estão consolidados. Segundo, a inconsistência — cada gestor de loja usa o ficheiro à sua maneira, e às vezes os dados chegam incompletos ou com erros de preenchimento. Terceiro, a falta de rastreabilidade — se há uma discrepância de stock, é muito difícil perceber onde aconteceu e quando.
 
---
 
Necessidades de Gestão Central
 
E: O que é que o sistema ideal deveria disponibilizar para si, enquanto gestor central?
 
C.M.: Quero um dashboard central onde consiga ver, de forma consolidada, as vendas de cada loja, o stock atual, os produtos com ruptura, e as encomendas pendentes. Preciso também de relatórios comparativos entre lojas — saber qual está a vender mais, quais têm os custos de reposição mais altos. E quero receber alertas automáticos quando alguma loja tem stock abaixo do mínimo definido.
 
E: Com que frequência precisaria de aceder a esses dados?
 
C.M.: Idealmente, a consolidação diária devia acontecer automaticamente ao fecho de cada loja, às 23h. Quero poder entrar no sistema às 07h30 da manhã seguinte e já ter os dados de todas as lojas do dia anterior. Mas também quero poder consultar dados em tempo real durante o dia, especialmente em situações de ruptura ou incidente.
 
E: Qual é a sua perspetiva sobre a gestão de fornecedores? O processo é centralizado ou cada loja trata das suas encomendas?
 
C.M.: Temos fornecedores nacionais, cujas encomendas faço eu centralmente para todas as lojas. Mas cada loja tem também alguns fornecedores locais, por exemplo para produtos frescos. Precisamos que o sistema suporte os dois modelos. As encomendas centrais devem poder ser distribuídas pelas lojas, e as locais devem ser registadas e visíveis para mim também.
 
---
 
Relatórios e Tomada de Decisão
 
E: Que tipo de relatórios usa atualmente para suportar a tomada de decisão?
 
C.M.: Uso relatórios de vendas mensais por loja, relatórios de margem por categoria de produto, e um relatório de gestão de stock que nos indica os produtos mais e menos vendidos. Tudo feito manualmente. O sistema devia gerar estes relatórios automaticamente, filtrando por loja, por período e por categoria de produto.
 
E: Existe alguma integração com sistemas externos, como faturação eletrónica ou a Autoridade Tributária?
 
C.M.: Sim, e este é um ponto crítico. Somos obrigados a usar software certificado pela AT e a gerar o ficheiro SAF-T mensalmente. Hoje fazemos isso com o software de caixa de cada loja, que depois exporta para o sistema central. O novo sistema tem de manter esta capacidade — a certificação pela AT é não negociável.
 
---
 
Requisitos Não Funcionais e Restrições
 
E: Do ponto de vista técnico, existem requisitos específicos que considera essenciais?
 
C.M.: Sim. O sistema de caixa de cada loja tem de funcionar offline. Já tive problemas com quedas de internet em lojas rurais — se o sistema parar, perdemos vendas. A sincronização pode ser feita ao fim do dia, mas durante o horário de funcionamento não posso depender da ligação. Em relação à segurança, preciso que cada utilizador só aceda ao que lhe compete — um caixa não precisa de ver os relatórios financeiros consolidados.
 
E: Algum requisito de desempenho específico?
 
C.M.: O registo de uma venda no PDV tem de ser instantâneo — menos de um segundo de resposta. Se a caixeira tiver de esperar, atrapalha o atendimento. Já na geração de relatórios complexos posso tolerar alguns segundos.
 
E: Para terminar, existe algo que não mencionámos e que considera importante para o sistema?
 
C.M.: Sim — a escalabilidade. Temos atualmente oito lojas, mas a nossa estratégia prevê abrir mais quatro nos próximos dois anos. O sistema tem de estar preparado para crescer sem necessitar de grandes reconfigurações. E quero também um histórico mínimo de dois anos de dados operacionais disponíveis para análise.
 
---
 
Requisitos Identificados:
- Dashboard central com dados consolidados de todas as lojas
- Consolidação automática diária às 23h00 (fecho de loja)
- Alertas automáticos de ruptura de stock
- Relatórios por loja, período e categoria de produto
- Gestão de fornecedores (central e local)
- Suporte a exportação SAF-T e certificação AT
- Modo offline para os terminais de loja
- Controlo de acesso por perfil de utilizador
- Desempenho PDV < 1 segundo por transação
- Escalabilidade para suportar até 12 lojas