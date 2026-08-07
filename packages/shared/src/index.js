export const appName = 'Viver & Saúde';
export const plans = [
    {
        id: 'nivel1',
        label: 'Cadastro único - Nível 1',
        priceInCents: 2990,
        billingInterval: 'one_time',
        description: 'Ativa a jornada inicial do usuário e libera a primeira camada do ecossistema.',
        benefits: [
            'Desbloqueio inicial do MeuGuardião por 24 horas',
            '30 minutos com consultor gratuito uma única vez',
            'Acesso ao onboarding pago obrigatório',
        ],
        whatsappEnabled: false,
        telegramEnabled: false,
        aiAccess: 'limited',
    },
    {
        id: 'nivel2',
        label: 'Assinatura mensal - Nível 2',
        priceInCents: 1807,
        billingInterval: 'monthly',
        description: 'Assinatura recorrente para uso contínuo dos recursos de rotina.',
        benefits: [
            'MeuGuardião com liberação total',
            '70 receitas naturais e e-book',
            'Bate-papo gratuito toda segunda-feira',
            'Botão de WhatsApp para consultoria gratuita',
        ],
        whatsappEnabled: true,
        telegramEnabled: false,
        aiAccess: 'full',
    },
    {
        id: 'nivel3',
        label: 'Experiência premium - Nível 3',
        priceInCents: 7990,
        billingInterval: 'monthly',
        description: 'Plano premium com consultoria e grupos exclusivos.',
        benefits: [
            'Treinamento gratuito de até 30 minutos',
            'Todos os benefícios dos níveis 1 e 2',
            'Grupos exclusivos no WhatsApp e Telegram',
            'Atendimento por videoconferência sob agendamento',
            'Acesso à fábrica com descontos e indicações da plataforma',
        ],
        whatsappEnabled: true,
        telegramEnabled: true,
        aiAccess: 'full',
    },
];
export const bottomNavItems = [
    { id: 'inicio', label: 'Início', icon: 'bi-house-heart' },
    { id: 'meuguardiao', label: 'MeuGuardião', icon: 'bi-chat-heart' },
    { id: 'receitas', label: 'Receitas', icon: 'bi-journal-medical' },
    { id: 'comunidade', label: 'Comunidade', icon: 'bi-people' },
    { id: 'conta', label: 'Conta', icon: 'bi-person-circle' },
];
export const sampleCommunityLinks = [
    {
        id: 'grupo-whatsapp-boasvindas',
        title: 'Grupo oficial de boas-vindas',
        platform: 'whatsapp',
        audience: ['nivel2', 'nivel3'],
        href: 'https://wa.me/5500000000000',
    },
    {
        id: 'grupo-telegram-premium',
        title: 'Canal premium de protocolos',
        platform: 'telegram',
        audience: ['nivel3'],
        href: 'https://t.me/viveresaude-premium',
    },
];
export const sampleRecipes = [
    {
        id: 'ebook-natural',
        title: 'E-book de receitas naturais',
        category: 'Material rico',
        summary: 'Coletânea inicial para alimentação funcional com foco em rotina saudável.',
        premiumPlan: 'nivel2',
        assetType: 'ebook',
    },
    {
        id: 'protocolo-imunidade',
        title: 'Protocolo de imunidade',
        category: 'Orientação',
        summary: 'Sugestões de produtos e hábitos para fortalecimento diário.',
        premiumPlan: 'nivel2',
        assetType: 'protocol',
    },
    {
        id: 'receita-calmante',
        title: 'Chá calmante funcional',
        category: 'Receita',
        summary: 'Receita simples voltada ao relaxamento e qualidade do sono.',
        premiumPlan: 'nivel1',
        assetType: 'recipe',
    },
];
export const sampleHealthProfile = {
    age: 39,
    weightKg: 71,
    heightCm: 168,
    bloodType: 'O+',
    goals: ['Reduzir inflamação', 'Melhorar energia', 'Organizar rotina alimentar'],
    familyHistory: [
        { relation: 'Mãe', notes: 'Histórico de hipertensão.' },
        { relation: 'Avô', notes: 'Diabetes tipo 2.' },
    ],
};
export function formatCurrencyBRL(amountInCents) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(amountInCents / 100);
}
export function getPlan(planId) {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) {
        throw new Error(`Plano inválido: ${planId}`);
    }
    return plan;
}
export function canAccessSection(planId, section) {
    if (!planId) {
        return section === 'inicio';
    }
    if (section === 'meuguardiao') {
        return planId !== null;
    }
    if (section === 'comunidade') {
        return planId === 'nivel2' || planId === 'nivel3';
    }
    return true;
}
export function resolveOnboardingDecision(status) {
    if (!status.paymentConfirmed) {
        return {
            canLogin: false,
            nextStep: 'checkout',
            message: 'Finalize o pagamento inicial para liberar o acesso ao aplicativo.',
        };
    }
    if (status.planId === 'nivel1') {
        return {
            canLogin: true,
            nextStep: 'app',
            message: 'Seu acesso inicial foi liberado com sucesso.',
        };
    }
    if (status.subscriptionActive || status.trialEndsAt) {
        return {
            canLogin: true,
            nextStep: 'app',
            message: 'Seu plano recorrente está ativo.',
        };
    }
    return {
        canLogin: true,
        nextStep: 'support',
        message: 'Seu cadastro existe, mas há pendências de assinatura para revisar.',
    };
}
