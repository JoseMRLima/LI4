#import "../template.typ": *

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Atua como uma Gestora de Loja da FlashStore (unidade urbana). Vamos fazer um Role-playing. Foca-te nos problemas diários que tens com a gestão de inventário, o atrito na reposição de prateleiras e o desperdício gerado pela falta de controlo de produtos perecíveis.
  ],
  analise: [
    Através desta entrevista simulada, conseguimos justificar a urgência da modernização do backoffice local. O modelo levantou problemas muito específicos, como a necessidade de ter alertas automáticos de validade e controlo rigoroso das entradas de mercadoria, que serviram de base aos nossos requisitos de stock.
  ],
)
#llm-end()

Entrevista 2 — Gestora de Loja (Unidade Urbana)
 
Entrevistada: Ana Ferreira (Gestora da Loja FlashStore — Braga Centro)
Entrevistador: Eduardo Freitas, Diogo Cardoso
Data: 12 de Fevereiro de 2026
Local: Loja FlashStore Braga Centro
 
---
 
Operação Diária da Loja
 
E: Ana, pode descrever como começa um dia típico na loja?
 
A.F.: Chego cedo, antes das 7h. A primeira coisa que faço é verificar o fecho de caixa do dia anterior — confirmar se os valores batem certo com as vendas registadas. Depois faço uma ronda pelas prateleiras para identificar os produtos em falta e preparo uma lista de reposição. Às 7h quando abre a loja já tem de estar tudo pronto.
 
E: Como gere atualmente o stock e as encomendas?
 
A.F.: Faço isso manualmente, com uma folha de inventário que eu própria criei no Excel. Tenho os produtos listados com as quantidades mínimas que defini com base na experiência. Quando vejo que um produto está a chegar ao mínimo, faço a encomenda por telefone ou por e-mail ao fornecedor. É completamente manual e muito dependente da minha memória e experiência.
 
E: Quais são os principais problemas que enfrenta neste processo?
 
A.F.: A principal dificuldade é a falta de tempo. No meio do atendimento ao público e da gestão da equipa, não tenho tempo para fazer inventários frequentes. Às vezes chegamos a uma situação de ruptura sem ter dado conta. Outro problema é que, no meio da confusão, faz-se a reposição de prateleiras mas não se comunica o que entrou no armazém — acabo com dados incorretos na minha folha.
 
---
 
Gestão de Inventário e Reposição
 
E: O que esperaria de um sistema de gestão de inventário integrado no FlashStore?
 
A.F.: Queria que o sistema atualizasse automaticamente o stock quando uma venda é registada no PDV. E que me mostrasse, em tempo real, os produtos abaixo do mínimo. Queria também poder fazer encomendas diretamente no sistema, com histórico das encomendas anteriores para comparar preços e quantidades.
 
E: Como é feita atualmente a receção de mercadorias?
 
A.F.: Eu ou a caixeira recebemos as caixas, conferimos com a nota de encomenda, e depois vou registando na minha folha Excel o que entrou. O problema é que quando há discrepâncias entre o que encomendei e o que veio, não fica registo formal disso. Queria que o sistema permitisse registar a entrada de stock com uma nota da diferença relativamente à encomenda, para ter rastreabilidade.
 
E: Existe algum processo de fecho de caixa ao fim do dia?
 
A.F.: Sim. Às 23h o caixa conta o dinheiro em caixa, fecha a sessão no terminal atual, e preenche um formulário físico com os totais por forma de pagamento. Eu depois confirmo esses valores contra os do terminal. Queria que este processo fosse digital e automatizado — o sistema devia calcular os totais e eu só confirmar.
 
---
 
Perfis de Utilizador e Acessos
 
E: Quantas pessoas trabalham consigo na loja e o que é que cada uma faz?
 
A.F.: Temos dois turnos. Cada turno tem uma caixeira e eu como gerente apoio a operação logística. As caixeiras só precisam de aceder ao PDV para registar vendas e processar pagamentos. Eu, como gestora, preciso de acesso a tudo — registar entradas de stock, relatórios, encomendas, fechos de caixa e controlo de inventário.
 
E: Tem alguma necessidade específica em termos de relatórios a nível da loja?
 
A.F.: Preciso de ver as vendas do dia por produto e por categoria, os produtos mais vendidos para perceber o que devo encomendar mais, e o relatório de fecho de caixa. Também queria um relatório de discrepâncias de stock — quando o stock real não coincide com o que está no sistema.
 
---
 
Integração e Conectividade
 
E: A loja tem ligação à internet estável?
 
A.F.: Temos fibra, mas já houve cortes. Uma vez ficámos três horas sem internet e foi um caos porque o terminal de caixa parou. O sistema tem obrigatoriamente de funcionar sem internet — é fundamental para o nosso modelo de negócio.
 
E: Há algum sistema existente que o novo sistema deva integrar ou substituir?
 
A.F.: Usamos um software de caixa antigo, que já não é suportado pelo fornecedor. O novo sistema deve substituí-lo completamente. Temos também um leitor de código de barras por loja que espero que continue a funcionar com o novo sistema.
 
---
 
Requisitos Identificados:
- Atualização automática de stock após cada venda no PDV
- Alertas de stock mínimo por produto
- Registo de entrada de mercadorias com comparação à encomenda
- Registo formal de discrepâncias na receção de stock
- Processo digital e automatizado de fecho de caixa
- Relatórios de vendas diárias por produto e categoria (nível loja)
- Relatório de discrepâncias de inventário
- Perfis diferenciados: Caixa, Gestor de Loja
- Funcionamento offline do terminal de ponto de venda
- Compatibilidade com leitores de código de barras existentes