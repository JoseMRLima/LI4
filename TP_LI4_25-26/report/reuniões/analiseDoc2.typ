#import "../template.typ": *

#llm-start()
#llm-block(
  modelo: "ChatGPT",
  iteracao: 1,
  prompt: [
    Gera uma segunda Análise de Documentos, desta vez focada numa 'Nota de Encomenda a Fornecedor' e nos registos físicos de 'Quebras por Validade Expirada'. Identifica o esforço manual diário exigido à gerência e propõe a digitalização do fluxo de abastecimento e monitorização de perecíveis.
  ],
  analise: [
    Este conteúdo provou que a nossa abordagem não se focou apenas nas vendas, mas também nos prejuízos escondidos (ruturas e validades). O uso do LLM para descrever estes documentos antigos reforçou a necessidade de automatizar a entrada de mercadorias no módulo administrativo da FlashStore.
  ],
)
#llm-end()

Análise de Documentos 2 — Nota de Encomenda e Conformidade Legal
 
Documentos Analisados:
- Nota de Encomenda a Fornecedor (formulário físico / e-mail informal)
- Documentação Legal: Portaria SAF-T PT; RGPD (UE) 2016/679; Decreto-Lei 28/2019
 
Data de Análise: 13–14 de Fevereiro de 2026
Analistas: Rui Castro, José Lima
 
---
 
Nota de Encomenda a Fornecedor
 
Descrição do Documento:
A Nota de Encomenda é o documento utilizado para solicitar mercadorias a fornecedores. É emitida pela gestora de loja (encomendas locais) ou pelo gerente central (encomendas nacionais). O documento inclui: identificação da loja e data da encomenda; identificação do fornecedor; lista de produtos com código (nem sempre EAN), designação, quantidade solicitada e preço unitário esperado; data de entrega pretendida; assinatura do responsável; campo de observações. Não existe sistema centralizado de encomendas. As encomendas locais são feitas por telefone ou e-mail informal, sem registo estruturado.
 
Problemas Identificados:
Não existe ligação entre a nota de encomenda, a receção de mercadoria e a atualização de stock, eliminando qualquer rastreabilidade. Sem histórico centralizado, diferentes lojas podem encomendar o mesmo produto a fornecedores distintos com preços diferentes. As encomendas são feitas sem consulta automática ao stock atual, podendo gerar encomendas desnecessárias. Após enviar a encomenda não existe mecanismo para acompanhar o seu estado. A mesma referência de produto pode aparecer com designações diferentes em encomendas de lojas distintas.
 
Requisitos Derivados:
- O sistema deve permitir criar notas de encomenda digitais, associadas a um fornecedor e a uma loja específica.
- O sistema deve sugerir automaticamente uma lista de reposição com base nos produtos abaixo do stock mínimo.
- O sistema deve manter um estado para cada encomenda: Rascunho, Enviada, Confirmada, Parcialmente Entregue, Entregue, Cancelada.
- Ao registar a receção de uma encomenda, o sistema deve atualizar automaticamente o stock dos produtos recebidos.
- O sistema deve permitir registar discrepâncias entre a quantidade encomendada e a quantidade efetivamente recebida.
- O sistema deve manter um catálogo de fornecedores com os produtos que cada um fornece e os preços históricos.
- O gerente central deve poder visualizar todas as encomendas de todas as lojas numa vista consolidada.
 
---
 
Conformidade Legal — SAF-T PT e RGPD
 
Obrigações SAF-T (PT) — Autoridade Tributária:
O Standard Audit File for Tax (SAF-T) é um formato XML padronizado exigido pela Autoridade Tributária para exportação de dados fiscais. As obrigações aplicáveis ao sistema FlashStore são: certificação do software pela AT antes da entrada em produção; integridade das faturas (não podem ser alteradas nem eliminadas, apenas anuladas com nota de crédito); numeração sequencial e sem lacunas por série de documentos; exportação mensal de ficheiro SAF-T em formato XML normalizado; hash de integridade por documento, encadeado com o documento anterior; comunicação eletrónica de faturas ao portal e-fatura.
 
Obrigações RGPD:
O Regulamento Geral sobre a Proteção de Dados impõe as seguintes obrigações: base legal para todo o tratamento de dados pessoais de funcionários e fornecedores; minimização de dados recolhidos ao estritamente necessário; implementação de controlo de acesso por perfis; registo de auditoria de ações sobre dados sensíveis; medidas técnicas de segurança (cifra em repouso e em trânsito); prazo de conservação configurável com eliminação automática.
 
Requisitos Derivados:
- O sistema deve emitir faturas e recibos com numeração sequencial sem lacunas, por série, por loja.
- O sistema deve calcular e armazenar o hash de integridade de cada documento fiscal, encadeado com o documento anterior.
- O sistema deve gerar o ficheiro SAF-T PT em formato XML normalizado para qualquer período selecionado.
- O sistema não deve permitir a alteração ou eliminação de documentos fiscais emitidos — apenas anulação com nota de crédito.
- O sistema deve implementar controlo de acesso baseado em perfis.
- O sistema deve manter registo de auditoria de todas as ações sobre dados sensíveis.
- O sistema deve ser certificado pela AT antes da entrada em produção.
- Os dados pessoais de funcionários devem ser cifrados em repouso e em trânsito.