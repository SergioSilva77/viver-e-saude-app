import type { ReactNode } from 'react'

interface Props {
  onClose: () => void
}

interface Step {
  number: number
  title: string
  content: ReactNode
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Criar sua conta na Stripe',
    content: (
      <>
        <p>
          Acesse{' '}
          <a href="https://stripe.com" target="_blank" rel="noopener noreferrer">
            stripe.com
          </a>{' '}
          e crie uma conta gratuita. Não precisa de cartão de crédito para começar.
        </p>
        <p>
          Assim que entrar no painel, ative o <strong>Modo de testes</strong> — é o botão
          no canto superior direito com o texto "Test mode". Isso garante que nenhum
          pagamento real será cobrado enquanto você configura tudo.
        </p>
        <div className="guide-tip">
          <i className="bi bi-lightbulb-fill" />
          Só mude para produção quando tudo estiver funcionando nos testes.
        </div>
      </>
    ),
  },
  {
    number: 2,
    title: 'Obter a chave secreta da API',
    content: (
      <>
        <p>
          No menu lateral esquerdo, clique em <strong>Developers</strong> e depois em{' '}
          <strong>API keys</strong>.
        </p>
        <p>
          Você vai ver duas chaves. Copie a <strong>Secret key</strong> — ela começa com{' '}
          <code>sk_test_…</code> no modo de testes ou <code>sk_live_…</code> em produção.
        </p>
        <p>
          Cole essa chave no campo <strong>"Chave secreta"</strong> desta tela de
          configurações.
        </p>
        <div className="guide-warning">
          <i className="bi bi-shield-exclamation" />
          Nunca compartilhe essa chave. Ela dá acesso total à sua conta Stripe.
        </div>
      </>
    ),
  },
  {
    number: 3,
    title: 'Criar os 3 produtos no catálogo',
    content: (
      <>
        <p>
          No menu lateral, clique em <strong>Product catalog</strong> e depois em{' '}
          <strong>+ Add product</strong>.
        </p>
        <p>Crie um produto para cada nível do aplicativo:</p>
        <ul className="guide-list">
          <li>
            <strong>Nível 1</strong> — Nome sugerido: "Viver &amp; Saúde — Nível 1"
          </li>
          <li>
            <strong>Nível 2</strong> — Nome sugerido: "Viver &amp; Saúde — Nível 2"
          </li>
          <li>
            <strong>Nível 3</strong> — Nome sugerido: "Viver &amp; Saúde — Nível 3"
          </li>
        </ul>
        <p>
          Em cada produto, defina o preço em <strong>BRL (Real brasileiro)</strong>,
          escolha <strong>Recurring</strong> e o intervalo <strong>Monthly</strong>.
          Clique em <strong>Save product</strong>.
        </p>
      </>
    ),
  },
  {
    number: 4,
    title: 'Copiar os Price IDs de cada produto',
    content: (
      <>
        <p>
          Depois de criar os produtos, entre em cada um deles. Você vai ver a seção de
          preços logo abaixo do nome.
        </p>
        <p>
          Clique no preço criado e copie o <strong>Price ID</strong> — ele tem o formato{' '}
          <code>price_1ABC…</code>.
        </p>
        <p>
          Cole os três IDs nos campos correspondentes desta tela:
        </p>
        <ul className="guide-list">
          <li>Price ID do Nível 1 → campo <strong>"Nível 1"</strong></li>
          <li>Price ID do Nível 2 → campo <strong>"Nível 2"</strong></li>
          <li>Price ID do Nível 3 → campo <strong>"Nível 3"</strong></li>
        </ul>
        <div className="guide-tip">
          <i className="bi bi-lightbulb-fill" />
          O Price ID fica visível na página do produto, logo abaixo do valor. Clique
          nele para copiar.
        </div>
      </>
    ),
  },
  {
    number: 5,
    title: 'Configurar o Webhook',
    content: (
      <>
        <p>
          O webhook é o jeito que a Stripe avisa o aplicativo quando um pagamento é
          aprovado. Sem ele, o usuário paga mas o acesso não é liberado automaticamente.
        </p>
        <p>
          Vá em <strong>Developers → Webhooks → Add endpoint</strong>.
        </p>
        <p>
          No campo de URL, coloque o endereço do servidor do aplicativo seguido de{' '}
          <code>/api/stripe/webhook</code>. Exemplo:
        </p>
        <div className="guide-code-block">
          https://seu-dominio.com/api/stripe/webhook
        </div>
        <p>
          Em <strong>Select events</strong>, busque e marque o evento:{' '}
          <code>checkout.session.completed</code>
        </p>
        <p>
          Após criar o endpoint, a Stripe vai mostrar o <strong>Signing secret</strong>{' '}
          — começa com <code>whsec_…</code>. Copie e cole no campo{' '}
          <strong>"Webhook secret"</strong> desta tela.
        </p>
        <div className="guide-warning">
          <i className="bi bi-shield-exclamation" />
          Durante os testes locais, use o{' '}
          <a
            href="https://stripe.com/docs/stripe-cli"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe CLI
          </a>{' '}
          para encaminhar os eventos para o servidor local.
        </div>
      </>
    ),
  },
  {
    number: 6,
    title: 'Salvar e testar um pagamento',
    content: (
      <>
        <p>
          Clique em <strong>"Salvar configurações"</strong> nesta tela. Agora faça um
          teste completo de compra no aplicativo.
        </p>
        <p>
          Na tela de checkout da Stripe, use os dados abaixo para simular um pagamento
          aprovado sem cobrar nada de verdade:
        </p>
        <div className="guide-test-card">
          <div className="guide-test-card-row">
            <span className="guide-test-label">Número do cartão</span>
            <code className="guide-test-value">4242 4242 4242 4242</code>
          </div>
          <div className="guide-test-card-row">
            <span className="guide-test-label">Validade</span>
            <code className="guide-test-value">Qualquer data futura</code>
          </div>
          <div className="guide-test-card-row">
            <span className="guide-test-label">CVC</span>
            <code className="guide-test-value">Qualquer 3 dígitos</code>
          </div>
        </div>
        <p>
          Se o pagamento for aprovado e o acesso do usuário for liberado no app, tudo
          está funcionando corretamente.
        </p>
        <div className="guide-tip">
          <i className="bi bi-lightbulb-fill" />
          Consulte mais cartões de teste em{' '}
          <a
            href="https://stripe.com/docs/testing"
            target="_blank"
            rel="noopener noreferrer"
          >
            stripe.com/docs/testing
          </a>
          , incluindo cartões que simulam recusa e erros.
        </div>
      </>
    ),
  },
]

export function StripeGuideModal({ onClose }: Props) {
  return (
    <div className="guide-backdrop" onClick={onClose}>
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guide-modal-header">
          <div>
            <h2 className="guide-modal-title">Como configurar a Stripe</h2>
            <p className="guide-modal-sub">
              Siga os passos abaixo. Leva menos de 15 minutos.
            </p>
          </div>
          <button
            type="button"
            className="guide-close-btn"
            onClick={onClose}
            aria-label="Fechar guia"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="guide-modal-body">
          {STEPS.map((step) => (
            <div key={step.number} className="guide-step">
              <div className="guide-step-number">{step.number}</div>
              <div className="guide-step-content">
                <h3 className="guide-step-title">{step.title}</h3>
                <div className="guide-step-body">{step.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
