#import "../template.typ": *

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Cria a ata da última reunião de elicitação, focada na Administração Central e Fiscalidade (com o Gerente Central). Discute os pormenores técnicos da arquitetura de sincronização noturna e a obrigatoriedade da geração rigorosa e inviolável do SAFT-PT mensal.
  ],
  analise: [
    A simulação desta reunião foi determinante para fechar o escopo legal do software. A estruturação gerada pela IA provou ao cliente (fictício) que as preocupações com o fisco e a centralização de dados ficariam cobertas pela arquitetura final (REQ-009, REQ-012).
  ],
)
#llm-end()

#heading(level: 3, outlined: false)[Ata de Reunião 3 - Levantamento de Requisitos: Administração Central e Fiscalidade]

*Data:* 18 de fevereiro de 2026 \
*Hora:* 14:00 – 15:30 \
*Local:* Sede da FlashStore (Braga) \
*Elaborado por:* Gonçalo Ribeiro (Coordenador de Desenvolvimento)

#heading(level: 4, outlined: false)[Participantes]
- Gonçalo Ribeiro (Coordenador de Desenvolvimento - FlashStore)
- Carlos Mendes (Diretor da Cadeia - Administração Central)

#heading(level: 4, outlined: false)[Ordem de Trabalhos]
- Automação da consolidação de dados das 8 lojas da cadeia.
- Escalabilidade do catálogo de produtos e gestão centralizada de preços.
- Geração de relatórios analíticos de suporte à decisão.
- Conformidade legal e integração com a Autoridade Tributária.

#heading(level: 4, outlined: false)[Resumo da Discussão]

*1. Consolidação Diária de Dados* \
A reunião foi dominada pela insatisfação do Diretor, Carlos Mendes, em relação ao modelo atual baseado em folhas de cálculo. O Diretor explicou que a consolidação manual de dados provenientes das várias lojas consome tempo excessivo e está minada de erros humanos.

Definiu-se como requisito fulcral que o novo sistema centralize a informação automaticamente. Para não sobrecarregar as ligações de rede durante os picos de vendas, acordou-se que cada loja enviará um resumo diário consolidado (vendas, fechos de caixa e movimentos de stock) à meia-noite para o servidor central (REQ-009).

*2. Gestão Centralizada e Escalabilidade* \
Carlos Mendes salientou que o modelo descentralizado atual gera inconsistências graves nos preços praticados. Exigiu que o núcleo central do software seja a única fonte de verdade para a criação de artigos, categorias e definição de preços.

O sistema terá de suportar um catálogo expansivo, atualmente com mais de 10.000 produtos distintos, garantindo que as pesquisas nos terminais das lojas se mantenham rápidas e sem lentidão (REQ-021).

Além disso, a administração central precisa de uma ferramenta para agendar promoções temporárias (ex: "Leve 2 Pague 1", descontos percentuais) que sejam ativadas automaticamente em todas as lojas nas datas definidas (REQ-013).

*3. Relatórios Estratégicos* \
O Diretor reforçou que precisa de "dados visíveis, não de palpites". O sistema central terá de dispor de um módulo analítico capaz de gerar relatórios comparativos de vendas entre as diferentes lojas da cadeia, permitindo filtrar por períodos de tempo (semanal, mensal) e por categoria de produto (REQ-020).

*4. Conformidade Legal e Fiscal (AT)* \
No âmbito da faturação, foi sublinhada a tolerância zero a falhas legais. O sistema, nas frentes de loja, tem de permitir a introdução de NIF para a emissão de faturas simplificadas (REQ-014).

A nível central, o software deve estar capacitado para gerar o ficheiro mensal obrigatório SAFT-PT (com agregação de vendas dos PDVs e máquinas de venda automática), pronto a ser submetido à Autoridade Tributária até ao dia 5 do mês seguinte (REQ-012).

#heading(level: 4, outlined: false)[Conclusões e Ações a Tomar]
- A equipa de desenvolvimento confirma que o modelo "Híbrido Descentralizado-Centralizado" é a solução arquitetural ideal para responder a todas estas exigências.
- As métricas de negócio e os fluxos centrais serão transcritos para os requisitos não-funcionais (escalabilidade, capacidade de armazenamento e segurança).
- Fica concluído o ciclo de simulação de entrevistas com os stakeholders.