#import "../template.typ": *

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Cria uma ata de reunião técnica simulando um encontro formal entre a Equipa de Desenvolvimento e os Operadores de Loja. A reunião deve consolidar as queixas da Entrevista 3 (Operação e PDV) em decisões técnicas preliminares. Menciona o modo offline, automatização de trocos e redução de cliques.
  ],
  analise: [
    A IA estruturou corretamente a ata, fazendo a ponte entre o levantamento empírico e a definição de soluções de engenharia. O registo formal em ata validou a inclusão dos requisitos operacionais (REQ-001 a REQ-004 e REQ-010, REQ-011) na nossa Tabela de Elicitação em Bruto.
  ],
)
#llm-end()

#heading(level: 3, outlined: false)[Ata de Reunião 1 - Levantamento de Requisitos: Operação de Loja e PDV]

*Data:* 10 de fevereiro de 2026 \
*Hora:* 10:30 – 12:00 \
*Local:* Microsoft Teams \
*Elaborado por:* Rui Castro e Diogo Cardoso (Equipa de Desenvolvimento)

#heading(level: 4, outlined: false)[Participantes]
- Rui Castro (Engenheiro de Software - FlashStore)
- Diogo Cardoso (Testador / Analista - FlashStore)
- João Costa (Funcionário de Caixa - Loja Rural)
- Mariana Silva (Gerente de Loja - Loja Centro/Urbana)

#heading(level: 4, outlined: false)[Ordem de Trabalhos]
- Apresentação dos objetivos da nova interface de Ponto de Venda (PDV).
- Análise da performance atual e identificação de constrangimentos no atendimento.
- Discussão sobre resiliência do sistema (conectividade e falhas de rede).
- Levantamento de necessidades para a gestão de turnos e fecho de caixa.

#heading(level: 4, outlined: false)[Resumo da Discussão]

*Performance e Usabilidade no Registo de Vendas* \
A reunião iniciou-se com a intervenção do João Costa, que relatou a enorme pressão sentida no atendimento durante as horas de ponta (especialmente no início da manhã e final da tarde). O João explicou que o sistema atual exige demasiados cliques (uso excessivo do rato) e que a leitura dos códigos de barras tem um *delay* que prejudica a fluidez.

Foi estabelecido como requisito crítico que a nova interface seja operável quase exclusivamente por atalhos de teclado ou ecrã tátil, e que o tempo de resposta entre a leitura do código e o registo do artigo no ecrã seja estritamente inferior a 2 segundos. Solicitou-se também a simplificação do processo de cancelamento de artigos durante uma venda em curso, que atualmente exige autorização do gerente para qualquer pequeno erro de digitalização.

*Pagamentos e Gestão de Trocos* \
A Mariana Silva alertou para as frequentes quebras de caixa devido a erros humanos no cálculo de trocos em pagamentos a dinheiro. Ficou definido que o novo PDV deve calcular automaticamente o troco exato a devolver ao cliente mal o operador insira o valor recebido.

Adicionalmente, foi reforçada a necessidade de integração direta com terminais de pagamento automático para suportar, de forma fluida, pagamentos via MB Way, cartões contactless e leitura de QR Codes.

*Resiliência Operacional (Modo Offline)* \
Um dos pontos mais debatidos foi a instabilidade da infraestrutura de rede. O João Costa referiu que, na loja rural, as falhas de internet são semanais, obrigando por vezes a fechar portas ou a anotar vendas em papel.

A equipa de desenvolvimento assegurou que o novo sistema terá uma arquitetura tolerante a falhas. O PDV funcionará de forma local e autónoma: em caso de quebra de ligação ao servidor central, o sistema entrará automaticamente em "Modo Offline", permitindo a continuidade das vendas e a emissão de faturas. A sincronização dos dados ocorrerá de forma invisível para o operador assim que a ligação for restabelecida, garantindo a unicidade das transações.

*Fecho de Caixa e Gestão de Turnos* \
A Mariana Silva descreveu o processo de fecho de turno atual como "caótico e demorado". Atualmente, o operador conta o dinheiro e o gerente tem de cruzar esse valor com os talões em papel.

Foi consensualizado que o novo sistema deve automatizar este processo (fecho "cego"): o sistema calculará o total esperado em gaveta baseando-se nas vendas registadas, o operador introduzirá os montantes físicos contados por tipo de moeda/nota, e o software gerará um relatório imediato destacando qualquer discrepância, registando a operação na base de dados com a assinatura digital (PIN) do utilizador ativo.

#heading(level: 4, outlined: false)[Conclusões e Ações a Tomar]
- A equipa técnica irá mapear estas necessidades em Requisitos Funcionais específicos (nomeadamente os REQ-001, REQ-002, REQ-003, REQ-010 e REQ-011 identificados na fase de elicitação).
- Serão desenvolvidos *mockups* (protótipos de ecrã) do novo PDV, focados na usabilidade e redução de cliques, para serem validados pelo João e pela Mariana numa próxima iteração.