/**
 * Módulo: conteúdo comercial da landing.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: página inicial e captação do piloto.
 * Finalidade: manter a proposta comercial centralizada e revisável.
 * Motivo: impedir textos divergentes e promessas espalhadas pelos componentes.
 * Evolução: receber conteúdo validado por entrevistas e casos reais.
 */
export const marketingNavigation = [
  { label: "Produto", href: "#produto" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Resultados", href: "#resultados" },
  { label: "Planos", href: "#planos" },
] as const;

export const valuePropositions = [
  {
    icon: "store",
    eyebrow: "Venda",
    title: "Seu canal, sua marca",
    description:
      "Um cardápio rápido e bonito para o cliente comprar sem baixar aplicativo ou criar senha antes do pedido.",
  },
  {
    icon: "orders",
    eyebrow: "Opere",
    title: "Pedido sem conversa perdida",
    description:
      "Cada venda chega com itens, endereço, pagamento e prazo no mesmo fluxo, pronta para a equipe agir.",
  },
  {
    icon: "repeat",
    eyebrow: "Cresça",
    title: "Faça o cliente voltar",
    description:
      "Histórico, cupons e campanhas ajudam a transformar a primeira compra em relacionamento recorrente.",
  },
] as const;

export const implementationSteps = [
  {
    number: "01",
    title: "A gente monta com você",
    description: "Configuramos loja, horários, entrega, pagamento e o primeiro cardápio.",
  },
  {
    number: "02",
    title: "Sua loja ganha um link",
    description: "Divulgue no WhatsApp, Instagram, Google, embalagem e balcão.",
  },
  {
    number: "03",
    title: "Os pedidos chegam organizados",
    description: "Sua equipe confirma, prepara e entrega sem depender de conversa solta.",
  },
  {
    number: "04",
    title: "O cliente volta",
    description: "Você acompanha recompra e ativa sua base com ofertas relevantes.",
  },
] as const;

export const pilotPlans = [
  {
    name: "Direto",
    price: 129,
    description: "Para colocar o canal próprio no ar e operar sem improviso.",
    features: [
      "Cardápio e pedidos ilimitados",
      "Pix e cartão por provedor homologado",
      "Clientes, cupons e WhatsApp operacional",
      "Relatório essencial da loja",
    ],
    featured: false,
  },
  {
    name: "Crescimento",
    price: 249,
    description: "Para transformar a base de clientes em receita recorrente.",
    features: [
      "Tudo do plano Direto",
      "Campanhas e automações",
      "Recuperação de oportunidades",
      "Relatórios de recompra e suporte prioritário",
    ],
    featured: true,
  },
] as const;

export const frequentlyAskedQuestions = [
  {
    question: "Preciso sair do iFood?",
    answer:
      "Não. O Pede Fácil cria seu canal próprio para clientes que já conhecem sua marca. Você pode continuar usando marketplaces como canal de descoberta.",
  },
  {
    question: "Existe comissão por pedido?",
    answer:
      "O Pede Fácil cobra assinatura, não percentual sobre sua venda. Taxas do provedor de pagamento continuam existindo e são informadas separadamente.",
  },
  {
    question: "Quem recebe o pagamento?",
    answer:
      "O pagamento é processado por um parceiro homologado e destinado à conta vinculada do estabelecimento. O Pede Fácil não faz repasse manual do dinheiro da loja.",
  },
  {
    question: "O cliente precisa baixar aplicativo?",
    answer:
      "Não. O cardápio abre no navegador do celular e a compra pode ser feita como convidado.",
  },
  {
    question: "Preciso ter entregador proprio?",
    answer:
      "Não para retirada. Para entrega, o MVP trabalha com entregadores da loja ou parceiros convidados por ela.",
  },
  {
    question: "Vocês montam o cardápio?",
    answer:
      "No piloto, fazemos a implantação inicial junto com a loja para reduzir o tempo até o primeiro pedido.",
  },
] as const;
