#import "cover.typ": cover
#import "template.typ": *

#show: project
#set par(first-line-indent: (amount: 1.5em, all: true))


#cover(
  title: "Grupo 29 - FlashStore",
  authors: (
    (name: "Gonçalo Ribeiro", number: "a106842"),
    (name: "Diogo Cardoso", number: "A106924"),
    (name: "Eduardo Freitas", number: "A106923"),
    (name: "José Lima", number: "A106888"),
    (name: "Rui Castro ", number: "A100753"),
  ),
  string_date: "Maio, 2026",
)

#set page(numbering: "i", number-align: center)
#counter(page).update(1)

#heading(numbering: none, outlined: false)[Resumo]
O presente relatório descreve o desenvolvimento do sistema FlashStore, um sistema integrado de gestão para uma cadeia de lojas de conveniência com oito pontos de venda distribuídos pelo distrito de Braga. O trabalho foi realizado no âmbito da Unidade Curricular de Laboratórios de Informática IV (LI4), da Licenciatura em Engenharia Informática da Universidade do Minho, no ano letivo 2025/2026.

A motivação para o projeto surgiu da necessidade de digitalizar e centralizar operações até então descentralizadas e manuais, abrangendo a gestão de vendas, stocks, produtos, fornecedores, promoções e turnos de caixa. O sistema foi desenvolvido segundo um ciclo de vida sequencial e incremental, com integração sistemática de Large Language Models (LLMs) em todas as fases — desde a elicitação de requisitos e geração de user stories, passando pelo design de arquitetura e implementação modular, até à verificação, validação e avaliação de qualidade.

A solução resultante assenta numa arquitetura cliente-servidor com suporte a modo offline nos terminais de loja (via Electron), sincronização diária com um servidor central (Node.js/Express), e uma interface de backoffice em React para gerentes e administradores. O sistema contempla ainda conformidade legal com o formato SAFT-PT, auditoria de operações e geração de relatórios. O estado final do projeto corresponde a um protótipo funcional com cobertura de testes e avaliação de qualidade segundo a norma ISO/IEC 25010.

\

*Área de Aplicação*: Desenvolvimento e Engenharia de Software Assistida por Inteligência Artificial; Sistemas de Informação para Gestão de Cadeias de Lojas de Conveniência.

\
*Palavras-Chave*: Sistemas de Ponto de Venda (PDV), Gestão de Stock, Sincronização Offline, Arquitetura Cliente-Servidor, API REST, Node.js, React, Electron, SQLite, PostgreSQL, Large Language Models (LLM), Engenharia de Requisitos, Casos de Uso, Modelo de Domínio, SAFT-PT, ISO/IEC 25010, Testes de Software, DevOps.

#show outline: it => {
    show heading: set text(size: 18pt)
    it
}

#{
  show outline.entry.where(level: 1): it => {
    v(5pt)
    strong(it)
  }

  outline(
    title: [Índice], 
    indent: 1em, 
  )
}

#v(-0.4em)
#outline(
  title: none,
  target: figure.where(kind: "attachment"),
  indent: n => 1em,
)

#outline(
  title: [Lista de Figuras],
  target: figure.where(kind: image),
)

#outline(
  title: [Lista de Tabelas],
  target: figure.where(kind: table),
)

// Make the page counter reset to 1
#set page(numbering: "1", number-align: center)
#counter(page).update(1)
#set heading(numbering: none)

// -----------------------------------------------------------------------------
// SECÇÕES PRÉVIAS (SEM NUMERAÇÃO DE CAPÍTULO PARA NÃO ESTRAGAR O CAPÍTULO 1)
// -----------------------------------------------------------------------------

#heading(numbering: none)[Introdução]

#heading(numbering: none, outlined: false, level: 2)[Prompt] // coloquei isto para nao aparecer a numerçao nos prompts para nao ficar sujo o trabalho

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Estamos a desenvolver um sistema de gestão integrada para uma cadeia de lojas de conveniência chamada FlashStore. Precisamos de identificar os principais casos de uso do sistema, considerando os seguintes atores: Operador de Caixa, Gestor de Loja, Administrador Central e Fornecedor. Para cada ator, lista os casos de uso mais relevantes, organizados por prioridade.
  ],
  analise: [
    O modelo identificou corretamente os quatro atores e gerou uma lista abrangente de casos de uso. Contudo, alguns casos de uso estavam demasiado granulares, misturando operações de baixo nível com funcionalidades de negócio. Além disso, o Fornecedor foi tratado como ator primário quando deveria ser secundário, dado que a sua interação com o sistema é indireta. Foi necessário reorganizar e consolidar alguns casos de uso.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Reformula os casos de uso tendo em conta o seguinte: o Fornecedor é um ator secundário e não interage diretamente com o sistema. Consolida os casos de uso demasiado granulares num nível de abstração mais adequado. Apresenta o resultado numa tabela com as colunas: Ator, Caso de Uso, Prioridade (Alta/Média/Baixa) e Descrição Breve.
  ],
  analise: [
    A segunda iteração produziu uma tabela bem estruturada com 14 casos de uso distribuídos pelos três atores principais. O nível de abstração ficou mais adequado e a remoção do Fornecedor como ator primário foi corretamente aplicada. A tabela serviu de base para a elaboração do Diagrama de Casos de Uso, com pequenos ajustes manuais pela equipa.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 3,
  prompt: [
    Com base nos casos de uso definidos, gera agora o código PlantUML para o Diagrama de Casos de Uso completo. Inclui as relações de include e extend onde aplicável. O diagrama deve refletir a separação entre o sistema local de cada loja e o sistema central.
  ],
  analise: [
    O modelo gerou código PlantUML funcional com a separação correta entre os dois subsistemas. No entanto, abusou das relações de extend em situações onde include seria mais apropriado, e alguns casos de uso secundários foram omitidos. A equipa corrigiu as relações incorretas e adicionou os casos de uso em falta antes de incorporar o diagrama no relatório.
  ],
)
#llm-end()


== Contextualização e Ciclo de Vida

#heading(numbering: none, outlined: false, level: 2)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Somos uma equipa de estudantes de engenharia informática a desenvolver um sistema de gestão integrada para uma cadeia de pequenas lojas de conveniência chamada FlashStore, em Braga. O sistema visa centralizar a gestão de vendas, stocks, produtos e fornecedores de 8 lojas distribuídas pelo distrito, que atualmente operam de forma autónoma e descentralizada, consolidando a informação diariamente num sistema central.

    Precisamos que escrevas uma contextualização para o relatório deste projeto. A contextualização deve responder às seguintes questões de forma coorente e integrada, sem recorrer a tópicos ou subtítulos: qual o setor de atividade e as suas características; como surgiu a FlashStore e qual a sua situação atual; como funciona hoje (de forma manual e descentralizada) e quais os problemas que isso causa; e o que motivou o desenvolvimento deste sistema. Inventa detalhes coerentes que enriqueçam a narrativa. O texto deve ser corrido, denso e adequado a um relatório académico, com no máximo 3 parágrafos.
  ],
  analise: [
    O ChatGPT produziu um texto bem estruturado, com o tom académico pretendido e sem recorrer a tópicos. O resultado foi satisfatório e, após pequenos ajustes de coerência interna pela equipa, foi integrado diretamente no relatório como contextualização do projeto.
  ],
)
#llm-end()

O presente projeto foi desenvolvido no âmbito da Unidade Curricular de Laboratórios de Informática IV (LI4), integrada na Licenciatura em Engenharia Informática da Universidade do Minho, no ano letivo 2025/2026.

Esta unidade curricular tem como principal objetivo proporcionar uma experiência prática e integrada de desenvolvimento de software, cobrindo todas as fases do ciclo de vida de um sistema, desde a análise de requisitos até à validação final. O projeto segue uma abordagem sequencial e incremental, inspirada em modelos clássicos de engenharia de software como o modelo Waterfall e o V-Model, enriquecida com práticas modernas de desenvolvimento, nomeadamente DevOps e desenvolvimento assistido por inteligência artificial.

Um dos elementos centrais desta edição da unidade curricular é a integração sistemática de Large Language Models (LLM) ao longo de todas as fases do ciclo de vida do software. Estes modelos são explorados não apenas como geradores de código, mas como agentes cognitivos de apoio à Engenharia de Requisitos, ao design de arquitetura, à revisão de código e à geração de testes. Esta abordagem visa familiarizar os estudantes com um paradigma de desenvolvimento que se torna cada vez mais presente no mercado profissional, onde o engenheiro de software assume um papel estratégico de avaliação crítica e governação, delegando tarefas repetitivas e cognitivamente intensivas a agentes artificiais.

=== Tema do Trabalho Prático
O presente trabalho corresponde ao *Tema 1 — Sistema de gestão integrada para uma cadeia de pequenas lojas de conveniência*, conforme definido no enunciado da unidade curricular. O sistema de software a desenvolver neste tema tem como objetivo apoiar a gestão de uma cadeia de pequenas lojas de conveniência, através da implementação de meios e estruturas adequadas para o registo e processamento centralizado dos dados das vendas, produtos, stocks e fornecedores, de cada uma das lojas. Tem-se em conta que cada uma das lojas da cadeia atua de forma autónoma, mas a sua informação deverá ser, todos os dias, ao fim do dia, consolidada num sistema central de dados para suporte a processos de análise de dados. O sistema a implementar deverá disponibilizar serviços para a gestão e controlo de inventário, reposição de produtos nas lojas, faturação e geração de relatórios de gestão, por loja, por período e por categoria de produto, de forma que seja possível apoiar adequadamente os processos de tomada de decisão e operacionais da cadeia de lojas.

== Apresentação do Caso de Estudo

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Estamos a fazer um relatório académico sobre o desenvolvimento de um sistema de gestão para a FlashStore, uma cadeia de 8 lojas de conveniência em Braga (Braga Centro, Gualtar, Guimarães, Barcelos, Póvoa de Lanhoso, Vila Nova de Famalicão, Esposende e Vizela), fundada em 2014. Cada loja funciona das 07h00 às 23h00 com dois colaboradores (caixa e gerente) de forma autónoma, e a consolidação diária é feita manualmente pelo gerente central via folhas de cálculo e relatórios.

    Precisamos de uma secção de "Apresentação do Caso de Estudo", sem tópicos nem subtítulos, com no máximo 4 parágrafos. Cobre a origem da empresa, distribuição das lojas, modelo operacional, gestão central e o que motivou o projeto. Podes inventar detalhes que façam sentido.
  ],
  analise: [
    O modelo produziu um texto coeso que cobriu todos os pontos pedidos.
  ],
)
#llm-end()

Como base para o desenvolvimento do sistema, foi considerado o caso de estudo da FlashStore. A *FlashStore* é uma cadeia regional de lojas de conveniência sediada em Braga e fundada em 2014 por empreendedores locais com larga experiência em comércio. Atualmente, a rede é composta por 8 lojas estrategicamente distribuídas pelo distrito de Braga, localizadas em: Braga Centro, Gualtar, Guimarães, Barcelos, Póvoa de Lanhoso, Vila Nova de Famalicão, Esposende e Vizela.

Este caso de estudo insere-se no domínio do comércio a retalho distribuído, onde múltiplas unidades operacionais funcionam de forma relativamente autónoma, mas necessitam de mecanismos de integração de informação para garantir consistência, controlo e capacidade analítica ao nível global.

O modelo operacional da FlashStore foi concebido para maximizar a conveniência ao cliente enquanto controla rigorosamente os custos fixos. Cada loja funciona com atendimento presencial das 07h00 às 23h00, contando com uma equipa reduzida de dois colaboradores: um caixa responsável pelo atendimento e registo de vendas, e um gerente encarregado da gestão local, reposição de produtos e organização das prateleiras. Às 23h00 a loja encerra as suas portas ao público, encerrando as operações do dia.

A nível de gestão global, existe um gerente central na sede da empresa em Braga que possui visão consolidada de toda a rede. Embora este responsável tenha acesso aos dados de todas as oito lojas, atualmente a consolidação dessa informação continua a ser feita de forma manual e demorada, através do envio diário de relatórios e folhas de cálculo por cada unidade. O problema central associado a este tipo de sistemas prende-se com a necessidade de conciliar dois requisitos fundamentais: por um lado, assegurar o funcionamento contínuo e independente de cada unidade local; por outro, garantir a recolha, integração e tratamento centralizado dos dados gerados, de forma estruturada e consistente. 

Foi precisamente esta combinação entre um modelo operacional inovador e uma gestão ainda fragmentada que motivou o desenvolvimento do sistema FlashStore.

#pagebreak()


== Estrutura do Relatório
O presente relatório está organizado da seguinte forma:
- O Capítulo "Organização e Planeamento do Projeto" descreve os recursos humanos, stakeholders, recursos materiais e plano de execução com gestão de risco.
- O Capítulo 1 detalha todo o processo de Conceção e Engenharia de Requisitos Assistida por LLM, incluindo a elicitação de requisitos, user stories, especificação de casos de uso e modelo de domínio.
- O Capítulo 2 foca-se na Arquitetura e Design do Software, apresentando as decisões arquiteturais, a stack tecnológica, os diagramas UML e a especificação da API.
- O Capítulo 3 documenta a Implementação e Desenvolvimento Assistido por LLM, descrevendo a configuração do ambiente, a decomposição modular e o processo de code reviewing e refactoring.
- O Capítulo 4 apresenta a Verificação, Validação e Avaliação da Qualidade do software, com testes unitários, de integração e de aceitação, análise de cobertura e métricas ISO/IEC 25010.
- Por fim, o relatório apresenta as conclusões e o trabalho futuro, seguido das referências, lista de siglas e anexos.

#set heading(numbering: "1.1.")
#counter(heading).update(0)


= Definição de Domínio do Sistema

== Contextualização

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Com base no contexto do projeto já estabelecido, redige a secção "Contextualização" do capítulo de Definição de Domínio. O foco deve ser o domínio técnico e operacional do sistema — não a empresa em si, que já foi apresentada. Aborda: as características do setor do retalho de conveniência multi-loja (rotação, volume, transações de baixo valor); a dualidade entre operação local autónoma e centralização de dados; e as obrigações legais e fiscais portuguesas que condicionam a implementação. Três parágrafos, tom académico e técnico, sem introduções genéricas.
  ],
  analise: [
    O modelo produziu um texto tecnicamente denso e bem estruturado, com o nível de abstração adequado ao capítulo de definição de domínio. A referência às obrigações legais (AT e SAFT-PT) foi integrada de forma coerente com as restrições já identificadas. A equipa ajustou a transição entre os dois primeiros parágrafos para reforçar a relação de causalidade entre o modelo operacional e os requisitos de integração.
  ],
)
#llm-end()

A FlashStore é uma cadeia regional de lojas de conveniência que opera num setor caracterizado por elevada rotação de produtos, transações de baixo valor unitário e elevado volume, e necessidade de gestão eficiente de informação distribuída. Com 8 lojas distribuídas pelo distrito de Braga, cada uma em funcionamento das 07h00 às 23h00, a empresa enfrenta os desafios típicos de uma rede de retalho em crescimento.

Cada loja funciona de forma autónoma no seu dia-a-dia, com uma equipa reduzida e hardware local para registo de vendas, visualização de stock e faturação. No entanto, a ausência de um sistema integrado obriga atualmente a uma consolidação manual e demorada da informação, feita através do envio diário de relatórios e folhas de cálculo entre as unidades e a sede. Este modelo torna-se progressivamente insustentável à medida que a cadeia cresce, comprometendo a capacidade de análise e decisão da gestão central.

O domínio de intervenção do sistema a desenvolver abrange, portanto, duas esferas indissociáveis: a operação local de cada loja, com foco na fiabilidade e velocidade das transações, e a gestão centralizada da cadeia, assente na consolidação diária e análise dos dados de todas as unidades. A esta realidade acrescem obrigações legais e fiscais específicas do contexto português, nomeadamente a certificação do software de faturação pela Autoridade Tributária e a geração do ficheiro SAFT-PT, que condicionam diretamente as escolhas de implementação do sistema.

== Fundamentação

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Queremos desenvolver texto para a "Fundamentação". Queremos dar a entender que o crescimento da empresa trouxe novas dificuldades para atender à grande procura, e que os responsáveis pela empresa sentiram essas discrepâncias. Fala sobre possíveis problemas: escalabilidade, dificuldade de armazenamento de grandes quantidades de dados, problemas de otimização (perdas de tempo evitáveis), etc. Escreve a fundamentação.
  ],
  analise: [
    O texto gerado era correto mas excessivamente vago, sem foco claro nos problemas concretos da nossa cadeia de lojas. Pedimos uma nova reformulação mais concisa e direta.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Sê mais conciso, vai mais direto ao ponto. Os problemas identificados e a sua necessidade de resolução devem ser o foco central do texto. Elimina as introduções genéricas.
  ],
  analise: [
    A segunda iteração produziu um texto mais direto ao ponto. A equipa ajustou a organização dos problemas em três categorias distintas: volume de dados, escalabilidade e ineficiência operacional, para facilitar a demonstrabilidade com os requisitos definidos nas secções seguintes.
  ],
)
#llm-end()

A nossa equipa identificou que o crescimento da FlashStore, traduzido no aumento do número de lojas e do volume diário de transações, expôs fragilidades significativas no modelo de gestão atual. O que inicialmente funcionava para uma estrutura de pequena dimensão tornou-se progressivamente inadequado face à complexidade operacional crescente.

Registámos três categorias principais de problemas: (1) o volume de dados gerado diariamente sem integração automática, (2) a falta de escalabilidade quando a empresa cresce e (3) a ineficiência operacional causada pela duplicação de tarefas e pela ausência de informação em tempo real. Estas limitações comprometem a eficiência, aumentam o risco operacional e condicionam o crescimento futuro da empresa. Por isso, decidimos desenvolver uma solução que centralize a informação, suporte o aumento contínuo de dados e otimize os processos internos.

#pagebreak()

== Objetivos

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Com base nos problemas identificados, define os objetivos do nosso sistema. Alguns exemplos: gestão centralizada de produtos e fornecedores; geração de relatórios analíticos por loja, por período, etc.; gestão de stock e controlo de inventário; registo estruturado das vendas. Escreve um texto completo com os principais objetivos do software, importantes, generalizados, com pouca técnica mas objetiva e clara.
  ],
  analise: [
    O texto devolvido era completo mas desorganizado, apresentando os objetivos em texto corrido, provavelmente pelo que foi pedido anteriormente, sem distinção clara entre eles. A leitura tornava-se difícil e os objetivos individuais perdiam-se no texto. Foi solicitada uma reestruturação com recurso a tópicos.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Reorganiza o texto: os objetivos devem estar claramente evidenciados em tópicos. Mantém uma frase introdutória e uma frase de conclusão em texto corrido, mas o corpo central deve ser uma lista de objetivos concisos e bem delimitados.
  ],
  analise: [
    A segunda iteração produziu uma estrutura clara, com introdução, lista de objetivos e conclusão. Os objetivos foram revistos pela equipa em relação aos princípios de engenharia de requisitos (Sommerville, Cap. 4 — Requirements Engineering), nomeadamente para garantir que cada objetivo era verificável e rastreável para requisitos concretos nas secções seguintes. Foram também ajustados para refletir a arquitetura híbrida local-central definida para o sistema.
  ],
)
#llm-end()
O principal objetivo deste projeto consiste no desenvolvimento de um sistema de software capaz de suportar a gestão integrada de uma cadeia de lojas de conveniência, assegurando simultaneamente a autonomia operacional das unidades locais e a centralização da informação relevante para análise global.

De forma geral, pretende-se criar uma solução que permita recolher, organizar e processar dados provenientes de múltiplas fontes, garantindo a sua consistência, disponibilidade e utilidade ao longo do tempo. Mais especificamente, o sistema deverá:

- suportar o registo estruturado das operações realizadas em cada unidade, de forma organizada, fiável e consistente;
- permitir a gestão eficiente de informação associada a produtos, vendas e inventário (reduzindo ruturas e excessos);
- possibilitar o encerramento diário das operações com geração automática de relatórios de suporte à gestão da loja;
- assegurar a integração periódica e automática dos dados (vendas agregadas e movimentos de stock) num sistema central;
- manter uma base de dados estruturada para produtos, categorias e fornecedores, garantindo coerência em toda a cadeia;
- disponibilizar mecanismos de consulta e geração de relatórios analíticos (por loja, por período e por categoria de produto);
- apoiar os processos de monitorização e tomada de decisão estratégica da gestão;
- garantir capacidade de evolução, escalabilidade e resiliência da solução para suportar a integração de novas lojas;
- desenvolver o software com uma arquitetura modular, código estruturado e documentação completa.

O objetivo final consiste em criar uma infraestrutura tecnológica estruturada, escalável e preparada para acompanhar a expansão futura da FlashStore, assegurando um modelo organizacional eficiente e sustentável.

#pagebreak()

== Viabilidade

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Justifica a viabilidade do nosso software com base em números realistas que inventas. Compara os custos atuais da empresa com o investimento no software: tarefas administrativas manuais, erros, ruturas de stock, tempo perdido. Além da componente financeira, aborda também os ganhos de tempo, otimização de recursos e qualidade de decisão. Usa comparações diretas para tornar os ganhos evidentes.
  ],
  analise: [
    O modelo dividiu a análise por categorias de ganho em tópicos separados, o que fragmentava a argumentação. Foi pedida uma versão condensada.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Sumariza tudo num único parágrafo. Os números devem estar integrados no texto, sem tópicos.
  ],
  analise: [
    A segunda iteração produziu um parágrafo coeso com os valores financeiros bem integrados. A equipa pediu ainda uma tabela comparativa "antes vs. depois" para complementar a análise textual com uma leitura mais imediata dos ganhos esperados.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 3,
  prompt: [
    Cria uma tabela comparativa simples com duas colunas — "Situação Atual" e "Com o Sistema" — que resuma os principais ganhos de forma visual e direta.
  ],
  analise: [
    A tabela gerada foi validada e integrada como complemento ao parágrafo de viabilidade, permitindo uma leitura rápida dos principais benefícios do sistema.
  ],
)
#llm-end()

A nossa equipa realizou uma análise financeira que demonstra que o projeto é viável. Atualmente, as 8 lojas despendem cerca de 64 horas semanais em tarefas administrativas manuais (custo anual superior a 27 000 €) e perdem aproximadamente 2 % do volume de vendas por ruturas de stock (cerca de 24 000 €/ano). O investimento estimado (35 000–45 000 €) mais manutenção anual (6 000–8 000 €) pode ser recuperado em aproximadamente um ano. Além dos ganhos económicos, o sistema reduz erros humanos, elimina duplicações e fornece informação consolidada para uma tomada de decisão mais rápida e fundamentada.

#figure(
  caption: "Comparação entre a situação atual e a solução proposta",
  kind: table,
  table(
    columns: (2fr, 2fr, 2fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Indicador*], [*Situação Atual*], [*Com o Sistema*],
    [Horas administrativas/semana], [~64 horas], [~10 horas],
    [Perdas por rutura de stock], [~24 000 €/ano], [~4 000 €/ano],
    [Consolidação de dados], [Manual, demorada], [Automática, diária],
    [Erros de registo], [Frequentes], [Minimizados],
    [Acesso a relatórios], [Dia seguinte (manual)], [Imediato],
  )
)

== Recursos Humanos e Stakeholders

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Gemini",
  iteracao: 1,
  prompt: [
    Para o relatório da FlashStore, lista os stakeholders divididos em internos (Administração central, Gestores de loja, Funcionários e Equipa técnica) e externos (Fornecedores, Clientes finais e Entidades reguladoras). Apresenta em bullet points com uma breve justificação da responsabilidade ou impacto de cada um.
  ],
  analise: [
    A lista gerada identificava corretamente os atores mas as descrições eram superficiais e genéricas,não explicavam como cada stakeholder interage especificamente com o software. Mais relevante, a definição implícita usada pelo modelo era demasiado ampla:* tratava como stakeholder qualquer entidade afetada pelo sistema, incluindo os clientes finais. O docente alertou para uma distinção fundamental da Engenharia de Requisitos: um stakeholder relevante para a especificação de software é aquele que tem capacidade de influenciar ou validar requisitos, não simplesmente quem é afetado pelo sistema em produção*. Com base nesta distinção, os clientes finais foram reclassificados como utilizadores indiretos sem impacto na especificação, e a equipa técnica foi reconhecida como stakeholder interno com papel ativo na validação arquitetural. Foi pedida uma nova iteração com descrições mais detalhadas e tecnicamente fundamentadas.
  ],
)
#llm-block(
  modelo: "Gemini",
  iteracao: 2,
  prompt: [
    Expande cada ponto detalhando como cada stakeholder interage diretamente com as funcionalidades do sistema: por exemplo, emissão do SAFT-PT para as Entidades Reguladoras, uso do PDV para os Funcionários. As descrições devem ser técnicas e específicas ao software que estamos a desenvolver.
  ],
  analise: [
    A segunda iteração produziu descrições tecnicamente mais ricas e específicas ao software. O resultado foi revisto pela equipa com base nos princípios de identificação de stakeholders de Sommerville (Cap. 4), tendo sido ajustada a descrição das Entidades Reguladoras para refletir as obrigações legais e fiscais do contexto português identificadas na análise de contexto, e a da Equipa Técnica para incluir o acesso a logs de auditoria e métricas de sincronização.
  ],
)
#llm-end()

Para a concretização do sistema de gestão integrada da FlashStore e para garantir que este responde às reais necessidades do negócio, é fundamental identificar a equipa de projeto alocada ao seu desenvolvimento, bem como todos os intervenientes (*stakeholders*) que irão interagir ou ser afetados pelo sistema.



=== Identificação de Stakeholders
Identificam-se os principais *stakeholders* do sistema, agrupados pelo seu papel operacional e pela sua relação direta ou indireta com o projeto de software. A identificação exaustiva destes atores é uma etapa crítica na Engenharia de Requisitos, uma vez que diferentes *stakeholders* apresentam frequentemente perspetivas distintas e requisitos potencialmente conflituosos.

==== Stakeholders Internos
- *Administração central da cadeia*: Utilizadores do módulo centralizado de gestão. São responsáveis pela tomada de decisões estratégicas, definição de preços e promoções, gestão global do catálogo de produtos e análise de desempenho corporativo através da consolidação diária de dados.
- *Gestores de loja*: Responsáveis pela operação e saúde operacional de cada espaço físico. Interagem com o sistema local para monitorizar os níveis de stock, validar fechos de caixa, registar discrepâncias, gerir turnos e supervisionar a receção de mercadorias.
- *Funcionários de loja (Operadores de Caixa)*: Utilizadores intensivos e diretos do ponto de venda (PDV). Dependem de uma interface rápida, intuitiva e tolerante a falhas (com suporte offline) para o registo ágil de vendas e consulta de inventário em tempo real.
- *Equipa técnica e de suporte*: Responsáveis pela implementação, manutenção, monitorização e evolução do sistema. Necessitam de acesso a logs de auditoria, métricas de sincronização entre as lojas e o servidor central, e ferramentas para gestão da infraestrutura cloud e local.

==== Stakeholders Externos
- *Fornecedores / Representantes*: Intervenientes essenciais na cadeia de abastecimento. Interagem indiretamente com o sistema através da receção de notas de encomenda (geradas manual ou automaticamente) e no fornecimento de catálogos e faturas que alimentam as entradas de stock.
- *Clientes finais*: Embora não interajam de forma direta com o software de gestão de retaguarda, são altamente afetados pela sua eficiência. Beneficiam da rapidez de processamento no PDV e da correta disponibilidade de stock nas lojas.
- *Entidades reguladoras (ex: Autoridade Tributária e CNPD)*: Impõem restrições legais e fiscais incontornáveis ao sistema. A Autoridade Tributária (AT) exige que o software seja certificado e capaz de exportar fidedignamente o ficheiro SAFT-PT (Standard Audit File for Tax - Portugal). A Comissão Nacional de Proteção de Dados (CNPD) exige o cumprimento do RGPD (Regulamento Geral sobre a Proteção de Dados) no tratamento de dados de clientes, funcionários e fornecedores.

== Recursos Materiais

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Gemini",
  iteracao: 1,
  prompt: [
    Para o nosso relatório, precisamos de uma secção de "Recursos Materiais" que liste e descreva brevemente os recursos tecnológicos e de infraestrutura necessários para o desenvolvimento e operação do sistema. Inclui: sistema de gestão de base de dados, ambiente de desenvolvimento integrado, ferramentas de gestão do projeto e infraestrutura de hardware (servidor central e terminais locais nas lojas). Apresenta em tópicos com uma breve descrição de cada um.
  ],
  analise: [
    O modelo gerou uma lista clara e bem estruturada, cobrindo os recursos essenciais. As descrições eram genéricas mas adequadas para uma secção introdutória de planeamento. A equipa ajustou a descrição da infraestrutura de hardware para refletir a arquitetura híbrida local-central definida para o sistema, nomeadamente a necessidade de terminais locais em cada uma das 8 lojas com sincronização diária para o servidor central.
  ],
)
#llm-end()
- *Sistema de gestão de base de dados -* Plataforma responsável pelo armazenamento estruturado, seguro e escalável da informação relativa a vendas, stocks, produtos e fornecedores.
- *Ambiente de desenvolvimento integrado -* Ferramenta utilizada para programação, testes e integração dos diferentes módulos do sistema.
- *Ferramentas de apoio à gestão do projeto -* Soluções para planeamento de tarefas, controlo de prazos, acompanhamento do progresso e documentação, promovendo organização e eficiência ao longo do ciclo de desenvolvimento.
- *Infraestrutura de hardware -* Recomenda-se a utilização de um servidor central dedicado, físico ou em ambiente cloud, responsável pela consolidação diária dos dados das lojas. Em cada uma das 8 lojas deverão existir terminais locais adequados à execução do sistema, assegurando ligação segura ao servidor central para sincronização diária da informação.

== Equipa de Trabalho (Recursos Humanos)
O projeto será desenvolvido e acompanhado por uma equipa técnica externa, em estreita articulação com os responsáveis internos da empresa. 

=== Pessoal Interno
- *Direção e Equipa da FlashStore*: Inclui gerentes de loja e responsáveis administrativos da sede, responsáveis por informar o que pretendem da aplicação, colaborar na identificação de necessidades, validar o sistema e fornecer feedback contínuo.
- *Responsável interno pelo projeto*: Elemento da gestão que atuará como interlocutor principal entre a empresa e a equipa de desenvolvimento, garantindo o alinhamento estratégico, a validação de decisões e o acompanhamento da evolução do projeto.

=== Pessoal Externo (Equipa de Desenvolvimento)
A equipa externa, composta por cinco elementos, é a responsável pela análise de requisitos, modelação do sistema, desenvolvimento da aplicação, implementação da base de dados e realização de testes:

#figure(
  caption: "Equipa externa do projeto",
  kind: table,
  table(
    columns: (1.3fr, 2.2fr, 2.2fr, 1.8fr),
    align: center + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*Número*], [*Nome*], [*Função*], [*Fotografia*],

    [A106842], [Gonçalo Ribeiro], [Coordenador], [#image("images/goncalo.png", width: 2.2cm)],
    [A100753], [Rui Castro], [Engenheiro de Software], [#image("images/rui.png", width: 2.2cm)],
    [A106888], [José Lima], [Analista], [#image("images/jose.png", width: 2.2cm)],
    [A106923], [Eduardo Freitas], [Engenheiro de Software], [#image("images/eduardo.png", width: 2.2cm)],
    [A106924], [Diogo Cardoso], [Testador], [#image("images/diogo.png", width: 2.2cm)],
  )
)

#pagebreak()

== Plano de Execução e Gestão de Risco

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Estamos a desenvolver um sistema de gestão para uma cadeia de 8 lojas de conveniência (enviei o projeto até á altura em anexo). Precisamos de um texto para a secção "Plano de Execução e Gestão de Risco" que descreva brevemente o plano de calendarização (com referência a milestones e deliverables) e identifique os principais riscos do projeto com as respetivas estratégias de mitigação. Baseia-te no Ch22 Project management e Ch23 Project planning do Sommerville que te enviámos.
  ],
  analise: [
    O modelo identificou corretamente os riscos típicos de projetos de software desta dimensão e estruturou bem as estratégias de mitigação. No entanto, os riscos gerados eram demasiado genéricos e não refletiam as especificidades do nosso contexto. A equipa selecionou os dois riscos mais relevantes para o projeto — alteração de requisitos e indisponibilidade de membros — e ajustou as mitigações para refletir a nossa abordagem concreta, nomeadamente o envolvimento contínuo de stakeholders e a rotação de tarefas para evitar single points of failure.
  ],
)
#llm-end()

#figure(
  caption: "Diagrama de Gantt da Fase 1",
  kind: image,
  image("images/GanttFase1.png", width: 110%)
)

#figure(
  caption: "Diagrama de Gantt da Fase 2",
  kind: image,
  image("images/GanttFase2.png", width: 110%)
) \

#figure(
  caption: "Diagrama de Gantt da Fase 3",
  kind: image,
  image("images/GanttFase3.png", width: 110%)
) \

#figure(
  caption: "Diagrama de Gantt da Fase 4",
  kind: image,
  image("images/GanttFase4.png", width: 110%)
) \

Os diagramas de Gantt apresentados ilustram a calendarização das atividades previstas. Para garantir um controlo rigoroso do progresso, o plano inclui marcos de controlo (*milestones*) relevantes, tais como a conclusão da fase de elicitação de requisitos e a finalização da modelação do sistema. Em paralelo, estão definidos entregáveis (*deliverables*) concretos a submeter à avaliação, nomeadamente o Documento de Especificação de Requisitos (SRS) e os diagramas estruturais e comportamentais (UML).

=== Gestão de Risco
Reconhecendo as incertezas inerentes ao desenvolvimento de software, o planeamento contempla uma abordagem preliminar de gestão de risco. Foram identificados dois riscos principais com impacto direto no calendário e nos recursos:
- *Alteração ou indefinição de requisitos*: A necessidade de ajustes funcionais solicitados pela direção da FlashStore durante o desenvolvimento. Para mitigar este risco, promover-se-á um envolvimento contínuo dos *stakeholders* nas fases iniciais e a adoção de um desenho arquitetural flexível.
- *Indisponibilidade de membros da equipa*: Doenças ou impedimentos temporários. Como estratégia de contingência, a equipa fomentará a partilha de conhecimento e a rotação de tarefas, assegurando que nenhum módulo fica dependente de um único programador (*single point of failure*), além de se prever margem de contingência temporal nas estimativas das tarefas.





== Definição do domínio do sistema

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Gemini",
  iteracao: 1,
  prompt: [
    Vamos escrever a secção "Definição do domínio do sistema". Com base no contexto que já temos, define o domínio do projeto FlashStore: o retalho de conveniência multi-loja. Refere o foco na operação diária dos pontos de venda (processos transacionais como vendas e stock) e a consolidação de dados na sede para gestão (análise de desempenho, reposição).
  ],
  analise: [
    O texto gerado estava correto e ia direto ao ponto, mas demasiado curto e genérico para o nível de profundidade exigido. Pedimos uma expansão que detalhasse melhor a diferença e interligação entre as duas vertentes do domínio: a operação local e a visão estratégica centralizada.
  ],
)
#llm-block(
  modelo: "Gemini",
  iteracao: 2,
  prompt: [
    Expande o texto anterior. Detalha melhor a separação entre as duas esferas do domínio: operação local descentralizada (PDV, stock, fecho de caixa) e gestão centralizada (análise de desempenho, fornecedores, promoções) e explica como a sua interligação impõe requisitos de domínio estritos que condicionam a arquitetura do sistema.
  ],
  analise: [
    A segunda iteração produziu um texto com maior qualidade técnica e académica, estruturando claramente a parte operacional do domínio.
  ],
)
#llm-end()

O domínio de intervenção do sistema FlashStore enquadra-se no setor do retalho de conveniência multi-loja. Este domínio caracteriza-se por um ambiente de negócio de elevada rotação, o que exige operações de ponto de venda (PDV) extremamente ágeis, contínuas e preparadas para lidar com um volume elevado de transações diárias.

Do ponto de vista operacional e de negócio, o domínio divide-se em duas esferas indissociáveis:

A Operação Local (Descentralizada): Centrada na interação direta com o cliente final e na gestão imediata do espaço físico. Engloba processos transacionais críticos, como o registo rápido de vendas, a gestão local e imediata de inventário e o fecho de caixa. Neste contexto, o domínio exige resiliência, uma vez que o atendimento e as operações diárias não podem ser interrompidos.

A Gestão Centralizada (Estratégica): Focada na supervisão global da cadeia de lojas e assente na consolidação diária de dados. Ao nível da gestão, o domínio envolve processos analíticos e de suporte à decisão, como a análise de desempenho por loja, a gestão unificada de fornecedores, o controlo centralizado de preços e promoções (garantindo a uniformidade da oferta e o alinhamento comercial em toda a cadeia) e o apoio logístico à reposição de produtos.

Por fim, a natureza deste domínio implica rigorosos requisitos de consistência, integridade e rastreabilidade da informação. Uma vez que as decisões estratégicas de negócio e a conformidade legal e fiscal da cadeia dependem diretamente dos dados recolhidos, o sistema deve garantir que o fluxo de informação entre os pontos de venda e o sistema central seja fiável e ininterrupto.

Esta dupla natureza do negócio impõe um conjunto estrito de *requisitos de domínio*, ou seja, restrições e características inalienáveis do próprio ambiente de operação (como o elevado volume de transações diárias e a necessidade de fecho de caixa estruturado) que limitam as escolhas de implementação e que condicionam fortemente a arquitetura do sistema a desenvolver.

== Análise de Contexto e Restrições

=== Análise de Contexto


#heading(numbering: none, outlined: false, level: 4)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Com base no que já temos do projeto, escreve a secção "Análise de Contexto" do sistema FlashStore. Descreve o ambiente híbrido descentralizado-centralizado em que o sistema opera, o contexto operacional de cada loja (dimensão, horário, funcionários, tipo de clientes, condições de rede) e o contexto técnico e de integração (hardware local, núcleo central, sincronização).
  ],
  analise: [
    O modelo produziu um texto bem organizado mas demasiado longo e com subtítulos intermédios que não faziam parte da estrutura pretendida. A equipa ajustou a descrição das condições de conectividade para refletir explicitamente o impacto nas lojas rurais, fator determinante para a restrição R05.
  ],
)
#llm-end()

O sistema da Flash Store opera num ambiente híbrido descentralizado–centralizado, modelo seguido pelas maiores franquias de lojas de conveniência do mundo.

Cada loja física funciona de forma autónoma no dia a dia, realizando transações de venda rápida, gestão local de stock e fecho de caixa. No entanto, ao final de cada dia operacional, ocorre uma consolidação automática obrigatória dos dados críticos (vendas agregadas, movimentos de stock, entradas de mercadoria e relatórios básicos) para um núcleo central da cadeia. Este núcleo suporta processos analíticos e de suporte à decisão estratégica, como otimização de reposição, análise de desempenho por loja/período/categoria de produto e negociação com fornecedores.

*Contexto Operacional:*

As lojas são pequenas (100–150 m2), com horário de funcionamento das 07h00 às 23h00. Existem poucos funcionários por turno (1–2 pessoas), muitos com formação técnica limitada, o que implica uma interface do funcionário fácil de usar e resistente a erros. A maior parte dos clientes efetua compras unitárias e de baixo valor (snacks, bebidas, tabaco, lotarias). As condições de operação são variáveis, pois são afetadas por internet instável em localizações rurais e picos de movimento ao longo do dia.

*Contexto Técnico e de Integração:*

Cada loja tem hardware local: computador, leitor de códigos de barras, impressora fiscal e terminal de pagamento (Multibanco, MB Way, cartão). Existe um núcleo central (servidor cloud) que recebe, ao fim do dia, os dados atualizados de cada loja: vendas totais, stock atualizado, relatórios básicos. A sincronização não precisa ser em tempo real, mas deve ser fiável e automática.

*Fronteiras do Sistema, Atores e Interações Principais:*

Para a elaboração do Diagrama de Contexto, é imperativo definir a fronteira do sistema. O sistema FlashStore a desenvolver engloba tanto os terminais de Ponto de Venda (PDV) locais como o Núcleo Central cloud. Assim, os atores que se encontram no exterior desta fronteira e que interagem diretamente com o sistema são:

- *Funcionário e Gerente de Loja*: Interação direta através da interface do PDV e backoffice local para registo de vendas, consulta de stock e fecho de turno.
- *Cliente Final*: Interação direta com o ponto de venda durante o horário de funcionamento da loja, beneficiando da rapidez de atendimento e da disponibilidade de stock.
- *Fornecedores / Representantes*: Receção de pedidos automáticos ou manuais e envio de mercadorias, faturas e catálogos.
- *Hardware PDV*: Comunicação bidirecional com leitores de código de barras e impressoras fiscais (telemetria e comandos de execução).
- *Gateway de Pagamentos (MB Way/Visa/Mastercard)*: Serviço externo acionado para confirmação e autorização de transações em tempo real.
- *Autoridade Tributária (AT)*: Entidade externa reguladora para a qual o sistema exporta os ficheiros SAFT-PT de faturação.
- *Administrador*: Interação com o servidor central através de análise de dados e modificações de promoções e preços do sistema.

#figure(
  caption: "Diagrama de Contexto do Sistema Flash Store",
  kind: image,
  image("images/DiagramaContexto.png", width: 80%)
)

=== Restrições

#heading(numbering: none, outlined: false, level: 4)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Cria uma tabela com as principais restrições para o sistema FlashStore. Para organizares as categorias, baseia-te na matéria dos nossos slides "Ch4 Req Eng.pptx" do Sommerville (requisitos de produto, organizacionais e externos). Faz só a tabela com ID, Categoria, Restrição e Impacto.
  ],
  analise: [
    O ChatGPT seguiu a estrutura dos slides e dividiu bem as restrições técnicas e operacionais. O problema é que, na parte dos requisitos externos, ele deu exemplos muito genéricos e esqueceu-se que o nosso projeto é em Portugal, não colocando as leis fiscais obrigatórias.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Refaz a tabela, mas tens de focar mais nos requisitos externos do contexto português: certificação da Autoridade Tributária e envio do SAFT-PT. Além disso, de acordo com o que demos nos slides "Ch14 Resilience engineering.pptx", adiciona a restrição de a loja ter de funcionar offline por causa das falhas de internet.
  ],
  analise: [
    Nesta segunda vez a resposta já veio certa. O modelo incluiu o modo offline (resiliência) e meteu as leis portuguesas do SAFT-PT e da AT que eram obrigatórias. A tabela final ficou exatamente com o que precisávamos e passou direto para o relatório.
  ],
)
#llm-end()

#figure(
  caption: "Restrições identificadas",
  kind: table,
  table(
    columns: (0.9fr, 1.5fr, 2.3fr, 2.8fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*ID*], [*Categoria*], [*Restrição*], [*Justificação / Impacto no Sistema*],

    [R01], [Legal / Regulatória],
    [Software de faturação deve ser certificado pela Autoridade Tributária (AT)],
    [Obrigatório para programas que processam faturas em Portugal.],

    [R02], [Legal],
    [Envio obrigatório do ficheiro SAFT-PT de facturação até ao dia 5 do mês seguinte],
    [Regra fiscal; deve agregar todas as vendas registadas no PDV.],

    [R03], [Legal],
    [Conformidade total com RGPD],
    [Tratamento de dados pessoais (clientes com NIF em faturas, fornecedores, funcionários).],

    [R04], [Técnica / Desempenho],
    [Tempo máximo de resposta no PDV < 2 s por transação],
    [Necessidade de atendimento rápido.],

    [R05], [Técnica],
    [Suporte a operação offline parcial nas lojas, com sincronização automática quando online],
    [Falhas de Internet são comuns, especialmente em localizações rurais; as lojas devem continuar a operar em modo offline em caso de falha de ligação.],

    [R06], [Técnica],
    [Capacidade mínima para gerir > 10.000 produtos distintos por loja],
    [Diversidade elevada típica do segmento (snacks, bebidas, tabaco).],

    [R07], [Operacional],
    [Consolidação diária obrigatória dos dados ao fecho do dia],
    [Alimenta relatórios e análises centrais.],

    [R08], [Segurança],
    [Autenticação obrigatória por utilizador (PIN/cartão) + registo auditável de operações sensíveis],
    [Prevenção de fraudes internas (caixa, stock).],

    [R09], [Implementação],
    [Solução económica e escalável (custos de hardware/licenças limitados por loja)],
    [Cadeia de pequenas lojas → margens baixas; impacto na escolha de tecnologias.],
  )
)

#pagebreak()

== Revisão e Aprovação

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Tens acesso ao nosso documento de planeamento inicial do projeto FlashStore. Atua como revisor técnico e valida o documento nas seguintes métricas: clareza e coerência na definição do domínio e contexto operacional; adequação da identificação de stakeholders face às boas práticas de Engenharia de Requisitos; completude das restrições identificadas; e consistência entre os objetivos definidos e os problemas fundamentados. Identifica lacunas ou inconsistências relevantes.
  ],
  analise: [
    O Claude validou positivamente a estrutura geral do documento e a coerência entre a fundamentação, os objetivos e as restrições identificadas. Apontou que a descrição do contexto operacional poderia detalhar melhor as condições de conectividade nas lojas rurais, o que foi incorporado na secção de restrições (R05). No geral, o documento foi considerado conforme com os objetivos definidos para esta fase do projeto.
  ],
)
#llm-end()


A presente secção regista o processo formal de revisão e aprovação do documento, assegurando que o conteúdo foi verificado pelos responsáveis competentes antes da sua submissão. A revisão incidiu sobre a correção, completude e consistência interna do documento, em particular no que respeita à especificação do domínio, à identificação de stakeholders, à análise de contexto e restrições, e ao plano de execução do projeto.

#figure(
  caption: "Registo de Revisão e Aprovação do Documento",
  kind: table,
  table(
    columns: (2.0fr, 2.2fr, 1.6fr, 1.6fr, 1.6fr),
    align: center + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*Nome*], [*Função*], [*Papel na Revisão*], [*Data*], [*Estado*],

    [Gonçalo Ribeiro], [Coordenador], [Autor / Revisor principal], [02/03/2026], [Aprovado],
    [Rui Castro], [Engenheiro de Software], [Revisor], [02/03/2026], [Aprovado],
    [José Lima], [Analista], [Revisor], [02/03/2026], [Aprovado],
    [Eduardo Freitas], [Engenheiro de Software], [Revisor], [02/03/2026], [Aprovado],
    [Diogo Cardoso], [Testador], [Revisor], [02/03/2026], [Aprovado],
  )
)

Após revisão conjunta por todos os membros da equipa de desenvolvimento, o documento foi considerado conforme com os objetivos definidos para a Etapa 1 do projeto, estando aprovado para submissão.

#pagebreak()


= Capítulo 1 - Conceção e Engenharia de Requisitos Assistida por LLM

Conforme recomendado no Capítulo 4 de Sommerville ("Requirements Engineering"), o processo de elicitação de requisitos deve iniciar-se com a descoberta e compreensão do domínio e do contexto organizacional antes de se avançar para a extração de requisitos específicos. Para a FlashStore, a nossa abordagem inicial combinou a Análise de Documentos físicos existentes e a realização de Simulações de Entrevistas com Stakeholders (*Role-playing*). A análise dos documentos permitiu-nos compreender as limitações dos formulários atuais, enquanto as simulações forneceram o contexto humano e as dores de negócio reais.

== Elicitação de Requisitos

=== Análise de Documentos e Simulação de Entrevistas

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Cria um resumo para a secção inicial de Elicitação de Requisitos baseada na descoberta de requisitos (Sommerville Ch4). Precisamos de ligar a Análise de Documentos (Anexos A e B) e as Simulações de Entrevistas/Atas de Reunião (Anexos C a H) como a nossa base de trabalho antes da geração dos requisitos. Explica que primeiro analisámos as folhas de Excel atuais e depois ouvimos cada pessoa (Gerente, Gestora e Caixa) em simulações (Role-playing). Faz a ligação com os problemas identificados que darão origem aos IDs REQ-001, etc.
  ],
  analise: [
    O modelo conseguiu cruzar a informação documental com as entrevistas individuais e as decisões tomadas nas reuniões de grupo. Isto é fundamental para a "Rastreabilidade", pois prova que os requisitos não foram inventados, mas sim extraídos das necessidades reais que os stakeholders relataram e das limitações dos documentos físicos (Anexos A e B) validadas nas simulações.
  ],
)
#llm-end()

De forma a garantir que as reais necessidades do negócio fossem capturadas, a equipa seguiu o processo de Elicitação sugerido por Sommerville (Ch4), combinando a análise de documentos existentes com sessões de entrevistas individuais e *role-playing*. Este processo permitiu transformar processos manuais obsoletos e queixas operacionais em requisitos concretos:

*1. Análise de Documentos (Anexos A e B)*
Analisámos a Folha de Fecho de Caixa (papel) e a Folha de Controlo de Stock em Excel. Identificou-se que o fecho manual demora 15 minutos e está sujeito a erros de transcrição, e que a folha de Excel gera conflitos de versão e desfasamentos de stock. Isto fundamentou a necessidade de automatizar o fecho de caixa, categorizar discrepâncias e forçar a atualização de stock em tempo real.

*2. Operação de Loja (Entrevista H + Reunião C)*
Na **Entrevista H**, o Operador de Caixa explicou a dificuldade com o cálculo mental de trocos e as frequentes quebras de rede rural. Na **Reunião C**, simulámos o atendimento em hora de ponta e decidimos que o sistema tinha de ter um modo offline parcial e cálculo automático de trocos. 
- *Impacto na Elicitação:* Gerou necessidades críticas como registo transacional ultrarrápido, pagamentos integrados e resiliência offline (REQ-001, REQ-010, REQ-011).

*3. Gestão de Inventário (Entrevista G + Reunião D)*
A Gestora de Loja, na **Entrevista G**, queixou-se de perder horas a cruzar as vendas com o Excel de inventário e da perda de produtos fora de validade. Na **Reunião D**, acordámos que o módulo de stock tinha de ser atualizado passivamente a cada venda e despoletar alertas automáticos no backoffice.
- *Impacto na Elicitação:* Gerou necessidades como atualização imediata, alarmística de rutura e controlo de validade de perecíveis (REQ-005, REQ-006, REQ-015).

*4. Administração Central (Entrevista F + Reunião E)*
O Gerente Central (Carlos Mendes) explicou na **Entrevista F** que precisa de dados consolidados fidedignos de toda a cadeia para efeitos fiscais e analíticos. Na **Reunião E**, focámos nos desafios de infraestrutura da sincronização à meia-noite e na geração estrita e inviolável do SAFT-PT.
- *Impacto na Elicitação:* Gerou necessidades primárias como sincronização diária assíncrona, centralização em cloud e certificação legal AT (REQ-009, REQ-012, REQ-020).

#pagebreak()

=== Tabela de Requisitos Iniciais

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Com base na Análise de Documentos e nas Simulações de Entrevistas realizadas, cria a tabela inicial de elicitação com cerca de 20 requisitos para a FlashStore. Utiliza a abordagem baseada em pontos de vista (viewpoints) do Sommerville (Ch4). Cria a tabela com ID, Descrição, Área, Data, Responsável (o nosso grupo) e o Stakeholder que o originou. Podes introduzir requisitos propositadamente redundantes ou vagos (ex: "atualizar stock sempre"), para simular um levantamento em bruto que será refinado posteriormente.
  ],
  analise: [
    A IA compreendeu o contexto prévio das reuniões e aplicou bem a abordagem de pontos de vista, garantindo que as queixas dos operadores de caixa geraram requisitos diferentes das exigências do gerente central. A inclusão intencional de redundâncias na tabela espelha a realidade de um levantamento de requisitos em bruto, justificando plenamente a secção seguinte de refinamento e resolução de conflitos.
  ],
)
#llm-end()

A extração de requisitos a partir do conhecimento recolhido nas simulações e documentos é uma etapa iterativa. Para organizar a informação obtida na fase de descoberta, elaborou-se a seguinte grelha de requisitos em bruto. O foco inicial foi capturar as necessidades sem preocupação excessiva com a terminologia formal de software.

Cada requisito foi associado à sua área de utilização e ao stakeholder que o originou na respetiva sessão. A presença de requisitos redundantes propostos por diferentes pessoas (por exemplo, a insistência no desconto imediato de stock quer pelo gerente quer pelo operador de caixa) reflete as áreas de maior atrito operacional na FlashStore atual. Este registo não estruturado serve como base para o refinamento de ambiguidades, conforme documentado nas secções subsequentes.

#figure(
  caption: "Requisitos Levantados – Fase de Elicitação em Bruto",
  kind: table,
  table(
    columns: (1.1fr, 3.6fr, 1.6fr, 1.8fr, 1.3fr, 2.0fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*ID*], [*Descrição do requisito*], [*Área de utilização*], [*Data e hora do levantamento*], [*Responsável*], [*Colaborador / Stakeholder*],

    [REQ-001], [Registar venda rápida com leitura de código de barras ou introdução manual do preço], [PDV / Caixa], [10/02/2026 10:45], [Rui Castro], [Funcionário de caixa – Loja Centro],
    [REQ-002], [Permitir cancelamento imediato de artigo na venda em curso], [PDV / Caixa], [10/02/2026 11:10], [Rui Castro], [Funcionário de caixa – Loja Centro],
    [REQ-003], [Fechar caixa no final do turno com contagem automática e registo de discrepâncias], [PDV / Caixa], [11/02/2026 14:30], [Gonçalo Ribeiro], [Gerente – Loja Norte],
    [REQ-004], [Gerar relatório diário de vendas por caixa e por funcionário], [Relatórios / Loja], [11/02/2026 15:15], [Gonçalo Ribeiro], [Gerente – Loja Norte],
    [REQ-005], [Atualizar stock automaticamente após cada venda (deduzir quantidade vendida)], [Gestão de stock], [12/02/2026 09:20], [José Lima], [Gerente – Loja Sul],
    [REQ-006], [Alertar quando stock de produto chega abaixo de 10 unidades (ex: refrigerantes)], [Gestão de stock], [12/02/2026 10:05], [José Lima], [Gerente – Loja Sul],
    [REQ-007], [Registar entrada de mercadoria com leitura de fatura/fornecedor e atualização de stock], [Gestão de stock / Receção], [13/02/2026 11:40], [Eduardo Freitas], [Gerente – Loja Centro],
    [REQ-008], [Consultar stock atual de qualquer produto diretamente no PDV], [PDV / Caixa], [14/02/2026 10:55], [Diogo Cardoso], [Funcionário de caixa – Loja Este],
    [REQ-009], [Enviar automaticamente resumo diário de vendas e stock para a administração central após o fecho diário da loja], [Sincronização central], [14/02/2026 14:20], [Diogo Cardoso], [Gerente – Loja Este],
    [REQ-010], [Registar venda mesmo sem internet (modo offline) e sincronizar quando voltar online], [PDV / Caixa – Offline], [17/02/2026 09:30], [Rui Castro], [Funcionário de caixa – Loja Rural],
    [REQ-011], [Suportar pagamento multibanco, MB Way, cartão e numerário com troco automático], [PDV / Pagamentos], [17/02/2026 11:15], [Rui Castro], [Funcionário de caixa – Loja Rural],
  )
)

#figure(
  caption: "Requisitos Levantados – Fase de Elicitação em Bruto (Cont.)",
  kind: table,
  table(
    columns: (1.1fr, 3.6fr, 1.6fr, 1.8fr, 1.3fr, 2.0fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*ID*], [*Descrição do requisito*], [*Área de utilização*], [*Data e hora do levantamento*], [*Responsável*], [*Colaborador / Stakeholder*],

    [REQ-012], [Gerar ficheiro SAFT-PT mensal automático com todas as vendas e devoluções], [Faturação / Legal], [18/02/2026 13:45], [Gonçalo Ribeiro], [Gerente regional (Administração central)],
    [REQ-013], [Permitir definir promoções temporárias (ex: 2+1, desconto %) por produto ou categoria], [Gestão de preços / Promoções], [18/02/2026 15:10], [Gonçalo Ribeiro], [Gerente regional (Administração central)],
    [REQ-014], [Registar venda com introdução de NIF para fatura simplificada], [PDV / Faturação], [19/02/2026 10:25], [José Lima], [Funcionário de caixa – Loja Centro],
    [REQ-015], [Mostrar alertas de validade próxima em produtos perecíveis (ex: lacticínios)], [Gestão de stock], [19/02/2026 11:50], [José Lima], [Gerente – Loja Centro],
    [REQ-016], [Permitir criar utilizadores com perfis diferentes (caixa, gerente, admin)], [Segurança / Utilizadores], [20/02/2026 09:40], [Eduardo Freitas], [Gerente – Loja Norte],
    [REQ-017], [Registar todas as operações com login (auditoria de quem fez o quê)], [Segurança / Auditoria], [20/02/2026 10:30], [Eduardo Freitas], [Gerente – Loja Norte],
    [REQ-018], [Atualizar stock da loja após vender um produto (repetido por insistência)], [Gestão de stock], [20/02/2026 14:55], [Diogo Cardoso], [Funcionário de caixa – Loja Sul],
    [REQ-019], [Ter interface muito simples e rápida, com poucos cliques por venda], [PDV / Usabilidade], [20/02/2026 16:10], [Diogo Cardoso], [Funcionário de caixa – Loja Sul],
    [REQ-020], [Gerar relatório comparativo de vendas entre lojas por período (semana/mês)], [Relatórios / Administração], [21/02/2026 10:00], [Rui Castro], [Diretor da cadeia (Administração central)],
    [REQ-021], [Suportar mais de 10.000 produtos diferentes sem lentidão], [Desempenho / Catálogo], [21/02/2026 11:20], [Rui Castro], [Diretor da cadeia (Administração central)],
    [REQ-022], [Gerir catálogo centralizado de produtos e categorias], [Gestão de Catálogo], [21/02/2026 14:00], [Gonçalo Ribeiro], [Diretor da cadeia (Administração central)],
    [REQ-023], [Registar devoluções de artigos e emitir notas de crédito (anulações)], [Gestão de Vendas], [22/02/2026 10:15], [José Lima], [Gerente – Loja Centro],
    [REQ-024], [Definir o fundo de maneio inicial da caixa e registar sangrias diárias], [Gestão de Caixa], [22/02/2026 11:30], [Eduardo Freitas], [Gerente – Loja Sul],
    [REQ-025], [Criar pedidos de encomenda diretos a fornecedores com base no stock local], [Gestão de Encomendas], [22/02/2026 15:45], [Diogo Cardoso], [Gerente – Loja Norte],
  )
)

#pagebreak()

== Geração de User Stories

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Com base nos requisitos identificados anteriormente para a FlashStore, gera as User Stories seguindo o formato padrão do Agile descrito nos slides "Ch3 Agile SW Dev.pptx" (As a... I want... so that...). 
    Organiza-as pelas camadas do sistema: Operacional (Loja), Gestão de Produtos, Segurança e Consolidação Central. Garante que cada história foca no valor de negócio e não apenas na funcionalidade técnica.
  ],
  analise: [
    O modelo gerou com sucesso as histórias de utilizador, permitindo uma transição clara dos requisitos técnicos para uma visão centrada no utilizador. A organização por camadas facilitou a visualização do impacto do software em cada nível da organização FlashStore. Fizemos pequenos ajustes manuais para garantir que os benefícios ("para...") refletissem os problemas de ineficiência e falta de dados identificados nas entrevistas (Anexos F, G e H).
  ],
)
#llm-end()

Com base no processo de elicitação de requisitos e na análise do domínio do sistema, as user stories foram organizadas por áreas funcionais, refletindo as diferentes camadas operacionais e de gestão do sistema FlashStore.

=== Camada Operacional – Ponto de Venda e Loja

- Como operador de loja, quero registar vendas de forma rápida e fiável, para processar compras de clientes com eficiência.
- Como operador de loja, quero cancelar ou corrigir um artigo durante a venda, para evitar erros no fecho de caixa.
- Como operador de loja, quero registar vendas mesmo sem ligação à internet, para garantir continuidade do serviço.
- Como gerente de loja, quero fechar caixa no final do turno com registo automático de discrepâncias, para controlar diferenças entre valores registados e valores reais.
- Como gestor de loja, quero consultar o stock atual de cada produto, para saber quando é necessário repor mercadoria.
- Como gestor de loja, quero receber alertas quando o stock atingir um limite mínimo definido, para evitar ruturas.

=== Camada de Gestão de Produtos e Fornecedores

- Como administrador, quero cadastrar e atualizar produtos e respetivas categorias, para manter o catálogo consistente em todas as lojas.
- Como responsável de compras, quero criar pedidos a fornecedores, para repor produtos em falta.
- Como administrador, quero definir promoções temporárias por produto ou categoria, para dinamizar vendas em períodos estratégicos.

=== Camada de Segurança e Controlo

- Como administrador, quero criar utilizadores com diferentes perfis e permissões, para controlar o acesso às funcionalidades do sistema.
- Como administrador (ou auditor), quero ter acesso a um registo automático de todas as operações críticas associadas a utilizadores autenticados, para garantir rastreabilidade e auditoria eficiente.

=== Camada de Consolidação e Análise Central

- Como gestor central, quero que os dados de cada loja sejam sincronizados automaticamente no final do dia, para consolidar a informação no núcleo central sem necessidade de intervenção manual.
- Como responsável financeiro, quero que o sistema gere automaticamente o ficheiro SAFT-PT mensal, para assegurar a conformidade com as obrigações da Autoridade Tributária.
- Como gestor central, quero visualizar as vendas agregadas de todas as lojas, para acompanhar o desempenho global da cadeia.
- Como gestor central, quero gerar relatórios comparativos por loja, período e categoria de produto, para apoiar decisões estratégicas.

Esta organização evidencia a separação entre funcionalidades operacionais locais, gestão centralizada, segurança e análise estratégica, reforçando a arquitetura híbrida descentralizada centralizada definida para o sistema.

#pagebreak()


== Refinamento de requisitos ambíguos

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Agora vamos refinar os requisitos da nossa Tabela 2. Segundo os slides "Ch4 Req Eng.pptx" do Sommerville, a linguagem natural é ambígua. Ajuda-me a encontrar termos subjetivos (como "rápido", "sem lentidão", "automático") e a transformá-los em requisitos verificáveis com números e métricas concretas. Faz uma tabela comparativa com o ID, o Problema e o Requisito Refinado.
  ],
  analise: [
    O modelo foi muito útil para "traduzir" as vontades dos utilizadores em metas que podemos testar. Por exemplo, em vez de aceitarmos que o sistema seja apenas "rápido", a IA sugeriu usarmos a métrica de 2 segundos, o que torna o requisito verificável. Isto evita confusões entre o que o cliente quer e o que a equipa de programação vai entregar.
  ],
)
#llm-end()

A imprecisão na linguagem natural é um dos problemas mais comuns no levantamento de requisitos, podendo gerar ambiguidades e diferentes interpretações entre os utilizadores e a equipa de desenvolvimento. Para mitigar este risco, procedeu-se à análise das entradas iniciais com o intuito de converter intenções vagas (goals) em requisitos mensuráveis e testáveis (verifiable requirements). A tabela seguinte detalha os requisitos que apresentavam termos subjetivos e a respetiva reformulação rigorosa adotada para o sistema.

#figure(
  caption: "Requisitos ambíguos",
  kind: table,
  table(
    columns: (1.1fr, 2.8fr, 3.8fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*ID*], [*Problema identificado*], [*Requisito refinado*],

    [REQ-001], ["Rápida" é subjetivo],
    [Registo de venda no PDV com tempo de resposta inferior a 2 segundos por operação principal.],

    [REQ-003], ["Contagem automática" pouco claro],
    [Sistema calcula total esperado e operador introduz valores contados, registando discrepâncias.],

    [REQ-009], [Sincronização pouco definida],
    [Sincronização diária automática após fecho, com reintento em caso de falha.],

    [REQ-010], [Modo offline pouco detalhado],
    [Permitir vendas offline e sincronizar posteriormente garantindo unicidade das transações.],

    [REQ-011], ["Troco automático" ambíguo],
    [Sistema calcula automaticamente o troco em pagamentos em numerário.],

    [REQ-021], ["Sem lentidão" não mensurável],
    [Pesquisa de produto inferior a 2 segundos com catálogo ≥ 10.000 produtos.],
  )
)

#pagebreak()


== Requisitos Funcionais e Não Funcionais

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Já temos 21 requisitos soltos, os refinamentos e as restrições legais (AT/SAFT). Agora, organiza tudo em duas tabelas finais: Requisitos Funcionais e Requisitos Não Funcionais, seguindo a separação do Sommerville (Ch4). Agrupa os Não Funcionais por categorias como Desempenho, Segurança e Legal.
  ],
  analise: [
    O ChatGPT conseguiu fazer a separação básica corretamente. Percebeu que "registar venda" é uma função e "tempo de resposta" é qualidade. No entanto, o resultado foi uma lista simples. Para um relatório de engenharia, percebemos que faltava a "Rastreabilidade": não sabíamos de onde vinha cada requisito final. Além disso, ele colocou o "Modo Offline" como funcional, mas nós decidimos classificá-lo como Não Funcional (Disponibilidade) por ser uma restrição de arquitetura.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Melhora as tabelas. Primeiro, adiciona uma coluna chamada "Origem" que ligue cada requisito aos IDs iniciais (REQ-001, etc.) ou às User Stories. Segundo, reclassifica o "Modo Offline" e as "Leis de Faturação" como Requisitos Não Funcionais, nas categorias de Disponibilidade e Legal, conforme as definições de restrições externas do Capítulo 4 do Sommerville.
  ],
  analise: [
    Esta segunda iteração foi a que usámos no relatório. A introdução da coluna "Origem" é fundamental para provarmos ao cliente (e ao stor) que todos os requisitos vêm de necessidades reais identificadas nas entrevistas e não foram inventados por nós. A reclassificação das restrições deu ao documento o rigor técnico que a unidade curricular exige.
  ],
)
#llm-end()


Após o processo de elicitação, análise de contexto, identificação de stakeholders e refinamento de ambiguidades, procedeu-se à classificação formal dos requisitos do sistema FlashStore em duas categorias fundamentais da Engenharia de Requisitos: requisitos funcionais e requisitos não funcionais.

Esta distinção é essencial para garantir clareza conceptual e rastreabilidade técnica ao longo do ciclo de vida do software. Enquanto os requisitos funcionais descrevem os serviços, comportamentos e operações que o sistema deve executar para suportar os processos de negócio da cadeia de lojas, os requisitos não funcionais estabelecem atributos de qualidade e restrições que condicionam a forma como essas funcionalidades devem ser implementadas e disponibilizadas.

A classificação apresentada resulta diretamente da Tabela 2 – Requisitos Levantados (Elicitação Inicial), da Tabela 3 – Refinamento de Requisitos Ambíguos, da Tabela 2.1 – Restrições Identificadas e das User Stories organizadas na secção anterior.

Importa salientar que não foram introduzidos novos requisitos nesta fase. O trabalho realizado consistiu exclusivamente na reorganização estruturada da informação previamente recolhida, assegurando:

- Eliminação de redundâncias  
- Integração dos refinamentos formais efetuados  
- Consolidação de requisitos duplicados  
- Garantia de rastreabilidade entre origem e especificação final  

Esta abordagem permite que, nas fases posteriores de modelação e implementação, exista uma correspondência clara entre necessidade identificada e solução desenvolvida.

#pagebreak()

=== Requisitos Funcionais

Os requisitos funcionais representam o núcleo operacional do sistema FlashStore. Estes descrevem as funcionalidades que suportam as operações de ponto de venda (PDV), a gestão de stock e inventário, a consolidação central de dados, a geração de relatórios e a gestão de utilizadores.

A sua definição está diretamente associada às atividades críticas do domínio do retalho de conveniência multi-loja, garantindo simultaneamente autonomia operacional local e integração estratégica centralizada.

Apresenta-se de seguida a tabela consolidada de requisitos funcionais.

#figure(
  caption: "Requisitos Funcionais Consolidados",
  kind: table,
  table(
    columns: (0.9fr, 4.5fr, 2.2fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*ID*], [*Descrição do Requisito*], [*Origem*],

    [RF01], [Registar vendas com leitura de código de barras ou introdução manual.], [REQ-001 (Tabela 2)],
    [RF02], [Cancelar ou remover artigos durante uma venda em curso.], [REQ-002 (Tabela 2)],
    [RF03], [Registar vendas em modo offline.], [REQ-010 (Tabela 2 + Tabela 3)],
    [RF04], [Suportar pagamentos por numerário, Multibanco, MB Way e cartão.], [REQ-011 (Tabela 2)],
    [RF05], [Calcular automaticamente o troco em pagamentos em numerário.], [REQ-011 (Tabela 3)],
    [RF06], [Registar venda com introdução de NIF para emissão de fatura.], [REQ-014 (Tabela 2)],
    [RF07], [Consultar stock de produtos diretamente no PDV.], [REQ-008 (Tabela 2)],
    [RF08], [Fechar caixa no final do turno com registo de discrepâncias.], [REQ-003 (Tabela 2 + Tabela 3)],
    [RF09], [Gerar relatório diário de vendas por caixa e por funcionário.], [REQ-004 (Tabela 2)],
    [RF10], [Atualizar automaticamente o stock após cada venda.], [REQ-005 + REQ-018 (Tabela 2)],
    [RF11], [Registar entrada de mercadoria com associação a fornecedor e atualização de stock.], [REQ-007 (Tabela 2)],
    [RF12], [Emitir alerta quando o stock atingir limite mínimo definido.], [REQ-006 (Tabela 2)],
    [RF13], [Mostrar alertas de validade próxima para produtos perecíveis.], [REQ-015 (Tabela 2)],
    [RF14], [Enviar automaticamente resumo diário de vendas e stock para o núcleo central.], [REQ-009 (Tabela 2 + Tabela 3)],
    [RF15], [Sincronização automática diária com reintento em caso de falha.], [REQ-009 (Tabela 3)],
    [RF16], [Gerar relatório comparativo de vendas entre lojas por período.], [REQ-020 (Tabela 2)],
    [RF17], [Gerar automaticamente ficheiro SAFT-PT mensal.], [REQ-012 (Tabela 2)],
    [RF18], [Permitir definir promoções temporárias por produto ou categoria.], [REQ-013 (Tabela 2)],
    [RF19], [Criar utilizadores com diferentes perfis.], [REQ-016 (Tabela 2)],
    [RF20], [Autenticação obrigatória antes do início das operações.], [REQ-016 (User Stories)],
    [RF21], [Registar operações críticas associadas ao utilizador autenticado.], [REQ-017 (Tabela 2)],
    [RF22], [Gerir catálogo de produtos, categorias e lojas.], [REQ-022 (Tabela 2)],
    [RF23], [Registar devoluções e anular vendas parciais no PDV.], [REQ-023 (Tabela 2)],
    [RF24], [Registar fundo de maneio inicial e efetuar sangrias de caixa.], [REQ-024 (Tabela 2)],
    [RF25], [Registar encomendas diretas a fornecedores locais.], [REQ-025 (Tabela 2)],
  )
)

#pagebreak()

=== Requisitos Não Funcionais

Os requisitos não funcionais estabelecem as condições de qualidade e as restrições técnicas, legais e operacionais que garantem que o sistema não apenas funcione, mas funcione de forma adequada ao contexto real da FlashStore.

No domínio do retalho de conveniência, estes requisitos assumem particular relevância devido ao elevado volume de transações diárias, à necessidade de resposta rápida no PDV, à possibilidade de falhas de ligação à internet e às obrigações fiscais rigorosas impostas por entidades reguladoras.

Os requisitos foram agrupados por categoria (Desempenho, Segurança, Legal, Usabilidade, Escalabilidade, Disponibilidade), promovendo uma organização coerente e alinhada com boas práticas de especificação.

#figure(
  caption: "Requisitos Não Funcionais Consolidados",
  kind: table,
  table(
    columns: (0.9fr, 3.6fr, 1.6fr, 2.0fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*ID*], [*Descrição do Requisito*], [*Categoria*], [*Origem*],

    [RNF01], [Tempo de resposta inferior a 2 segundos por operação principal no PDV.], [Desempenho], [REQ-001 + R04],
    [RNF02], [Pesquisa de produto inferior a 2 segundos com catálogo ≥ 10.000 produtos.], [Desempenho], [REQ-021 (Tabela 3)],
    [RNF03], [Capacidade de gerir mais de 10.000 produtos distintos por loja.], [Escalabilidade], [REQ-021 + R06],
    [RNF04], [Suporte a operação offline parcial com sincronização automática.], [Disponibilidade], [R05],
    [RNF05], [Consolidação diária obrigatória ao fecho do dia operacional.], [Operacional], [R07],
    [RNF06], [Garantir unicidade e integridade das transações após sincronização offline.], [Integridade], [REQ-010 (Tabela 3)],
    [RNF07], [Autenticação obrigatória por utilizador.], [Segurança], [R08],
    [RNF08], [Registo auditável de operações sensíveis.], [Segurança], [R08],
    [RNF09], [Implementação de backups periódicos da base de dados central.], [Segurança], [User Stories],
    [RNF10], [Software de faturação certificado pela Autoridade Tributária.], [Legal], [R01],
    [RNF11], [Envio obrigatório do ficheiro SAFT-PT até ao dia 5 do mês seguinte.], [Legal], [R02],
    [RNF12], [Conformidade total com RGPD no tratamento de dados pessoais.], [Legal], [R03],
    [RNF13], [Registo de uma venda padrão deve ser concluído com um máximo de 3 interações (cliques/toques).], [Usabilidade], [REQ-019],
    [RNF14], [Sistema adequado a utilizadores com formação técnica limitada.], [Usabilidade], [Análise de Contexto],
    [RNF15], [Solução economicamente sustentável por loja.], [Implementação], [R09],
    [RNF16], [Arquitetura escalável para integração futura de novas lojas.], [Escalabilidade], [Objetivos do Projeto],
  )
)

== Identificação de Atores do Sistema

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Com base no domínio da FlashStore e nos requisitos RF01 a RF25, identifica os atores do sistema segundo as normas descritas nos slides "Ch5 System modeling.pptx" do Sommerville. Garante que os atores representam papéis lógicos e que a lista cobre tanto a operação local (loja) como a gestão central (sede).
  ],
  analise: [
    O modelo identificou corretamente os perfis operacionais (Caixa e Gerente) e o perfil administrativo. Contudo, cometeu um erro conceptual comum em Engenharia de Software: listou o "Cliente Final" como ator principal. No nosso sistema de Ponto de Venda, o cliente é um beneficiário, mas não interage diretamente com o software; quem opera a interface é o funcionário. Além disso, a IA omitiu os atores sistémicos (secundários) necessários para o processamento de pagamentos e para as obrigações fiscais (Autoridade Tributária).
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Refina a lista de atores aplicando o princípio de "fronteira do sistema" do Sommerville. Remove o Cliente (não interage com a UI). Divide os restantes em Atores Principais (humanos) e Secundários (sistemas externos). 
    Inclui o Gateway de Pagamentos (necessário para o RF04) e a Autoridade Tributária como atores secundários. Por fim, adiciona um "Temporizador do Sistema" (ator automático) para disparar a sincronização diária obrigatória definida no RF14, seguindo as boas práticas do RUP (Rational Unified Process).
  ],
  analise: [
    Esta segunda iteração permitiu atingir o rigor académico necessário. A inclusão do "Temporizador" como ator automático é um detalhe técnico importante, pois justifica como a sincronização acontece à meia-noite sem intervenção humana. A distinção entre atores principais e secundários clarificou a fronteira do sistema e serviu de base direta para a modelação dos diagramas UML seguintes.
  ],
)
#llm-end()


De acordo com os princípios da Modelação de Requisitos baseada em RUP (Rational Unified Process), um ator representa um papel que uma pessoa, dispositivo ou sistema externo assume ao interagir com o sistema em análise. Com base nos Requisitos Funcionais levantados para a FlashStore e aplicando o princípio de "solução equilibrada" para evitar redundâncias, identificaram-se os seguintes atores:

=== Atores Principais
Os Atores Principais são as entidades que iniciam uma interação direta com o sistema para atingir um objetivo de negócio.

- *Operador de Caixa*: Utilizador com formação técnica limitada, responsável pela interação contínua no Ponto de Venda (PDV). Inicia casos de uso transacionais e locais.
  - *Justificação:* Originado por RF01 (Registar vendas), RF02 (Cancelar artigos), RF04 (Pagamentos) e RF07 (Consultar stock no PDV).
  
- *Gerente de Loja*: Utilizador responsável pela supervisão e gestão da loja física. Inicia casos de uso de logística local e fecho de operações.
  - *Justificação:* Originado por RF08 (Fechar caixa/turno), RF11 (Registar entrada de mercadoria) e monitorização de alertas em backoffice (RF12, RF13).

- *Administrador / Gestor Central*: Utilizador com privilégios globais, operando a partir do núcleo central da cadeia.
  - *Justificação:* Originado por RF16 (Relatórios comparativos), RF17 (Gerar ficheiro SAFT-PT), RF18 (Definir promoções) e RF19 (Criar utilizadores e perfis).

- *Temporizador do Sistema (Actor Automático)*: Representa o gatilho temporal que atua sobre o sistema sem intervenção humana, despoletando a sincronização automática após o fecho diário da loja.

=== Atores Secundários
Os Atores Secundários são sistemas externos com os quais a FlashStore tem, obrigatoriamente, de estabelecer um diálogo informático bidirecional para satisfazer um requisito funcional durante a execução de um Caso de Uso.

- *Gateway de Pagamentos (Terminal TPA)*: Sistema externo de validação bancária.
  - *Justificação:* Embora o Operador inicie a venda (RF01), a conclusão do pagamento eletrónico (Multibanco, MB Way, Cartão) exigida pelo RF04 obriga o sistema FlashStore a comunicar com a rede bancária para obter a respetiva autorização de débito antes de emitir a fatura.

=== Impacto dos Requisitos Não Funcionais na Modelação
Embora a identificação primária de atores derive dos Requisitos Funcionais (serviços do sistema), os Requisitos Não Funcionais (RNF) condicionam a sua interação. Nomeadamente, o RNF07 (Autenticação obrigatória) exige que todos os atores humanos passem por um processo de validação prévia antes de iniciarem os seus Casos de Uso. Paralelamente, o RNF05 (Consolidação diária) é o requisito arquitetural que justifica a inclusão do Temporizador como ator autónomo no diagrama, garantindo as operações de background sem intervenção manual.



== Listagem de Casos de Uso

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nos Atores e nos Requisitos Funcionais (RF01 a RF25) que já definimos, gera uma lista de Casos de Uso (UC) para a FlashStore. Organiza a lista por ator principal. Usa como base a teoria de Use Cases dos slides "Ch5 System modeling.pptx" do Sommerville.
  ],
  analise: [
    O modelo listou as ações base, mas cometeu um erro de modelação: a "decomposição funcional excessiva". Por exemplo, separou "Ler código de barras" e "Calcular troco" em Casos de Uso distintos. Como estudámos nos slides do Ch5, um Caso de Uso deve representar um objetivo de negócio completo para o utilizador, e não passos individuais de um botão. Além disso, a IA omitiu o mapeamento direto para os nossos RFs, quebrando a rastreabilidade.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    Volta a aplicar as regras dos slides "Ch5 System modeling.pptx": agrupa os pequenos passos em objetivos de negócio completos (ex: "Registar Venda" engloba o registo, o pagamento e o troco). 
    Além disso: 
    1) Escreve todos os UCs a começar por um verbo no infinitivo. 
    2) Mapeia explicitamente que RFs pertencem a cada UC. 
    3) Cria um UC transversal de "Autenticar no sistema" que sirva de dependência obrigatória (<<include>>) para as operações dos atores humanos, resolvendo o requisito RNF07.
  ],
  analise: [
    Nesta segunda iteração a IA produziu o nível de abstração exigido pela disciplina. O agrupamento das funções eliminou a granularidade excessiva. O mapeamento detalhado para os RFs restaurou a rastreabilidade, provando que todos os nossos requisitos estão cobertos por funcionalidades reais. A introdução do UC transversal de Autenticação preparou a lógica de dependências que usámos no Diagrama UML.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 3,
  prompt: [
    Atua agora como um Auditor de Software e verifica a Rastreabilidade (Traceability) entre os nossos requisitos funcionais (RF01 a RF25) e as operações básicas que um sistema de retalho real exige. Existe alguma lacuna operacional (Gap) crítica no nosso levantamento para o funcionamento da loja no dia-a-dia?
  ],
  analise: [
    Esta iteração revelou o poder da IA para "Quality Assurance". O modelo detetou imediatamente Gaps operacionais críticos: tínhamos desenhado fluxos complexos de sincronização offline, mas esquecemo-nos de funções base imperativas num negócio real, como Registar Devoluções, efetuar Sangrias de Caixa e a Gestão Central de Catálogo. Esta análise forçou a equipa a regressar às tabelas anteriores para adicionar os requisitos extra (REQ-022 a REQ-025 e RF22 a RF25), garantindo a total rastreabilidade até aos novos Casos de Uso incorporados na listagem final.
  ],
)
#llm-end()

A identificação e especificação dos Casos de Uso (Use Cases) constitui o núcleo do processo de modelação de requisitos funcionais. Seguindo as boas práticas da Engenharia de Software, cada Caso de Uso foi designado por um verbo no infinitivo, representando de forma inequívoca o objetivo que o ator pretende atingir ao interagir com o sistema FlashStore, mantendo um nível de abstração que exclui detalhes de Interface com o Utilizador (UI).

Os Casos de Uso identificados foram mapeados diretamente a partir dos Requisitos Funcionais (RF) e agrupados por ator principal, conforme apresentado de seguida.

=== Casos de Uso Transversais (Humanos)
- *UC00 - Autenticar no sistema*: Validar credenciais do utilizador antes do acesso a funcionalidades restritas.
  - *Mapeamento*: RF20, RNF07.

=== Ator: Operador de Caixa
- *UC01 - Registar venda*: Inserir artigos, aplicar método de pagamento (incluindo interação com Gateway de Pagamentos externo), calcular troco, efetuar a emissão de fatura/talão e, caso necessário, remover/cancelar artigos específicos durante a transação em curso.
  - *Mapeamento*: RF01, RF02, RF03, RF04, RF05, RF06, RF10.
- *UC02 - Consultar stock local*: Verificar a disponibilidade de um produto específico diretamente no Ponto de Venda.
  - *Mapeamento*: RF07.
- *UC03 - Fechar turno de caixa*: Efetuar a contagem do numerário e terminar o período individual de operação no Ponto de Venda, registando eventuais discrepâncias associadas ao operador.
  - *Mapeamento*: RF08.
- *UC13 - Registar devolução*: Anular faturas ou processar a devolução física de artigos, restituindo o valor ao cliente.
  - *Mapeamento*: RF23.
- *UC14 - Efetuar sangria de caixa*: Registar a retirada de excesso de numerário do Ponto de Venda para o cofre da loja.
  - *Mapeamento*: RF24.

=== Ator: Gerente de Loja
- *UC04 - Fechar dia operacional*: Validar e consolidar os fechos de turno de todos os operadores, encerrando o dia financeiro da loja física.
  - *Mapeamento*: RF08.
- *UC05 - Registar entrada de mercadoria*: Inserir dados de faturação de fornecedores e indicar as quantidades de produtos que serão entregues no stock da loja selecionada.
  - *Mapeamento*: RF11.
- *UC06 - Monitorizar alertas de stock e validade*: Consultar os avisos automáticos do sistema referentes a produtos perecíveis ou em rutura.
  - *Mapeamento*: RF12, RF13.
- *UC07 - Gerar relatório diário local*: Extrair o resumo de vendas por caixa e funcionário para efeitos de gestão do espaço físico.
  - *Mapeamento*: RF09.
- *UC15 - Registar encomendas a fornecedores*: Criar pedidos de reposição com base nos alertas do sistema e gerir o abastecimento da loja.
  - *Mapeamento*: RF25.
- *UC16 - Gerir funcionários da loja*: Configurar e gerir os acessos dos operadores de caixa afetos à sua loja.
  - *Mapeamento*: RF19.
- *UC17 - Definir fundo de maneio*: Registar o valor de abertura inicial para cada Ponto de Venda antes do início dos turnos.
  - *Mapeamento*: RF24.

=== Ator: Administrador / Gestor Central
- *UC08 - Gerar relatórios corporativos*: Extrair e analisar mapas comparativos de vendas entre diferentes lojas, períodos e categorias.
  - *Mapeamento*: RF16.
- *UC09 - Exportar ficheiro SAFT-PT*: Gerar o documento fiscal obrigatório consolidado para submissão à Autoridade Tributária.
  - *Mapeamento*: RF17.
- *UC10 - Definir promoções e preços*: Criar campanhas temporárias e atualizar valores no catálogo centralizado.
  - *Mapeamento*: RF18.
- *UC11 - Gerir utilizadores*: Criar, editar e desativar perfis de acesso para os colaboradores da cadeia.
  - *Mapeamento*: RF19.
- *UC18 - Gerir catálogo de produtos e lojas*: Criar novos artigos, organizar categorias e configurar novas lojas físicas no sistema da cadeia.
  - *Mapeamento*: RF22.

=== Ator: Temporizador do Sistema
- *UC12 - Sincronizar dados diários*: Desencadear automaticamente, após o fecho da loja, o envio do resumo de vendas e stock para o núcleo central, com reintento em caso de falha.
  - *Mapeamento*: RF14, RF15.
  
=== Diagrama de Casos de Uso

O Diagrama de Casos de Uso seguinte materializa as interações mapeadas na secção anterior. A fronteira do sistema (*System Boundary*) delimita as funcionalidades internas da FlashStore, enquanto os atores principais e secundários se posicionam no exterior. 

Destacam-se as relações de dependência aplicadas segundo as boas práticas da disciplina, nomeadamente a obrigatoriedade de autenticação prévia (`<<include>>`) nas operações centrais de cada ator humano. Esta abordagem garante a representação formal dos requisitos de segurança (Login obrigatório) de forma limpa, direta e sem sobrecarregar visualmente o modelo estrutural.

#figure(
  caption: "Diagrama de Casos de Uso do Sistema FlashStore",
  kind: image,
  image("images/UseCases.png", width: 75%)
)

#pagebreak()

== Especificação Detalhada de Casos de Uso

#heading(numbering: none, outlined: false, level: 3)[Prompt - UC01]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Escreve o texto introdutório para a secção de "Especificação Detalhada de Casos de Uso" referindo a norma IEEE 29148. Depois, segundo os slides "Ch5 System modeling.pptx" do Sommerville, cria a descrição tabular para o nosso caso mais crítico: UC01 (Registar Venda). Usa a estrutura: ID, Ator, Pré-condições, Fluxo Principal e Pós-condições.
  ],
  analise: [
    O ChatGPT escreveu uma excelente introdução e gerou a estrutura tabular recomendada pelo Sommerville (Ch5). Contudo, focou-se apenas no "Happy Path" (cenário ideal). Em Engenharia de Software, o risco reside nas exceções, e a IA esqueceu-se de incluir a secção de "Fluxos Alternativos", falhando em especificar como o sistema reage a erros.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Melhora a tabela do UC01 adicionando a secção de "Fluxos Alternativos", conforme exigido nas boas práticas do Ch5. Precisamos prever as exceções do dia-a-dia do Caixa: 1) o leitor de código de barras falhar; 2) o cliente pedir para inserir o NIF a meio do processo; 3) o terminal de pagamento recusar o cartão.
  ],
  analise: [
    Nesta iteração, a tabela do UC01 ficou completa e realista. A inclusão dos fluxos alternativos garante que os programadores saberão exatamente como o sistema deve reagir a problemas de hardware ou falhas bancárias, aumentando a resiliência do Ponto de Venda.
  ],
)
#llm-end()

De acordo com as boas práticas de Engenharia de Software (norma IEEE 29148), não é estritamente necessário detalhar exaustivamente todos os casos de uso identificados, mas sim os processos críticos que representam o núcleo (_core_) do negócio e que acarretam maior risco arquitetural. 

Nesta secção, apresentam-se as especificações comportamentais detalhadas para os dois casos de uso mais críticos da operação local da FlashStore: o registo transacional de vendas (UC01) e a consolidação de fecho de dia (UC04).

#figure(
  caption: "Especificação do Caso de Uso: UC01 - Registar Venda",
  kind: table,
  table(
    columns: (1fr, 3.5fr),
    align: left,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*Atributo*], [*Descrição*],
    [**ID e Nome**], [UC01 - Registar Venda],
    [**Ator Principal**], [Operador de Caixa],
    [**Pré-condições**], [O operador concluiu o UC00 (Autenticar no sistema) com sucesso e iniciou um turno (UC03). O sistema encontra-se no ecrã inicial de PDV.],
    [**Fluxo Principal**], [
      1. O operador regista um artigo através do leitor de código de barras. \
      2. O sistema reconhece o produto, obtém o preço em vigor e adiciona uma Linha de Venda ao ecrã. \
      3. O sistema atualiza o subtotal e o valor de IVA em tempo real. \
      4. Os passos 1 a 3 repetem-se até todos os artigos do cliente estarem registados. \
      5. O operador seleciona a opção "Finalizar Pagamento". \
      6. O sistema solicita a escolha do método de pagamento. \
      7. O operador seleciona "Numerário" e introduz o montante entregue pelo cliente. \
      8. O sistema calcula e exibe automaticamente o troco a devolver (RF05). \
      9. O sistema regista a Venda, deduz os artigos do Stock atual da loja (RF10) e emite a Fatura simplificada na impressora térmica.
    ],
    [**Fluxos Alternativos**], [
      *1a. Leitura de código falha:* O sistema emite um alerta visual; o operador pesquisa o artigo manualmente por nome ou introduz o EAN no teclado. \
      *4a. Cancelamento de artigo:* O cliente desiste de um produto. O operador seleciona a linha correspondente e pressiona "Remover"; o sistema recalcula o subtotal (RF02). \
      *6a. Inserção de NIF:* Antes de fechar a conta, o cliente pede fatura com NIF. O operador introduz o NIF no campo respetivo, e o sistema valida o formato (RF06). \
      *7a. Pagamento Eletrónico:* O operador seleciona "Cartão/MB Way". O sistema comunica com o Gateway externo. Se aprovado, avança para o passo 9. Se rejeitado, o sistema exibe "Transação Recusada", cancela o processo de faturação e regressa ao passo 6.
    ],
    [**Pós-condições**], [A transação financeira fica registada na base de dados local (SQLite), o inventário sofre atualização imediata e a gaveta de dinheiro abre-se eletronicamente.],
  )
)

#v(1em)

#v(1em)
#v(1em)

#heading(numbering: none, outlined: false, level: 3)[Prompt - UC04]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Agora, cria a tabela de especificação detalhada para o UC04 - Fechar Dia Operacional, para o Gerente de Loja. Mantém a mesma estrutura tabular baseada no "Ch5 System modeling.pptx" que usaste no UC01.
  ],
  analise: [
    A IA gerou o fluxo principal corretamente, onde o gerente consolida os dados e o sistema envia o pacote de sincronização para a sede. No entanto, voltou a cometer o erro de ignorar as exceções. Faltava prever o que acontece se um Operador de Caixa não tiver fechado o seu turno (uma falha crítica na operação).
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Corrige a especificação do UC04 adicionando os "Fluxos Alternativos" para garantir a robustez exigida no Ch5. Adiciona o cenário em que o sistema deteta que ainda existem turnos de caixa abertos (ou seja, o operador esqueceu-se de executar o UC03). O sistema tem de abortar o fecho do dia e emitir um alerta.
  ],
  analise: [
    Com esta correção, a especificação do UC04 passou a cobrir um dos riscos operacionais e contabilísticos mais graves. O sistema garantirá a consistência dos dados locais antes de permitir qualquer sincronização de fim de dia com a Administração Central.
  ],
)
#llm-end()

#figure(
  caption: "Especificação do Caso de Uso: UC04 - Fechar Dia Operacional",
  kind: table,
  table(
    columns: (1fr, 3.5fr),
    align: left,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*Atributo*], [*Descrição*],
    [**ID e Nome**], [UC04 - Fechar Dia Operacional],
    [**Ator Principal**], [Gerente de Loja],
    [**Pré-condições**], [O horário de atendimento ao público encerrou (23h00). O Gerente está autenticado na interface de Backoffice da loja.],
    [**Fluxo Principal**], [
      1. O Gerente acede ao módulo de gestão e seleciona a opção "Fechar Dia Operacional". \
      2. O sistema verifica o estado de todos os turnos de caixa registados na data corrente. \
      3. O sistema consolida o total de vendas, agrega os valores por método de pagamento e calcula o total de discrepâncias detetadas nos fechos de turno (UC03). \
      4. O sistema gera no ecrã o Relatório Diário de Fecho para revisão. \
      5. O Gerente analisa os valores e pressiona "Aprovar e Encerrar Dia". \
      6. O sistema bloqueia a emissão de quaisquer novas vendas ou movimentos de stock com a data do dia encerrado. \
      7. O sistema coloca o pacote de dados consolidados (Vendas e Stock) na fila de sincronização (Outbox) para envio pelo UC12.
    ],
    [**Fluxos Alternativos**], [
      *2a. Turnos em aberto detetados:* O sistema deteta que o Operador de Caixa se esqueceu de executar o "Fecho de turno de caixa" (UC03). O sistema aborta a operação de fecho de dia e exibe um alerta indicando qual o terminal que se encontra com o turno pendente.
    ],
    [**Pós-condições**], [O dia contabilístico da loja fica fechado (estado _Read-only_) e os dados operacionais ficam preparados para a sincronização com a Administração Central.],
  )
)

#v(1em)

#heading(numbering: none, outlined: false, level: 3)[Prompt - UC13]

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Agora cria a tabela de especificação detalhada para o recém-descoberto UC13 - Registar Devolução, para o Operador de Caixa. O fluxo deve cobrir a leitura do talão original, validação do prazo de devolução (14 dias), reposição do artigo no stock e reembolso em numerário ou estorno.
  ],
  analise: [
    O modelo estruturou bem o fluxo principal, mas omitiu uma regra de negócio crítica no retalho: a necessidade de autorização superior. Os operadores de caixa não têm permissão autónoma para efetuar saídas de dinheiro (reembolsos). Foi necessário refinar.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    Refina o UC13 adicionando um fluxo alternativo (ou passo obrigatório) onde o sistema exige a aprovação do Gerente de Loja (via PIN) antes de processar o reembolso e a abertura da gaveta.
  ],
  analise: [
    Esta iteração alinhou o caso de uso com as políticas reais de prevenção de fraude em PDV. A exigência de aprovação gerencial transformou um processo simples numa operação de alta segurança e auditável (cumprindo o requisito RF21 de auditoria crítica).
  ],
)
#llm-end()

#figure(
  caption: "Especificação do Caso de Uso: UC13 - Registar Devolução",
  kind: table,
  table(
    columns: (1fr, 3.5fr),
    align: left,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },

    [*Atributo*], [*Descrição*],
    [**ID e Nome**], [UC13 - Registar Devolução],
    [**Ator Principal**], [Operador de Caixa],
    [**Ator Secundário**], [Gerente de Loja (Aprovação)],
    [**Pré-condições**], [O operador está autenticado no PDV. O cliente apresenta o talão original legível e o artigo em perfeitas condições de revenda.],
    [**Fluxo Principal**], [
      1. O operador seleciona "Devolução / Anulação" no menu do PDV. \
      2. O sistema solicita a leitura do código de barras da fatura original. \
      3. O sistema carrega os detalhes da venda original e verifica se a data está dentro do prazo legal (14 dias). \
      4. O operador seleciona na listagem os artigos específicos que o cliente deseja devolver. \
      5. O sistema calcula o valor total a reembolsar e bloqueia o ecrã, solicitando "Autorização Superior". \
      6. O Gerente insere o seu PIN de aprovação. \
      7. O sistema processa o reembolso (ex: abre a gaveta de dinheiro) e emite a Nota de Crédito. \
      8. O sistema atualiza o inventário, repondo as quantidades devolvidas no stock disponível.
    ],
    [**Fluxos Alternativos**], [
      *3a. Prazo expirado:* O sistema deteta que a fatura tem mais de 14 dias. A devolução é abortada exibindo "Prazo excedido" (a menos que o Gerente utilize um código de _override_). \
      *6a. Autorização recusada:* O Gerente não aprova a operação ou insere um PIN inválido. A devolução é cancelada e a tentativa falhada é guardada no registo de auditoria (RF21).
    ],
    [**Pós-condições**], [O artigo regressa ao stock da loja, o valor monetário é subtraído ao total do fecho de turno e a operação é registada como anulação associada à fatura original.],
  )
)

#pagebreak()

== Modelo de Domínio

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Vamos começar a secção do "Modelo de Domínio". Escreve uma introdução a explicar o que é este modelo e a sua importância para o projeto FlashStore, dado que temos uma operação local e uma gestão central.
  ],
  analise: [
    O modelo gerou uma boa explicação teórica sobre a importância do Modelo de Domínio para alinhar a linguagem de negócio entre as lojas e a sede. Contudo, faltava o essencial para um relatório de Engenharia: a metodologia. A IA não explicou *como* é que nós identificámos as entidades, parecendo que foram inventadas do nada.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Adiciona a essa introdução o "Processo Adotado". Explica que usámos a técnica de Análise Textual: fomos aos requisitos e User Stories e extraímos os substantivos para encontrar as entidades candidatas, e os verbos para definir os relacionamentos. 
    Refere também que fizemos uma fase de filtragem técnica para remover sinónimos e excluir conceitos abstratos como o "sistema FlashStore" (porque o modelo de domínio é sobre o negócio real e não sobre o software).
  ],
  analise: [
    Com esta segunda iteração, o texto ganhou um rigor académico excelente. A descrição do processo de extração e filtragem de substantivos e verbos prova que a construção do modelo não foi empírica, mas sim o resultado de uma derivação sistemática e rastreável desde a fase de Elicitação de Requisitos.
  ],
)
#llm-end()

=== Introdução e processo adotado

O Modelo de Domínio constitui um dos elementos mais relevantes nas fases iniciais de conceção de um sistema de software, na medida em que permite representar, de forma estruturada e abstrata, as entidades mais significativas do contexto de negócio e os relacionamentos que entre elas se estabelecem. Um modelo de domínio captura os tipos de objetos mais importantes no contexto do negócio, representando as "coisas" que existem ou que ocorrem no ambiente empresarial. No caso do projeto FlashStore, a construção deste modelo assume particular importância, dado que o sistema abrange duas esferas operacionais indissociáveis — a operação local descentralizada em cada loja e a gestão centralizada na sede — exigindo uma compreensão clara e partilhada do vocabulário de negócio, das entidades envolvidas e das regras que governam as suas interações. O modelo de domínio fornece precisamente essa _framework_ conceptual, funcionando como glossário de termos e como base para a análise de requisitos subsequente, sem incluir o próprio sistema de software a desenvolver.

A elaboração do modelo seguiu uma metodologia comummente utilizada na área de desenvolvimento de software, baseada na análise de elementos obtidos em fases anteriores do projeto. Numa primeira fase, procedeu-se à extração sistemática dos substantivos presentes na descrição do domínio (Secção 3.1), nos requisitos funcionais consolidados (Tabela 6), nas _user stories_ (Secção 3.5) e na análise de contexto (Secção 3.3), constituindo estes os candidatos iniciais a entidades do modelo. Numa segunda fase, cada candidato foi avaliado segundo critérios de filtragem reconhecidos: verificou-se se o substantivo era sinónimo de outra entidade já identificada, se se encontrava fora do âmbito da análise (como o próprio "sistema FlashStore" ou o "núcleo central", que representam a solução e não o problema), se na realidade representava uma relação entre outras entidades em vez de uma entidade autónoma, ou se era meramente fruto do estilo de escrita. Os verbos presentes nas descrições foram, por sua vez, analisados para identificar relações persistentes entre entidades, sendo estas decoradas com nomes, direções e multiplicidades, de acordo com a notação simplificada de diagramas de classe da UML. Importa reforçar que o modelo de domínio apresenta uma visão estática do problema — não representa fluxos de dados — e que as entidades nele identificadas são apenas candidatas a serem classes na solução final.

=== Entidades identificadas

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nos requisitos e nos slides "Ch5 System modeling.pptx" (Sommerville) e "02-Ciclo_Vida_SBD.pdf" (Orlando Belo), identifica as entidades candidatas para o Modelo de Domínio da FlashStore. Foca-te na fase de Modelação Conceptual, identificando os objetos do mundo real que existem no negócio de retalho.
  ],
  analise: [
    O modelo identificou as entidades básicas, mas cometeu erros de principiante em Modelação de Dados: incluiu termos da camada de software (ex: "Base de Dados", "Login", "Menu") que, segundo o slide 02 de SBD, não devem pertencer ao Modelo Conceptual. Além disso, as descrições eram genéricas e não refletiam a estrutura de atributos necessária para um sistema de retalho real como o da "Mercearia da D. Acácia" (Caso de Estudo C01).
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    Refina a lista aplicando o rigor da Modelação Conceptual de SBD. 
    1) Remove artefactos de implementação (software/UI). 
    2) Baseia-te no caso de estudo "C01-Mercearia_Acacia.pdf" para detalhar as entidades de suporte ao inventário e vendas. 
    3) Aplica a separação entre "Venda" e "Linha de Venda", garantindo que as descrições focam nos atributos de negócio (ex: EAN, Stock Mínimo, NIF). 
    4) Organiza por áreas funcionais para facilitar a leitura.
  ],
  analise: [
    Esta iteração atingiu o nível de detalhe esperado. Ao usarmos o caso de estudo da Mercearia da D. Acácia como referência de domínio, conseguimos mapear entidades muito mais realistas para o contexto português (como a diferenciação entre Produto e Categoria). A purificação das entidades de software garantiu que o modelo representa fielmente o negócio "FlashStore", servindo de base sólida para o futuro Diagrama Entidade-Associação.
  ],
)
#llm-end()

Apresentam-se de seguida as entidades identificadas para o modelo de domínio do sistema FlashStore, agrupadas por área funcional do negócio.

==== Estrutura da cadeia

#figure(
  caption: "Entidades da Estrutura da Cadeia",
  kind: table,
  table(
    columns: (1.5fr, 5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade*], [*Descrição*],
    [Loja], [Representa cada uma das lojas físicas da cadeia FlashStore. Possui atributos como nome, morada e horário de funcionamento.],
    [Ponto de venda], [Terminal físico de ponto de venda (PDV) existente em cada loja, onde são registadas as transações de venda.]
  )
)

==== Catálogo e fornecimento

#figure(
  caption: "Entidades de Catálogo e Fornecimento",
  kind: table,
  table(
    columns: (1.5fr, 5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade*], [*Descrição*],
    [Produto], [Artigo disponível para comercialização nas lojas (snacks, bebidas, tabaco, etc.). Possui atributos como nome, código de barras, preço e data de validade.],
    [Categoria], [Agrupamento lógico de produtos (por exemplo: bebidas, snacks, tabaco, lacticínios), permitindo organização e análise por tipo de produto.],
    [Fornecedor], [Entidade externa responsável pelo abastecimento de produtos à cadeia. Possui atributos como nome, contacto e NIF.],
  )
)

==== Operações de venda

#figure(
  caption: "Entidades de Operações de Venda",
  kind: table,
  table(
    columns: (1.5fr, 5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade*], [*Descrição*],
    [Venda], [Registo de uma transação comercial realizada numa loja. Possui atributos como data/hora e valor total.],
    [Linha de Venda], [Cada artigo individual incluído numa venda, com a respetiva quantidade, preço unitário e subtotal.],
    [Pagamento], [Registo do pagamento efetuado para uma venda, incluindo o método utilizado (numerário, Multibanco, MB Way ou cartão) e o respetivo valor.],
    [Fatura], [Documento fiscal emitido na sequência de uma venda, podendo incluir o NIF do cliente quando solicitado. Possui atributos como número, data e valor total.],
    [Cliente], [Entidade opcional, representando um cliente que solicita a inclusão do seu NIF na fatura. Possui atributos como NIF e nome.],
  )
)

==== Gestão de stock e encomendas

#figure(
  caption: "Entidades de Gestão de Stock e Encomendas",
  kind: table,
  table(
    columns: (1.5fr, 5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade*], [*Descrição*],
    [Stock], [Representa a quantidade disponível de um determinado produto numa determinada loja. Possui atributos como quantidade atual e quantidade mínima (limiar para alerta).],
    [Encomenda], [Pedido de reposição de produtos efetuado a um fornecedor. Possui atributos como data e estado.],
    [Linha de Encomenda], [Cada produto individual incluído numa encomenda, com a respetiva quantidade solicitada.],
    [Entrada de Mercadoria], [Registo da receção efetiva de mercadoria numa loja, proveniente de um fornecedor, com atributos como data e referência da fatura do fornecedor.],
     [Produto], [Representa um produto.],
  )
)

==== Recursos humanos e operações diárias

#figure(
  caption: "Entidades de Recursos Humanos e Operações Diárias",
  kind: table,
  table(
    columns: (1.5fr, 5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade*], [*Descrição*],
    [Funcionário], [Colaborador da cadeia FlashStore. Possui atributos como nome, contacto e credenciais de acesso (PIN).],
    [Operador de Caixa], [Subtipo de Funcionário, responsável por operar o PDV.],
    [Gerente], [Subtipo de Funcionário, responsável pela supervisão operacional de uma loja.],
    [Administrador], [Subtipo de Funcionário, responsável pela gestão centralizada da cadeia a partir da sede.],
    [Turno], [Período de trabalho de um funcionário numa caixa específica. Possui atributos como data, hora de início e hora de fim.],
    [Fecho de Turno], [Registo de encerramento de um turno individual, incluindo o valor esperado, o valor efetivamente contado e a discrepância registada.],
    [Fecho de Dia], [Registo do encerramento diário das operações de uma loja, consolidando os fechos de turno do dia.],
   [Ponto de venda], [configurado num ponto de venda específico.],
    [Sangria de Caixa], [Retirada de valores do ponto de venda], [Ponto de venda], [realizada num ponto de venda.],
  [Operador de Caixa], [efetuada por um operador.],
  )
)

==== Promoções

#figure(
  caption: "Entidades de Promoções",
  kind: table,
  table(
    columns: (1.5fr, 5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade*], [*Descrição*],
    [Promoção], [Campanha promocional temporária definida centralmente, aplicável a produtos ou categorias específicas. Possui atributos como descrição, tipo de desconto (percentagem, 2+1, etc.), valor e datas de início e fim.],
  )
)

== Relacionamentos entre entidades

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Com base na nossa lista de entidades, identifica os relacionamentos para o Modelo de Domínio. Indica a multiplicidade (ex: 1:N) e o verbo que liga as classes. Usa como base o capítulo de Modelação de Sistemas do Sommerville (Ch5).
  ],
  analise: [
    O modelo identificou as ligações óbvias, mas foi tecnicamente pobre para o rigor exigido em SBD. Primeiro, usou notação de multiplicidade simplista e falhou na cardinalidade [Min:Max] defendida pelo Prof. Orlando Belo no slide "02-Ciclo_Vida_SBD.pdf". Segundo, cometeu um erro grave de domínio: considerou que uma Loja tem Produtos (1:N), ignorando que, numa cadeia de retalho, o mesmo Produto existe em várias Lojas, o que exige a entidade "Stock" para decompor uma relação M:N.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Refina os relacionamentos aplicando os conceitos de Modelação Conceptual de SBD (Orlando Belo). 
    1) Aplica o formato de cardinalidade [Min:Max]. 
    2) Baseia-te no caso de estudo "C01-Mercearia_Acacia.pdf" para modelar a relação entre Venda, Linha de Venda e Produto. 
    3) Decompõe a relação Loja-Produto através da entidade Stock (cada registo de stock pertence a 1 loja e refere 1 produto). 
    4) Identifica a hierarquia de Funcionários através de Generalização/Especialização (relação "é um"), conforme o slide 02 de SBD.
  ],
  analise: [
    A IA melhorou significativamente, mas ainda apresentava inconsistências na entidade "Venda". Estava a associar o Cliente como obrigatório, quando nos nossos requisitos (RF06) e no domínio real de conveniência, o NIF é opcional. Além disso, a multiplicidade da relação entre Fornecedor e Produto estava como 1:N, quando o material da Mercearia Acácia prova que um produto pode ter vários fornecedores alternativos (M:N).
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 3,
  prompt: [
    Faz o ajuste final com rigor máximo: 
    1) A relação Fatura-Cliente deve ter cardinalidade [0:1] no lado do cliente (opcionalidade). 
    2) A relação Produto-Fornecedor deve ser M:N. 
    3) Garante que a multiplicidade UML (Sommerville Ch5) no diagrama final será coerente com estas definições [Min:Max] de SBD. 
    4) Usa verbos precisos para as associações (ex: "é composto por", "está afeto a", "fornece") para garantir que a leitura do modelo de domínio é natural.
  ],
  analise: [
    Esta terceira iteração atingiu o estado de "solução equilibrada". O cruzamento entre a teoria de Engenharia de Software (Sommerville) e a Modelação Relacional (Belo) permitiu criar um modelo de domínio que não é apenas um desenho, mas uma especificação técnica pronta para ser transposta para SQL. O uso do caso "Mercearia Acácia" foi vital para validar que a estrutura de "Linha de Venda" é a forma correta de evitar redundâncias e garantir a integridade dos dados transacionais.
  ],
)
#llm-end()

Apresentam-se de seguida os relacionamentos persistentes identificados entre as entidades do modelo de domínio, com os respetivos nomes e multiplicidades.

=== Estrutura da cadeia

#figure(
  caption: "Relacionamentos da Estrutura da Cadeia",
  kind: table,
  table(
    columns: (2.5fr, 1.5fr, 2.5fr, 1.5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade 1*], [*Multiplicidade*], [*Entidade 2*], [*Descrição*],
    [Loja], [[1 : 1..\*]], [Ponto de venda], [contém um ou mais pontos de venda; cada ponto de venda pertence a uma loja.]
  )
)

=== Catálogo e fornecimento

#figure(
  caption: "Relacionamentos de Catálogo e Fornecimento",
  kind: table,
  table(
    columns: (2.5fr, 1.5fr, 2.5fr, 1.5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade 1*], [*Multiplicidade*], [*Entidade 2*], [*Descrição*],
    [Produto], [[\* : 1]], [Categoria], [organizado numa categoria; uma categoria agrupa vários produtos.],
    [Produto], [[\* : \*]], [Fornecedor], [pode ser fornecido por vários fornecedores e um fornecedor fornece vários produtos.],
  )
)

=== Operações de venda

#figure(
  caption: "Relacionamentos de Operações de Venda",
  kind: table,
  table(
    columns: (2.5fr, 1.5fr, 2.5fr, 1.5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade 1*], [*Multiplicidade*], [*Entidade 2*], [*Descrição*],
    [Venda], [[\* : 1]], [Loja], [realizada em loja; uma loja regista várias vendas.],
    [Venda], [[\* : 1]], [Ponto de venda], [efetuada e registada num ponto de venda específico.],
    [Venda], [[\* : 0..1]], [Operador de Caixa], [pode ser registada por operador; um operador regista várias vendas.],
    [Venda], [[1 : 1..\*]], [Linha de Venda], [composta por uma ou mais linhas de venda.],
    [Linha de Venda], [[\* : 1]], [Produto], [refere um produto; um produto pode aparecer em várias linhas de venda.],
    [Produto], [[\* : 0..1]], [Promoção], [pode beneficiar de uma promoção ativa.],
    [Venda], [[1 : 1]], [Pagamento], [possui um pagamento associado.],
    [Venda], [[1 : 1]], [Fatura], [gera uma fatura.],
    [Fatura], [[\* : 0..1]], [Cliente], [pode, opcionalmente, estar associada a um cliente identificado por NIF.],
    [Devolução], [[1 : 1]], [Venda], [anula total ou parcialmente uma venda original.],
    [Devolução], [[1 : 1..\*]], [Linha de Devolução], [composta por uma ou mais linhas devolvidas.],
    [Linha de Devolução], [[\* : 1]], [Produto], [refere um produto devolvido.],
  )
)

=== Gestão de stock e encomendas

#figure(
  caption: "Relacionamentos de Gestão de Stock e Encomendas",
  kind: table,
  table(
    columns: (2.5fr, 1.5fr, 2.5fr, 1.5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade 1*], [*Multiplicidade*], [*Entidade 2*], [*Descrição*],
    [Stock], [[1 : 1]], [Produto], [cada registo de stock refere um produto.],
    [Produto], [[\* : 1]], [Loja], [cada produto é armazenado numa loja. Uma loja armazena vários produtos.],
    [Encomenda], [[\* : 1]], [Fornecedor], [feita a um fornecedor.],
    [Encomenda], [[\* : 1]], [Loja], [destina-se a uma loja.],
    [Encomenda], [[1 : 1..\*]], [Linha de Encomenda], [composta por uma ou mais linhas.],
    [Linha de Encomenda], [[\* : 1]], [Produto], [refere um produto.],
    [Entrada de Mercadoria], [[\* : 1]], [Loja], [recebida numa loja.],
    [Entrada de Mercadoria], [[\* : 1]], [Fornecedor], [proveniente de um fornecedor.],
  )
)

=== Recursos humanos e operações diárias

#figure(
  caption: "Relacionamentos de Recursos Humanos e Operações Diárias",
  kind: table,
  table(
    columns: (2.5fr, 1.5fr, 2.5fr, 1.5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade 1*], [*Multiplicidade*], [*Entidade 2*], [*Descrição*],
    [Funcionário], [[\* : 1]], [Loja], [trabalha em loja; cada funcionário está afeto a uma loja; uma loja emprega vários funcionários.],
    [Funcionário], [[\* : 1]], [Turno], [realiza vários turnos. Um turno é realizado por 1 funcionário.],
    [Turno], [[\* : 1]], [Loja], [feito numa loja.],
    [Alerta], [[\* : 1]], [Loja], [sobre uma loja.],
    [Sangria], [[\* : 1]], [Operador de Caixa], [feita por operador de caixa.],
    [Gerente], [[1 : \*]], [Sangria], [valida a sangria.],
      [Sangria], [[\* : 1]], [Ponto de Venda], [de um PDV.],
    [Fecho de Turno], [[1 : 1]], [Turno], [referente a turno; cada fecho de turno corresponde a exatamente um turno.],
    [Fecho de Turno], [[\* : 1]], [Funcionário], [registado pelo funcionário responsável.],
    [Fecho de Dia], [[\* : 1]], [Loja], [referente a loja; cada fecho de dia corresponde a uma loja numa data específica.],
  )
)

=== Promoções

#figure(
  caption: "Relacionamentos de Promoções",
  kind: table,
  table(
    columns: (2.5fr, 1.5fr, 2.5fr, 1.5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Entidade 1*], [*Multiplicidade*], [*Entidade 2*], [*Descrição*],
    [Promoção], [[\* : \*]], [Produto], [pode abranger vários produtos e um produto pode estar sujeito a várias promoções .],
    [Promoção], [[\* : \*]], [Categoria], [pode abranger várias categorias e uma categoria pode estar sujeita a várias promoções.],
  )
)

=== Relações de generalização (é um)

#figure(
  caption: "Relações de Generalização",
  kind: table,
  table(
    columns: (2.5fr, 1fr, 2.5fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Subtipo*], [*Relação*], [*Superclasse*],
    [Operador de Caixa], [é um], [Funcionário],
    [Gerente], [é um], [Funcionário],
    [Administrador], [é um], [Funcionário]
  )
)
#figure(
  caption: "Diagrama do Modelo de Domínio do Sistema FlashStore",
  kind: image,
  image("images/Modelo de Dominínio.jpg", width: 100%)
)
= Esboços de Interfaces de Utilizador

Os esboços apresentados nesta secção foram elaborados na fase de elicitação de requisitos e serviram como ponto de partida para o design detalhado das interfaces descrito no Capítulo 2. Cada esboço corresponde a um perfil de utilizador e cobre os fluxos de maior frequência de utilização.

=== Ecrã de Autenticação (UC00)

#figure(
   caption: "Esboço do Ecrã de Autenticação",
   kind: image,
   image("images/esboco_login.png", width: 70%)
)

O ecrã de autenticação é o ponto de entrada do sistema. O esboço centra-se na introdução de credenciais (email e password) através de um formulário minimalista, com identificação visual da loja e data/hora atuais. O design privilegia a rapidez de acesso — o operador de caixa deve conseguir autenticar-se em poucos segundos no início de cada turno (RF20, RNF07). O ecrã serve igualmente como ecrã de repouso quando nenhum utilizador está autenticado.

=== Ecrã de Ponto de Venda / PDV (UC01, UC02, UC03)

#figure(
  caption: "Esboço do Ecrã de Ponto de Venda (PDV)",
  kind: image,
  image("images/esboco_pdv.png", width: 100%)
)

O esboço do PDV divide o ecrã em três zonas funcionais: a zona esquerda com a lista de artigos da venda em curso e subtotais; a zona central com o total, o método de pagamento selecionado e o campo de troco; e a zona direita com acesso rápido a funções como cancelar artigo, consultar stock e fechar turno. A barra superior identifica o operador autenticado, o número do turno e a hora. O objetivo é que o registo de uma venda simples (produto → carrinho → pagamento) seja concluído em no máximo 3 interações (RNF13).

=== Backoffice do Gerente de Loja (UC04, UC05, UC06, UC07)

#figure(
  caption: "Esboço do Backoffice do Gerente de Loja",
  kind: image,
  image("images/esboco_backoffice.png", width: 100%)
)

O esboço do backoffice local organiza-se por separadores laterais, disponibilizando as seguintes secções: Resumo do Dia (vendas agregadas, alertas de stock e validade), Gestão de Stock (consulta e ajuste manual de inventário), Encomendas (criação e acompanhamento de pedidos a fornecedores), Promoções e Fecho de Dia (validação dos turnos e encerramento do dia operacional). O design privilegia tabelas de dados com indicadores de cor para alertas (verde, amarelo, vermelho), de modo a facilitar a triagem visual rápida pelo gerente (RF07–RF13, RF16).

=== Dashboard Central do Administrador (UC08, UC09, UC10, UC11)

#figure(
  caption: "Esboço do Dashboard Central do Administrador",
  kind: image,
  image("images/esboco_dashboard.png", width: 100%)
)

O esboço do dashboard central apresenta uma vista consolidada das 8 lojas, com cartões de indicadores de desempenho (vendas do dia, comparativo semanal, alertas globais de stock). O painel lateral dá acesso a relatórios filtráveis por loja, período e categoria, à secção de conformidade fiscal (geração e submissão do ficheiro SAFT-PT) e à gestão de utilizadores e promoções da cadeia (RF16, RF17, RF19, RF21).


= Capítulo 2 - Arquitetura e Design do Software utilizando LLM


== Processo de design assistido por LLM
       
A conceção da arquitetura e o design do sistema FlashStore beneficiaram fortemente da utilização de Modelos de Linguagem de Grande Escala (LLMs), nomeadamente o ChatGPT e o Claude. A integração destas ferramentas no fluxo de trabalho de Engenharia de Software não procurou substituir a tomada de decisão humana, mas sim atuar como um "arquiteto de software co-piloto", acelerando a exploração de alternativas, a estruturação de documentação formal (como os _Architecture Decision Records_ - ADRs) e a transição da elicitação de requisitos para a modelação conceptual.

=== Estratégia de Prompting e Iteração

O processo de interação com os LLMs seguiu uma abordagem estruturada e iterativa, fundamentada em três princípios centrais:
1. *Injeção de Contexto Restritivo:* Os _prompts_ iniciais nunca foram genéricos. Foram sempre alimentados com as restrições críticas identificadas na fase de requisitos (ex: R05 - Modo offline obrigatório, R09 - Solução económica). Esta técnica obrigou os modelos a descartar soluções "ideais" na teoria (como microserviços na cloud) em prol de arquiteturas viáveis para o contexto de uma PME.
2. *Geração Comparativa:* Exigiu-se frequentemente que o LLM apresentasse múltiplas alternativas e as avaliasse face aos nossos requisitos, forçando a justificação explícita antes de aceitarmos uma recomendação (ex: "Compara Monólito, Microserviços e Cliente-Servidor").
3. *Refinamento com Conhecimento Específico:* Quando o LLM gerava modelos conceptuais muito puristas ou demasiado genéricos, o _prompting_ subsequente injetava material de estudo específico (ex: "Baseia-te no caso de estudo Mercearia da D. Acácia") ou regras de negócio locais (ex: SAFT-PT) para forçar o modelo a alinhar-se com a realidade do retalho português e com o rigor académico da unidade curricular.

=== Avaliação Crítica e Limitações

A utilização dos LLMs provou ser extremamente eficaz na *estruturação e formatação rápida* de padrões estabelecidos. A geração do Modelo de Domínio inicial, a elaboração das tabelas de ADRs e a sugestão de Padrões de Design (como o _Outbox Pattern_ para sincronização) pouparam dezenas de horas de trabalho puramente redatorial e de pesquisa teórica. O modelo funcionou como uma excelente caixa de ressonância para validar as nossas intuições arquiteturais.

No entanto, o processo evidenciou limitações significativas que exigiram a intervenção constante da equipa:
- *Alucinação de Requisitos e "Overengineering":* Nos diagramas iniciais, os modelos tenderam a sugerir bases de dados NoSQL (ex: MongoDB) e arquiteturas em tempo real (WebSockets), ignorando a forte estrutura relacional necessária para relatórios financeiros e a impossibilidade de manter ligações persistentes em algumas das lojas.
- *Desconhecimento do Domínio Fiscal Local:* As complexidades da faturação portuguesa, nomeadamente a opcionalidade do NIF na Venda e a exclusividade da geração do SAFT-PT no servidor central, tiveram de ser corrigidas manualmente, pois os LLMs assumiam fluxos de e-commerce anglo-saxónicos genéricos.
- *Dificuldades com Notação Estrita:* Na geração de código PlantUML, os LLMs cometeram pequenos erros semânticos (ex: confundir ligações IPC com HTTP no Electron), o que reforça que o código gerado por IA requer sempre auditoria técnica.

Em suma, o LLM foi um catalisador de produtividade, mas o rigor, a validação face ao domínio de negócio e as decisões finais de engenharia permaneceram da inteira responsabilidade da equipa FlashStore.

== Decisões arquiteturais

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nos requisitos funcionais e não funcionais consolidados na Etapa 1 do projeto FlashStore (em particular R05 — modo offline, R07 — consolidação diária, R09 — solução económica) e nas restrições identificadas (R01–R09), propõe e justifica o padrão arquitetural global para o sistema. Compara pelo menos três alternativas (arquitetura monolítica centralizada, microserviços, e arquitetura em camadas com cliente-servidor distribuído) e fundamenta a escolha final. Apresenta a decisão no formato ADR (Architecture Decision Record) com os campos: ID e Estado, Contexto, Decisão, Justificação, Alternativas Consideradas e Consequências.
  ],
  analise: [
    O Claude produziu a comparação de alternativas de forma clara e bem fundamentada. A decisão pelo modelo cliente-servidor distribuído com Electron foi corretamente justificada pela necessidade de acesso a hardware periférico (leitores de código de barras, impressoras fiscais) e pelo requisito de operação offline (R05). O modelo identificou também como consequência relevante a complexidade de resolução de conflitos na sincronização, o que levou a equipa a desenvolver mais tarde o ADR-003 sobre a estratégia Outbox. A equipa ajustou a secção de alternativas para incluir a justificação de rejeição do monolítico centralizado de forma mais explícita.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
     Tendo em conta a stack tecnológica selecionada (Electron + React para o terminal de loja, Node.js/Express para o servidor central, SQLite para ambas as bases de dados), gera uma tabela comparativa da stack com as colunas: Camada, Tecnologia, Justificação. Cobre todas as camadas: runtime desktop, frontend/PDV, lógica de negócio local, servidor central, base de dados local, base de dados central, comunicação loja-central e IPC interno do Electron. Para cada tecnologia, a justificação deve referenciar os requisitos ou restrições que motivam a escolha.
  ],
  analise: [
    A tabela gerada foi completa e as justificações foram tecnicamente corretas. A tabela foi adotada diretamente como Tabela 26 do relatório.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 3,
  prompt: [
     Gera dois ADRs adicionais para o sistema FlashStore, no mesmo formato da Tabela 25: (1) ADR-002 sobre a decisão da base de dados — justifica a escolha do SQLite embebido no Electron e no servidor central em vez de MongoDB ou PostgreSQL, tendo em conta o volume transacional de 8 pequenas lojas com sincronização diária e a restrição de custo R09; (2) ADR-003 sobre a estratégia de sincronização offline — justifica a adoção do padrão Outbox com idempotência por UUID, descartando alternativas como WebSockets em tempo real, ficheiros CSV e replicação SQLite direta.
  ],
  analise: [
    O Claude produziu os dois ADRs com o nível de detalhe adequado. A justificação do SQLite no contexto de uma PME com margens baixas (R09) foi especialmente bem argumentada. No ADR-003, a rejeição da replicação SQLite direta por ausência de validação de negócio no momento da integração — o que comprometeria a integridade do SAFT-PT — foi um argumento que a equipa não tinha considerado explicitamente e que foi incorporado na justificação final. Os dois ADRs foram adotados como Tabelas 27 e 29 do relatório.
  ],
)
#llm-end()

A definição da arquitetura de software constitui uma das etapas mais determinantes do ciclo de vida de um sistema, uma vez que as decisões tomadas nesta fase condicionam profundamente a capacidade de evolução, a manutenibilidade e o desempenho da solução ao longo do tempo. No caso do sistema FlashStore, a complexidade do contexto operacional — rede de lojas geograficamente distribuídas com requisitos simultâneos de autonomia local, integração centralizada e conformidade legal — impõe a necessidade de uma abordagem arquitectural cuidada e fundamentada.

As decisões apresentadas foram tomadas com base na análise dos requisitos funcionais e não funcionais consolidados na Etapa 1, nas restrições identificadas (R01–R09) e no processo de revisão assistido por LLM descrito na secção anterior. Para cada decisão de relevo foi adotado o formato ADR (Architecture Decision Record).

=== Padrão Arquitetural Global

Após análise comparativa de vários estilos arquitecturais e revisão assistida por LLM, foi adotada uma arquitetura em camadas (_Layered Architecture_) combinada com um modelo de implantação cliente-servidor distribuído. Esta combinação responde à natureza híbrida do sistema FlashStore, que opera simultaneamente em dois planos: a operação local descentralizada de cada loja e a gestão centralizada na sede.

A arquitetura em camadas organiza o software em quatro níveis hierárquicos bem definidos, em que cada camada apenas comunica com a camada imediatamente adjacente:

- *Camada de Apresentação:* interfaces React do PDV e backoffice local, servidas dentro de uma aplicação Electron em cada terminal de loja; dashboard central acessível via browser na sede.
- *Camada de Aplicação (Lógica de Negócio):* do lado da loja, reside no processo principal do Electron (Node.js); do lado do servidor central, é exposta por uma API REST em Node.js/Express.
- *Camada de Domínio:* entidades e lógica pura (Venda, Produto, Stock, Fatura, etc.), independente de tecnologias externas e partilhada entre cliente e servidor.
- *Camada de Dados:* SQLite embebido no Electron de cada loja para suporte ao modo offline; SQLite no servidor central para consolidação e análise.

Do ponto de vista de implantação, cada loja dispõe de uma aplicação desktop Electron autónoma que sincroniza periodicamente com o servidor central (Node.js/Express + SQLite) através de uma API REST sobre HTTPS. O servidor central pode ser alojado na sede ou num serviço de cloud de baixo custo, sem requerer hardware especializado. Esta topologia está alinhada com as restrições R05 (suporte offline), R07 (consolidação diária obrigatória) e R09 (solução económica e escalável).

#figure(
  table(
    columns: (auto, 1fr), 
    stroke: 0.5pt,
    fill: (col, row) => if row == 0 { luma(230) } else { white },
    [*Campo*], [*Detalhe*],
    [ID e Estado], [ADR-001 — Aprovado],
    [Contexto], [O sistema FlashStore opera em 8 lojas geograficamente distribuídas, cada uma com necessidade de autonomia operacional total (incluindo modo offline obrigatório) e obrigação de consolidar dados diariamente num servidor central. A FlashStore é uma cadeia de pequenas lojas de conveniência com margens baixas, pelo que os custos de infraestrutura devem ser minimizados (R09).],
    [Decisão], [Arquitetura em camadas (4 camadas: Apresentação, Aplicação, Domínio, Dados) com modelo cliente-servidor distribuído. Cada loja corre uma aplicação Electron com SQLite embebido; o servidor central é uma API Node.js/Express com SQLite. Comunicação via API REST/HTTPS com sincronização diária.],
    [Justificação], [O Electron permite empacotar a aplicação React como executável nativo com acesso direto a hardware periférico (leitor de código de barras, impressora fiscal via porta serial/USB) e operação totalmente offline. A API REST no servidor central é simples de implementar, bem suportada por LLMs para geração de código, e não requer infraestrutura dedicada. O modelo distribuído é o padrão dominante em cadeias de retalho (e.g., 7-Eleven, SPAR).],
    [Alternativas consideradas], [1) Aplicação web pura — rejeitada por limitações de acesso a hardware periférico em contexto offline. 2) Microserviços — rejeitados por complexidade desproporcional ao contexto de PME. 3) Monolítico centralizado — rejeitado por incompatibilidade com o requisito de operação offline (R05).],
    [Consequências], [A sincronização offline introduz complexidade de resolução de conflitos, mitigada pelo padrão Outbox com idempotência por UUID (ADR-003). A distribuição e atualização do executável Electron nas 8 lojas requer uma estratégia de auto-update.],
  ),
  caption: [ADR-001 — Padrão arquitectural global],
)

=== Stack Tecnológica

A stack tecnológica foi selecionada com base em três critérios fundamentais: adequação aos requisitos funcionais e não funcionais; capacidade de geração e revisão de código assistida por LLM; e sustentabilidade económica (R09).

O fluxo de desenvolvimento partiu da criação ágil de protótipos para acelerar as fases iniciais. O código React e a lógica de negócio correspondente foram submetidos a sessões iterativas de refactoring assistido por LLM (Claude e ChatGPT), sendo adaptados para a stack final — Electron, Node.js e SQLite — e versionados no repositório do projeto. Esta abordagem reduziu o tempo de scaffolding inicial mantendo controlo total sobre o código.

#block(breakable: true)[
#figure(
  table(
    columns: (auto, auto, 1fr),
    stroke: 0.5pt,
    fill: (col, row) => if row == 0 { luma(230) } else { white },
    table.header(
      [*Camada*], [*Tecnologia*], [*Justificação*],
    ),
    [Runtime desktop (loja)], [Electron (Node.js)], [Permite empacotar a aplicação como executável nativo com acesso direto a hardware periférico (leitor de código de barras, impressora fiscal) e operação totalmente offline sem dependência de browser.],
    [Frontend / PDV], [React (JavaScript)], [Componentes reativos adequados à interface de alta frequência do PDV; código refinado iterativamente com LLM; ecossistema maduro.],
    [Lógica de negócio (loja)], [Node.js (processo principal Electron)], [Orquestra vendas, sincronização e relatórios locais com acesso ao sistema de ficheiros e ao SQLite, sem depender do servidor central.],
    [Servidor central], [Node.js / Express], [Framework minimalista para API REST; partilha o ecossistema Node.js do Electron, maximizando a reutilização de código da camada de domínio.],
    [Base de dados (loja)], [SQLite], [Base de dados embebida sem servidor dedicado; adequada ao volume transacional local; suporte nativo ao modo offline (R05).],
    [Base de dados (central)], [SQLite], [Adequado ao volume de 8 pequenas lojas com sincronização diária. Mantém homogeneidade tecnológica, elimina custos de licenciamento (R09) e é migrável para PostgreSQL futuramente sem alterar a camada de domínio.],
    [Comunicação loja ↔ central], [API REST / HTTPS + JSON], [Protocolo universal com integração com o gateway de pagamentos e a AT (SAFT-PT); autenticação JWT garante que apenas terminais autorizados sincronizam (R08).],
    [IPC (intra-Electron)], [Electron IPC (ipcMain / ipcRenderer)], [Comunicação segura e nativa entre o processo React e o Node.js dentro do Electron, reduzindo latência nas operações críticas do PDV (R04).],
  ),
  caption: [Stack tecnológica do sistema FlashStore],
)
]

#block(breakable: true)[
#figure(
  table(
    columns: (auto, 1fr),
    stroke: 0.5pt,
    fill: (col, row) => if row == 0 { luma(230) } else { white },
    table.header([*Campo*], [*Detalhe*]),
    [ID e Estado], [ADR-002 — Aprovado],
    [Contexto], [O sistema requer persistência de transações financeiras e conformidade com SAFT-PT. As lojas necessitam de base de dados local para modo offline. O servidor central consolida dados de 8 lojas de pequena dimensão com sincronização apenas diária. A FlashStore tem margens baixas e custos de infraestrutura devem ser minimizados (R09).],
    [Decisão], [SQLite embebido no Electron em cada loja e SQLite no servidor central (Node.js/Express). A sincronização é feita por transferência de pacotes JSON via API REST que o servidor aplica à sua instância SQLite.],
    [Justificação], [A consolidação de 8 pequenas lojas com sincronização diária está inteiramente dentro das capacidades comprovadas do SQLite. A homogeneidade tecnológica simplifica a sincronização, a manutenção e a geração de código com LLM. Elimina a necessidade de instalar e gerir um servidor de base de dados separado, reduzindo custos operacionais (R09). A consistência transacional é assegurada pelas transações ACID nativas do SQLite e pela validação de unicidade por UUID na camada de aplicação.],
    [Alternativas consideradas], [MongoDB — rejeitado por exigir servidor dedicado sem trazer vantagens para dados estruturados com queries relacionais (relatórios, SAFT-PT). PostgreSQL — mais robusto para volumes elevados, mas exige servidor de base de dados dedicado no central, aumentando custos e complexidade de forma injustificada para 8 lojas de pequena dimensão; pode ser adotado futuramente se a cadeia expandir.],
    [Consequências], [O acesso concorrente ao SQLite do servidor central é gerido por um mecanismo de fila de escrita no Express para evitar conflitos de bloqueio. O esquema foi desenhado com normalização adequada para suportar as queries analíticas dos relatórios e a geração do SAFT-PT.],
  ),
  caption: [ADR-002 — Decisão sobre base de dados],
)
]


=== Padrões de Design Aplicados

A definição dos padrões de design foi orientada pelos requisitos de extensibilidade, testabilidade e clareza estrutural do código, com base nas recomendações do processo de revisão arquitectural assistida por LLM:

#figure(
  table(
    columns: (auto, auto, auto, auto),
    stroke: 0.5pt,
    fill: (col, row) => if row == 0 { luma(230) } else { white },
    [*Padrão*], [*Contexto de aplicação*], [*Benefício*], [*Requisitos cobertos*],
    [Repository], [Acesso à base de dados SQLite (local e central)], [Isola a lógica de persistência; permite substituir SQLite por outro motor sem alterar as camadas superiores.], [R05, RNF04, RNF06],
    [Strategy], [Processamento de pagamentos (numerário, MB Way, Multibanco, cartão)], [Permite adicionar novos métodos de pagamento sem modificar o fluxo principal de venda.], [RF04, RF05],
    [Observer], [Alertas de stock mínimo e validade próxima], [Desacopla a lógica de alerta da lógica de venda; permite múltiplos subscritores sem acoplamento direto.], [RF12, RF13],
    [Facade], [API REST do servidor central], [Interface simplificada para as lojas acederem ao núcleo central, ocultando a complexidade da consolidação e das queries analíticas SQLite.], [RF14, RF15, RF16],
    [Template Method], [Geração de relatórios (diário local, comparativo central, SAFT-PT)], [Define o esqueleto do processo de geração, permitindo especialização por tipo sem duplicação de código.], [RF09, RF16, RF17],
    [IPC Bridge], [Comunicação React ↔ Node.js dentro do Electron], [Encapsula os canais IPC do Electron em serviços tipados, evitando acoplamento direto entre a UI React e a lógica de negócio Node.js.], [RF01, RF07, RF08],
  ),
  caption: [Padrões de design adotados e contexto de aplicação],
)

=== Estratégia de Sincronização e Modo Offline

A operação em modo offline constitui um dos requisitos mais exigentes do sistema (R05, RNF04), dado que falhas de conectividade são frequentes em várias localizações da rede FlashStore, nomeadamente em zonas rurais. A estratégia adotada assenta em quatro princípios:

- *Autonomia local total:* durante uma falha de rede, o terminal Electron continua a registar vendas, emitir faturas e atualizar o stock no SQLite local, sem qualquer degradação visível para o operador. Toda a lógica crítica reside no Node.js local do Electron.

- *Sincronização eventual e automática:* quando a ligação é restabelecida, o módulo de sincronização envia as transações pendentes via API REST/HTTPS para o servidor central, sem intervenção manual.

- *Idempotência por UUID:* cada transação é identificada por um UUID gerado localmente no momento do registo. O servidor central verifica o UUID antes de aplicar cada transação, rejeitando silenciosamente os duplicados (RNF06).

- *Sincronização reativa:* além da sincronização automática quando a rede volta, o sistema prevê verificações regulares no servidor central — nomeadamente após o fecho operacional da loja — para garantir que os dados locais e os do central estão alinhados e que não ficam operações por enviar.

#figure(
  table(
    columns: (auto, 1fr),
    stroke: 0.5pt,
    fill: (col, row) => if row == 0 { luma(230) } else { white },
    [*Campo*], [*Detalhe*],
    [ID e Estado], [ADR-003 — Aprovado],
    [Contexto], [As lojas devem operar autonomamente durante falhas de rede e sincronizar dados com o servidor central quando a ligação for restabelecida, sem risco de duplicação de transações financeiras. A sincronização não precisa de ser em tempo real, mas deve ser fiável e automática.],
    [Decisão], [Cada transação é identificada por um UUID gerado no Node.js local no momento do registo. O módulo de sincronização mantém uma fila de eventos pendentes (_outbox_) no SQLite local. Quando a ligação é restabelecida, os eventos são enviados via API REST para o servidor central, que verifica o UUID antes de aplicar cada um, rejeitando silenciosamente os duplicados.],
    [Justificação], [O _Outbox Pattern_ é amplamente utilizado em sistemas distribuídos para garantia de entrega fiável de eventos. A persistência da fila no SQLite local garante que os eventos sobrevivem a falhas de energia ou reinícios do terminal. A verificação por UUID é O(1) com índice, sem impacto relevante na performance.],
    [Alternativas consideradas], [1) WebSockets em tempo real — rejeitados por incompatibilidade com o requisito de operação offline. 2) Envio de ficheiros CSV — rejeitado por ausência de rastreabilidade e dificuldade de resolução de conflitos. 3) Replicação SQLite direta — rejeitada por ausência de validação de negócio no momento da integração, comprometendo a integridade do SAFT-PT.],
    [Consequências], [O módulo de sincronização mantém o estado de cada evento (pendente, enviado, confirmado) e é executado como tarefa agendada no processo principal do Electron. O armazenamento local de eventos pendentes é limitado temporalmente para evitar crescimento ilimitado do SQLite local.],
  ),
  caption: [ADR-003 — Estratégia de sincronização offline],
)

=== Conformidade Legal e Integrações Externas

O contexto legal português impõe restrições arquitecturais concretas. Foram identificadas duas integrações externas obrigatórias:

*Autoridade Tributária (AT) — Geração do ficheiro SAFT-PT:* O sistema gera mensalmente um ficheiro XML no formato SAFT-PT agregando todas as faturas emitidas pelos PDVs da cadeia (RF17), disponível até ao dia 5 do mês seguinte (R02). Este módulo é implementado como serviço isolado no Node.js/Express do servidor central — uma função dedicada que executa queries de agregação sobre o SQLite central e produz o XML no schema exigido pela AT — invocável pelo Administrador / Gestor Central (UC09), sem dependência dos módulos operacionais das lojas.

*Gateway de Pagamentos — Integração com rede bancária:* Os pagamentos eletrónicos (Multibanco, MB Way, cartão contactless) requerem comunicação em tempo real com um gateway externo para autorização de débito (RF04). Esta integração é implementada no Node.js local do Electron através do padrão Strategy, com cada método encapsulado numa implementação específica. A comunicação é via API REST/HTTPS com timeout de 2 segundos (R04). Em caso de falha do gateway, o sistema mantém a venda em estado pendente e permite ao operador reprocessar ou alternar para numerário.


=== Síntese das Decisões Arquiteturais

#figure(
  table(
    columns: (auto, 1fr, auto, auto),
    stroke: 0.5pt,
    fill: (col, row) => if row == 0 { luma(230) } else { white },
    [*ADR*], [*Decisão*], [*Estado*], [*Restrições*],
    [ADR-001], [Arquitetura em camadas + cliente-servidor com Electron (loja) e Node.js/Express (central)], [Aprovado], [R04, R05, R07, R09],
    [ADR-002], [SQLite embebido no Electron (loja) + SQLite no servidor central (Node.js/Express)], [Aprovado], [R01, R05, R06, R09, RNF06],
    [ADR-003], [Sincronização eventual com Outbox Pattern e idempotência por UUID via API REST/HTTPS], [Aprovado], [R05, R07, RNF04, RNF06],
    [—], [Stack: React + Electron + Node.js/Express + SQLite (código base refinado com LLM)], [Aprovado], [R04, R05, R09],
    [—], [Padrões: IPC entre processos Electron (loja), fachada de acesso à API no cliente, módulos de domínio no servidor (vendas, stock, sync, SAFT).], [Aprovado], [RF04, RF12, RF14, RF16, RF17],
  ),
  caption: [Síntese das decisões arquitecturais do sistema FlashStore],
)

== Arquitetura global do sistema

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base na arquitetura em camadas e no modelo cliente-servidor distribuído definidos nas decisões arquiteturais (ADR-001), descreve em texto académico corrido a arquitetura global do sistema FlashStore. Explica a organização em dois tipos de nós (terminal Electron por loja e servidor central Node.js/Express), a natureza autossuficiente de cada terminal local (React + Node.js + SQLite embebido), o papel do servidor central na consolidação e análise de dados, e o protocolo de comunicação entre os dois nós (API REST sobre HTTPS com sincronização diária). Máximo 2 parágrafos, sem tópicos.
  ],
  analise: [
    O texto gerado foi claro e adequado a uma secção de descrição da arquitetura global. A equipa ajustou a referência à sincronização para ser mais precisa: o texto original dizia "sincronização em tempo real quando possível", o que contradizia a decisão arquitetural de sincronização diária obrigatória ao fecho do dia (R07, ADR-003). A correção tornou explícito que a sincronização é assíncrona e diária por design, não por limitação técnica.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
     Gera o código PlantUML para o Diagrama de Componentes do sistema FlashStore, usando a notação de componentes UML. O diagrama deve representar dois nós principais: (1) Terminal de Loja (Electron) com os componentes: React UI (PDV/Backoffice), IPC Bridge, Lógica de Negócio (Node.js), Módulo de Sincronização (Outbox), Módulo de Pagamentos (Strategy) e Repositório Local (SQLite); (2) Servidor Central (Node.js/Express) com os componentes: API REST (Express), Controladores (Routes), Lógica de Negócio (Services), Módulo SAFT-PT e Repositório Central (SQLite). Representa as interfaces de comunicação entre componentes: ipcRenderer/ipcMain dentro do Electron, HTTPS REST + JWT entre os dois nós, e HTTPS REST para o Gateway de Pagamentos e para a AT/e-Fatura.
  ],
  analise: [
     O modelo gerou código PlantUML funcional com a organização correta dos componentes. Foram necessárias três correções: (1) o modelo representou a biblioteca better-sqlite3 como um componente de negócio em vez de uma dependência técnica do repositório — a equipa ajustou para mostrar a relação correta; (2) a interface IPC entre o React UI e a IPC Bridge estava representada como uma ligação HTTP, o que é tecnicamente incorreto no Electron (usa ipcRenderer/ipcMain); (3) o Módulo SAFT-PT estava ligado diretamente ao Terminal de Loja, quando na arquitetura definida este módulo reside exclusivamente no servidor central. Após estas correções, o diagrama foi exportado e integrado como Figura 5.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 3,
  prompt: [
     Gera o código PlantUML para o Diagrama de Deployment do sistema FlashStore. O diagrama deve representar: (1) o nó físico "Loja (x8)" contendo um sub-nó "Terminal PDV (PC com Electron)" com os artefactos flashstore-loja.exe (Electron + React + Node.js) e loja.db (SQLite); (2) o nó "Sede FlashStore (Servidor Central)" contendo um sub-nó "Servidor Node.js/Express" com os artefactos flashstore-central (Node.js + Express) e central.db (SQLite); (3) os nós externos "Gateway de Pagamentos (MB Way/Multibanco)" e "Autoridade Tributária (Portal e-Fatura)". Representa os protocolos de comunicação: HTTPS REST (autorização de pagamento) entre o Terminal e o Gateway; HTTPS REST/JSON com JWT (sincronização diária) entre o Terminal e o Servidor Central; e HTTPS (SAFT-PT mensal) entre o Servidor Central e a AT.
  ],
  analise: [
    O diagrama de deployment gerado foi o que exigiu menos correções de todos os diagramas PlantUML do projeto. O modelo interpretou corretamente a notação de nós aninhados e os protocolos de comunicação. A única correção necessária foi a remoção de uma ligação direta entre o Terminal de Loja e a Autoridade Tributária, que o modelo incluiu erroneamente — na arquitetura definida, a geração e submissão do SAFT-PT é responsabilidade exclusiva do servidor central (UC09). O diagrama corrigido foi exportado e integrado como Figura 6.
  ],
)
#llm-end()

O sistema FlashStore segue uma arquitetura distribuída composta por dois tipos de nós: os terminais
locais de cada loja, implementados como aplicações Electron, e o servidor central que agrega e expõe
os dados consolidados da cadeia. A comunicação entre ambos é feita exclusivamente via API REST sobre
HTTPS, de forma assíncrona e com sincronização diária obrigatória ao fecho do dia operacional.

Do ponto de vista lógico, cada terminal de loja é uma aplicação autossuficiente: contém a interface
React do PDV e do backoffice local, a lógica de negócio no processo principal Node.js do Electron e
uma base de dados SQLite embebida que garante a continuidade das operações em modo offline. O servidor
central expõe uma API REST Node.js/Express que recebe os pacotes de sincronização diária de cada loja,
consolida os dados no seu próprio SQLite e disponibiliza os endpoints de análise e geração de relatórios
para o dashboard da administração central.

=== Diagrama de Componentes

O diagrama de componentes ilustra a organização interna de cada nó e as interfaces entre eles,
evidenciando os módulos principais, as suas responsabilidades e as dependências entre camadas.

#figure(
  image("images/componentes.jpeg", width: 100%),
  caption: "Diagrama de Componentes do Sistema FlashStore",
)

=== Diagrama de Deployment

O diagrama de deployment ilustra a distribuição física dos nós do sistema, os artefactos que neles
residem e os protocolos de comunicação utilizados entre cada nó.

#figure(
  image("images/deployment.jpeg", width: 100%),
  caption: "Diagrama de Deployment do Sistema FlashStore",
)

== Diagrama de classes

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nas entidades do modelo de domínio do sistema FlashStore (Tabelas 12–17) e nas decisões de design adotadas (padrões Repository, Strategy e Observer), gera uma proposta inicial de diagrama de classes para a solução de software. Ao contrário do modelo de domínio, o diagrama de classes deve incorporar decisões de implementação: define os atributos com tipos de dados, as operações de cada classe coerentes com os casos de uso, e as relações de implementação. Organiza as classes em dois agrupamentos funcionais: núcleo operacional (PDV, stock, venda, pagamento) e módulo de gestão e utilizadores (funcionários, turnos, fechos). Apresenta o resultado em código PlantUML.
  ],
  analise: [
    O modelo gerou uma proposta inicial sólida para o núcleo operacional, com as classes de negócio principais bem definidas. A equipa efetuou ainda um ajuste visual no código PlantUML para organizar os dois agrupamentos funcionais em packages separados, tornando o diagrama mais legível. A coerência entre o diagrama de classes e o modelo de domínio foi verificada pela equipa antes da submissão.
  ],
)
#llm-end()


O diagrama de classes apresentado nesta secção constitui o modelo estrutural da solução de software,
traduzindo as entidades conceptuais do modelo de domínio em classes concretas com atributos,
operações e relações de implementação. Ao contrário do modelo de domínio, que representa o
vocabulário do negócio de forma independente de tecnologia, o diagrama de classes incorpora decisões
de design já tomadas, nomeadamente a separação em módulos operacionais alinhados com a arquitetura
em camadas definida na secção anterior.

O modelo foi organizado em dois agrupamentos funcionais: o núcleo operacional, centrado nas
operações de ponto de venda e gestão de stock de cada loja, e o módulo de gestão e utilizadores,
que abrange a estrutura hierárquica de colaboradores, turnos e fechos de operação.

O processo de geração assistida por LLM foi utilizado para derivar uma proposta inicial de classes a
partir das entidades e relacionamentos do modelo de domínio. A proposta foi subsequentemente revista
pela equipa, com introdução de ajustes relativos à separação de responsabilidades, à definição das
operações de cada classe e à coerência com os padrões de design adotados (Repository, Strategy,
Observer).

#figure(
  image("images/classes.png", width: 100%),
  caption: "Diagrama de Classes do Sistema FlashStore",
)

== Diagramas de sequência

#heading(numbering: none, outlined: false, level: 3)[Prompt]

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Gera o código PlantUML para o Diagrama de Sequência do UC00 — Autenticar no Sistema (implementação atual). Os participantes são: Utilizador, React UI (Login), API Client, Backend Express (/api/auth/login) e SQLite (users). O fluxo principal é: o utilizador introduz email e password; a UI chama api.auth.login(email, password); o backend valida utilizador ativo por email, verifica bcrypt.compare(password, password_hash), gera JWT e retorna {token, user}; a UI chama /api/auth/me para validar sessão e redireciona para a área principal. Representa os fragmentos alternativos para [Credenciais inválidas] e [Servidor indisponível com sessão em cache] no cliente.
  ],
  analise: [
    O diagrama foi ajustado para refletir o fluxo real do código, removendo a autenticação por PIN e a ponte IPC de autenticação. A versão final representa corretamente o login por email/password com JWT, a validação posterior via /api/auth/me e o fallback offline com sessão em cache quando há falha de rede.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    Gera o código PlantUML para o Diagrama de Sequência do UC01 — Registar Venda (versão simplificada, alinhada ao código). Os participantes são: Operador de Caixa, PDV (React UI), Pagamento, Serviço de Vendas e Base de Dados. O fluxo principal cobre: seleção de produtos, atualização de linhas/subtotal, finalização de pagamento, registo da venda e linhas, dedução de stock por lote e geração de talão/fatura simplificada. Representa os fragmentos alternativos [Sistema online] (registo direto no backend) e [Sistema offline] (gravação local + fila de sincronização posterior), mantendo o loop para os artigos do carrinho.
  ],
  analise: [
    O diagrama final foi simplificado para corresponder ao nível de abstração pretendido no relatório e ao comportamento real implementado. Foram removidos elementos não existentes na arquitetura atual (Gateway de Pagamentos externo, PagamentoStrategy e serviços separados), mantendo-se os pontos críticos: registo de venda, atualização de stock, emissão de talão e caminho offline com sincronização posterior.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 3,
  prompt: [
    Gera o código PlantUML para o Diagrama de Sequência do UC03 — Fechar Turno de Caixa (implementação atual). Os participantes são: Operador de Caixa, PDV (ShiftCloseModal), API Turnos e Base de Dados. O fluxo é: o operador seleciona "Fechar Turno"; a UI obtém resumo de caixa via GET /api/shift-closures/:id/cash-summary; o operador introduz numerário contado e valor a retirar; a UI envia PUT /api/shift-closures/:id com status='pending_approval'; o backend valida permissões/estado do turno, verifica sangrias pendentes, calcula discrepância e atualiza shift_closures. Representa o fragmento alternativo [Existem sangrias pendentes] com bloqueio do fecho.
  ],
  analise: [
    O diagrama foi atualizado para o fluxo efetivo em REST, substituindo o desenho antigo baseado em IPC e entidades separadas de Turno/FechoDeTurno. A versão final modela corretamente a submissão para aprovação do gerente (pending_approval), o cálculo de discrepância no backend e o bloqueio quando há sangrias pendentes.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 4,
  prompt: [
    Gera o código PlantUML para o Diagrama de Sequência do UC04 — Fechar Dia Operacional (implementação atual). Os participantes são: Gerente de Loja, Backoffice UI (DayClosure), API Day Closures e Base de Dados. O fluxo principal é: o gerente revê o estado diário; confirma fecho; a UI envia POST /api/day-closures {store, closure_date}; o backend valida permissões, verifica se o dia já está fechado, confirma ausência de turnos open/pending_approval e de sangrias pendentes, consolida totais a partir de shift_closures aprovados/fechados e cria o registo em day_closures. Representa o fragmento alternativo [Pendências detetadas] com bloqueio e mensagem de erro.
  ],
  analise: [
    O diagrama foi revisto para remover operações não implementadas (config de bloqueio global e outbox de fecho de dia) e para refletir o mecanismo real de bloqueio por presença de day_closures. A bifurcação de erro passou a incluir explicitamente as duas causas de bloqueio previstas no código: turnos por fechar/aprovar e sangrias pendentes.
  ],
)
#llm-block(
  modelo: "Claude",
  iteracao: 5,
  prompt: [
    Gera o código PlantUML para o Diagrama de Sequência do UC12 — Sincronizar Dados Diários (implementação atual). Os participantes são: Operador/Aplicação, Electron App (outboxSync), SQLite Local (sync_outbox), API REST Central (/api/sync/push) e SQLite Central. O fluxo é: obter operações pendentes da outbox local (lote), enviar POST /api/sync/push com Authorization Bearer JWT, processar cada operação no servidor (sale.create, shift.open, shift.close), devolver resultados por outbox_id e aplicar commit local dos resultados (synced/failed). Representa os fragmentos alternativos [Sem pendências], [Operação sincronizada], [Operação falhada com retries e eventual estado failed], e mantém loop por lote de operações.
  ],
  analise: [
    O diagrama foi alinhado com o mecanismo real de sincronização, substituindo o modelo antigo de eventos genéricos por UUID. A versão final representa a semântica implementada em sync_outbox, o endpoint /api/sync/push, o processamento por tipo de operação e a política de retries com transição para failed após tentativas consecutivas.
  ],
)
#llm-end()

Os diagramas de sequência apresentados nesta secção descrevem o comportamento dinâmico dos
casos de uso mais críticos do sistema FlashStore, detalhando a ordem das mensagens trocadas entre
os participantes e evidenciando os mecanismos de tratamento de cenários alternativos. A seleção dos
cenários a modelar seguiu o critério de cobertura máxima dos fluxos com maior risco arquitetural e
maior frequência de utilização: o registo de uma venda (UC01), o fecho de turno de caixa (UC03), o
fecho do dia operacional (UC04), a sincronização diária automática (UC12) e o processo de autenticação
(UC00).

A geração inicial de cada diagrama foi realizada com recurso a LLM, fornecendo como contexto a
especificação detalhada do caso de uso e os padrões de design adotados. Os diagramas resultantes foram
posteriormente revistos e corrigidos pela equipa para garantir coerência com a arquitetura definida,
nomeadamente no que respeita ao fluxo efetivo implementado em REST, ao comportamento offline no Electron
e ao mecanismo de sincronização por outbox para o servidor central.

==== UC00 — Autenticar no Sistema

#figure(
  image("images/seq_uc00.png", width: 85%),
  caption: "Diagrama de Sequência: UC00 — Autenticar no Sistema",
)

==== UC01 — Registar Venda

#figure(
  image("images/seq_uc01.png", width: 100%),
  caption: "Diagrama de Sequência: UC01 — Registar Venda",
)

==== UC03 — Fechar Turno de Caixa

#figure(
  image("images/seq_uc03.png", width: 85%),
  caption: "Diagrama de Sequência: UC03 — Fechar Turno de Caixa",
)

==== UC04 — Fechar Dia Operacional

#figure(
  image("images/seq_uc04.png", width: 85%),
  caption: "Diagrama de Sequência: UC04 — Fechar Dia Operacional",
)

==== UC12 — Sincronizar Dados Diários

#figure(
  image("images/seq_uc12.png", width: 90%),
  caption: "Diagrama de Sequência: UC12 — Sincronizar Dados Diários",
)

== Design de interfaces
       
O design das interfaces do sistema FlashStore foi conduzido com base nos requisitos de usabilidade
definidos (RNF13, RNF14) e nas restrições operacionais do contexto de retalho de conveniência: ecrãs
em ambientes de pouca luz, utilizadores com formação técnica limitada, necessidade de registo de venda
em no máximo 3 interações. A abordagem adotada privilegia a clareza visual, a hierarquia de informação
e a redução ao mínimo do número de cliques necessários para as operações mais frequentes.

Foram desenhadas quatro interfaces principais, cobrindo os fluxos de maior utilização: o ecrã de
Ponto de Venda (PDV), o ecrã de Autenticação, o Backoffice do Gerente de Loja e o Dashboard Central
do Administrador. A geração dos mockups foi assistida por LLM, com base na descrição textual de cada
interface e nas user stories correspondentes, tendo a equipa procedido à validação e refinamento dos
resultados.

==== Interface 1 — Autenticação (UC00)

O ecrã de autenticação é o ponto de entrada de todos os utilizadores do sistema. O seu design
minimalista centra-se na introdução do PIN numérico através de um teclado virtual ou físico, com
identificação visual do utilizador após validação. O ecrã exibe o nome da loja e a data/hora atuais,
servindo também como ecrã de repouso quando nenhum utilizador está autenticado.
/*
#figure(
  image("images/ui_login.png", width: 70%),
  caption: "Mockup — Ecrã de Autenticação",
)
*/

==== Interface 2 — Ponto de Venda / PDV (UC01, UC02, UC03)

O ecrã de PDV é a interface de maior utilização do sistema e foi desenhado para maximizar a
velocidade de atendimento. Divide-se em três zonas funcionais: a zona esquerda exibe a lista de artigos
da venda em curso com subtotais; a zona central apresenta o total, o método de pagamento selecionado
e o campo de troco; a zona direita disponibiliza acesso rápido às funções mais comuns (cancelar artigo,
consultar stock, fechar turno). A barra superior exibe o nome do operador autenticado, o número do
turno e a hora.
/*
#figure(
  image("ui_pdv.png", width: 100%),
  caption: "Mockup — Ecrã de Ponto de Venda (PDV)",
)
*/

==== Interface 3 — Backoffice do Gerente de Loja (UC04, UC05, UC06, UC07)

O backoffice local é acessível apenas ao Gerente de Loja após autenticação com o respetivo perfil.
Organizado por separadores, disponibiliza as seguintes secções: Resumo do Dia (vendas agregadas,
alertas de stock e validade), Gestão de Stock (consulta e ajuste manual de inventário), Encomendas
(criação e acompanhamento de pedidos a fornecedores) e Fecho de Dia (validação dos turnos e
encerramento do dia operacional). O design privilegia tabelas de dados com indicadores de cor para
alertas (verde, amarelo, vermelho), de modo a facilitar a triagem visual rápida.
/*
#figure(
  image("ui_backoffice.png", width: 100%),
  caption: "Mockup — Backoffice do Gerente de Loja",
)*/

==== Interface 4 — Dashboard Central do Administrador (UC08, UC09, UC10, UC11)

O dashboard central é acessível via browser na sede e constitui o principal instrumento de análise
e controlo da cadeia. A página inicial apresenta um resumo consolidado das 8 lojas com indicadores
de desempenho (vendas do dia, comparativo semanal, alertas globais de stock). O painel de relatórios
permite filtrar por loja, período e categoria de produto, com exportação para formatos comuns. A secção
de conformidade fiscal concentra a geração e submissão do ficheiro SAFT-PT. A gestão de utilizadores
e de promoções é acessível através do menu de administração.
/*
#figure(
  image("ui_central.png", width: 100%),
  caption: "Mockup — Dashboard Central do Administrador",
)*/

== Especificação de API
A estrutura da API foi organizada em torno dos recursos de negócio identificados no modelo de domínio: Produtos, Vendas, Stock, Fornecedores, Utilizadores, Fecho de Turno, Encomendas e Entradas de Mercadoria. A API organiza-se em torno de recursos de negócio, com verbos HTTP (GET, POST, PUT, DELETE) e URLs estáveis, em linha com serviços REST. Nem todos os recursos expõem CRUD completo: operações como abertura/fecho de turno, devoluções ou sincronização offline usam endpoints específicos quando o fluxo o exige.

A autenticação e as permissões por perfil (`admin`, `gerente`, `caixa`) restringem o acesso nos endpoints críticos (vendas, turnos, fechos, sangrias, sincronização), com registo de auditoria (RF21) e tratamento de dados pessoais alinhado ao RGPD.

=== Autenticação e Segurança

As operações da API são protegidas por JWT (`authMiddleware`), exceto `POST /api/auth/login` e `GET /api/health` (verificação de disponibilidade do serviço).

*Endpoint de Autenticação:*
- `POST /api/auth/login`: Permite a um utilizador (Operador de Caixa, Gerente, Admin) autenticar-se no sistema.
  - *Request Body:* `{ "email": "string", "password": "string" }`
  - *Success Response (200):* `{ "token": "string", "user": { "id": "...", "email": "...", "role": "...", "store": "...", "full_name": "..." } }`
  - *Error Response (400):* `{ "error": "Email e password obrigatórios" }`
  - *Error Response (401):* `\{ "error": "Credenciais inválidas" \}`
  - *Observação:* O token JWT gerado contém a informação do utilizador (`id`, `email`, `role`, `store`) e expira em 8 horas, devendo ser enviado no header `Authorization: Bearer <token>` em todas as chamadas subsequentes.

\
*Endpoint de Verificação de Sessão:*
- `GET /api/auth/me`: Utilizado pelo cliente local para verificar a validade do token e recuperar os dados do utilizador autenticado no arranque da aplicação.
  - *Success Response (200):* `{ "id": "...", "email": "...", "role": "...", "store": "...", "full_name": "...", "is_active": 1 }`
  - *Error Response (404):* `{ "error": "Utilizador não encontrado" }`

\
*Endpoint de Terminação de Sessão:*
- `POST /api/auth/logout`: Regista o logout no audit log (requer token válido).
  - *Success Response (200):* `{ "success": true }`
=== Recursos da API

A tabela seguinte detalha os endpoints para cada entidade do sistema, mapeando-os para as User Stories e Requisitos Funcionais (RFs) identificados.
#table(
  columns: (20%, 15%, 25%, 40%),
  inset: 4pt,
  gutter: 2pt,
  stroke: (x: none, y: .35pt + gray.lighten(45%)),

  fill: (x, y) =>
    if y == 0 {
      gray.lighten(85%)
    } else if calc.rem(y, 2) == 0 {
      luma(98%)
    } else {
      white
    },

  align: (left, center, left, left, center),

  table.header(
    [*Recurso / Entidade*],
    [*Método*],
    [*Endpoint*],
    [*Descrição do Endpoint*],
  ),

  // Products
  [*Products*], [`GET`], [`/api/products`],
  [Lista produtos. Filtros: `is_active`, `category`, `q` (pesquisa), `barcode`.],

  [], [`GET`], [`/api/products/:id`],
  [Retorna um produto pelo ID.],
  
  [], [`POST`], [`/api/products`],
  [Regista um novo produto no catálogo central.],

  [], [`PUT`], [`/api/products/:id`],
  [Atualiza os dados de um produto existente.],

  [], [`DELETE`], [`/api/products/:id`],
  [Remove um produto do sistema.],

  // Sales
  [*Sales*], [`GET`], [`/api/sales`],
  [Lista vendas. Suporta filtros: `store`, `cashier_email`, `status`, `limit`.],

  [], [`POST`], [`/api/sales`],
  [Regista venda. Atualiza `stock` automaticamente.],
  

  [], [`PUT`], [`/api/sales/:id`],
  [Anula venda (`status: cancelled`) e repõe `stock`.],
  

  // Stock
  [*Stock*], [`GET`], [`/api/stock`],
  [Lista stock de todos os produtos. Suporta filtro: `store`.],
 

  [], [`POST`], [`/api/stock`],
  [Cria ou atualiza (upsert) stock de produto por loja.],


  [], [`PUT`], [`/api/stock/:id`],
  [Atualiza quantidade em stock, stock mínimo ou data de validade.],
  

  // Suppliers
  [*Suppliers*], [`GET`], [`/api/suppliers`],
  [Lista todos os fornecedores.],
 

  [], [`POST`], [`/api/suppliers`],
  [Regista novo fornecedor.],
 

  [], [`PUT`], [`/api/suppliers/:id`],
  [Atualiza dados de fornecedor.],
 

  [], [`DELETE`], [`/api/suppliers/:id`],
  [Remove fornecedor.],
  

  // Promotions
  [*Promotions*], [`GET`], [`/api/promotions`],
  [Lista promoções.],


  [], [`POST`], [`/api/promotions`],
  [Cria uma nova promoção.],
  

  [], [`PUT`], [`/api/promotions/:id`],
  [Atualiza uma promoção.],
 

  [], [`DELETE`], [`/api/promotions/:id`],
  [Remove uma promoção.],
  

  // Users
  [*Users*], [`GET`], [`/api/users`],
  [Lista utilizadores do sistema.],


  [], [`POST`], [`/api/users`],
  [Cria novo utilizador.],
  

  [], [`PUT`], [`/api/users/:id`],
  [Atualiza perfil (`role`, `store`, etc.).],

  [], [`DELETE`], [`/api/users/:id`],
  [Remove utilizador (apenas `admin`).],
 

  // Shift Closures
  [*Shift Closures*], [`GET`], [`/api/shift-closures`],
  [Lista fechos de turno. Filtros: `store`, `cashier_email`, `status`.],
  

  [], [`POST`], [`/api/shift-closures/open`],
  [Abre turno na loja/terminal (caixa).],

  [], [`GET`], [`/api/shift-closures/my-open`],
  [Turno aberto do operador (`store` obrigatório).],

  [], [`PUT`], [`/api/shift-closures/:id`],
  [Submete fecho (`pending_approval`) ou aprovação pelo gerente.],
 
  // Supplier Orders
  [*Supplier Orders*], [`GET`], [`/api/supplier-orders`],
  [Lista encomendas a fornecedores.],
 

  [], [`POST`], [`/api/supplier-orders`],
  [Cria nova encomenda.],


  [], [`PUT`], [`/api/supplier-orders/:id`],
  [Altera estado (`sent`, `delivered`, etc.).],


  // Merchandise Entries
  [*Merchandise Entries*], [`GET`], [`/api/merchandise-entries`],
  [Lista entradas de mercadoria.],


  [], [`POST`], [`/api/merchandise-entries`],
  [Regista receção de encomenda e atualiza `stock`.],
  
  // Returns
  [*Returns*], [`POST`], [`/api/sales/:id/return`],
  [Devolução parcial de itens; repõe stock e regista reembolso.],

  [], [`PUT`], [`/api/sales/:id`],
  [Anula venda total (`status: cancelled`) — ver também Sales.],

  // Cash Operations
  [*Cash Operations*], [`POST`], [`/api/cash-floats`],
  [Regista a configuração inicial do fundo de maneio na caixa.],

  [], [`POST`], [`/api/cash-drops`],
  [Regista a retirada de numerário (sangria) para o cofre seguro.],

  // Daily Closures
  [*Daily Closures*], [`POST`], [`/api/daily-closures`],
  [Regista o fecho de dia de uma loja, validando e consolidando os turnos diários.],
)



= Capítulo 3 - Implementação e Desenvolvimento Assistido por LLM

== Configuração do Ambiente de Trabalho
#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Com base nas decisões arquiteturais definidas nas secções 3.2 (Arquitetura do Sistema) e 3.4 (Decisões de Design — ADR-001, ADR-002) do nosso relatório, que estabelecem a utilização de Electron como runtime desktop por loja, React com Vite para o frontend, Node.js/Express como servidor central e SQLite como base de dados (local e central), sugere uma configuração de ambiente de desenvolvimento adequada para a realização deste projeto. A equipa é composta por estudantes a trabalhar em Windows e Linux. O ambiente deve permitir correr simultaneamente o servidor Express, o frontend React e a aplicação Electron durante o desenvolvimento.
  ],
  analise: [
    O LLM produziu uma sugestão coerente com a stack definida, identificando corretamente os requisitos base: Node.js LTS, um gestor de versões para garantir consistência entre membros da equipa, e a necessidade de coordenar três processos em simultâneo durante o desenvolvimento (servidor Express, Vite e Electron). A recomendação de usar nvm para fixar a versão do Node.js foi adotada sem alterações, pois resolve diretamente o problema de incompatibilidade de módulos nativos entre sistemas operativos — problema particularmente relevante dado que o better-sqlite3 (inicialmente considerado para o Electron) requer recompilação para o runtime específico do Electron.

    Contudo, o LLM não antecipou o conflito entre o tipo de módulo CommonJS exigido pelo processo principal do Electron e o ESM utilizado pelo Vite/React, o que obrigou a equipa a definir explicitamente a separação entre as pastas electron/ (CommonJS) e src/ (ESM). Também não foi mencionada a necessidade de uma flag de ambiente para alternar o caminho base do Vite entre o modo de desenvolvimento (caminhos absolutos, com proxy para o Express) e o build de produção para o Electron (caminhos relativos, para loadFile()).

    A sugestão de criar um ficheiro .env com variáveis de ambiente para o servidor foi considerada excessiva para o contexto de desenvolvimento académico e foi descartada — os valores de configuração foram mantidos diretamente no código para simplificar o onboarding.
  ],
)
#llm-end()

A configuração do ambiente de trabalho teve como objetivo garantir a consistência entre os membros da equipa, que desenvolviam tanto em Windows como em Linux, e permitir a execução coordenada de três processos em simultâneo: servidor Express, Vite e Electron.

Foi adotado o Node.js v20 LTS, gerido através do `nvm`. Esta opção garantiu a mesma versão do runtime em todos os ambientes, prevenindo incompatibilidades na compilação de módulos nativos (como os necessários para o SQLite) entre diferentes sistemas operativos.

Um dos principais desafios na configuração foi o conflito de sistemas de módulos. O processo principal do Electron exige a utilização de CommonJS, ao passo que o frontend (Vite/React) opera em ESM (ECMAScript Modules). Para acomodar esta exigência, a equipa estruturou o projeto separando o código de interface na diretoria `src/` (ESM) e a lógica desktop na diretoria `electron/` (CommonJS). Os dois contextos (servidor e frontend/Electron) mantêm ficheiros `package.json` independentes, gerindo as suas próprias dependências.

Adicionalmente, a configuração do Vite foi adaptada com uma flag de ambiente que alterna dinamicamente o caminho base: no modo de desenvolvimento utilizam-se caminhos absolutos com um proxy transparente para a API do Express, enquanto no build de produção (para o Electron) utilizam-se caminhos relativos para permitir o carregamento correto via `loadFile()`.

Em prol da simplicidade e de um *onboarding* mais rápido no contexto académico, optou-se por não utilizar ficheiros `.env` para a gestão de variáveis de ambiente no servidor, optando por manter as configurações essenciais diretamente no código.

Durante o desenvolvimento, um script unificado assegura o arranque síncrono do ambiente, garantindo que a janela do Electron apenas é instanciada após a total disponibilidade do servidor Express e do servidor de desenvolvimento Vite.


== Estrutura de Desenvolvimento por Módulos

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nos requisitos funcionais definidos na secção 2.5.1 (RF01 a RF25), nas decisões arquiteturais descritas na secção 3.2 (ADR-001 — arquitetura em três camadas com Electron por loja; ADR-002 — SQLite como base de dados; ADR-003 — padrão outbox para sincronização offline) e na especificação da API REST da secção 3.7, propõe uma decomposição modular do sistema FlashStore para guiar o desenvolvimento. Para cada módulo indica: a camada a que pertence (servidor Express, frontend React ou processo Electron), os requisitos funcionais que cobre, as dependências em relação a outros módulos e a prioridade de implementação. O objetivo é que cada módulo seja implementável de forma relativamente independente e verificável isoladamente.
  ],
  analise: [
    O modelo produziu uma decomposição em três camadas alinhada com a arquitetura definida no ADR-001, organizando os módulos por servidor, frontend e Electron. A proposta foi globalmente coerente, identificando corretamente as dependências críticas — nomeadamente que os módulos de ponto de venda, turnos e fecho de dia dependem obrigatoriamente do módulo de autenticação, e que a sincronização offline pressupõe a existência do módulo de vendas offline no Electron.

    Contudo, o modelo agrupou a gestão de stock e a gestão de produtos num único módulo, o que se revelou problemático na prática: as operações de stock (consulta em PDV, atualização automática após venda, alertas de mínimos) têm ciclos de vida e atores distintos dos da manutenção do catálogo de produtos, tornando a separação mais adequada. O mesmo aconteceu com os relatórios e o dashboard, tratados como um único bloco quando na realidade servem propósitos e atores diferentes — o dashboard é consultado em tempo quase real pelo gerente e pelo administrador, enquanto os relatórios são gerados periodicamente e exportados.

    O modelo não incluiu explicitamente um módulo de auditoria, tendo-o tratado como funcionalidade transversal integrada noutros módulos. A equipa optou por torná-lo explícito, dado que o RF21 exige registo de operações críticas associadas ao utilizador autenticado em contextos muito variados (vendas, acessos, alterações de stock), o que justifica um tratamento dedicado. A ordem de implementação sugerida pelo modelo foi parcialmente seguida, com a exceção de que o módulo de SAFT-PT foi adiado para uma fase posterior, dado não ser bloqueante para o funcionamento do PDV.
  ],
)
#llm-end()

A decomposição modular adotada organiza o sistema em três camadas correspondentes às três componentes da arquitetura definida na Etapa 2: o servidor Express central, o frontend React e o processo principal do Electron. A tabela seguinte apresenta os módulos definidos, a sua camada, os requisitos funcionais cobertos e as dependências entre módulos.

=== Camada A — Servidor Express (API REST Central)

#table(
  columns: (1.8fr, 2.8fr, 1.2fr, 1.2fr),
  stroke: 0.5pt,
  inset: 6pt,
  fill: (_, row) => if row == 0 { luma(230) } else { white },
  [*Módulo*], [*Descrição*], [*Requisitos*], [*Depende de*],

  [M01 — Autenticação e Autorização],
  [Login com email e password, emissão de JWT, middleware de verificação por rota, controlo de acesso por papel (caixa, gerente, administrador).],
  [RF20, RNF07], [—],

  [M02 — Catálogo de Produtos],
  [CRUD de produtos e categorias, pesquisa por código de barras e nome, gestão de imagens, definição de stock mínimo por franchisado.],
  [RF01, RF02, RF07], [M01],

  [M03 — Ponto de Venda e Vendas],
  [Registo de venda com múltiplos artigos, cálculo de totais e IVA, suporte a NIF do cliente, métodos de pagamento, devolução parcial.],
  [RF01–RF06, RF10], [M01, M02],

  [M04 — Gestão de Stock],
  [Consulta de stock por loja, atualização automática após venda e entrada de mercadoria, alertas de mínimos e de validade próxima.],
  [RF07, RF10–RF13], [M01, M02, M03],

  [M05 — Turnos de Caixa],
  [Abertura e fecho de turno por terminal, registo de fundo de maneio, sangrias, resumo de numerário e discrepâncias.],
  [RF08, RNF13], [M01, M03],

  [M06 — Fecho de Dia Operacional],
  [Consolidação diária de vendas e turnos por loja, bloqueio de operações após fecho, reabertura com justificação.],
  [RF09, RNF05], [M01, M05],

  [M07 — Fornecedores e Encomendas],
  [CRUD de fornecedores, criação e acompanhamento de encomendas, registo de entrada de mercadoria com atualização de stock.],
  [RF11], [M01, M04],

  [M08 — Promoções],
  [Definição de promoções temporárias por produto ou categoria com datas de validade, aplicação automática no PDV.],
  [RF18], [M01, M02],

  [M09 — Relatórios e Dashboard],
  [Relatório diário de vendas por caixa e funcionário, relatório comparativo entre lojas, dashboard de indicadores por loja e central.],
  [RF09, RF16], [M01, M03, M06],

  [M10 — Utilizadores e Lojas],
  [Gestão de utilizadores e perfis, gestão de lojas e terminais de caixa, atribuição de papéis.],
  [RF19, RF21], [M01],

  [M11 — Auditoria],
  [Registo automático de operações críticas associadas ao utilizador autenticado: logins, vendas, alterações de stock, acessos administrativos.],
  [RF21, RNF08], [M01],

  [M12 — SAFT-PT],
  [Geração do ficheiro XML mensal no formato SAFT-PT com encadeamento de hashes SHA-256, exportação para download.],
  [RF17, RNF10, RNF11], [M01, M03],

  [M13 — Sincronização Central],
  [Receção e processamento do outbox enviado pelos terminais Electron, confirmação de sincronização, deteção de duplicados por UUID.],
  [RF14, RF15, RNF06], [M01, M03],
)

=== Camada B — Frontend React (Interface de Utilizador)

#table(
  columns: (1.8fr, 2.8fr, 1.2fr, 1.2fr),
  stroke: 0.5pt,
  inset: 6pt,
  fill: (_, row) => if row == 0 { luma(230) } else { white },
  [*Módulo*], [*Descrição*], [*Requisitos*], [*Depende de*],

  [M14 — Autenticação (UI)],
  [Página de login com email e password, gestão do token JWT em localStorage, proteção de rotas por papel.],
  [RF20, RNF07], [M01],

  [M15 — PDV (Interface Caixa)],
  [Interface de ponto de venda com pesquisa de produtos, carrinho, cálculo de totais, modal de pagamento com NIF e troco, fecho de turno.],
  [RF01–RF08, RF18, RNF13], [M14, M03, M05],

  [M16 — Backoffice Gerente],
  [Gestão de stock, produtos, encomendas, fornecedores, histórico de vendas, relatórios diários, fecho de dia, gestão de funcionários.],
  [RF07–RF13, RF16, RF18], [M14, M02–M09],

  [M17 — Painel Administração Central],
  [Dashboard multi-loja, gestão de promoções, utilizadores e franchisados, relatórios comparativos, auditoria, exportação SAFT-PT.],
  [RF16, RF17, RF19, RF21], [M14, M09–M12],
)

=== Camada C — Processo Electron (Terminal de Loja)

#table(
  columns: (1.8fr, 2.8fr, 1.2fr, 1.2fr),
  stroke: 0.5pt,
  inset: 6pt,
  fill: (_, row) => if row == 0 { luma(230) } else { white },
  [*Módulo*], [*Descrição*], [*Requisitos*], [*Depende de*],

  [M18 — Base de Dados Local],
  [Adaptador sql.js com API compatível com better-sqlite3, esquema SQLite local (produtos, stock, vendas, turnos, outbox), persistência em disco por loja.],
  [RNF04, RNF06], [—],

  [M19 — Operações Offline],
  [Registo de vendas e turnos em modo offline com UUID idempotente, inserção na fila de sincronização (outbox), importação do catálogo central.],
  [RF03, RF14, RNF04], [M18],

  [M20 — Sincronização Outbox],
  [Leitura da fila pendente, envio para o servidor central via HTTP, confirmação ou marcação de falha com retenção para reenvio.],
  [RF14, RF15, RNF06], [M18, M19, M13],
)

== Camada A - M01 — Autenticação e Autorização

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base na secção 3.7.1 do relatório (Autenticação e Segurança da API) e no requisito RF20 (autenticação obrigatória antes do início das operações) e RNF07 (autenticação obrigatória por utilizador), implementa o módulo de autenticação para o servidor Express do FlashStore. O sistema tem três papéis distintos — caixeiro, gerente e administrador — e todas as rotas da API devem estar protegidas. O login deve ser feito com email e password. O servidor usa SQLite com better-sqlite3. Indica como estruturar o middleware de verificação, a geração de token e o endpoint de login.
  ],
  analise: [
    O modelo produziu uma proposta funcional centrada em JWT, com um `authMiddleware` que verifica o cabeçalho `Authorization: Bearer` em cada pedido protegido. A abordagem estava alinhada com a decisão arquitetural ADR-002 e com a especificação da API do relatório. O endpoint de login com bcrypt para verificação da password foi gerado corretamente, incluindo a resposta com o token e os dados do utilizador necessários para o frontend (`id`, `email`, `role`, `store`, `full_name`).

    Foram necessários dois ajustes. Primeiro, o modelo gerou um `adminMiddleware` separado apenas para rotas exclusivas de administrador, mas não contemplou um middleware intermédio para rotas partilhadas entre gerente e administrador — esse padrão surgiu em vários endpoints (encomendas, gestão de funcionários) e teve de ser resolvido com verificações de role inline em cada rota. Segundo, o modelo sugeriu armazenar o `JWT_SECRET` numa variável de ambiente; no contexto de desenvolvimento académico, a equipa optou por um valor fixo no código para simplificar o onboarding.

    A integração com o registo de auditoria (RF21) não foi incluída na proposta inicial. A equipa adicionou manualmente o registo de eventos de login bem-sucedido e falhado na lógica do endpoint.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    O módulo de autenticação não cobre o endpoint GET /api/auth/me, necessário para o frontend restaurar a sessão após reload sem novo login. Adiciona este endpoint e documenta também os middlewares de proteção de rotas — authMiddleware (valida JWT, injeta req.user) e adminMiddleware (verifica papel admin em cascata). O servidor usa better-sqlite3.
  ],
  analise: [
    O modelo gerou o endpoint `GET /api/auth/me` corretamente — valida o token e devolve os dados do utilizador atual sem expor campos sensíveis. A documentação dos middlewares foi clara: `authMiddleware` rejeita com 401 se o token for inválido ou ausente; `adminMiddleware` aplica-se em cascata e rejeita com 403 se o papel não for admin.

    O ponto que a equipa ajustou foi o endpoint `POST /api/auth/logout`: o modelo não o incluiu por considerar que num sistema stateless o logout é apenas responsabilidade do cliente (apagar o token). A equipa adicionou um endpoint de logout que regista o evento na auditoria, mesmo sem invalidar o token no servidor — necessário para o RF21.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`POST /api/auth/login`], [Recebe email e password, verifica com bcrypt, devolve JWT com expiração de 8h e dados do utilizador. Regista evento na auditoria (sucesso e falha).],

  [`POST /api/auth/logout`], [Endpoint protegido que regista evento de logout na auditoria. O token não é invalidado no servidor — o sistema é stateless por design.],

  [`GET /api/auth/me`], [Devolve os dados do utilizador associado ao token atual. Chamado pelo frontend na inicialização para restaurar sessão.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Faz uma revisão de code smells e oportunidades de refactoring no módulo de autenticação do FlashStore. O módulo inclui: middleware de verificação JWT, endpoints de login/logout/me no servidor Express, e o contexto de autenticação React com gestão de token em localStorage. Identifica problemas de qualidade, duplicação, acoplamento e potenciais vulnerabilidades.
  ],
  analise: [
    O Claude identificou três problemas principais. O `require('bcryptjs')` estava inline dentro do handler em vez de no topo do ficheiro — funcional (Node.js faz cache do módulo) mas má prática de legibilidade, corrigido. Verificações de papel duplicadas (`if (req.user.role !== 'admin' && req.user.role !== 'manager')`) repetidas inline em vários endpoints em vez de usar middleware reutilizável — registado como dívida técnica mas não extraído imediatamente dado o volume. A sugestão de usar httpOnly cookies em vez de localStorage foi considerada academicamente válida mas descartada — o deployment é Electron desktop, onde o risco XSS é negligenciável e o acesso ao token via IPC pesa mais.

    O modelo não identificou o bug mais relevante na prática: o `AuthContext` inicial não tratava o caso em que `GET /api/auth/me` devolvia 401 (token expirado entre sessões), mantendo `isLoadingAuth` em `true` indefinidamente. Foi corrigido com bloco `catch` que limpa o token de localStorage e define o utilizador como não autenticado.

    #strong[Problema corrigido:] `isLoadingAuth` ficava em `true` permanentemente quando o token estava expirado, bloqueando toda a interface. Adicionado bloco `catch` no `AuthContext` que trata o 401 e repõe o estado.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — `authMiddleware`, `adminMiddleware`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`],

  [Servidor], [`server/database.js` — tabela `users` com campos `email`, `password_hash`, `role`, `store`, `full_name`, `is_active`],

  [Frontend], [`src/lib/AuthContext.jsx` — contexto React com hook `useAuth()`],

  [Frontend], [`src/pages/Login.jsx` — formulário email/password],

  [Frontend], [`src/pages/RoleRouter.jsx` — roteamento por papel após autenticação],

  [Frontend], [`src/api/localClient.js` — cliente HTTP com gestão do token JWT e redirecionamento automático para `/login` em 401],
)


== Camada A - M02 — Catálogo de Produtos

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF01 (registo de vendas com código de barras ou introdução manual), RF02 (cancelar artigos) e RF07 (consultar stock no PDV) do relatório, e tendo em conta o modelo de domínio da secção 2.9.2 (entidades Produto e Categoria), implementa o módulo de catálogo de produtos para o servidor Express do FlashStore. O catálogo deve suportar pesquisa por código de barras, pesquisa por nome com texto livre, filtragem por categoria e paginação. A base de dados é SQLite com better-sqlite3. Considera que o catálogo é partilhado entre todas as lojas da cadeia mas o stock é por loja.
  ],
  analise: [
    O modelo produziu uma estrutura CRUD padrão com os endpoints corretos e a separação entre catálogo global e stock por loja. A proposta de pesquisa full-text usando `LIKE '%termo%'` foi funcional mas inadequada para o requisito RNF02 (pesquisa inferior a 2 segundos com catálogo de 10.000 produtos) — com este volume, o LIKE com wildcard inicial impede o uso de índices e degrada o desempenho. A equipa substituiu por pesquisa FTS5 (Full-Text Search nativo do SQLite) com fallback automático para LIKE em caso de falha, garantindo robustez sem perder performance.

    O modelo não contemplou a distinção entre produtos do catálogo central e a visibilidade por loja. A equipa adicionou o endpoint `/api/admin/franchise-products` para que o administrador gerencie o catálogo de referência, e `/api/admin/stock-minimum` para definir o stock mínimo por produto por loja — funcionalidade necessária para o RF12 (alertas de stock mínimo).

    A lógica de soft-delete (campo `is_active`) para produtos não foi incluída na proposta do modelo, que usava `DELETE` físico. A equipa optou por desativação lógica para preservar o histórico de vendas que referenciam produtos antigos.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (3fr, 4fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/products`], [Listagem com pesquisa full-text via FTS5, lookup direto por código de barras, filtragem por categoria e paginação com `limit`/`offset`. A pesquisa por barcode usa índice direto; a pesquisa full-text usa a tabela virtual `products_fts` com fallback para LIKE se o FTS falhar.],

  [`GET /api/products/:id`], [Consulta individual por identificador.],

  [`POST /api/products`], [Criação com validação de campos obrigatórios (nome, preço, categoria), suporte a produtos perecíveis com prazo de validade padrão e taxa de IVA configurável.],

  [`PUT /api/products/:id`], [Atualização parcial com merge dos campos existentes — não exige envio de todos os campos.],

  [`DELETE /api/products/:id`], [Eliminação física, reservada para produtos sem histórico de vendas. Soft-delete preferido via `is_active`.],

  [`GET /api/categories`], [Listagem de categorias ordenada por nome.],

  [`POST /api/admin/categories` \ `PUT /api/admin/categories` \ `DELETE /api/admin/categories`], [Gestão de categorias restrita ao papel de administrador.],

  [`GET /api/admin/franchise-products`], [Catálogo de referência da cadeia com stock mínimo por loja, acessível apenas ao administrador central.],

  [`PUT /api/admin/stock-minimum`], [Definição do stock mínimo de um produto para uma loja específica.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Revê o handler GET /api/products no servidor Express do FlashStore. O handler faz pesquisa full-text FTS5 com fallback para LIKE, filtragem dinâmica por categoria e paginação. Identifica problemas de qualidade de código, legibilidade e potenciais riscos. O servidor usa better-sqlite3 com SQLite.
  ],
  analise: [
    O modelo identificou dois problemas relevantes: a construção dinâmica de queries SQL por concatenação de strings (embora parametrizada corretamente, dificulta a leitura e manutenção), e a ausência de validação do parâmetro `limit` — sem um teto máximo, um cliente poderia pedir milhares de registos. A equipa já tinha introduzido `Math.min(parseInt(lim) || 200, 500)` antes da revisão, pelo que este ponto já estava resolvido. A sugestão de extrair a lógica de construção de query para uma função auxiliar foi considerada mas não aplicada, dado que o módulo estava estável e o ganho de legibilidade não justificava o risco de regressão.

    O modelo não identificou o problema mais relevante: a tabela virtual `products_fts` tem de ser mantida sincronizada com a tabela `products` através de triggers. A equipa confirmou que os triggers estão definidos no schema e não requerem ação nos handlers.

    #strong[Problema corrigido:] A query de fallback LIKE usava `%${q.trim()}%` sem sanitização prévia dos caracteres especiais do SQLite (`%`, `_`). Embora parametrizada (sem risco de injeção), um termo como `%` produzia resultados inesperados. Foi adicionada sanitização básica do termo antes da substituição.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `/api/products` (CRUD + pesquisa FTS5), `/api/categories` (CRUD admin), `/api/admin/franchise-products`, `/api/admin/stock-minimum`],

  [Servidor], [`server/database.js` — tabela `products`, tabela virtual `products_fts`, triggers de sincronização, índices em `barcode` e `category`],
)


== Camada A - M03 — Ponto de Venda e Vendas

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nos requisitos RF01 a RF06 do relatório (registo de venda, cancelamento, modo offline, métodos de pagamento, cálculo de troco, NIF) e no diagrama de sequência UC01 da secção 3.5, implementa o endpoint de criação de venda para o servidor Express do FlashStore. A venda deve: validar que existe um turno aberto para o operador, descontar automaticamente o stock por lote (FIFO), registar os itens vendidos com preço unitário e IVA, e suportar pagamentos por numerário, Multibanco, MB Way e cartão. A base de dados é SQLite. Garante que a operação é atómica.
  ],
  analise: [
    O modelo produziu um endpoint funcional com transação SQLite correta. A atomicidade foi implementada adequadamente com `db.transaction()`. A validação do turno aberto e a verificação de que o dia não está fechado foram incluídas, alinhando-se com os requisitos RNF05 e RF08.

    O ponto mais crítico que o modelo não resolveu foi a alocação de stock por lote: o modelo assumiu que existe um único registo de stock por produto por loja e fazia `UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND store = ?`. Na realidade, o sistema suporta múltiplos lotes do mesmo produto (com números de série e datas de validade diferentes), e a alocação deve seguir FIFO pela data de validade — os lotes com validade mais próxima devem ser consumidos primeiro. A função `allocateStockForSale` foi desenvolvida pela equipa para implementar esta lógica, gerando uma alocação por lote para cada item da venda.

    O modelo também não incluiu a geração do texto de recibo em formato legível, necessária para a impressão no PDV. Esta funcionalidade foi adicionada através da função `buildReceiptText`, que formata os itens, totais, método de pagamento e dados do cliente.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/sales`], [Listagem de vendas com filtragem por loja, operador, estado e turno, incluindo os itens de cada venda.],

  [`POST /api/sales`], [Criação de venda com validação de turno aberto, verificação de fecho de dia, alocação de stock por lote FIFO, inserção atómica da venda e dos seus itens, atualização do stock, geração do texto de recibo e registo de auditoria.],

  [`PUT /api/sales/:id`], [Cancelamento de venda com reposição de stock nos lotes originais; requer autorização de gerente ou administrador.],

  [`GET /api/sales/:id/returns`], [Consulta de devoluções associadas a uma venda.],

  [`POST /api/sales/:id/return`], [Registo de devolução parcial com reposição de stock.],

  [`GET /api/sales/daily-report`], [Relatório diário de vendas por turno e operador, com totais por método de pagamento.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "GitHub Copilot",
  iteracao: 1,
  prompt: [
    O handler POST /api/sales do FlashStore tem mais de 150 linhas e mistura validação de negócio, lógica de alocação de stock, inserção em base de dados e geração de recibo numa única função. Que padrões de refactoring recomendas para melhorar a manutenibilidade sem alterar o comportamento?
  ],
  analise: [
    O Copilot identificou corretamente o principal code smell: violação do SRP — o handler faz demasiadas coisas. Sugeriu extrair `validateSaleRequest`, `allocateStock` e `buildReceipt` como funções auxiliares independentes, e envolver toda a lógica de persistência num serviço `SaleService`. A equipa concordou com o diagnóstico mas optou por refactoring parcial: as funções `allocateStockForSale` e `buildReceiptText` foram extraídas como helpers no mesmo ficheiro, sem criar um serviço separado. A criação de uma camada de serviços teria exigido reestruturar todos os outros módulos do `index.js` — dívida técnica registada mas adiada.

    O Copilot não mencionou o problema de performance potencial da função `allocateStockForSale`: para itens com muitos lotes disponíveis, a função faz uma query por item dentro de um loop. Não foi corrigido nesta fase pois o volume típico de itens por venda é baixo.

    #strong[Problema corrigido:] O handler não verificava se o `shift_closure_id` enviado pertencia à loja correta — um caixeiro podia registar vendas num turno de outra loja. Foi adicionada validação explícita de `sh.store !== store` antes de aceitar o turno.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `/api/sales` (GET, POST), `/api/sales/:id` (PUT cancelamento), `/api/sales/:id/returns` (GET), `/api/sales/:id/return` (POST), `/api/sales/daily-report` (GET); funções auxiliares `allocateStockForSale` e `buildReceiptText`],

  [Servidor], [`server/database.js` — tabelas `sales`, `sale_items`; índices em `store`, `cashier_email`, `created_date`],
)


== Camada A - M04 — Gestão de Stock

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nos requisitos RF07 (consultar stock no PDV), RF10 (atualizar stock após venda), RF11 (entrada de mercadoria com atualização de stock), RF12 (alertas de stock mínimo) e RF13 (alertas de validade próxima) do relatório, implementa o módulo de gestão de stock para o servidor Express. O stock é gerido por loja e por lote — cada entrada de mercadoria pode criar um lote com número de série e data de validade próprios. Indica como estruturar os endpoints e a lógica de atualização automática após venda.
  ],
  analise: [
    O modelo gerou uma estrutura de stock simples com um registo por produto por loja, ignorando completamente o conceito de lotes. Para a maioria das lojas de conveniência esta simplificação seria aceitável, mas o enunciado requer rastreabilidade de validades e números de série (RF13), o que exige gestão por lote. A equipa reformulou o schema para que a tabela `stock` contenha um registo por lote (produto + loja + número de série + data de validade), e implementou a função `upsertStockLot` que cria um novo lote ou incrementa um existente quando a combinação produto/loja/série/validade já existe.

    O modelo também não contemplou os alertas de stock mínimo como mecanismo de consulta — propôs um sistema de notificações push que não é viável na arquitetura do projeto. A equipa implementou os alertas como endpoint de consulta (`GET /api/stock` com filtro `low_stock=true`) que o frontend pode chamar periodicamente, e como verificação no scheduler diário.

    A integração com o módulo de vendas (atualização automática de stock no `POST /api/sales`) não foi gerada pelo modelo neste prompt — foi tratada no módulo M03 com a função `allocateStockForSale`.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/stock`], [Listagem de lotes de stock com join ao catálogo de produtos (nome, código de barras, categoria, flag perecível), filtragem por loja, produto e flag `low_stock` para alertas de stock mínimo. Alertas de validade próxima filtram lotes com `expiry_date` nos próximos 30 dias.],

  [`POST /api/stock`], [Criação manual de um lote de stock, utilizado pelo gerente para correções de inventário.],

  [`PUT /api/stock/:id`], [Atualização de quantidade ou metadados de um lote existente.],
)

A função auxiliar `upsertStockLot` é utilizada internamente pelos módulos de vendas (reposição em cancelamento) e de encomendas (receção de mercadoria) para criar ou incrementar lotes sem duplicar registos.

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    No servidor Express do FlashStore, a função upsertStockLot está definida inline no ficheiro index.js e é chamada por múltiplos módulos (entrada de mercadoria, cancelamento de venda, receção de encomenda). Identifica os problemas desta abordagem e sugere como melhorá-la sem alterar o comportamento externo.
  ],
  analise: [
    O Claude identificou o problema corretamente: `upsertStockLot` é uma função de domínio partilhada por três módulos diferentes (M03, M04 e M07), mas está definida como função local no `index.js`. Qualquer alteração à lógica de upsert afeta os três contextos sem que isso seja evidente. Sugeriu extrair para um ficheiro `server/stock.js` com exportação explícita.

    A equipa reconheceu o problema mas optou por não fazer a extração nesta fase, dado que o `index.js` usa `db` como variável de módulo e a extração exigiria passar a instância da base de dados como parâmetro — uma refactoring de maior impacto. A função permanece no `index.js` como dívida técnica documentada.

    #strong[Problema corrigido:] A função `upsertStockLot` não tinha proteção contra `product_id` nulo — quando chamada a partir de entradas manuais de mercadoria sem produto associado, inseria um lote sem ligação ao catálogo. Foi adicionada validação que rejeita a operação se `product_id` for nulo e `product_name` estiver em branco.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `/api/stock` (GET, POST, PUT), função auxiliar `upsertStockLot`, lógica de alertas de stock mínimo e validade],

  [Servidor], [`server/database.js` — tabela `stock` com colunas `product_id`, `store`, `quantity`, `serial_number`, `expiry_date`; índice composto em `(product_id, store)`],

  [Frontend], [`src/pages/manager/StockManagement.jsx` — lista de stock por loja com filtros e edição de quantidade],

  [Frontend], [`src/pages/manager/AlertsPage.jsx` — alertas de stock mínimo e validade próxima],
)

=== Alertas Automáticos e Snapshots Diários

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    O FlashStore tem os requisitos RF12 (alertas de stock mínimo) e RF13 (alertas de validade próxima). Implementa um sistema de alertas automáticos para o servidor Express que verifique diariamente o stock de todas as lojas e gere alertas quando um lote estiver abaixo do limiar mínimo ou com validade nos próximos 30 dias. Os alertas devem ser consultáveis pelo frontend com filtragem por loja, tipo e estado de resolução, e devem poder ser marcados como resolvidos. Implementa também um snapshot diário do stock por loja para suporte a relatórios históricos.
  ],
  analise: [
    O modelo gerou uma estrutura de alertas adequada com tabela própria e endpoints de consulta e resolução. O ponto que o modelo não resolveu foi a deduplicação de alertas: ao correr diariamente, o scheduler criaria alertas duplicados para o mesmo produto se o problema persistisse. A equipa adicionou lógica de upsert por `(store, type, entity_id)` — se já existir um alerta não resolvido para o mesmo produto e loja, o scheduler atualiza o existente em vez de criar um novo.

    O modelo também não contemplou o endpoint de contagem por tipo (`GET /api/alerts/counts`), essencial para o dashboard do gerente mostrar badges de alerta sem carregar a lista completa. Foi adicionado pela equipa.

    Para os snapshots diários, o modelo propôs guardar o stock completo linha a linha, o que geraria volumes de dados elevados. A equipa optou por agregar por produto e loja, guardando apenas a quantidade total e o valor estimado por loja — suficiente para os relatórios históricos pretendidos.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/alerts`], [Listagem de alertas com filtragem por loja, tipo (`low_stock`, `expiry`) e estado de resolução. Ordenada por data de criação descendente.],

  [`GET /api/alerts/counts`], [Contagem de alertas não resolvidos por tipo e por loja, usado pelo dashboard para badges de notificação.],

  [`PUT /api/alerts/:id/resolve`], [Marca um alerta individual como resolvido, registando o utilizador e a data de resolução.],

  [`PUT /api/alerts/resolve-all`], [Resolve em massa todos os alertas de uma loja, com filtragem opcional por tipo.],

  [`GET /api/stock-snapshots`], [Listagem de snapshots diários de stock agregados por loja e data, com filtragem por loja e intervalo de datas.],
)

O scheduler em `server/scheduler.js` executa diariamente e gera alertas de stock mínimo (quando `quantity < minimum_threshold`) e alertas de validade próxima (quando `expiry_date` está nos próximos 30 dias), com deduplicação por `(store, type, entity_id)`. O snapshot diário é gerado na mesma execução agrupando o stock por loja.

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/scheduler.js` — execução diária de verificação de stock, geração de alertas com deduplicação e criação de snapshots agregados por loja],

  [Servidor], [`server/index.js` — endpoints `GET /api/alerts`, `GET /api/alerts/counts`, `PUT /api/alerts/:id/resolve`, `PUT /api/alerts/resolve-all`, `GET /api/stock-snapshots`],

  [Servidor], [`server/database.js` — tabela `alerts` com campos `store`, `type`, `entity_id`, `resolved`; tabela `daily_stock_snapshots` com campos `store`, `snapshot_date`, `total_value`],

  [Frontend], [`src/pages/manager/AlertsPage.jsx` — lista de alertas com resolução individual e em massa, agrupada por tipo],
)


== Camada A - M05 — Turnos de Caixa

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF08 (fecho de caixa com registo de discrepâncias) e RNF13 (registo de venda concluído em menos de 3 cliques) do relatório, e no diagrama de sequência UC03 da secção 3.5, implementa o módulo de gestão de turnos de caixa para o servidor Express. Um turno é aberto por um operador num terminal de caixa específico, acumula vendas durante o dia, e é fechado com registo do numerário contado. O gerente deve aprovar o fecho. O módulo também deve suportar sangrias (retiradas de numerário durante o turno) e o fundo de maneio inicial.
  ],
  analise: [
    O modelo produziu uma máquina de estados básica com dois estados (`aberto` e `fechado`) e os endpoints de abertura e fecho. A proposta era funcional para o caso simples mas incompleta: o fecho de turno pelo caixeiro deve colocar o turno em estado `pending_approval`, e o gerente aprova ou rejeita. Este estado intermédio é essencial para o controlo de discrepâncias e não foi contemplado.

    Também não foram incluídos os endpoints de sangria (`cash_drops`) nem o fundo de maneio de abertura (`register_opening_floats`) — duas funcionalidades com impacto direto no cálculo do numerário esperado na gaveta. A equipa adicionou estes dois sub-módulos após identificar as lacunas.

    O modelo não contemplou a validação de que o dia anterior foi fechado antes de permitir a abertura de um novo turno (RNF05). Esta regra foi adicionada manualmente: ao tentar abrir um turno, o servidor verifica se existem turnos do dia anterior sem fecho de dia associado, bloqueando a abertura se for o caso.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    O módulo de turnos gerado não inclui os endpoints de sangria nem de fundo de maneio. Implementa: POST /api/cash-drops para registo de retiradas de numerário durante o turno com aprovação do gerente; GET/PUT /api/cash-drops para listagem e aprovação; GET/POST /api/register-opening-floats para consulta e definição do fundo de maneio por terminal e data. Adiciona também GET /api/shift-closures/:id/cash-summary que calcula o numerário esperado na gaveta: fundo inicial + vendas em dinheiro − sangrias.
  ],
  analise: [
    O modelo gerou os três grupos de endpoints com a estrutura correta. O `cash-summary` foi bem implementado, devolvendo os componentes individuais (fundo, vendas em numerário, total de sangrias) além do total esperado — necessário para que o caixeiro preencha a contagem com contexto.

    O único ajuste foi na aprovação de sangrias: o modelo permitia que o próprio caixeiro aprovasse a sangria que criou. A equipa adicionou validação de que o aprovador tem papel `manager` ou `admin` e não é o mesmo utilizador que criou a sangria.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`POST /api/shift-closures/open`], [Abertura de turno por operador de caixa, com validação do terminal, verificação de fecho do dia anterior e comparação do fundo declarado com o fundo definido pelo gerente.],

  [`PUT /api/shift-closures/:id`], [Atualização do turno: submissão de fecho pelo caixeiro (`→ pending_approval`) ou aprovação pelo gerente (`→ approved`), com registo de numerário contado, sangrias e discrepâncias.],

  [`GET /api/shift-closures`], [Listagem de turnos com filtragem por loja, operador, estado e terminal.],

  [`GET /api/shift-closures/my-open`], [Turno atualmente aberto do operador autenticado.],

  [`GET /api/shift-closures/active`], [Turno aberto num terminal específico, usado pelo PDV para verificação.],

  [`GET /api/shift-closures/:id/cash-summary`], [Resumo do numerário esperado na gaveta: fundo inicial + vendas em dinheiro − sangrias.],

  [`GET /api/cash-drops`], [Listagem de sangrias com filtragem por loja e turno.],

  [`POST /api/cash-drops`], [Registo de sangria durante o turno com aprovação de gerente.],

  [`PUT /api/cash-drops/:id`], [Atualização de estado da sangria (pendente → aprovada).],

  [`GET /api/register-opening-floats`], [Consulta do fundo definido pelo gerente para um terminal numa data.],

  [`POST /api/register-opening-floats`], [Definição do fundo de maneio de abertura por terminal e data.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "DeepSeek",
  iteracao: 1,
  prompt: [
    O módulo de turnos de caixa do FlashStore implementa uma máquina de estados (open → pending_approval → approved) no handler PUT /api/shift-closures/:id, com validações de papel e de propriedade do turno embutidas diretamente no handler. Além disso, existe um endpoint POST /api/shift-closures legado marcado como deprecated que ainda responde com mensagens de erro. Identifica os code smells e propõe melhorias.
  ],
  analise: [
    O DeepSeek identificou dois problemas reais: o endpoint legado `POST /api/shift-closures` que ainda responde (mesmo que apenas com erros orientativos) cria confusão sobre qual endpoint usar; e a lógica de transição de estados embutida no handler dificulta a adição de novos estados no futuro. Sugeriu introduzir uma máquina de estados explícita com mapa de transições válidas.

    A equipa considerou a sugestão da máquina de estados adequada concetualmente mas excessiva para o número atual de estados. O endpoint legado foi mantido intencionalmente para orientar clientes antigos, mas o modelo alertou para o risco de confusão em testes — ponto aceite e documentado.

    #strong[Problema corrigido:] O handler `PUT /api/shift-closures/:id` para aprovação pelo gerente não verificava se o turno pertencia à loja do gerente, permitindo que um gerente aprovasse turnos de outra loja. Foi adicionada a verificação `req.user.store !== e.store` para gerentes, com retorno 403.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints de turnos (`/api/shift-closures/`), sangrias (`/api/cash-drops`), fundo de maneio (`/api/register-opening-floats`); função `computeShiftExpectedDrawerCash`],

  [Servidor], [`server/database.js` — tabelas `shift_closures`, `cash_drops`, `register_opening_floats`],

  [Frontend], [`src/components/cashier/ShiftOpenModal.jsx` — modal de abertura de turno com declaração de fundo],

  [Frontend], [`src/components/cashier/ShiftCloseModal.jsx` — modal de fecho com contagem de numerário e registo de discrepâncias],
)


== Camada A - M06 — Fecho de Dia Operacional

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF09 (envio diário de resumo para o núcleo central), RNF05 (consolidação diária obrigatória ao fecho do dia) e no diagrama de sequência UC04 da secção 3.5 do relatório, implementa o módulo de fecho de dia operacional para o servidor Express. O fecho de dia deve: consolidar todas as vendas e turnos do dia para uma loja, impedir novas vendas e novas aberturas de turno após o fecho, e permitir reabertura com justificação pelo administrador. Indica como garantir a consistência sem usar transações distribuídas.
  ],
  analise: [
    O modelo produziu os endpoints principais de criação e consulta de fecho de dia. A lógica de bloqueio de vendas após fecho foi tratada pelo modelo como uma simples verificação no endpoint de fecho, o que estava errado: o bloqueio tem de ser aplicado nos endpoints de criação de venda e de abertura de turno, não no próprio fecho. A equipa implementou a função auxiliar `ensureDayNotClosed` que é chamada no início dos handlers `POST /api/sales` e `POST /api/shift-closures/open`, centralizando a verificação num único ponto.

    O modelo não incluiu o endpoint de reabertura de fecho com justificação obrigatória, nem a validação de que todos os turnos do dia estão no estado `approved` antes de permitir o fecho — uma regra de negócio importante para garantir que nenhum turno fica por reconciliar. Ambas as funcionalidades foram adicionadas pela equipa.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/day-closures`], [Listagem de fechos de dia com filtragem por loja e período.],

  [`GET /api/day-closures/:store/:date`], [Consulta do fecho de um dia específico para uma loja.],

  [`POST /api/day-closures`], [Criação do fecho de dia com validação de que todos os turnos estão aprovados e registo do resumo consolidado (total de vendas, total por método de pagamento, número de transações).],

  [`POST /api/day-closures/:id/reopen`], [Reabertura de um fecho com registo da justificação e do utilizador responsável; restrita ao papel de administrador.],
)

A função `ensureDayNotClosed` verifica se o dia já foi fechado para uma loja e data, e é chamada nos módulos de vendas e turnos para impedir operações após o fecho. Lança um erro com código HTTP 409 que os handlers propagam diretamente ao cliente.

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    No servidor Express do FlashStore, a função ensureDayNotClosed lança exceções com propriedades customizadas (status, message) que são capturadas e propagadas por múltiplos handlers. Este padrão de controlo de fluxo por exceções é adequado em Node.js/Express? Identifica alternativas e os trade-offs de cada abordagem.
  ],
  analise: [
    O ChatGPT identificou corretamente que usar exceções para controlo de fluxo normal (não erros inesperados) é uma prática controversa — as exceções têm custo de criação de stack trace e tornam o fluxo menos evidente. Sugeriu duas alternativas: retornar um objeto `{ ok, error, status }` e verificar no handler, ou usar um middleware de validação pré-rota. A equipa considerou a primeira alternativa mais simples e legível, mas optou por manter o padrão atual para não introduzir refactoring em múltiplos handlers numa fase tardia do desenvolvimento.

    O ponto mais útil da análise foi a identificação de que `ensureDayNotClosed` faz duas queries à base de dados em sequência sem transação, o que introduz uma condição de corrida teórica. Em SQLite com `better-sqlite3` este risco é nulo dado o modelo de concorrência de single-writer, mas é um ponto relevante para futura migração de base de dados.

    #strong[Problema corrigido:] O endpoint de reabertura não registava o evento na auditoria. Foi adicionado `logAudit` com severidade `high` para registar a reabertura, o identificador do fecho e a justificação fornecida.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `/api/day-closures` (GET, GET por loja/data, POST, POST reopen); função auxiliar `ensureDayNotClosed` usada transversalmente],

  [Servidor], [`server/database.js` — tabela `day_closures` com colunas `store`, `closure_date`, `total_sales`, `reopened_at`, `reopen_reason`],

  [Frontend], [`src/pages/manager/DayClosure.jsx` — interface de fecho de dia com resumo de turnos e confirmação],
)


== Camada A - M07 — Fornecedores e Encomendas

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF11 (entrada de mercadoria com associação a fornecedor e atualização de stock) do relatório e no modelo de domínio da secção 2.9.2 (entidades Fornecedor, Encomenda, EntradaMercadoria), implementa o módulo de gestão de fornecedores e encomendas para o servidor Express. Uma encomenda é criada pelo gerente, enviada ao fornecedor, e quando marcada como recebida deve gerar automaticamente uma entrada de mercadoria e atualizar o stock. As entradas de mercadoria também podem ser criadas manualmente sem encomenda prévia.
  ],
  analise: [
    O modelo produziu a estrutura CRUD para fornecedores e encomendas de forma adequada. O ponto mais relevante que o modelo não resolveu foi a transição automática de estado da encomenda: quando o estado muda para `received`, deve ser criada automaticamente uma entrada de mercadoria e o stock de cada produto deve ser atualizado com os lotes recebidos. O modelo tratou estas como operações separadas que o utilizador teria de executar manualmente — a equipa integrou a lógica de criação automática da entrada de mercadoria e atualização de stock diretamente no handler `PUT /api/supplier-orders/:id` quando `status === 'received'`.

    O modelo também não contemplou a validação de que os produtos de uma encomenda pertencem ao fornecedor correto — um produto pode ter um fornecedor preferencial definido no catálogo, e a encomenda deve respeitar essa associação. A equipa adicionou essa validação no endpoint de criação de encomendas.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/suppliers`], [Listagem de fornecedores.],

  [`POST /api/suppliers`], [Criação de fornecedor.],

  [`PUT /api/suppliers/:id`], [Atualização de fornecedor.],

  [`DELETE /api/suppliers/:id`], [Remoção de fornecedor.],

  [`GET /api/supplier-orders`], [Listagem de encomendas com os itens de cada uma.],

  [`POST /api/supplier-orders`], [Criação de encomenda com validação de associação produto-fornecedor.],

  [`PUT /api/supplier-orders/:id`], [Atualização de estado; quando `status → received`, cria automaticamente uma entrada de mercadoria e atualiza o stock por lote via `upsertStockLot`.],

  [`GET /api/merchandise-entries`], [Listagem de entradas de mercadoria com itens.],

  [`POST /api/merchandise-entries`], [Criação manual de entrada de mercadoria com atualização imediata do stock.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "GitHub Copilot",
  iteracao: 1,
  prompt: [
    No handler PUT /api/supplier-orders/:id do FlashStore, quando o estado muda para "received", o código cria automaticamente uma entrada de mercadoria e actualiza o stock de cada item. Esta lógica de side-effect está embutida no handler HTTP. Que problemas isso causa e como se poderia isolar?
  ],
  analise: [
    O Copilot identificou o problema como um efeito lateral acoplado à camada HTTP — se a criação da entrada de mercadoria falhar a meio, a encomenda já foi marcada como `received` mas o stock pode não ter sido atualizado. Sugeriu envolver toda a operação numa transação SQLite, o que a equipa confirmou já estar implementado com `db.transaction()`. O ponto que o Copilot não identificou foi que a lógica de criação da entrada de mercadoria está duplicada entre este handler e o `POST /api/merchandise-entries`.

    #strong[Problema corrigido:] O handler de receção de encomenda não atualizava os números de série e datas de validade dos itens antes de criar os lotes de stock — os lotes eram criados com esses campos nulos mesmo que o utilizador os tivesse preenchido. Foi corrigida a ordem das operações: primeiro atualizar os itens da encomenda, depois criar os lotes.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `/api/suppliers` (CRUD), `/api/supplier-orders` (GET, POST, PUT com criação automática de entrada), `/api/merchandise-entries` (GET, POST)],

  [Servidor], [`server/database.js` — tabelas `suppliers`, `supplier_orders`, `supplier_order_items`, `merchandise_entries`, `merchandise_entry_items`],

  [Frontend], [`src/pages/manager/Suppliers.jsx` — lista e formulário de fornecedores],

  [Frontend], [`src/pages/manager/Orders.jsx` — gestão de encomendas com atualização de estado],

  [Frontend], [`src/pages/admin/AdminSuppliers.jsx` — visão central de fornecedores],

  [Frontend], [`src/pages/admin/AdminOrders.jsx` — visão central de encomendas],
)

=== Sugestões de Reposição Automática

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    No FlashStore, o gerente tem de criar encomendas manualmente. Implementa um endpoint que, com base no histórico de vendas dos últimos N dias e no stock atual por loja, calcule sugestões de reposição por produto — indicando a quantidade sugerida a encomendar e o fornecedor preferencial. Implementa também um endpoint que, a partir dessas sugestões, crie automaticamente uma encomenda ao fornecedor preferencial de cada produto.
  ],
  analise: [
    O modelo gerou a lógica de cálculo de sugestões de forma adequada: média de vendas diárias dos últimos 30 dias multiplicada por um fator de cobertura configúravel, subtraindo o stock atual. Os produtos sem histórico de vendas são excluídos das sugestões.

    O ponto que o modelo não resolveu foi o agrupamento por fornecedor: a criação automática de encomenda deve gerar uma encomenda por fornecedor (não uma encomenda global), pois cada fornecedor tem a sua própria relação comercial. A equipa implementou o agrupamento por `supplier_id` antes de criar as encomendas.

    O modelo também não contemplou o caso em que um produto não tem fornecedor preferencial definido no catálogo — esses produtos são sinalizados nas sugestões mas excluídos da criação automática de encomenda, cabendo ao gerente associá-los manualmente.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/replenishment-suggestions`], [Calcula sugestões de reposição por produto para uma loja, com base no histórico de vendas dos últimos N dias e no stock atual. Devolve quantidade sugerida, fornecedor preferencial e flag de aviso quando o produto não tem fornecedor associado.],

  [`POST /api/replenishment-suggestions/create-order`], [Cria encomendas automáticas a partir das sugestões, agrupadas por fornecedor. Produtos sem fornecedor preferencial são ignorados. Devolve a lista de encomendas criadas.],
)

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `GET /api/replenishment-suggestions` e `POST /api/replenishment-suggestions/create-order`, lógica de cálculo de médias de vendas e agrupamento por fornecedor],

  [Servidor], [`server/database.js` — consulta ao histórico de `sales` e `sale_items` para cálculo de médias; tabelas `products` e `stock` para comparação com stock atual],
)



== Camada A - M08 — Promoções

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF18 (promoções temporárias por produto ou categoria) do relatório, implementa o módulo de promoções para o servidor Express do FlashStore. Uma promoção define um desconto (percentagem ou valor fixo) aplicável a um produto ou a toda uma categoria, durante um período com data de início e fim. O desconto deve ser aplicado automaticamente no PDV quando o produto é adicionado ao carrinho. Indica como estruturar o endpoint e como o frontend deve calcular o preço com desconto.
  ],
  analise: [
    O modelo produziu o CRUD de promoções com estrutura adequada. A proposta de aplicar o desconto no servidor no momento do registo da venda foi avaliada pela equipa: aplicar no servidor garantiria consistência, mas tornaria o PDV dependente de uma chamada extra à API antes de cada adição ao carrinho — incompatível com o modo offline (RF03). A equipa optou por calcular o desconto no frontend com base nas promoções carregadas na inicialização do PDV, e registar o preço já descontado nos itens de venda. As promoções são descarregadas uma vez no arranque e atualizadas periodicamente.

    O modelo sugeriu usar campos de percentagem e valor fixo em simultâneo, com uma coluna `discount_type` para distinguir. A equipa simplificou para usar sempre percentagem, dado que os descontos de valor fixo podem ser expressos como percentagem do preço unitário.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/promotions`], [Listagem de promoções, incluindo o campo `is_active` calculado pelo servidor com base na data atual — o frontend usa este campo diretamente, sem recalcular.],

  [`POST /api/promotions`], [Criação de promoção com produto ou categoria alvo, percentagem de desconto e período de validade. Restrito ao administrador.],

  [`PUT /api/promotions/:id`], [Atualização de uma promoção existente.],

  [`DELETE /api/promotions/:id`], [Remoção de promoção.],
)

No frontend, as promoções ativas são carregadas no arranque do PDV e aplicadas no carrinho antes de cada cálculo de total. Uma promoção de categoria aplica-se a todos os produtos dessa categoria; uma promoção de produto aplica-se apenas ao produto específico. Quando ambas se aplicam, prevalece a promoção de produto.

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    No FlashStore, a lógica de aplicação de promoções está duplicada: o servidor valida as promoções ativas por data no GET /api/promotions, e o frontend repete a mesma lógica de verificação de datas para filtrar promoções ativas antes de aplicar ao carrinho. Como resolver esta duplicação e onde deve residir a lógica canónica?
  ],
  analise: [
    O Claude identificou a duplicação corretamente e apresentou três opções: mover tudo para o servidor (um endpoint que recebe o carrinho e devolve os preços finais), manter no frontend com um endpoint de validação, ou usar um campo computado na API (`is_active` calculado no servidor). A equipa adotou a terceira opção — o endpoint `GET /api/promotions` calcula e devolve o campo `is_active` baseado na data atual do servidor, e o frontend usa esse campo em vez de recalcular. Elimina a duplicação sem introduzir acoplamento entre carrinho e servidor.

    O modelo também identificou que as promoções não têm qualquer mecanismo de prioridade — se duas promoções ativas se aplicam ao mesmo produto (uma por produto, outra por categoria), o comportamento era indefinido. A equipa adicionou a regra de desempate: promoção de produto tem prioridade sobre promoção de categoria.

    #strong[Problema corrigido:] O endpoint de criação de promoções não validava que `end_date >= start_date`, permitindo criar promoções com período inválido. Foi adicionada validação que rejeita com 400 se a data de fim for anterior à data de início.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `/api/promotions` (GET com `is_active` calculado, POST, PUT, DELETE)],

  [Servidor], [`server/database.js` — tabela `promotions` com colunas `product_id`, `category`, `discount_percent`, `start_date`, `end_date`],

  [Frontend], [`src/pages/admin/AdminPromotions.jsx` — gestão de promoções da cadeia de lojas],
)


== Camada A - M09 — Relatórios e Dashboard

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF09 (relatório diário de vendas por caixa e funcionário) e RF16 (relatório comparativo entre lojas por período) do relatório, e tendo em conta os casos de uso UC07 e UC08 da secção 2.7, implementa os endpoints de relatórios e dashboard para o servidor Express do FlashStore. O dashboard deve mostrar indicadores em tempo real para o gerente da loja (vendas do dia, stock baixo, turnos ativos) e para o administrador central (visão agregada de todas as lojas). Os relatórios devem suportar filtragem por período e exportação.
  ],
  analise: [
    O modelo produziu queries SQL de agregação corretas para os indicadores principais. A estrutura de dashboards separados por papel (loja vs. central) foi bem identificada. Contudo, o modelo não contemplou a filtragem por data nos dashboards — propôs sempre dados do dia atual, sem possibilidade de consultar dias anteriores. A equipa adicionou o parâmetro `date` opcional que permite consultar o dashboard de qualquer data passada, essencial para o gerente verificar o desempenho de dias anteriores.

    Para o relatório comparativo entre lojas, o modelo sugeriu uma query com múltiplos `GROUP BY` que devolvia dados brutos sem agregação temporal — o relatório exige comparação por período (semana, mês) entre lojas, o que requer uma estrutura de resposta hierárquica. A equipa reformulou a query para agrupar por loja e período, devolvendo uma matriz de valores adequada à visualização em gráfico de barras no frontend.

    O modelo não incluiu o relatório diário por turno/operador (RF09), que é distinto do dashboard — é um documento formal gerado no final do dia com totais por método de pagamento. Foi implementado como endpoint separado `/api/sales/daily-report`.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/dashboard/store/:store`], [Indicadores do dia para uma loja: total de vendas, número de transações, vendas por método de pagamento, turnos abertos, alertas de stock mínimo e validade. Suporta parâmetro `date` para consulta de dias anteriores.],

  [`GET /api/dashboard/global`], [Visão agregada de todas as lojas para o administrador: totais consolidados, ranking de lojas por volume de vendas, número de lojas com alertas ativos.],

  [`GET /api/sales/daily-report`], [Relatório formal por turno e operador com totais por método de pagamento, discrepâncias de numerário e número de transações. Filtrável por loja, data e operador.],

  [`GET /api/reports/comparative`], [Relatório comparativo de vendas entre lojas num período definido, agrupado por loja e semana/mês.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "DeepSeek",
  iteracao: 1,
  prompt: [
    Os endpoints de dashboard do FlashStore executam múltiplas queries SQL de agregação em sequência para montar a resposta (vendas do dia, turnos ativos, alertas de stock, etc.). Cada query é independente e executada em série. Identifica os problemas desta abordagem em termos de performance e manutenibilidade.
  ],
  analise: [
    O DeepSeek identificou dois problemas: o tempo de resposta é a soma dos tempos de todas as queries (em vez do máximo, se fossem paralelas), e a adição de um novo indicador exige modificar o handler e adicionar mais uma query em série. Sugeriu agrupar as queries numa única query com múltiplas subconsultas ou usar queries paralelas com `Promise.all`. O `better-sqlite3` é síncrono e não suporta paralelismo real, mas o modelo não sabia isso. Em SQLite, a forma correta é combinar numa única query com subconsultas ou CTEs — sugestão válida que a equipa avaliou mas não implementou dado o custo de refactoring e a performance já satisfatória (todas as queries usam índices e retornam em milissegundos).

    #strong[Problema corrigido:] O endpoint `GET /api/dashboard/store/:store` não validava se a loja pedida existia, podendo retornar um dashboard vazio sem erro para lojas inexistentes. Foi adicionada validação com retorno 404 se a loja não existir na base de dados.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `/api/dashboard/store/:store`, `/api/dashboard/global`, `/api/sales/daily-report`, `/api/reports/comparative`],

  [Frontend], [`src/pages/manager/Dashboard.jsx` — dashboard de loja com gráficos Recharts e indicadores],

  [Frontend], [`src/pages/manager/Reports.jsx` — relatório diário exportável],

  [Frontend], [`src/pages/admin/AdminDashboard.jsx` — dashboard central multi-loja],

  [Frontend], [`src/pages/admin/AdminReports.jsx` — relatório comparativo entre lojas],
)


== Camada A - M10 — Utilizadores e Lojas

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF19 (criar utilizadores com diferentes perfis) e RF21 (registo de operações críticas associadas ao utilizador) do relatório, e na secção 2.6 (atores do sistema: caixeiro, gerente, administrador), implementa o módulo de gestão de utilizadores e lojas para o servidor Express. O sistema tem três papéis distintos. Um utilizador pertence a uma loja específica (exceto o administrador central). A gestão de lojas inclui os terminais de caixa de cada loja. Indica como estruturar os endpoints e as restrições de acesso.
  ],
  analise: [
    O modelo produziu um CRUD de utilizadores completo com hashing de password via bcrypt. A separação de papéis e a atribuição de utilizadores a lojas foi bem contemplada. O ponto que exigiu ajuste foi a restrição de quem pode gerir utilizadores: o modelo restringiu a criação de utilizadores apenas ao administrador, mas na prática um gerente de loja necessita de poder criar e desativar operadores de caixa da sua loja sem depender do administrador central. A equipa adicionou a lógica de que gerentes podem criar utilizadores com papel `cashier` para a sua própria loja, mas não podem criar gerentes ou administradores.

    O modelo não incluiu a gestão de terminais de caixa (`pos_terminals`) como parte deste módulo — os terminais são necessários para que os caixeiros possam abrir turnos (M05 requer um terminal válido). A equipa adicionou os endpoints de terminais como extensão natural deste módulo.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/users`], [Listagem de utilizadores, sem campo `password_hash`.],

  [`POST /api/users`], [Criação com hashing de password, atribuição de papel e loja. Gerentes só podem criar caixeiros para a sua loja.],

  [`PUT /api/users/:id`], [Atualização incluindo mudança de password (re-hashing automático) e ativação/desativação.],

  [`DELETE /api/users/:id`], [Remoção restrita ao administrador.],

  [`GET /api/stores`], [Listagem de lojas da cadeia.],

  [`POST /api/stores`], [Criação de loja (administrador).],

  [`PUT /api/stores/:id`], [Atualização de dados da loja.],

  [`DELETE /api/stores/:id`], [Eliminação de loja. Restrita ao administrador.],

  [`GET /api/pos-terminals`], [Listagem de terminais de uma loja com estado ativo/inativo.],

  [`POST /api/pos-terminals`], [Criação de terminal (gerente ou administrador).],

  [`PUT /api/pos-terminals/:id`], [Atualização de estado do terminal.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "GitHub Copilot",
  iteracao: 1,
  prompt: [
    No servidor Express do FlashStore, o hashing de password com bcrypt é feito tanto no handler POST /api/users (criação) como no PUT /api/users/:id (atualização, quando a password é alterada). O código de hashing está duplicado nos dois handlers. Como resolver esta duplicação?
  ],
  analise: [
    O Copilot sugeriu extrair uma função `hashPassword(plain)` reutilizável. Sugestão correta e simples — a equipa implementou. Adicionalmente, o Copilot identificou que o `PUT /api/users/:id` lia a password em texto limpo do corpo do pedido e fazia hash incondicionalmente, mesmo quando o campo `password` não era enviado (ficava `undefined`, que o bcrypt hasheia como a string `"undefined"`). Este bug foi corrigido: o hashing só ocorre quando `password` está explicitamente presente no corpo do pedido.

    #strong[Problema corrigido:] O endpoint de listagem de utilizadores devolvia o campo `password_hash` na resposta. Embora o hash não seja reversível, é má prática expô-lo. A query foi alterada para selecionar explicitamente apenas os campos necessários, excluindo `password_hash`.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `/api/users` (CRUD), `/api/stores` (GET, POST, PUT, DELETE), `/api/pos-terminals` (GET, POST, PUT)],

  [Servidor], [`server/database.js` — tabelas `users`, `stores`, `pos_terminals`],

  [Frontend], [`src/pages/admin/AdminUsers.jsx` — gestão central de utilizadores],

  [Frontend], [`src/pages/admin/AdminStores.jsx` — gestão de lojas e terminais],

  [Frontend], [`src/pages/manager/Employees.jsx` — gestão de operadores de caixa da loja],
)

== Camada A - M11 — Auditoria

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF21 (registo de operações críticas associadas ao utilizador autenticado) e RNF08 (registo auditável de operações sensíveis) do relatório, implementa o módulo de auditoria para o servidor Express do FlashStore. O sistema deve registar automaticamente eventos como logins, criação de vendas, cancelamentos, fechos de turno e alterações de utilizadores, associando cada evento ao utilizador autenticado, à loja, à data e à severidade. Indica como estruturar o registo de eventos de forma a não afetar a performance das operações principais.
  ],
  analise: [
    O modelo produziu uma função de logging adequada com os campos essenciais: utilizador, ação, entidade, identificador da entidade, loja e timestamp. A proposta de usar uma tabela separada `audit_logs` em vez de enriquecer tabelas existentes estava correta e foi seguida.

    O ponto mais importante que o modelo não resolveu foi o impacto na performance: o modelo sugeriu fazer o insert de auditoria em série com a operação principal, o que aumenta o tempo de cada operação sensível. A equipa analisou esta preocupação e concluiu que, com SQLite síncrono e a tabela de auditoria bem indexada, o custo de um insert adicional é negligenciável (< 1ms). A sugestão do modelo de usar uma fila assíncrona ou uma tabela de staging + worker foi descartada por complexidade desnecessária neste contexto.

    O modelo não mencionou a necessidade de um endpoint de consulta dos logs com filtragem — sem isso a auditoria seria apenas um registo interno sem utilidade operacional. A equipa adicionou o endpoint `GET /api/audit-logs` com filtragem por ator, ação, loja e período.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/audit-logs`], [Listagem de eventos com filtragem por ator, ação, loja, severidade e período, ordenada por data descendente com limite configurável.],
)

A função `logAudit(req, event)` é chamada nos handlers de todos os módulos após operações sensíveis (login/logout, criação e cancelamento de vendas, abertura e fecho de turnos, alterações de utilizadores, reabertura de fecho de dia). Regista os campos `actor_id`, `actor_email`, `actor_role`, `action`, `entity`, `entity_id`, `store`, `severity` e `payload`.

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    No servidor Express do FlashStore, a função logAudit está definida globalmente no ficheiro index.js e é chamada em dezenas de handlers ao longo do mesmo ficheiro. Quais os problemas desta abordagem e que alternativas existem para tornar o sistema de auditoria mais coeso e testável?
  ],
  analise: [
    O ChatGPT identificou o problema central: `logAudit` é uma função com efeitos laterais (escrita em base de dados) que não pode ser facilmente substituída por um mock nos testes — qualquer teste que chame um handler que use `logAudit` escreve na base de dados de teste. Sugeriu injetar a função como dependência (via parâmetro ou contexto) para facilitar a testabilidade.

    A equipa reconheceu o problema mas optou por manter a abordagem atual dado que os testes de integração usam uma base de dados em memória isolada (criada no `beforeEach`), pelo que os inserts de auditoria não interferem entre testes. A sugestão de injeção de dependência foi registada como melhoria futura.

    #strong[Problema corrigido:] A função `logAudit` não tratava o caso em que `req.user` era `null` (chamadas de endpoints não autenticados ou de processos internos). Se chamada sem utilizador autenticado, causava um erro de acesso a propriedade nula. Foi adicionado guard com valores por defeito para `actor_id`, `actor_email` e `actor_role`.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — função `logAudit`, endpoint `GET /api/audit-logs`],

  [Servidor], [`server/database.js` — tabela `audit_logs` com índices em `actor_id`, `action`, `store`, `created_at`],

  [Frontend], [`src/pages/admin/AdminAudit.jsx` — interface de consulta de logs com filtros e exportação],
)

=== Conformidade RGPD

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    O FlashStore recolhe NIFs de clientes nas vendas (campo opcional `customer_nif` na tabela `sales`), o que constitui dados pessoais sujeitos ao RGPD (RNF12, restrição R03). Implementa os mecanismos de conformidade necessários para o administrador central: anonimização automática de NIFs em vendas com mais de X anos, remoção de todos os dados associados a um NIF específico a pedido do titular, e relatório de retenção de dados pessoais. Todas as operações devem ser restritas ao papel `admin` e registadas na auditoria.
  ],
  analise: [
    O modelo gerou os três endpoints de forma adequada e reconheceu corretamente que a anonimização deve substituir o NIF real por um token não reversível (e não simplesmente apagar o campo, o que quebraria relatórios históricos). Usou `ANONYMIZED-` concatenado com os últimos quatro dígitos do NIF como token — a equipa manteve esta abordagem por ser rastreável sem expor o NIF original.

    O ponto que o modelo não resolveu foi o relatório de retenção: propôs devolver apenas a contagem de NIFs por antiguidade, sem distinguir os que já foram anonimizados dos que ainda são dados reais. A equipa adicionou a distinção entre `raw_nifs` (ainda identificáveis) e `anonymized_nifs` no relatório, tornando-o operacionalmente útil para o DPO.

    Todas as operações são registadas via `logAudit` com severidade `critical`, associando o administrador executor, o número de registos afetados e o timestamp da operação.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`POST /api/admin/rgpd/anonymize-old-nifs`], [Anonimiza os NIFs de vendas com mais de N anos (configurável no body), substituindo-os por um token não reversível. Restrito ao papel `admin`. Regista na auditoria o número de registos afetados.],

  [`POST /api/admin/rgpd/forget-nif`], [Remove todos os dados identificáveis associados a um NIF específico em resposta a um pedido de esquecimento do titular (artigo 17.º do RGPD). Anonimiza o NIF em todas as vendas e remove referências diretas.],

  [`GET /api/admin/rgpd/retention-report`], [Devolve relatório de retenção de dados pessoais: contagem de NIFs reais por antiguidade, contagem de NIFs já anonimizados e data da última operação de anonimização.],
)

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/index.js` — endpoints `POST /api/admin/rgpd/anonymize-old-nifs`, `POST /api/admin/rgpd/forget-nif`, `GET /api/admin/rgpd/retention-report`, com restrição `adminMiddleware` e registo em `logAudit`],

  [Servidor], [`server/database.js` — tabela `sales` com campo `customer_nif`; operações de UPDATE para anonimização],
)

=== Sistema de Backups

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    O RNF09 do FlashStore exige backups periódicos da base de dados central. Implementa um mecanismo de backup automático do ficheiro SQLite (`flashstore.db`) para uma pasta de backups local, com retenção configurável (manter os últimos N backups). Implementa também um endpoint de administração que liste os backups disponíveis com data, tamanho e nome de ficheiro.
  ],
  analise: [
    O modelo gerou a lógica de cópia do ficheiro SQLite com timestamp no nome e retenção por número de ficheiros. A abordagem de copiar o ficheiro diretamente é adequada para SQLite desde que feita no momento certo — o modelo não contemplou o uso do `VACUUM INTO` ou do modo WAL para garantir consistência durante a cópia. A equipa utilizou a API `backup` do `better-sqlite3`, que garante uma cópia consistente mesmo com a base de dados em uso.

    O modelo não contemplou a listagem de backups para o frontend — propôs apenas o mecanismo de criação. A equipa adicionou o endpoint `GET /api/admin/backups` que devolve nome, tamanho e data de cada backup disponível na pasta, permitindo ao administrador monitorizar o estado dos backups sem acesso direto ao servidor.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/admin/backups`], [Lista os backups disponíveis na pasta de backups com nome de ficheiro, tamanho em bytes e data de criação. Restrito ao papel `admin`.],
)

O backup automático é executado pelo scheduler diário (`server/scheduler.js`) e também pode ser despoletado manualmente. A retenção mantém os últimos N ficheiros, eliminando os mais antigos automaticamente.

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/backup.js` — lógica de cópia consistente via API `backup` do `better-sqlite3`, gestão de retenção por número de ficheiros, integração com o scheduler],

  [Servidor], [`server/index.js` — endpoint `GET /api/admin/backups` com listagem de ficheiros da pasta de backups],
)



== Camada A - M12 — SAFT-PT

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF17 (geração automática de ficheiro SAFT-PT mensal) e nos requisitos legais RNF10 e RNF11 do relatório (software certificado pela AT, envio até dia 5 do mês seguinte), implementa o módulo de geração do ficheiro SAFT-PT para o FlashStore. O SAFT-PT é um ficheiro XML com uma estrutura definida pela Autoridade Tributária portuguesa. Deve incluir o cabeçalho da empresa, os produtos, os clientes (quando NIF presente) e as facturas simplificadas do período. O ficheiro deve ter encadeamento de hashes SHA-256 para garantir integridade.
  ],
  analise: [
    O modelo produziu a estrutura XML básica com os nós principais do SAFT-PT. O conhecimento do formato foi globalmente correto, incluindo a hierarquia `AuditFile > Header > MasterFiles > SourceDocuments`. O ponto mais crítico foi o encadeamento de hashes: o SAFT-PT português exige que cada documento tenha uma assinatura derivada do documento anterior, formando uma cadeia que permite à AT detetar documentos alterados ou eliminados. O modelo não implementou este mecanismo — propôs um hash SHA-256 simples por documento sem encadeamento. A equipa implementou o encadeamento correto usando o hash do documento anterior como parte da entrada do hash seguinte.

    O modelo também não contemplou a geração do ficheiro em memória para download direto (sem escrever em disco), o que é preferível para evitar ficheiros temporários no servidor. A equipa implementou o endpoint de forma a gerar o XML e enviá-lo diretamente como resposta HTTP com o cabeçalho `Content-Disposition: attachment`.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`GET /api/saft/export`], [Geração do ficheiro XML SAFT-PT para um período e loja especificados, devolvido diretamente como download com o nome `SAFT-PT_<loja>_<ano><mês>.xml`. Inclui cabeçalho com dados da empresa e período, ficheiros mestre (produtos e clientes com NIF), e documentos de fonte (facturas simplificadas com encadeamento SHA-256).],
)

O encadeamento de hashes garante que qualquer alteração ou eliminação de documentos após a geração do ficheiro é detetável pela AT. O scheduler diário verifica no dia 5 de cada mês se o SAFT do mês anterior foi gerado, e regista um alerta de auditoria se não foi.

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    O módulo SAFT-PT do FlashStore tem toda a lógica de geração do XML numa única função de mais de 200 linhas no ficheiro saft.js. Identifica os problemas de manutenibilidade e propõe como decompor a função mantendo a correção do encadeamento de hashes.
  ],
  analise: [
    O Claude identificou que a função monolítica mistura três responsabilidades distintas: a query à base de dados para recolher os dados do período, a transformação dos dados no formato SAFT-PT, e a serialização para XML. Sugeriu decompor em `fetchSaftData(db, filters)`, `buildSaftModel(data)` e `serializeToXml(model)`. A equipa considerou a decomposição correta mas optou por uma versão simplificada: separação entre a parte de query (`fetchSaftData`) e a de geração (`generateSaft`), sem criar uma camada de modelo intermédia. A lógica de encadeamento de hashes foi mantida na função de geração onde o contexto de hash anterior é mais facilmente propagado.

    #strong[Problema corrigido:] A função de geração não escapava corretamente caracteres XML especiais (como `&` em nomes de produtos) antes de os inserir no XML, o que produzia ficheiros XML inválidos quando os dados continham esses caracteres. Foi adicionado um helper `escapeXml` aplicado a todos os valores de texto.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/saft.js` — função `generateSaft(db, filters)` com `fetchSaftData`, encadeamento SHA-256 e helper `escapeXml`],

  [Servidor], [`server/index.js` — endpoint `GET /api/saft/export` que invoca `generateSaft` e devolve o XML como download],

  [Servidor], [`server/scheduler.js` — verificação mensal no dia 5 com alerta de auditoria se SAFT não gerado],
)


== Camada A - M13 — Sincronização Central

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF14 (envio automático de resumo diário para o núcleo central), RF15 (sincronização com reintento em caso de falha) e ADR-003 (padrão outbox para sincronização offline) da secção 3.2.4 do relatório, implementa o endpoint de receção de dados de sincronização no servidor central Express. O endpoint recebe um lote de operações pendentes dos terminais Electron (vendas e turnos criados offline), processa-as de forma idempotente (a mesma operação pode ser enviada várias vezes sem efeito duplicado), e devolve o estado de cada operação ao cliente para que este atualize a sua fila local.
  ],
  analise: [
    O modelo produziu um endpoint `POST /api/sync/push` com estrutura adequada para receber um array de operações e devolver o resultado de cada uma. A idempotência por UUID foi corretamente identificada como o mecanismo principal: antes de processar cada operação, o servidor verifica se já existe um registo com aquele identificador, e em caso afirmativo devolve sucesso sem reprocessar.

    O ponto que o modelo não contemplou foi a distinção entre tipos de entidade no outbox: o terminal pode enviar tanto vendas (`entity: 'sale'`) como fechos de turno (`entity: 'shift_closure'`), e cada tipo exige lógica de processamento diferente. O modelo assumiu que todas as operações eram vendas. A equipa implementou um dispatcher por tipo de entidade dentro do handler.

    A validação de que a loja do terminal corresponde à loja da operação (para evitar que um terminal envie dados de outra loja) não foi incluída pelo modelo e foi adicionada pela equipa.
  ],
)
#llm-end()

#strong[Endpoints do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Endpoint*], [*Descrição*],

  [`POST /api/sync/push`], [Recebe um array de entradas do outbox local, cada uma com `outbox_id`, `operation`, `entity`, `entity_id` e `payload`. Para cada entrada: verifica idempotência por `entity_id`, processa consoante o tipo (`sale` ou `shift_closure`), e devolve `{ outbox_id, status, entity_id, error }`. O resultado é usado pelo terminal para marcar entradas como sincronizadas ou falhas na fila local.],
)

A lógica de processamento está implementada em `server/syncPush.js`, separada do ficheiro principal de rotas para facilitar a manutenção e os testes. O processamento de vendas replica a lógica do endpoint `POST /api/sales` mas sem os guards de turno e sem interação com o stock central, dado que o stock é gerido localmente no terminal.

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "DeepSeek",
  iteracao: 1,
  prompt: [
    O handler de sincronização do FlashStore processa diferentes tipos de entidade (vendas, turnos) com um bloco if/else por tipo dentro de um loop. À medida que o número de entidades sincronizáveis cresce, este padrão torna-se difícil de manter. Que padrão de design se aplicaria aqui e como implementá-lo em Node.js?
  ],
  analise: [
    O DeepSeek sugeriu o padrão Strategy ou um mapa de handlers por tipo de entidade (`{ sale: handleSale, shift_closure: handleShiftClosure }`), o que torna o dispatcher O(1) em vez de uma cadeia `if/else` e facilita a adição de novos tipos sem modificar o código existente. A equipa considerou a sugestão adequada e parcialmente implementou: o `syncPush.js` usa um objeto de dispatching por tipo em vez de `if/else`. A refactoring foi aplicada porque a complexidade do código o justificava (cada handler tem 20-30 linhas e o número de entidades pode crescer).

    #strong[Problema corrigido:] O handler de sincronização não registava os eventos processados na tabela de auditoria. Vendas sincronizadas ficavam visíveis no histórico de vendas mas sem registo auditável da origem (offline vs. online). Foi adicionado `logAudit` com ação `sale_synced_from_offline` para cada venda processada com sucesso.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Servidor], [`server/syncPush.js` — lógica de processamento do outbox com dispatcher por tipo de entidade e verificação de idempotência],

  [Servidor], [`server/index.js` — endpoint `POST /api/sync/push` que delega para `syncPush.js`],
)


== Camada B - M14 — Autenticação (UI)

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nestas imagens (figma_imagem_autenticacao) e na secção 3.6.1 do relatório (Interface de Autenticação — UC00) e nos requisitos RF20 e RNF07, implementa o módulo de autenticação no frontend React do FlashStore. O sistema usa JWT armazenado em localStorage. A interface deve: mostrar um formulário de login com email e password, redirecionar o utilizador para a área correta consoante o seu papel após login bem-sucedido, proteger todas as rotas da aplicação que requerem autenticação, e restaurar a sessão automaticamente quando o utilizador recarrega a página. Usa React Router v6 e TanStack Query. Os endpoints de autenticação já foram implementados na Camada A — M01 (Autenticação e Autorização): `POST /api/auth/login` devolve `{ token, user: { id, email, full_name, role, store } }`; `GET /api/auth/me` valida o token e devolve o utilizador atual.
  ],
  analise: [
    O modelo produziu uma interface correspondente às imagens do Figma e um `AuthContext` funcional com a lógica de verificação de sessão no arranque. O formulário de login foi gerado corretamente com validação básica e mensagens de erro. O mecanismo de restauração de sessão via `GET /api/auth/me` na inicialização estava correto.

    O problema mais relevante foi a estratégia de redirecionamento: o modelo usou `window.location.href` para redirecionar após login, o que força um reload completo da página e perde o estado da aplicação React. A equipa substituiu por `navigate()` do React Router, que faz a transição sem reload.

    Um segundo problema foi o comportamento quando o utilizador navega diretamente para `/login` estando já autenticado — sem tratamento, o utilizador via o formulário de login novamente. Foi adicionado um `useEffect` que redireciona automaticamente para a área correta se o utilizador já estiver autenticado ao visitar `/login`.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    O módulo de autenticação gerado não inclui um mecanismo centralizado de routing por papel. Atualmente, a lógica de redirecionamento está duplicada em vários pontos da aplicação. Cria um componente RoleRouter que, após autenticação confirmada, lê user.role e redireciona para /admin, /manager ou /cashier conforme o papel. Integra-o nas rotas do App.jsx como handler da rota /.
  ],
  analise: [
    O modelo gerou o `RoleRouter` corretamente como componente independente que consome o `useAuth()` e utiliza `<Navigate>` do React Router. A integração em `App.jsx` foi igualmente bem resolvida, mapeando a rota `/` para este componente.

    O único ajuste necessário foi adicionar o estado de loading — durante a verificação inicial do JWT, o `RoleRouter` mostrava um flash de redirect antes de saber o papel do utilizador. Foi adicionado um spinner enquanto `isLoadingAuth` for `true`, garantindo que o redirect só ocorre após o estado de autenticação estar estabilizado.
  ],
)
#llm-end()

#strong[Componentes gerados]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Componente*], [*Descrição*],

  [`src/lib/AuthContext.jsx`], [Contexto React global com estado de autenticação (`user`, `isLoadingAuth`, `isAuthenticated`). Na montagem, verifica token em `localStorage` e chama `GET /api/auth/me` para restaurar sessão. Expõe `useAuth()`.],

  [`src/pages/Login.jsx`], [Página de login com formulário email/password, gestão de erros inline, indicador de loading e redirecionamento pós-login via `navigate()` sem reload. Inclui bloco de credenciais de desenvolvimento.],

  [`src/pages/RoleRouter.jsx`], [Componente de routing que lê `user.role` e redireciona para `/cashier`, `/manager` ou `/admin`. Mostra spinner enquanto `isLoadingAuth`.],

  [`src/App.jsx`], [Configuração de rotas com `PrivateRoutes` — componente guard que verifica `isAuthenticated` antes de renderizar rotas protegidas; se não autenticado, redireciona para `/login?next=<rota-original>`.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "GitHub Copilot",
  iteracao: 1,
  prompt: [
    No FlashStore, o AuthContext React usa useState para gerir isAuthenticated e user em separado, mas estes dois estados são sempre alterados em conjunto — nunca se atualiza um sem o outro. Que problemas pode causar ter estados relacionados separados em React e como se resolve?
  ],
  analise: [
    O Copilot identificou o problema corretamente: estados relacionados geridos em separado podem causar renders intermédios inconsistentes — por exemplo, `isAuthenticated = true` durante uma fração de frame em que `user` ainda é `null`, o que pode causar erros em componentes que dependem de ambos. Sugeriu consolidar em `useState({ user: null, isAuthenticated: false })` ou usar `useReducer`.

    A equipa avaliou a sugestão: o problema teórico existe mas não se manifesta na prática porque o React 18 faz batching automático de updates de estado na mesma função síncrona. Optou-se por manter os dois `useState` separados por clareza, mas o ponto foi registado.

    #strong[Problema corrigido:] O `navigateToLogin` no `AuthContext` usava `window.location.href = '/login'` — o mesmo problema de reload identificado na iteração 1. Foi substituído garantindo que o código novo usa `useNavigate()` diretamente nos componentes em vez de chamar o método do contexto.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Frontend], [`src/lib/AuthContext.jsx` — contexto de autenticação com hook `useAuth()`],

  [Frontend], [`src/pages/Login.jsx` — página de login com email/password e redirect por papel],

  [Frontend], [`src/pages/RoleRouter.jsx` — routing automático por papel após autenticação],

  [Frontend], [`src/App.jsx` — configuração de rotas protegidas com `PrivateRoutes`],
)


== Camada B - M15 — PDV (Interface Caixa)

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nestas imagens (figma_imagem_caixa) e na secção 3.6.2 do relatório (Interface PDV — UC01, UC02, UC03) e nos requisitos RF01–RF08, RF18 e RNF13 (registo de venda em menos de 3 cliques), implementa a interface de ponto de venda para o operador de caixa no React. A interface deve: permitir pesquisa de produtos por nome ou código de barras, gerir um carrinho com quantidades e totais em tempo real, suportar leitura de código de barras por câmara ou teclado, abrir um modal de pagamento com seleção de método e cálculo de troco, e mostrar o banner de sincronização pendente quando em modo offline. Usa TanStack Query para os dados e shadcn/ui para os componentes. Os endpoints necessários já foram implementados na Camada A — M02 (Catálogo de Produtos): `GET /api/products?is_active=true`; M03 (Ponto de Venda e Vendas): `POST /api/sales` com body `{ store, items, total, payment_method, cashier_email, ... }`; M04 (Gestão de Stock): `GET /api/stock?store=<loja>` para verificar disponibilidade antes de vender; M05 (Turnos de Caixa): `GET /api/shift-closures/my-open`, `POST /api/shift-closures`.
  ],
  analise: [
    O modelo produziu uma estrutura de componentes adequada com a separação entre a grelha de produtos (`ProductGrid`) e o painel de carrinho (`CartPanel`). A gestão de estado do carrinho com `useState` foi correta e eficiente para o volume esperado de itens.

    O modelo sugeriu botões de pagamento rápido por método diretamente no carrinho (um botão por método), o que reduzia o número de cliques mas eliminava a possibilidade de introduzir o NIF do cliente e o montante recebido em numerário. A equipa optou por um único botão "Confirmar Pagamento" que abre o modal completo — a experiência é mais consistente e o NIF é necessário para RF06.

    A leitura de código de barras por câmara foi gerada como componente separado (`BarcodeScannerModal`), o que manteve o `CashierPOS` desacoplado da lógica de câmara. A leitura manual por teclado ficou num segundo modal (`BarcodeInputModal`), com lookup automático ao confirmar.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    O CashierPOS.jsx gerado não inclui a gestão do turno do operador de caixa. Implementa: um modal de abertura de turno (`ShiftOpenModal`) que pede seleção de terminal POS e introdução do fundo de maneio inicial; um modal de fecho de turno (`ShiftCloseModal`) que mostra o resumo de vendas do turno e permite introduzir a contagem de caixa; e um componente `OfflineBanner` que aparece no topo da interface quando há vendas pendentes de sincronização, com um contador e um botão de sincronização manual. O CashierPOS deve bloquear a venda enquanto não houver um turno ativo. Usa TanStack Query para `GET /api/shift-closures/my-open` e `POST /api/shift-closures`.
  ],
  analise: [
    O modelo gerou os três componentes com a estrutura esperada. O `ShiftOpenModal` ficou bem resolvido com a listagem de terminais disponíveis para a loja do utilizador e validação do fundo de maneio. O `ShiftCloseModal` apresentou um resumo correto das transações do turno.

    O ajuste mais relevante foi no `OfflineBanner`: o modelo renderizava o banner como elemento estático no topo do layout, mas a equipa moveu-o para um portal React (`createPortal`) ancorado ao `document.body`, de forma a garantir que o banner permanece visível mesmo quando o utilizador abre modais sobrepostos. O contador de vendas pendentes (`outboxPending`) é passado como prop ao banner — a origem dos dados de sincronização é interna ao contexto Electron, não ao componente React.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 3,
  prompt: [
    O ProductGrid.jsx mostra sempre o preço base dos produtos, mesmo quando existe uma promoção ativa. Além disso, o badge "PROMO" só aparece após o produto ser adicionado ao carrinho. Modifica o componente para: receber a lista de promoções ativas como prop, calcular o preço efetivo de cada produto antes de adicionar ao carrinho, mostrar o preço original riscado e o preço com desconto, e exibir o badge PROMO mesmo antes de clicar no produto.
  ],
  analise: [
    O modelo adicionou corretamente a função `getActivePromo` interna ao `ProductGrid` e o cálculo do `effectivePrice`. A lógica de exibição do preço riscado ficou bem estruturada.

    O ajuste da equipa foi na função de filtro de scope por loja: o modelo não verificava `applies_to_stores` — se uma promoção estivesse configurada apenas para "Braga Centro", aparecia igualmente no POS de outras lojas. Foi adicionado o filtro que compara a loja do utilizador (`userStore`) com a lista `applies_to_stores` da promoção antes de a considerar ativa.
  ],
)
#llm-end()

#strong[Componentes gerados]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Componente*], [*Descrição*],

  [`src/pages/cashier/CashierPOS.jsx`], [Componente principal que orquestra estado do carrinho, pesquisa de produtos, gestão do turno ativo e modais. Bloqueia venda enquanto não há turno aberto.],

  [`src/components/cashier/ProductGrid.jsx`], [Grelha responsiva de produtos com filtro por categoria, pesquisa, badge de promoção ativa, preço efetivo com desconto, controles de quantidade inline e indicador de stock esgotado.],

  [`src/components/cashier/CartPanel.jsx`], [Painel lateral com lista de itens, quantidades editáveis, thumbnails de produto, subtotais por item, total com IVA discriminado e botão de pagamento.],

  [`src/components/cashier/PaymentModal.jsx`], [Modal de pagamento com seleção de método (Numerário, Multibanco, MB Way, Cartão), campo de NIF opcional, campo de montante recebido e cálculo de troco automático para pagamentos em numerário.],

  [`src/components/cashier/BarcodeInputModal.jsx`], [Modal de entrada manual de código de barras por teclado, com lookup automático ao confirmar.],

  [`src/components/cashier/BarcodeScannerModal.jsx`], [Modal de leitura de código de barras por câmara do dispositivo.],

  [`src/components/cashier/ShiftOpenModal.jsx`], [Modal de abertura de turno com seleção de terminal POS e fundo de maneio inicial.],

  [`src/components/cashier/ShiftCloseModal.jsx`], [Modal de fecho de turno com resumo de vendas do turno e contagem de caixa.],

  [`src/components/electron/OfflineBanner.jsx`], [Banner de sincronização pendente com contador de vendas offline e botão de sincronização manual. Renderizado via portal React para garantir visibilidade por cima dos modais.],
)

A interface respeita o RNF13: para pagamentos sem necessidade de troco, o fluxo completo (produto → carrinho → pagar → modal → confirmar) é concluído em 3 interações.

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    O componente CashierPOS.jsx do FlashStore tem mais de 700 linhas e concentra: gestão de estado do carrinho, lógica de pesquisa de produtos, gestão do turno ativo, e renderização de múltiplos modais. Identifica os principais problemas e sugere como decompor sem alterar o comportamento.
  ],
  analise: [
    O modelo identificou corretamente que `CashierPOS.jsx` viola o SRP — é simultaneamente um gestor de estado, um orquestrador de UI e um adaptador de dados. Sugeriu extrair: `useCart()` como hook para a lógica do carrinho, `useActiveShift()` para a gestão do turno, e `useSaleSubmit()` para a submissão da venda.

    A equipa extraiu parcialmente `useCart` como hook local, mas não criou hooks separados para as outras responsabilidades — a decomposição exigiria refactoring extenso num componente estável, com risco de regressão. O componente permanece grande mas funcional, com a lógica de carrinho isolada num hook.

    #strong[Problema corrigido:] O componente não limpava o estado do modal de pagamento ao fechar sem confirmar — os campos (método, NIF, montante) ficavam com os valores da sessão anterior ao reabrir. O estado do modal foi movido para dentro do `PaymentModal`, que reinicia ao montar.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Frontend], [`src/pages/cashier/CashierPOS.jsx` — componente principal do PDV com hook `useCart`],

  [Frontend], [`src/components/cashier/CartPanel.jsx` — painel de carrinho com totais e thumbnails],

  [Frontend], [`src/components/cashier/ProductGrid.jsx` — grelha de produtos com promoções],

  [Frontend], [`src/components/cashier/PaymentModal.jsx` — modal de pagamento com métodos e NIF],

  [Frontend], [`src/components/cashier/BarcodeInputModal.jsx` — entrada manual de código de barras],

  [Frontend], [`src/components/cashier/BarcodeScannerModal.jsx` — leitura por câmara],

  [Frontend], [`src/components/cashier/ShiftOpenModal.jsx` — abertura de turno],

  [Frontend], [`src/components/cashier/ShiftCloseModal.jsx` — fecho de turno],

  [Frontend], [`src/components/electron/OfflineBanner.jsx` — banner de sincronização pendente],

  [Frontend], [`src/components/cashier/CashDropModal.jsx` — modal de sangria de caixa durante o turno, com campo de montante e confirmação por gerente],

  [Frontend], [`src/components/cashier/ManagerAuthFields.jsx` — campos de autenticação de gerente para operações que requerem aprovação (ex.: cancelamento, sangria)],

  [Frontend], [`src/components/cashier/ReturnModal.jsx` — modal de devolução de venda com seleção de itens, motivo e reposição automática de stock],

  [Frontend], [`src/components/cashier/StockLookupModal.jsx` — modal de consulta de stock local por produto, com quantidade disponível por lote],

  [Frontend], [`src/components/cashier/ShiftHistoryModal.jsx` — modal com histórico de turnos anteriores do operador de caixa],

  [Frontend], [`src/components/electron/LocalSalesDialog.jsx` — diálogo que lista as vendas registadas localmente e ainda não sincronizadas com o servidor],

  [Frontend], [`src/components/layout/CashierHeader.jsx` — cabeçalho da interface do caixeiro com identificação do turno ativo, loja e botões de ação rápida],

  [Electron/Lib], [`src/lib/registerSale.js` — orquestra o registo de uma venda: tenta o servidor online e cai para o outbox offline se necessário],

  [Electron/Lib], [`src/lib/receiptPrinter.js` — formata e envia recibos para impressora térmica via IPC Electron],

  [Electron/Lib], [`src/lib/posTerminal.js` — utilitários de identificação e validação do terminal POS associado ao turno ativo],

  [Electron/Lib], [`src/lib/connectivity.js` — deteção de conectividade com o servidor (`isElectronApp`, `checkServerReachable`)],

  [Electron/Lib], [`src/lib/outboxSync.js` — lógica de sincronização do outbox offline: lê entradas pendentes e reenvia ao servidor quando a ligação é restabelecida],

  [Electron/Lib], [`src/lib/localCatalogSync.js` — sincronização do catálogo local (produtos, stock, promoções) incluindo cache de imagens como base64 para uso offline],
)



== Camada B - M16 — Backoffice Gerente

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nestas imagens (figma_imagem_gerente) e na secção 3.6.3 do relatório (Interface Backoffice do Gerente) e nos requisitos RF07–RF13, RF16 e RF18, cria o scaffold do backoffice do gerente de loja no React. Deve incluir: um layout com sidebar de navegação lateral, routing para as várias secções (dashboard, produtos, stock, vendas, encomendas, fornecedores, relatórios, fecho de dia, funcionários), proteção de rotas por papel com redirect para /manager se sem permissão, e os componentes de layout partilhados (cabeçalho de secção, cards de estatística, tabelas). Usa React Router v6, shadcn/ui e TanStack Query. Os endpoints necessários já foram implementados na Camada A — M02 (Catálogo de Produtos): `GET /api/products`, `POST /api/products`, `PATCH /api/products/:id`; M04 (Gestão de Stock): `GET /api/stock`, `PATCH /api/stock/:id`; M05 (Turnos de Caixa): `GET /api/shift-closures`, `POST /api/shift-closures`; M06 (Fecho de Dia): `GET /api/day-closures`, `POST /api/day-closures`; M07 (Fornecedores e Encomendas): `GET /api/supplier-orders`, `POST /api/supplier-orders`, `PATCH /api/supplier-orders/:id`; `GET /api/suppliers`; M09 (Relatórios e Dashboard): `GET /api/dashboard/store`, `GET /api/sales`.
  ],
  analise: [
    O modelo gerou o `ManagerLayout` com o `ManagerSidebar` e a configuração de rotas aninhadas no `App.jsx`. A estrutura de navegação foi bem resolvida, com links activos destacados e indicadores visuais de secção corrente.

    Os componentes partilhados de backoffice (`DashboardHeader`, `DashboardSection`, `BackofficeStatCard`, `StatusBadge`) foram gerados com boa separação de responsabilidades, tornando a adição de novas páginas consistente. A equipa ajustou o `DashboardHeader` para incluir uma barra de pesquisa opcional, passada como prop, uma vez que várias páginas necessitavam de filtro inline no cabeçalho.

    A configuração de permissões por módulo (quais as secções acessíveis por cada papel) foi abstraída no ficheiro `src/lib/permissions.js`, que o modelo não incluiu inicialmente — a equipa criou-o para centralizar `defaultPermissions` e `hasModuleAccess`, evitando verificações dispersas.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    Implementa a página Dashboard.jsx do backoffice do gerente. Deve mostrar: total de vendas do dia, número de transações, valor médio por venda, indicadores de stock abaixo do mínimo, alertas de validade próxima, e um gráfico de vendas por hora com Recharts. Os dados vêm do endpoint GET /api/dashboard/store?store=<loja>. Usa TanStack Query com refetch automático a cada 30 segundos.
  ],
  analise: [
    O modelo gerou o dashboard com os indicadores corretos e o gráfico de barras com Recharts. A integração com TanStack Query com `refetchInterval` foi aplicada corretamente.

    O ajuste necessário foi nos gráficos: o modelo usou cores planas (`fill="#f97316"`) sem gradiente, o que produzia um visual pouco refinado. A equipa substituiu por gradientes lineares SVG (`<linearGradient>` dentro de `<defs>`) para barras com transição de laranja para laranja claro, e customizou os tooltips com cards brancos de bordas arredondadas em vez dos tooltips padrão do Recharts.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 3,
  prompt: [
    Implementa as páginas StockManagement.jsx e Products.jsx do backoffice do gerente. A página de stock deve: listar os lotes de stock da loja do utilizador com colunas para produto, lote, quantidade, validade e estado (normal/alerta/expirado); permitir ajustar quantidades; destacar visualmente lotes expirados ou abaixo do mínimo. A página de produtos deve: listar o catálogo com filtro por categoria e pesquisa por nome; permitir ativar/desativar produtos. Ambas as páginas usam TanStack Query.
  ],
  analise: [
    O modelo gerou as duas páginas com a estrutura esperada. A listagem de stock ficou funcional com os filtros de estado.

    O ponto que exigiu ajuste foi a lógica de destaque de validade: o modelo usava apenas `expiry_date < today` para marcar lotes como expirados, sem considerar a janela de alerta (validade nos próximos 7 dias). A equipa acrescentou a lógica de `alertThreshold` que calcula a diferença em dias e aplica tons diferentes (`critical` para expirados, `warning` para validade próxima, `success` para stock normal).
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 4,
  prompt: [
    Implementa a página DayClosure.jsx do backoffice do gerente para o fecho de dia operacional (RNF05). A página deve: mostrar os turnos do dia com o respetivo estado (aberto, pendente aprovação, aprovado, rejeitado); bloquear o botão de fecho enquanto existirem turnos não aprovados; chamar POST /api/day-closures ao fechar; e mostrar o historial de fechos anteriores.
  ],
  analise: [
    O modelo gerou uma página com um botão "Fechar Dia" e uma tabela simples de fechos históricos, mas sem a listagem de turnos activos nem a validação de estados. A interface real exige que o gerente veja claramente quais os turnos do dia, quais estão pendentes de aprovação e só possa fechar quando todos estiverem aprovados.

    A equipa desenvolveu esta lógica de raiz: query aos turnos do dia (`GET /api/shift-closures?store=<loja>&date=<hoje>`), cálculo do estado agregado (`allApproved`), indicadores visuais por estado de turno com `Badge` colorido, e bloqueio do botão de fecho com tooltip explicativo enquanto existirem turnos pendentes. O componente `DayClosure.jsx` foi o mais extenso da Camada B, com 724 linhas, devido à complexidade de gerir simultaneamente a visão do gerente e do administrador.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 5,
  prompt: [
    Implementa a página Orders.jsx do backoffice do gerente para gestão de encomendas a fornecedores. Deve: listar encomendas com estado (pendente, enviada, recebida); permitir criar nova encomenda com seleção de fornecedor, produtos e quantidades; e marcar encomendas como recebidas. Usa TanStack Query e chama os endpoints POST /api/supplier-orders e PATCH /api/supplier-orders/:id.
  ],
  analise: [
    O modelo gerou a listagem e o formulário de criação corretamente. O problema foi o fluxo de receção: ao marcar uma encomenda como "recebida", o sistema deve registar os números de série e datas de validade dos artigos recebidos antes de confirmar — estes dados alimentam o stock com rastreabilidade por lote. O modelo fez a transição de estado diretamente, sem qualquer recolha de dados de receção.

    A equipa adicionou o modal de receção: ao clicar "Marcar como Recebida", abre um diálogo com a lista de itens da encomenda e campos de `serial_number` e `expiry_date` por item. Ao confirmar, o sistema chama `PATCH /api/supplier-orders/:id` com os dados de receção e atualiza o stock automaticamente.
  ],
)
#llm-end()

#strong[Componentes gerados]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Componente*], [*Descrição*],

  [`src/components/layout/ManagerLayout.jsx`], [Layout principal do backoffice com sidebar fixa e área de conteúdo scrollável.],

  [`src/components/layout/ManagerSidebar.jsx`], [Sidebar com links para todas as secções, ícones Lucide, indicador de secção ativa e avatar do utilizador no rodapé.],

  [`src/pages/manager/Dashboard.jsx`], [Indicadores do dia (vendas, transações, média, stock baixo), alertas de validade e gráfico de vendas por hora com gradiente. Refetch a cada 30 s.],

  [`src/pages/manager/Products.jsx`], [Catálogo de produtos da loja com pesquisa, filtro por categoria e toggle de ativação.],

  [`src/pages/manager/StockManagement.jsx`], [Gestão de lotes de stock com destaque de validade (expirado / alerta / normal) e ajuste de quantidades.],

  [`src/pages/manager/SalesHistory.jsx`], [Histórico de vendas com filtros de data e detalhe de itens; cancelamento de venda com aprovação do gerente.],

  [`src/pages/manager/Orders.jsx`], [Gestão de encomendas com criação, listagem por estado e modal de receção com registo de série e validade por artigo.],

  [`src/pages/manager/Suppliers.jsx`], [Lista e formulário de fornecedores da loja.],

  [`src/pages/manager/Reports.jsx`], [Relatório diário por turno com exportação para PDF.],

  [`src/pages/manager/DayClosure.jsx`], [Fecho de dia com listagem de turnos, validação de estados e bloqueio até todos estarem aprovados. Partilhado com o admin.],

  [`src/pages/manager/Employees.jsx`], [Gestão de operadores de caixa da loja.],

  [`src/pages/manager/AlertsPage.jsx`], [Alertas consolidados de stock mínimo e validade próxima com navegação para o lote em causa.],

  [`src/lib/permissions.js`], [Mapa de permissões por papel (`defaultPermissions`, `hasModuleAccess`) para controlo de acesso a módulos.],

)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    No backoffice React do FlashStore, várias páginas do gerente (Dashboard, Relatórios, Histórico de Vendas) fazem refetch dos dados quando a janela recupera foco, mas outras páginas não têm este comportamento. Há também duplicação de lógica de formatação de datas e moeda em múltiplos componentes. Como uniformizar estas situações?
  ],
  analise: [
    O Claude identificou duas questões reais. Para o refetch ao foco: a inconsistência deve-se ao facto de algumas queries terem `refetchOnWindowFocus: false` explícito e outras não — a solução é definir `defaultOptions` global no `QueryClient` para uniformizar o comportamento. Para a formatação: a duplicação de `toFixed(2) + '€'` e de `new Date().toLocaleDateString('pt-PT')` em múltiplos componentes é um smell claro. A formatação de moeda e data mantém-se inline nas páginas (ex. `toLocaleString('pt-PT')`); um módulo `format.js` partilhado não foi criado.

    #strong[Problema corrigido:] A página `DayClosure.jsx` chamava `api.entities.DayClosure.list()` sem filtro de loja, devolvendo fechos de todas as lojas da cadeia. O gerente via fechos de outras lojas. Foi adicionado filtro `{ store: user.store }` à query.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Frontend], [`src/pages/manager/Dashboard.jsx`],

  [Frontend], [`src/pages/manager/Products.jsx`],

  [Frontend], [`src/pages/manager/StockManagement.jsx`],

  [Frontend], [`src/pages/manager/SalesHistory.jsx`],

  [Frontend], [`src/pages/manager/Orders.jsx`],

  [Frontend], [`src/pages/manager/Suppliers.jsx`],

  [Frontend], [`src/pages/manager/Reports.jsx`],

  [Frontend], [`src/pages/manager/DayClosure.jsx`],

  [Frontend], [`src/pages/manager/AlertsPage.jsx`],

  [Frontend], [`src/pages/manager/Employees.jsx`],

  [Frontend], [`src/components/layout/ManagerLayout.jsx`],

  [Frontend], [`src/components/layout/ManagerSidebar.jsx`],

  [Frontend], [`src/lib/permissions.js` — controlo de acesso por papel],

  [Frontend], [`src/components/backoffice/BackofficeStatCard.jsx` — card de estatística reutilizável para dashboards (título, valor, ícone, variação percentual)],

  [Frontend], [`src/components/backoffice/DashboardHeader.jsx` — cabeçalho de secção de backoffice com título, subtítulo e barra de pesquisa opcional],

  [Frontend], [`src/components/backoffice/DashboardSection.jsx` — contentor de secção de backoffice com título e área de conteúdo],

  [Frontend], [`src/components/backoffice/ManagementShortcuts.jsx` — atalhos rápidos de gestão no dashboard do gerente (acesso direto a stock, encomendas, alertas)],

  [Frontend], [`src/components/backoffice/SalesCharts.jsx` — gráficos Recharts de vendas (por hora, por método de pagamento) com gradientes SVG e tooltips customizados],

  [Frontend], [`src/components/backoffice/StatusBadge.jsx` — badge colorido de estado reutilizável (pendente, aprovado, rejeitado, expirado, etc.)],

  [Frontend], [`src/components/backoffice/SyncStatus.jsx` — indicador de estado de sincronização do backoffice com o servidor],

  [Frontend], [`src/components/manager/ProductForm.jsx` — formulário de criação e edição de produto com validação de campos e upload de imagem],

  [Frontend], [`src/components/reports/DailyShiftReport.jsx` — relatório diário por turno com totais por método de pagamento e exportação para PDF],

  [Frontend], [`src/components/reports/SaftReport.jsx` — componente de geração e exportação do ficheiro SAF-T PT com validação de integridade],

  [Frontend], [`src/components/stock/ProductLotsDialog.jsx` — diálogo de lotes de stock por produto com detalhe de série, validade e estado],
)


== Camada B - M17 — Painel Administração Central

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base nestas imagens (figma_imagem_admin) e na secção 3.6.4 do relatório (Dashboard Central do Administrador — UC08 a UC11) e nos requisitos RF16, RF17, RF19 e RF21, cria o scaffold do painel de administração central no React. O administrador tem visão sobre todas as lojas da cadeia. Deve incluir: layout com sidebar de navegação, routing para as secções (dashboard, utilizadores, lojas, produtos, promoções, fornecedores, encomendas, relatórios, auditoria), e as páginas AdminUsers.jsx e AdminStores.jsx com formulários de criação, edição, ativação e desativação. Usa TanStack Query e shadcn/ui. Os endpoints de gestão central já foram implementados na Camada A: M01 (`GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`), M02 (`GET /api/products`, `POST /api/products`), M08 (`GET /api/promotions`, `POST /api/promotions`, `PATCH /api/promotions/:id`), M09 (`GET /api/dashboard/global`, `GET /api/reports/comparative`), M10 (`GET /api/audit-logs`), M11 (`GET /api/stores`, `POST /api/stores`; `GET /api/pos-terminals`, `POST /api/pos-terminals`), M12 (`GET /api/saft/export` para exportação fiscal).
  ],
  analise: [
    O modelo gerou o `AdminLayout` com sidebar e as páginas `AdminUsers` e `AdminStores` com toda a lógica CRUD esperada. Os formulários de criação e edição de utilizadores foram bem resolvidos, incluindo a seleção de papel, loja associada e estado ativo/suspenso.

    O ajuste mais relevante foi na proteção do último admin ativo: o modelo não implementou a restrição que impede a suspensão ou o rebaixamento de papel quando o utilizador em causa é o único admin ativo. A equipa adicionou a função `isLastActiveAdmin` que verifica esta condição e desabilita os controlos relevantes no formulário e na tabela, com tooltip explicativo.

    Para `AdminStores`, o modelo gerou a gestão básica de lojas mas não incluiu a configuração de terminais POS por loja. A equipa adicionou uma secção expansível por loja que lista os terminais com código, etiqueta e estado, e permite criar/desativar terminais.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    Implementa a página AdminDashboard.jsx do painel de administração. Deve mostrar uma visão agregada de todas as lojas: total de vendas da cadeia, número de lojas ativas, utilizadores ativos, e um gráfico comparativo de vendas por loja com Recharts. Os dados vêm do endpoint GET /api/dashboard/global. Usa TanStack Query.
  ],
  analise: [
    O modelo gerou uma versão do dashboard com dados estáticos hardcoded sem integração real com o endpoint. Os gráficos usavam arrays de exemplo em vez de chamar a API.

    A equipa substituiu os dados estáticos pela integração real com `useQuery` para `GET /api/dashboard/global`, que devolve vendas agregadas por loja, contagens de utilizadores e alertas ativos. O gráfico comparativo de vendas entre lojas usa o componente `StoreSalesBarChart` partilhado com o backoffice do gerente, parametrizado com os dados da cadeia. O componente `SyncStatus` no dashboard admin é um placeholder (“funcionalidade em preparação”), sem dados reais de sincronização por loja.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 3,
  prompt: [
    Implementa as páginas AdminFranchiseProducts.jsx, AdminPromotions.jsx, AdminSuppliers.jsx e AdminOrders.jsx do painel de administração. Os produtos da cadeia são o catálogo de referência franchisado — o admin pode criar, editar e desativar produtos que ficam disponíveis em todas as lojas. As promoções são geridas ao nível da cadeia com tipo (percentagem ou valor fixo), alvo (categoria, produto, loja ou toda a cadeia), período de vigência e escopo de lojas. Os fornecedores e encomendas são a visão consolidada da cadeia, com filtro por loja e estado. Usa TanStack Query e shadcn/ui.
  ],
  analise: [
    O modelo gerou as quatro páginas com estrutura consistente. A `AdminOrders.jsx` ficou bem resolvida — listagem paginada de encomendas com filtro por loja e estado, sem necessidade de ajuste.

    O ponto que exigiu mais trabalho foi o formulário de promoções: o modelo apresentava em simultâneo um campo "Aplicar a: Loja" e uma secção "Aplica-se em" com checkboxes de lojas, criando uma redundância confusa — ao selecionar uma loja como alvo, o sistema pedia novamente para selecionar as lojas de scope.

    A equipa reestruturou o formulário para que a secção de scope de lojas só apareça quando o alvo é "Categoria" ou "Produto específico" (onde faz sentido restringir a lojas específicas), e que ao selecionar "Loja" como alvo o formulário use diretamente essa loja como scope, sem secção separada. Esta reorganização também tornou explícito o caso de uso "produto X apenas na loja Y", que antes estava escondido.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 4,
  prompt: [
    Implementa a página AdminAudit.jsx do painel de administração. Deve mostrar o registo de auditoria do sistema com: tabela de logs ordenada por data descendente, colunas para ator, ação, entidade, loja e severidade, e filtros por cada um desses campos. Usa TanStack Query para GET /api/audit-logs.
  ],
  analise: [
    O modelo gerou a tabela de auditoria sem paginação nem filtros — uma listagem plana de todos os registos. Em produção, com múltiplas lojas e meses de operação, esta página carregaria dezenas de milhares de registos.

    A equipa adicionou: filtros por ator, ação, loja, severidade e período (com selectors e date pickers); indicadores de contagem por severidade no topo (`info`, `medium`, `high`, `critical`) que funcionam como filtro rápido ao clicar; e uma paginação de 50 registos por pedido, com filtros no servidor e exportação CSV dos resultados filtrados. A query passou a enviar os filtros como parâmetros para o servidor, reduzindo o payload.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 5,
  prompt: [
    A página AdminReports.jsx deve mostrar relatórios comparativos de vendas entre lojas com seleção de período. Deve também incluir um formulário de exportação SAFT-PT (formato fiscal português) com seleção de loja e período, que descarregue o ficheiro XML gerado pelo servidor. O endpoint de exportação é GET /api/saft/export?store=<loja>&start=<data>&end=<data>.
  ],
  analise: [
    O modelo não incluiu a funcionalidade de exportação SAFT-PT na primeira iteração, uma vez que não conhecia a especificidade legal do formato. A equipa adicionou o formulário de seleção de período e loja, a chamada ao endpoint e o trigger de download do ficheiro XML via `Blob` e `URL.createObjectURL`. O relatório comparativo entre lojas foi bem integrado com o gráfico de barras do Recharts usando gradiente laranja.
  ],
)
#llm-end()

#strong[Componentes gerados]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Componente*], [*Descrição*],

  [`src/components/layout/AdminLayout.jsx`], [Layout do painel de administração com sidebar e área de conteúdo. Partilha componentes de backoffice com o layout do gerente.],

  [`src/pages/admin/AdminDashboard.jsx`], [Visão global de todas as lojas com indicadores agregados, ranking por volume de vendas e gráfico comparativo com Recharts. Integrado com `GET /api/dashboard/global`.],

  [`src/pages/admin/AdminUsers.jsx`], [Gestão de todos os utilizadores da cadeia com criação, edição, mudança de papel, ativação/desativação e proteção do último admin ativo.],

  [`src/pages/admin/AdminStores.jsx`], [Gestão de lojas e terminais POS, com criação de lojas e configuração de terminais (código, etiqueta, fundo de maneio).],

  [`src/pages/admin/AdminFranchiseProducts.jsx`], [Catálogo de referência da cadeia com criação, edição e ativação de produtos franchisados disponíveis em todas as lojas.],

  [`src/pages/admin/AdminPromotions.jsx`], [Gestão de promoções ao nível da cadeia com tipo, alvo (categoria / produto / loja / cadeia), período e scope de lojas.],

  [`src/pages/admin/AdminSuppliers.jsx`], [Visão consolidada de fornecedores da cadeia com formulário de criação e edição.],

  [`src/pages/admin/AdminOrders.jsx`], [Visão consolidada de encomendas de todas as lojas, com filtro por loja e estado.],

  [`src/pages/admin/AdminReports.jsx`], [Relatório comparativo de vendas entre lojas com seleção de período, gráfico Recharts e exportação SAFT-PT (download de XML).],

  [`src/pages/admin/AdminAudit.jsx`], [Registo de auditoria com filtros avançados por ator, ação, loja e severidade, indicadores de contagem e paginação (50 por página), filtros e exportação CSV.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "DeepSeek",
  iteracao: 1,
  prompt: [
    Várias páginas do painel de administração do FlashStore (AdminUsers, AdminStores, AdminSuppliers) seguem o mesmo padrão: lista com TanStack Query, botão de criação que abre um modal, formulário com validação, submit que invalida a query. Este padrão repete-se com poucas variações. Como abstrair sem over-engineering?
  ],
  analise: [
    O modelo identificou o padrão corretamente e sugeriu criar um componente genérico `CrudPage` parametrizado por entidade. A equipa avaliou a sugestão e decidiu não abstrair: as variações entre páginas (campos de formulário, colunas da tabela, validações específicas como `isLastActiveAdmin`) são suficientemente diferentes para tornar a abstração genérica complexa de usar e difícil de depurar. Três páginas similares não justificam uma abstração — a regra aplicada foi que a abstração se justifica a partir da quinta ou sexta repetição com variações mínimas. O código mantém alguma duplicação estrutural mas cada página é legível e depurável de forma independente.

    #strong[Problema corrigido:] A página `AdminAudit.jsx` carregava todos os logs sem limite, o que em produção poderia resultar em dezenas de milhares de registos a serem transferidos e renderizados. Foi adicionado um limite padrão de 500 registos com indicação do total disponível e botão de exportação do conjunto completo.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Frontend], [`src/components/layout/AdminLayout.jsx`],

  [Frontend], [`src/pages/admin/AdminDashboard.jsx`],

  [Frontend], [`src/pages/admin/AdminUsers.jsx`],

  [Frontend], [`src/pages/admin/AdminStores.jsx`],

  [Frontend], [`src/pages/admin/AdminFranchiseProducts.jsx`],

  [Frontend], [`src/pages/admin/AdminPromotions.jsx`],

  [Frontend], [`src/pages/admin/AdminSuppliers.jsx`],

  [Frontend], [`src/pages/admin/AdminOrders.jsx`],

  [Frontend], [`src/pages/admin/AdminReports.jsx`],

  [Frontend], [`src/pages/admin/AdminAudit.jsx`],
)


== Camada C - M18 — Base de Dados Local

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no ADR-002 (SQLite como base de dados) e ADR-001 (Electron como runtime desktop por loja) da secção 3.2 do relatório, e no requisito RNF04 (suporte a operação offline parcial), implementa a camada de base de dados local para o processo principal do Electron. A base de dados local usa sql.js (SQLite em WASM) em vez de better-sqlite3 para evitar problemas de compilação cruzada. A base de dados deve ser persistida num ficheiro por loja, identificado pela variável de ambiente FLASHSTORE_STORE_ID. Indica como estruturar o adaptador, o schema e o ciclo de vida da base de dados.
  ],
  analise: [
    O modelo produziu uma estrutura adequada com o adaptador `sql.js` e a inicialização da base de dados a partir de ficheiro. A separação entre schema (DDL) e gestão de ciclo de vida (abrir, fechar, persistir) foi bem identificada.

    O ponto crítico que o modelo não resolveu corretamente foi a persistência automática: o `sql.js` mantém a base de dados em memória e requer uma chamada explícita a `db.export()` + escrita em disco após cada operação de escrita. O modelo propôs persistir apenas no fecho da aplicação, o que resultaria em perda de dados em caso de crash. A equipa implementou persistência após cada operação mutante (write-through), garantindo que o ficheiro em disco está sempre sincronizado com o estado em memória.

    O modelo também não abordou o modo em memória para testes — a equipa adicionou suporte explícito ao path `:memory:` que omite a leitura e escrita de ficheiro, isolando os testes da base de dados real.
  ],
)
#llm-end()

#strong[Componentes da camada de dados local]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Módulo*], [*Descrição*],

  [`electron/db/sqlAdapter.cjs`], [Adaptador que expõe uma API compatível com `better-sqlite3` (`prepare`, `exec`, `pragma`, `transaction`). As operações de escrita chamam `persist()` automaticamente. Suporta path `:memory:` para testes.],

  [`electron/db/localSchema.cjs`], [DDL das tabelas locais: `products`, `stock`, `sales`, `sale_items`, `shift_closures`, `sync_outbox`, `catalog_version`. Aplicado com `IF NOT EXISTS` para não destruir dados existentes ao reiniciar.],

  [`electron/db/localDb.cjs`], [Gestão do ciclo de vida: abertura da base de dados por loja (lê o ficheiro existente ou cria novo), aplicação do schema e `close` com persistência final.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "GitHub Copilot",
  iteracao: 1,
  prompt: [
    O adaptador sql.js do FlashStore expõe métodos de escrita (run, exec, transaction) que chamam persist() internamente. Mas persist() também pode ser chamada externamente por quem usa o adaptador. Como garantir que persist() é sempre chamada após operações de escrita sem depender de quem chama se lembrar?
  ],
  analise: [
    O Copilot identificou o problema corretamente: confiar que cada ponto de chamada se lembre de invocar `persist()` é frágil — uma operação de escrita esquecida leva a perda de dados silenciosa. Sugeriu duas abordagens: um Proxy JavaScript que interceta todos os métodos de escrita e chama `persist()` automaticamente, ou uma API mais restrita que envolva `prepare().run()` num wrapper que persiste. A equipa adotou a segunda abordagem: o adaptador chama `persist()` internamente no método `run()` das statements preparadas e na função `transaction()`, tornando desnecessário chamar `persist()` externamente.

    #strong[Problema corrigido (descoberto aqui, corrigido em M20):] A função `db.transaction(fn)` do adaptador retornava a função de transação mas não a invocava — o chamador tinha de escrever `db.transaction(fn)()`. Em vários pontos do código, a segunda invocação `()` estava em falta, o que causava que as operações dentro da transação nunca fossem executadas. Este bug foi o responsável pelo banner de "sincronização pendente" que não desaparecia após sincronização. Corrigido em `syncCommit.cjs`.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Electron], [`electron/db/sqlAdapter.cjs` — adaptador `sql.js` com API compatível com `better-sqlite3` e persist automático],

  [Electron], [`electron/db/localSchema.cjs` — DDL das tabelas locais com `IF NOT EXISTS`],

  [Electron], [`electron/db/localDb.cjs` — ciclo de vida: abertura por loja, aplicação de schema, close],
)


== Camada C - M19 — Operações Offline

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF03 (vendas em modo offline), RF14 (envio automático de dados para o núcleo central) e RNF06 (unicidade e integridade das transações após sincronização) do relatório, implementa o módulo de operações offline para o processo principal do Electron. Quando sem ligação ao servidor, as vendas e fechos de turno devem ser registados na base de dados local SQLite e colocados numa fila de sincronização (outbox). Os handlers IPC devem ser registados para que o renderer (React) possa invocar estas operações sem acesso direto ao Node.js. Usa a base de dados local implementada em M18.
  ],
  analise: [
    O modelo produziu os handlers IPC para registo de vendas e turnos offline, com inserção na tabela `sync_outbox`. A estrutura geral do módulo estava correta.

    O ponto que o modelo não resolveu foi a idempotência das operações: se o renderer enviar a mesma venda duas vezes por erro de rede ou retry, o modelo criaria dois registos duplicados. A equipa implementou o seguinte, cada venda offline recebe um identificador único (`crypto.randomUUID()` no processo principal ao registar a venda) e é enfileirada no `sync_outbox`. A idempotência em reenvios é garantida no servidor central (`POST /api/sync/push`), que ignora vendas com o mesmo `id`. Assim, uma operação reenviada por erro não é duplicada.

    O modelo também não contemplou a importação do catálogo de produtos do servidor para a base de dados local — sem catálogo local, o modo offline não seria funcional (o PDV não conseguiria pesquisar produtos). A equipa adicionou o módulo `catalogImport.cjs` que sincroniza os produtos e o stock do servidor para a base de dados local quando há ligação, usando `INSERT OR REPLACE` para atualizar produtos existentes.
  ],
)
#llm-end()

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 2,
  prompt: [
    O módulo offline não expõe a API de base de dados ao renderer de forma segura. Implementa o preload.cjs que usa o contextBridge do Electron para expor window.flashstore.db ao renderer, sem expor o módulo Node.js diretamente. Os canais IPC a expor são: db:ping, db:getProducts, db:createSale, db:openShift, db:closeShift, db:getShift e db:syncStatus.
  ],
  analise: [
    O modelo gerou o `preload.cjs` corretamente com o `contextBridge.exposeInMainWorld`, encapsulando cada canal IPC num método da API `window.flashstore.db`. A separação entre o que o renderer pode invocar e o que o processo principal executa ficou bem definida.

    O ajuste necessário foi no canal `db:getProducts`: o modelo expunha uma lista plana de produtos sem suporte a pesquisa por termo ou código de barras — o PDV necessita de filtrar produtos localmente quando está offline. A equipa adicionou os parâmetros `{ query, barcode }` ao canal, passados ao handler que executa a pesquisa `LIKE` na base de dados local.
  ],
)
#llm-end()

#strong[Componentes do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Módulo*], [*Descrição*],

  [`electron/db/offlineSale.cjs`], [Registo de venda na base de dados local com UUID idempotente (`INSERT` em `sales` + entrada em `sync_outbox` (`pending`)), atualização de stock local por lote e inserção na tabela `sync_outbox` com estado `pending`.],

  [`electron/db/offlineShift.cjs`], [Abertura e fecho de turno na base de dados local com inserção no outbox para sincronização com o servidor central.],

  [`electron/db/catalogImport.cjs`], [Importação do catálogo de produtos e stock do servidor para a base de dados local. Executado no arranque quando há ligação e periodicamente. Usa `INSERT OR REPLACE` para atualizar produtos existentes.],

  [`electron/ipc/dbHandlers.cjs`], [Registo de todos os handlers IPC do processo principal: `db:ping`, `db:getProducts`, `db:createSale`, `db:openShift`, `db:closeShift`, `db:getShift`, `db:syncStatus`.],

  [`electron/preload.cjs`], [Exposição da API de base de dados ao renderer de forma segura via `contextBridge`: `window.flashstore.db`.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    O ficheiro dbHandlers.cjs do Electron FlashStore regista mais de 10 handlers ipcMain.handle para operações diferentes (produtos, vendas, turnos, sync). Todos os handlers estão no mesmo ficheiro e partilham a instância da base de dados via getDb(). Identifica os problemas e sugere como organizar melhor.
  ],
  analise: [
    O ChatGPT identificou que o ficheiro de handlers mistura responsabilidades de domínios distintos (catálogo, vendas, turnos, sincronização) num único ficheiro monolítico. Sugeriu dividir por domínio: `catalogHandlers.cjs`, `saleHandlers.cjs`, `shiftHandlers.cjs`, `syncHandlers.cjs`, cada um exportando uma função `registerHandlers(ipcMain, db)`.

    A equipa avaliou a sugestão e considerou-a válida para um projeto maior, mas decidiu manter o ficheiro único dado o volume de handlers (10 no total) e a natureza fechada do módulo — os handlers raramente mudam de forma independente. A sugestão foi registada como melhoria futura para quando o número de canais IPC crescer.

    #strong[Problema corrigido:] O handler `db:getProducts` não tratava o caso em que a base de dados local ainda não tinha o catálogo importado (primeiro arranque offline). Devolvia um array vazio sem indicação de erro. Foi adicionado um campo `catalogReady: false` na resposta quando a tabela `products` está vazia, para o renderer mostrar uma mensagem adequada.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Electron], [`electron/db/offlineSale.cjs` — registo offline de vendas com idempotência UUID],

  [Electron], [`electron/db/offlineShift.cjs` — abertura e fecho offline de turnos],

  [Electron], [`electron/db/catalogImport.cjs` — importação do catálogo do servidor para SQLite local],

  [Electron], [`electron/ipc/dbHandlers.cjs` — handlers IPC para todas as operações de base de dados],

  [Electron], [`electron/preload.cjs` — exposição da API via `contextBridge`: `window.flashstore.db`],
)


== Camada C - M20 — Sincronização Outbox

=== Desenvolvimento do Módulo

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    Com base no RF14 (envio automático de dados para o núcleo central), RF15 (sincronização com reintento em caso de falha) e ADR-003 (padrão outbox) da secção 3.2.4 do relatório, implementa a atualização de estados do outbox no processo principal (`syncCommit.cjs`) e o envio HTTP no cliente React (`outboxSync.js`). O outbox contém operações pendentes (vendas e turnos criados offline) que devem ser enviadas ao servidor central quando a ligação for restabelecida. Cada operação deve ter um estado (pending, synced, failed) e um contador de tentativas. Após 3 falhas consecutivas, a operação deve ser marcada como failed e não reenviada automaticamente.
  ],
  analise: [
    O modelo produziu a estrutura de leitura do outbox e atualização de estados de forma adequada. A lógica de retry com contador de tentativas foi corretamente implementada com a regra de 3 falhas máximas.

    O problema mais grave que o modelo introduziu foi na função de commit dos resultados de sincronização: a operação de atualização de estados (`markSynced.run()`, `markFailed.run()`) foi colocada dentro de `db.transaction(fn)` mas a função retornada pela transação não foi invocada — o modelo escreveu `db.transaction(() => { … });` sem o `()` final de invocação. O resultado é que a transação nunca era executada: as entradas permaneciam em estado `pending` indefinidamente, e o banner de "sincronização pendente" no PDV nunca desaparecia mesmo após uma sincronização bem-sucedida. Este bug foi detetado e corrigido pela equipa durante os testes de integração.

    A sincronização é desencadeada automaticamente quando a ligação ao servidor é restabelecida (detetada por polling do endpoint `/api/health`) e pode ser iniciada manualmente pelo utilizador através do botão no `OfflineBanner`.
  ],
)
#llm-end()

#strong[Funções do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Função*], [*Descrição*],

  [`getPendingOutbox(db, limit)`], [Lê até 50 entradas pendentes ordenadas por data de criação (FIFO).],

  [`commitSyncResults(db, results)`], [Atualiza o estado de cada entrada com base na resposta do servidor: `synced` (marca a venda como sincronizada) ou `failed` (incrementa o contador; após 3 falhas, muda para `failed`). A transação SQLite é corretamente invocada com `db.transaction(fn)()`.],

  [`requeueFailedOutbox(db)`], [Recoloca entradas `failed` em `pending` com contador de tentativas a zero, para reenvio manual pelo utilizador.],
)

=== Code Refactoring / Deteção de Smells

#llm-start()
#llm-block(
  modelo: "Claude",
  iteracao: 1,
  prompt: [
    No syncCommit.cjs do Electron FlashStore, a função commitSyncResults usa db.transaction() para atualizar múltiplas entradas do outbox atomicamente. Durante os testes verificou-se que a transação nunca era executada. Analisa o código e identifica o problema.
  ],
  analise: [
    O Claude identificou imediatamente o bug: `db.transaction(fn)` em `better-sqlite3` (e no adaptador `sql.js` da equipa) retorna uma função, não executa a transação. A execução ocorre ao invocar a função retornada: `db.transaction(fn)()`. O modelo tinha gerado `db.transaction(() => { … });` sem a segunda invocação `()`, o que é um erro subtil — o código compila e corre sem erros, mas a função passada nunca é chamada.

    O Claude sugeriu ainda adicionar um teste automatizado que verificasse que `commitSyncResults` altera efetivamente o estado das entradas no outbox, para prevenir a regressão. A equipa adicionou este caso de teste ao suite de testes com Vitest, usando mocks da base de dados local.

    #strong[Problema corrigido:] Linha 67 de `syncCommit.cjs` alterada de `});` para `})();` — a transação passou a ser efetivamente executada, os estados do outbox são atualizados após cada sincronização, e o banner de "sincronização pendente" desaparece corretamente.
  ],
)
#llm-end()

#strong[Ficheiros do módulo]

#table(
  columns: (auto, 1fr),
  inset: 10pt,
  fill: (col, row) => if row == 0 { rgb("#e8f0fe") } else if calc.odd(row) { rgb("#f8f9fa") } else { white },
  stroke: rgb("#cccccc"),

  [*Camada*], [*Ficheiro*],

  [Electron], [`electron/db/syncCommit.cjs` — `getPendingOutbox`, `commitSyncResults`, `requeueFailedOutbox`],

  [Frontend], [`src/lib/outboxSync.js` — envio da fila via `POST /api/sync/push` e `commitSyncResults` via IPC],

  [Electron], [`electron/db/syncCommit.cjs` — leitura/atualização da fila (`getPendingOutbox`, `commitSyncResults`, `requeueFailedOutbox`)],
  
  [Electron], [`electron/ipc/dbHandlers.cjs` — `db:ping`, `db:getPendingOutbox`, `db:commitSyncResults`],
)


= Capítulo 4 - Verificação, Validação e Avaliação da Qualidade do Software Produzido
A quarta e última etapa do ciclo de desenvolvimento do projeto FlashStore teve como foco principal garantir que o sistema implementado cumpre os requisitos especificados, é confiável e está em conformidade com os padrões de qualidade definidos. Este processo foi fortemente auxiliado por Large Language Models (LLM), que atuaram como agentes de suporte na geração de casos de teste, na análise de cobertura e na identificação de inconsistências.

A abordagem adotada seguiu uma pirâmide de testes clássica, composta por testes unitários, de integração e de sistema, complementada por testes de aceitação, com o objetivo de verificar a satisfação da Software Requirements Specification (SRS) e assegurar a robustez do software antes da sua instalação.
== Plano de Testes e Geração Assistida por LLM
O plano de testes foi concebido para cobrir criticamente as áreas de maior risco e os fluxos de negócio mais importantes para a FlashStoresendo eles a operação de ponto de venda (PDV), a gestão de stock e a administração central.

A geração dos casos de teste foi um processo iterativo em que, para cada requisito ou user story, foram utilizados prompts específicos para gerar cenários de teste, incluindo:

    - Testes de Sucesso (Happy Path): Verificar o comportamento esperado do sistema.

    - Testes de Exceção (Edge Cases): Simular condições de erro, como falta de stock, falhas de comunicação ou entradas inválidas.

    - Testes de Segurança: Validar os mecanismos de autenticação e autorização.


    
== Testes Unitários, de Integração e de Aceitação
=== Testes Unitários
==== saft.js
#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Tendo em conta o funcionamento da aplicação descrito ao longo do relatório e a estrutura de testes definida, implemente testes unitários para saft.js, seguindo a estrutura de Vitetest. O módulo saft.js é responsável por gerar o ficheiro XML SAFT-PT mensal no formato exigido pela Autoridade Tributária portuguesa (Portaria n.º 321-A/2007), incluindo o cabeçalho da empresa, os ficheiros mestre (produtos e clientes), os documentos de fonte (faturas e notas de crédito) e o encadeamento de hashes entre documentos consecutivos. Os cenários de teste devem englobar testes de sucesso, testes de exceção, testes de segurança e testes de limite.
  ],
  analise: [
O modelo gerou uma suíte de testes razoavelmente completa, com boa cobertura dos cenários principais. A estrutura dos testes está bem organizada em quatro categorias distintas (escapeXml, generateSaftXml - Sucesso, Exceção, Segurança, Limite), o que facilita a manutenção e a identificação de falhas.
  ],
)
#llm-end()

Os testes implementados para `saft.js` encontram-se organizados nas seguintes categorias:

1. *Testes de Sucesso (Happy Path):*
   - Geração de XML válido com estrutura completa
   - Informação correta do cabeçalho da empresa
   - Faturas dentro do período especificado
   - Múltiplas taxas de IVA (6%, 13%, 23%)
   - Cadeia de hash correta para múltiplas faturas
   - Dados mestre de clientes e produtos
   - Métodos de pagamento (Numerário, MB Way)

2. *Testes de Exceção (Edge Cases):*
   - Período sem vendas
   - Loja sem dados
   - Vendas canceladas (excluídas)
   - Valores zero ou negativos
   - Loja inexistente (valores padrão)
   - Produtos em falta
   - Formatos de data inválidos

3. *Testes de Segurança:*
   - Prevenção de XML injection em vários campos
   - Proteção contra injeção em nomes de empresa
   - Proteção em números de fatura
   - Proteção em dados de cliente
   - Proteção em descrições de produtos
   - Caracteres de controlo e null bytes
   - Integridade do hash com caracteres especiais
   - Não exposição de erros de base de dados

4. *Testes de Limite (Bónus):*
   - Grande volume de vendas (100 registos)
   - Campos de texto muito longos

==== scheduler.js
#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Tendo em conta o funcionamento da aplicação descrito ao longo do relatório e a estrutura de testes definida, implemente testes unitários para scheduler.js, seguindo a estrutura do Vitest. O módulo scheduler.js é responsável por verificar alertas de validade de produtos, alertas de stock baixo e por gerar ficheiros SAF-T mensais automaticamente. Os cenários de teste devem englobar testes de sucesso, testes de exceção, testes de segurança e testes de limite.
  ],
  analise: [
    O modelo gerou uma suite de testes bem estruturada para as três funções principais do módulo: `checkExpiryAlerts`, `checkLowStockAlerts` e `generateSaftForMonth`. Os testes de sucesso cobriam corretamente os casos principais, incluindo a deteção de produtos a expirar nos próximos 7 dias e o cálculo correto dos dias restantes. Contudo, nos testes de exceção, o modelo não contemplou inicialmente o caso de prevenção de alertas duplicados, que é um requisito crítico para evitar notificações redundantes no sistema. Foi necessário reformular o prompt para incluir explicitamente este cenário. Nos testes de limite, a equipa validou manualmente que o teste de desempenho com 100 produtos conclui em menos de 1 segundo, confirmando a adequação da implementação para o volume esperado em produção.
  ],
)
#llm-end()

Os testes implementados para `scheduler.js` encontram-se organizados nas seguintes categorias:

1. *Testes de Sucesso (Happy Path):*
   - Deteção de produtos a expirar nos próximos 7 dias
   - Deteção de múltiplos produtos em risco de expiração simultaneamente
   - Cálculo correto dos dias até à expiração
   - Inclusão de todos os campos obrigatórios no alerta gerado
   - Deteção de stock abaixo do limiar mínimo definido
   - Deteção de múltiplos produtos com stock baixo
   - Consideração apenas de lotes com stock válido (quantidade > 0)
   - Geração de SAF-T para todas as lojas configuradas
   - Não sobreposição de ficheiros SAF-T já existentes

2. *Testes de Exceção (Edge Cases):*
   - Stock vazio — nenhum alerta deve ser gerado
   - Quantidade zero — produto ignorado na deteção de expiração
   - Data de expiração nula — produto ignorado sem causar erro
   - String de expiração vazia — produto ignorado sem causar erro
   - Prevenção de criação de alertas duplicados
   - Produtos já expirados — não geram novo alerta de expiração iminente
   - Limiar mínimo não definido — produto ignorado na deteção de stock baixo
   - Stock negativo — tratado como ausência de stock
   - Sem vendas no período — SAF-T não é gerado
   - Mês inválido — erro tratado sem interromper o processo

3. *Testes de Segurança:*
   - Prevenção de SQL injection nos parâmetros de pesquisa de stock
   - Isolamento entre lojas — alertas de uma loja não afetam outra

4. *Testes de Limite:*
   - Desempenho com 100 produtos — processamento em menos de 1 segundo

==== backup.js
#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Tendo em conta o funcionamento da aplicação descrito ao longo do relatório e a estrutura de testes definida, implemente testes unitários para backup.js, seguindo a estrutura do Vitest. O módulo backup.js é responsável por criar cópias de segurança da base de dados SQLite, listar backups existentes e remover backups antigos quando o limite máximo é atingido. Os cenários de teste devem englobar testes de sucesso, testes de exceção e testes de segurança.
  ],
  analise: [
    O modelo produziu uma cobertura satisfatória das funcionalidades principais de backup. Os testes de sucesso verificavam corretamente a criação do ficheiro, a convenção de nomenclatura e a integridade dos dados copiados. A equipa identificou que os testes de segurança gerados inicialmente eram insuficientes — o modelo não verificava se dados sensíveis poderiam ser expostos nos nomes dos ficheiros de backup, um cenário adicionado manualmente. Nos testes de exceção, o cenário de base de dados vazia foi particularmente relevante, pois garante que o sistema de backup não falha em estado inicial. O teste de pruning de backups antigos validou corretamente que o sistema mantém no máximo 30 cópias, removendo as mais antigas primeiro.
  ],
)
#llm-end()

Os testes implementados para `backup.js` encontram-se organizados nas seguintes categorias:

1. *Testes de Sucesso (Happy Path):*
   - Criação bem-sucedida do ficheiro de backup
   - Convenção de nomenclatura correta (com data e hora)
   - Criação automática do diretório de destino se inexistente
   - Integridade dos dados copiados
   - Listagem de todos os backups existentes com informação de tamanho
   - Agendamento correto do backup diário automático

2. *Testes de Exceção (Edge Cases):*
   - Base de dados vazia — backup criado sem erros
   - Nomes com caracteres especiais — tratados corretamente
   - Datasets de grande dimensão — backup concluído com sucesso
   - Diretório de backups inexistente — criado automaticamente
   - Ausência de backups anteriores — listagem devolve lista vazia

3. *Testes de Segurança:*
   - Armazenamento no diretório correto — sem exposição em caminhos públicos
   - Ausência de dados sensíveis nos nomes dos ficheiros de backup

4. *Testes de Limite:*
   - Pruning automático com mais de 30 backups — os mais antigos são removidos primeiro
   - Manutenção exata do limite máximo de 30 cópias

==== syncPush.js
#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Tendo em conta o funcionamento da aplicação descrito ao longo do relatório e a estrutura de testes definida, implemente testes unitários para syncPush.js, seguindo a estrutura do Vitest. O módulo syncPush.js é responsável por processar operações de sincronização enviadas pelas lojas (vendas offline, aberturas e fechos de turno) para o servidor central. Os cenários de teste devem cobrir testes de sucesso, testes de exceção, testes de segurança e testes de integração com a base de dados central.
  ],
  analise: [
    A geração inicial cobriu bem os fluxos de sincronização de vendas e turnos. No entanto, o modelo não contemplou o caso de operações em batch com limite máximo (50 operações por pedido), que é um requisito não-funcional importante para prevenir sobrecarga do servidor. Este cenário foi adicionado manualmente pela equipa. O teste de idempotência — garantir que vendas com o mesmo identificador não são duplicadas no servidor central — foi o mais crítico e exigiu uma segunda iteração do prompt para ser implementado corretamente. A equipa validou também que o modelo gerou corretamente os testes de isolamento entre lojas, impedindo que uma caixa sincronize vendas para uma loja que não é a sua.
  ],
)
#llm-end()

Os testes implementados para `syncPush.js` encontram-se organizados nas seguintes categorias:

1. *Testes de Sucesso (Happy Path):*
   - Sincronização de venda (`sale.create`) com desconto correto de stock
   - Sincronização de abertura de turno (`shift.open`)
   - Sincronização de fecho de turno (`shift.close`)
   - Processamento de múltiplas operações em batch num único pedido
   - Ignorar operações já sincronizadas (idempotência)

2. *Testes de Exceção (Edge Cases):*
   - Lista de operações vazia — resposta sem erros
   - Campo `store` ausente no payload — erro 400
   - Loja no payload diferente da loja do token — erro 403
   - Stock insuficiente no servidor central — operação marcada como falhada
   - Tipo de operação desconhecido — erro tratado sem interromper o batch
   - JSON inválido no corpo do pedido — erro 400
   - Turno inexistente no fecho — erro tratado corretamente

3. *Testes de Segurança:*
   - Caixa não pode sincronizar vendas para outra loja
   - Admin pode sincronizar para qualquer loja
   - Prevenção de SQL injection nos dados sincronizados
   - Limite de 50 operações por pedido — operações acima do limite são rejeitadas

4. *Testes de Integração:*
   - Ciclo completo: abertura de turno, venda com stock, fecho de turno — tudo sincronizado com consistência

=== Testes de Integração
#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Tendo em conta o funcionamento da aplicação descrito ao longo do relatório, implemente testes de integração para a API REST da FlashStore, seguindo a estrutura do Vitest com Supertest. Os testes devem cobrir os principais endpoints da API (autenticação, produtos, stock, turnos, vendas, alertas, RGPD) e incluir testes de segurança como SQL injection, tokens inválidos e verificação de permissões por perfil. Usa uma base de dados SQLite em memória isolada por suite de testes.
  ],
  analise: [
    O modelo gerou uma suite de testes de integração abrangente para os principais endpoints da API. A utilização de uma base de dados SQLite em memória isolada foi uma sugestão da equipa, não contemplada na primeira resposta do modelo, que propunha mocks — abordagem rejeitada por não validar o comportamento real da base de dados. Os testes de segurança incluídos pelo modelo foram satisfatórios na cobertura de SQL injection e tokens inválidos, mas não contemplavam inicialmente testes de concorrência. A equipa adicionou testes de pedidos simultâneos para validar que as transações SQLite não causam condições de corrida. O conjunto final cobre 32 cenários distribuídos pelos módulos de autenticação, produtos, stock, turnos, vendas, alertas, sugestões de reposição e RGPD.
  ],
)
#llm-block(
  modelo: "ChatGPT",
  iteracao: 2,
  prompt: [
    Expande os testes de integração com cenários avançados para: categorias de produtos, fornecedores (incluindo validação de NIF duplicado), promoções com controlo de permissões, alertas de stock com resolução, logs de auditoria, devoluções de vendas, dashboard com KPIs, e testes de resiliência com payloads malformados e pedidos concorrentes.
  ],
  analise: [
    A segunda iteração produziu os testes avançados de integração, cobrindo 42 cenários adicionais. A equipa identificou que o teste de rate limiting gerado era demasiado simplista, verificando apenas que múltiplos pedidos não causavam erros sem validar limites reais. Este teste foi mantido como teste de resiliência básica. A suite completa de testes de integração resultou em 74 testes (32 + 42), todos a passar de forma consistente.
  ],
)
#llm-end()

Os testes de integração cobrem dois níveis de complexidade, documentados em dois ficheiros distintos:

*`api.test.js` — Integração base (32 testes):*

1. *Autenticação e Autorização:*
   - Login com credenciais válidas devolve token JWT
   - Login com password incorreta devolve 401
   - Pedido sem token a endpoint protegido devolve 401
   - Perfil do utilizador autenticado
   - Token expirado e token malformado devolvem 401

2. *Produtos e Stock:*
   - Listagem de produtos ativos
   - Pesquisa por nome e por código de barras
   - Código de barras inexistente devolve lista vazia
   - Listagem de stock por loja

3. *Turnos e Vendas:*
   - Caixa abre turno com sucesso
   - Segundo turno no mesmo terminal é rejeitado
   - Gerente não pode abrir turno
   - Venda com desconto correto de stock
   - Venda rejeitada por stock insuficiente e por campos em falta

4. *Alertas, RGPD e Segurança:*
   - Listagem e contagens de alertas por loja e tipo
   - Sugestões de reposição com e sem parâmetro store
   - Anonimização de NIFs por admin; rejeição para outros perfis
   - SQL injection, JSON malformado, métodos não suportados, pedidos concorrentes

*`integration-advanced.test.js` — Integração avançada (42 testes):*

1. *Categorias de Produtos:* listagem, criação, duplicados, restrições de perfil, propagação de mudanças
2. *Fornecedores:* listagem, criação, validação de NIF duplicado, campos obrigatórios
3. *Promoções:* criação por parte do administrador, restrições de perfil, listagem
4. *Alertas:* alertas não resolvidos, filtro por tipo, resolução, alerta inexistente
5. *Auditoria:* listagem, filtro por ação e severidade, controlo de acesso
6. *Devoluções:* processamento por gerente, restrição de caixa, venda inexistente e cancelada
7. *Dashboard:* KPIs da loja, stock baixo visível
8. *Reposição:* sugestões para stock baixo, erro sem parâmetro store
9. *RGPD:* anonimização por admin, restrição a não-admin
10. *Resiliência:* pedidos simultâneos, payload vazio, JSON inválido, métodos não suportados

=== Testes de Aceitação
#llm-start()
#llm-block(
  modelo: "Claude Sonnet 4.5",
  iteracao: 1,
  prompt: [
    Com base nas funcionalidades implementadas na aplicação FlashStore, desenvolve testes de aceitação usando Vitest e Supertest. Os testes devem validar fluxos completos de utilização por perfil: (1) caixa — login, abertura de turno, consulta de catálogo, pesquisa por código de barras, registo de venda com desconto de stock, rejeição por stock insuficiente, fecho de turno; (2) gerente — consulta de stock, histórico de vendas, consulta de encomendas, KPIs do dashboard; (3) administrador — listagem de utilizadores,  criação de promoção, consulta de auditoria, anonimização RGPD; (4) controlo de acesso — isolamento completo de permissões entre os três perfis. Usa uma base de dados SQLite em memória isolada.
  ],
  analise: [
    O modelo gerou os testes de aceitação para os quatro grupos principais com boa cobertura dos fluxos de negócio. A implementação de uma app Express de teste dentro do próprio ficheiro de testes — reutilizando a lógica dos endpoints reais mas com BD em memória — foi uma abordagem proposta pela equipa para garantir que os testes validam comportamento real sem depender de um servidor em execução. A equipa identificou que o modelo não gerava o middleware `requireRole` de forma consistente com o comportamento real, pelo que foi necessário rever e alinhar as respostas de erro (403) com a implementação do servidor.
  ],
)
#llm-block(
  modelo: "Claude Sonnet 4.5",
  iteracao: 2,
  prompt: [
    Expande os testes de aceitação com os seguintes grupos adicionais: (1) AC-06 — alertas de stock baixo com consulta, filtro por tipo, resolução e verificação de ausência após resolução, sugestões de reposição e controlo de acesso; (2) AC-07 — devoluções de vendas com reposição de stock, rejeição de venda cancelada, restrição de perfil e venda inexistente; (3) AC-08 — fecho de dia com cálculo de total, prevenção de fecho duplicado e restrição de perfil; (4) AC-09 — gestão de fornecedores com criação, validação de NIF duplicado, campos obrigatórios, listagem e restrição de perfil.
  ],
  analise: [
    A segunda iteração completou a suite de testes de aceitação com 19 cenários adicionais, totalizando 43 testes. A equipa verificou que todos os cenários passam de forma consistente e documentou a correspondência com os requisitos no ficheiro `acceptance-scenarios.md`, distinguindo os cenários alinhados com o SRS dos derivados da implementação real. Este documento serviu de base para a análise de cobertura funcional apresentada na secção de métricas de qualidade.
  ],
)
#llm-end()

Os testes de aceitação foram organizados em nove grupos, cada um correspondendo a um perfil de utilizador ou área funcional do sistema:

- *AC-01 — Autenticação (4 testes):* login válido, password incorreta, acesso sem token, consulta de perfil
- *AC-02 — Fluxo do caixa (7 testes):* abertura de turno, bloqueio de turno duplicado, catálogo, pesquisa por código de barras, venda com desconto de stock, rejeição por stock insuficiente, fecho de turno
- *AC-03 — Fluxo do gerente (4 testes):* stock, histórico de vendas, encomendas, KPIs do dashboard
- *AC-04 — Fluxo do administrador (4 testes):* listagem de utilizadores, criação de promoção, logs de auditoria, anonimização RGPD
- *AC-05 — Controlo de acesso (5 testes):* isolamento completo de permissões entre caixa, gerente e administrador
- *AC-06 — Alertas e reposição (7 testes):* consulta, filtro por tipo, resolução, ausência pós-resolução, sugestões, validação de parâmetros, restrição de perfil
- *AC-07 — Devoluções (4 testes):* processamento com reposição de stock, rejeição de venda cancelada, restrição de perfil, venda inexistente
- *AC-08 — Fecho de dia (3 testes):* criação com total calculado, prevenção de duplicado, restrição de perfil
- *AC-09 — Fornecedores (5 testes):* criação, NIF duplicado, campos obrigatórios, listagem, restrição de perfil

== Análise de Cobertura e Métricas de Qualidade (ISO/IEC 25010)

A avaliação da qualidade do software produzido foi realizada segundo duas dimensões complementares: a cobertura de código obtida pela suite de testes automatizados e a análise de atributos de qualidade definidos pela norma ISO/IEC 25010.

=== Cobertura de Código

A cobertura de código foi medida com recurso ao `@vitest/coverage-v8`, executado sobre a totalidade dos ficheiros do servidor (`backup.js`, `saft.js`, `scheduler.js`, `syncPush.js`). Os resultados obtidos foram os seguintes:

#figure(
  caption: "Resultados de cobertura de código por ficheiro",
  kind: table,
  table(
    columns: (2.5fr, 1.5fr, 1.5fr, 1.5fr, 1.5fr),
    align: center + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Ficheiro*], [*Statements*], [*Branches*], [*Funções*], [*Linhas*],
    [`backup.js`],    [84.44%], [87.50%], [87.50%], [84.09%],
    [`saft.js`],      [82.35%], [69.76%], [81.25%], [81.57%],
    [`scheduler.js`], [59.25%], [30.00%], [50.00%], [63.88%],
    [`syncPush.js`],  [86.61%], [76.56%], [100.0%], [87.40%],
    [*Total*],        [*80.15%*], [*70.66%*], [*75%*], [*81.53%*],
  )
)

Os valores de cobertura refletem a natureza distinta de cada módulo. O `syncPush.js` apresenta a cobertura mais elevada (100% de funções), dado que a sua lógica é inteiramente exercitada pelos testes de sincronização. O `scheduler.js` apresenta os valores mais baixos, uma vez que parte da sua lógica depende de condições temporais (execução agendada) que são difíceis de simular em ambiente de teste isolado. A cobertura de branches do `saft.js` é limitada pelas muitas condições de formatação XML que só ocorrem com dados de produção específicos.

=== Métricas de Qualidade ISO/IEC 25010

A norma ISO/IEC 25010 define um modelo de qualidade de produto de software organizado em oito características principais. A análise seguinte avalia o sistema FlashStore segundo as características mais relevantes para o contexto do projeto.

#figure(
  caption: "Avaliação de qualidade segundo ISO/IEC 25010",
  kind: table,
  table(
    columns: (1.8fr, 3fr, 1.2fr),
    align: left + horizon,
    stroke: (dash: "densely-dotted", thickness: 0.75pt),
    fill: (x, y) => if y == 0 { gray.lighten(50%) },
    [*Característica*], [*Evidência*], [*Avaliação*],
    [*Adequação Funcional*],
      [43 cenários de aceitação validam os principais requisitos funcionais. 40 dos 43 cenários correspondem diretamente a requisitos do SRS.],
      [Alta],
    [*Fiabilidade*],
      [Testes de concorrência validam ausência de condições de corrida. 216 testes passam de forma consistente em múltiplas execuções. O módulo de sincronização garante idempotência das operações.],
      [Alta],
    [*Segurança*],
      [Testes de SQL injection em todos os endpoints de entrada. Isolamento de permissões validado entre os três perfis. Tokens JWT com expiração verificada. Prevenção de XML injection no módulo SAF-T.],
      [Alta],
    [*Manutenibilidade*],
      [Suite de testes organizada em 7 ficheiros por domínio funcional. Cobertura de 80.15% de statements facilita a deteção de regressões. Base de dados em memória nos testes garante isolamento e reprodutibilidade.],
      [Média-Alta],
    [*Compatibilidade*],
      [API REST com contrato JSON bem definido. Suporte a modo offline com sincronização posterior. Electron garante compatibilidade multiplataforma (Windows, Linux, macOS).],
      [Alta],
    [*Usabilidade*],
      [Interface adaptada a três perfis distintos com navegação por role. Terminal de caixa otimizado para uso com leitor de código de barras. Mensagens de erro descritivas validadas nos testes de exceção.],
      [Média-Alta],
  )
)

A característica com avaliação mais limitada é a *Manutenibilidade*, em particular no que respeita à cobertura de branches do `scheduler.js` (30%), condicionada pela dificuldade de simular condições temporais em ambiente de teste automatizado. Em contrapartida, a *Segurança* e a *Fiabilidade* apresentam evidências sólidas, suportadas pelos testes de integração avançados que incluem cenários de injeção, concorrência e validação de permissões entre perfis.



= Conclusões e Trabalho Futuro

O desenvolvimento do sistema *FlashStore* permitiu aplicar, de forma integrada, os principais conceitos de Engenharia de Software abordados na unidade curricular de Laboratórios de Informática IV, desde a definição do domínio e elicitação de requisitos até à implementação, validação e avaliação de qualidade do software produzido.

O projeto teve como principal objetivo a criação de uma plataforma de gestão integrada para uma cadeia de lojas de conveniência, suportando operações de ponto de venda, gestão de stock, sincronização distribuída, auditoria, relatórios e conformidade legal. Ao longo do desenvolvimento foi possível conceber uma solução modular e escalável, baseada numa arquitetura cliente-servidor, composta por uma API central em Node.js/Express, uma interface web em React e um terminal local em Electron com suporte a funcionamento offline.

Um dos aspetos diferenciadores do projeto foi a integração sistemática de *Large Language Models* (LLMs) em diferentes fases do ciclo de vida do software. Os modelos foram utilizados como ferramenta de apoio na elicitação e refinamento de requisitos, geração de user stories, definição de arquitetura, apoio à implementação modular, deteção de *code smells*, geração de testes e análise de qualidade. A experiência demonstrou que a utilização criteriosa de LLMs pode aumentar significativamente a produtividade da equipa, acelerar tarefas repetitivas e apoiar a tomada de decisão técnica. Contudo, também evidenciou a necessidade de validação humana contínua, sobretudo em aspetos relacionados com coerência arquitetural, segurança, consistência funcional e conformidade legal.

Relativamente aos requisitos inicialmente definidos, considera-se que os principais objetivos do sistema foram atingidos. O protótipo desenvolvido suporta operações essenciais de gestão de loja, incluindo autenticação, vendas, gestão de produtos, controlo de stock, fornecedores, promoções, turnos de caixa, relatórios e sincronização centralizada. O sistema apresenta ainda mecanismos de auditoria, backups e geração de ficheiros SAFT-PT, contribuindo para a robustez e conformidade da solução.

Do ponto de vista arquitetural, a adoção de uma estratégia híbrida com suporte offline revelou-se adequada ao contexto do problema, permitindo garantir continuidade operacional nas lojas mesmo perante falhas de conectividade. A utilização de sincronização baseada em *outbox* e persistência local permitiu desacoplar as operações críticas do estado da ligação à rede, aumentando a resiliência do sistema.

A fase de verificação e validação permitiu confirmar a estabilidade geral da aplicação e identificar oportunidades de melhoria. A realização de testes unitários, de integração e de aceitação, aliada à análise segundo a norma ISO/IEC 25010, demonstrou níveis satisfatórios de qualidade nas dimensões de funcionalidade, fiabilidade, manutenibilidade e usabilidade. Ainda assim, algumas áreas permanecem suscetíveis a evolução, particularmente no que diz respeito à otimização de desempenho em cenários de elevada concorrência e à expansão da cobertura automática de testes.

Apesar dos resultados positivos, o projeto apresenta limitações inerentes ao seu contexto académico e ao tempo disponível para desenvolvimento. Algumas funcionalidades foram implementadas ao nível de protótipo funcional, não tendo sido efetuada validação em ambiente real de produção. Adicionalmente, determinadas integrações externas e mecanismos avançados de monitorização e escalabilidade não foram aprofundados.

Como trabalho futuro, identificam-se várias possibilidades de evolução do sistema. Uma das extensões mais relevantes seria a implementação de sincronização em tempo real entre lojas e servidor central, recorrendo a tecnologias como WebSockets ou arquiteturas orientadas a eventos. Esta melhoria permitiria reduzir atrasos de propagação de dados e melhorar a monitorização operacional da cadeia de lojas.

Outra evolução importante seria a introdução de mecanismos avançados de análise de dados e apoio à decisão, incluindo previsão de vendas, deteção de padrões de consumo e sugestões inteligentes de reposição de stock com recurso a técnicas de *Machine Learning*. Estas funcionalidades poderiam aumentar significativamente a eficiência operacional e reduzir desperdícios.

Ao nível da segurança, seria relevante reforçar mecanismos de autenticação multifator, encriptação avançada de dados sensíveis e sistemas de deteção de atividades suspeitas. Também seria pertinente aprofundar aspetos relacionados com conformidade RGPD, retenção de dados e rastreabilidade de operações.

No contexto de usabilidade e mobilidade, o sistema poderia evoluir para suportar aplicações móveis para gerentes e administradores, permitindo acompanhamento remoto das operações das lojas, gestão de alertas e consulta de métricas em tempo real.

Por fim, considera-se igualmente relevante explorar de forma mais aprofundada o papel dos LLMs no processo de engenharia de software. Futuramente, seria interessante avaliar métricas quantitativas sobre produtividade, qualidade de código e impacto no processo de desenvolvimento, bem como estudar estratégias híbridas de colaboração entre programadores humanos e sistemas de inteligência artificial generativa.

Em síntese, o projeto *FlashStore* constituiu uma experiência abrangente de análise, conceção, implementação e validação de um sistema de informação distribuído, permitindo consolidar competências técnicas, arquiteturais e metodológicas. O trabalho desenvolvido demonstra o potencial da integração de ferramentas de Inteligência Artificial no desenvolvimento de software moderno, ao mesmo tempo que reforça a importância do pensamento crítico, validação humana e boas práticas de engenharia de software.


#heading(numbering: none)[Referências Bibliográficas]
<< DICA: Deve ser adotado o método de representação APA (https://guias.usdb.uminho.pt/APA) para apresentar as referências bibliográficas utilizadas. >>


#heading(numbering: none)[Lista de Siglas e Acrónimos]
/ BD: Base de Dados
/ DW: Data Warehouse
/ IAG: Inteligência Artificial Generativa
/ LLM: Large Language Model
/ PDV: Ponto de Venda
/ RGPD: Regulamento Geral sobre a Proteção de Dados
/ SAFT-PT: Standard Audit File for Tax - Portugal
/ SRS: Software Requirements Specification


#pagebreak()





#set heading(numbering: none)
#heading(numbering: none)[Anexos]

Nesta secção encontram-se os registos detalhados de toda a documentação de suporte à elicitação de requisitos.

== Anexo A - Análise de Documentos 1 (Folha de Fecho e Inventário)
#include "reuniões/analiseDoc1.typ"

#pagebreak()
== Anexo B - Análise de Documentos 2 (Nota de Encomenda e Conformidade)
#include "reuniões/analiseDoc2.typ"

#pagebreak()
== Anexo C - Ata da Reunião 1 (Operação de Loja e PDV)
#include "reuniões/reuniao1.typ"

#pagebreak()
== Anexo D - Ata da Reunião 2 (Gestão de Inventário e Logística)
#include "reuniões/reuniao2.typ"

#pagebreak()
== Anexo E - Ata da Reunião 3 (Administração Central e Fiscalidade)
#include "reuniões/reuniao3.typ"

#pagebreak()
== Anexo F - Entrevista 1 (Gerente Central)
#include "reuniões/entrevista1.typ"

#pagebreak()
== Anexo G - Entrevista 2 (Gestora de Loja)
#include "reuniões/entrevista2.typ"

#pagebreak()
== Anexo H - Entrevista 3 (Operador de Caixa)
#include "reuniões/entrevista3.typ"



// attachment(caption: "Logo da Universidade do Minho", image("images/uminho.png"))