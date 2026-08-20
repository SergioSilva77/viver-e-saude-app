import nodemailer from 'nodemailer'
import { config, getSmtpConfig } from './config.js'

export async function sendRegistrationLink(params: {
  to: string
  fullName: string
  sessionId: string
  planId: string
}): Promise<{ sent: boolean; reason?: string }> {
  const smtp = getSmtpConfig()

  if (!smtp) {
    console.warn('[Email] SMTP não configurado — e-mail de cadastro não enviado para', params.to)
    return { sent: false, reason: 'SMTP não configurado' }
  }

  const link = `${config.appUrl}/?checkout=success&plan=${encodeURIComponent(params.planId)}&session_id=${encodeURIComponent(params.sessionId)}`
  const firstName = params.fullName.split(' ')[0]

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2e7d5e,#56a87a);padding:36px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">❤️‍🩹</div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Viver &amp; Saúde</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            <h2 style="color:#1a2e26;font-size:20px;font-weight:700;margin:0 0 12px;">Olá, ${firstName}!</h2>
            <p style="color:#4a6258;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Seu pagamento foi <strong style="color:#2e7d5e;">confirmado com sucesso</strong>. Falta só um passo: crie sua senha para ativar o acesso ao seu plano.
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <a href="${link}" style="display:inline-block;background:#2e7d5e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 36px;border-radius:14px;letter-spacing:-0.01em;">
                    Ativar minha conta
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#7a9e91;font-size:13px;line-height:1.5;margin:0 0 8px;">
              Se o botão não funcionar, copie e cole este link no seu navegador:
            </p>
            <p style="color:#7a9e91;font-size:12px;word-break:break-all;margin:0 0 28px;">
              <a href="${link}" style="color:#2e7d5e;">${link}</a>
            </p>

            <hr style="border:none;border-top:1px solid #e8f2ed;margin:0 0 24px;">

            <p style="color:#b0c9bf;font-size:12px;line-height:1.5;margin:0;">
              Se você não realizou este pagamento, ignore este e-mail. Para dúvidas, entre em contato conosco.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f9f6;padding:20px 32px;text-align:center;">
            <p style="color:#b0c9bf;font-size:12px;margin:0;">© ${new Date().getFullYear()} Viver &amp; Saúde. Todos os direitos reservados.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    await transporter.sendMail({
      from: `"Viver & Saúde" <${smtp.from}>`,
      to: params.to,
      subject: 'Ative sua conta — Viver & Saúde',
      html,
      text: `Olá, ${firstName}!\n\nSeu pagamento foi confirmado. Clique no link abaixo para criar sua senha e ativar sua conta:\n\n${link}\n\nSe você não realizou este pagamento, ignore este e-mail.`,
    })

    console.log('[Email] E-mail de ativação enviado para', params.to)
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Email] Falha ao enviar e-mail para', params.to, '—', msg)
    return { sent: false, reason: msg }
  }
}

export async function sendPasswordResetLink(params: {
  to: string
  fullName: string
  token: string
}): Promise<{ sent: boolean; reason?: string }> {
  const smtp = getSmtpConfig()

  if (!smtp) {
    console.warn('[Email] SMTP não configurado — e-mail de redefinição não enviado para', params.to)
    return { sent: false, reason: 'SMTP não configurado' }
  }

  const webLink = `${config.appUrl}/reset-password?token=${encodeURIComponent(params.token)}`
  const deepLink = `${config.appScheme}://reset?token=${encodeURIComponent(params.token)}`
  const firstName = params.fullName.split(' ')[0]

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2e7d5e,#56a87a);padding:36px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🔑</div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Viver &amp; Saúde</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            <h2 style="color:#1a2e26;font-size:20px;font-weight:700;margin:0 0 12px;">Olá, ${firstName}!</h2>
            <p style="color:#4a6258;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.
            </p>
            <p style="color:#7a9e91;font-size:13px;margin:0 0 24px;">
              Este link é válido por <strong>1 hora</strong>. Se você não solicitou a redefinição, ignore este e-mail — sua senha não será alterada.
            </p>

            <!-- CTA Button (web link — funciona no navegador) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <a href="${webLink}" style="display:inline-block;background:#2e7d5e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 36px;border-radius:14px;letter-spacing:-0.01em;">
                    Redefinir minha senha
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#7a9e91;font-size:13px;line-height:1.5;margin:0 0 8px;">
              Se o botão não funcionar, copie e cole este link no seu navegador:
            </p>
            <p style="color:#7a9e91;font-size:12px;word-break:break-all;margin:0 0 28px;">
              <a href="${webLink}" style="color:#2e7d5e;">${webLink}</a>
            </p>

            <!-- Deep link for mobile app -->
            <hr style="border:none;border-top:1px solid #e8f2ed;margin:0 0 24px;">
            <p style="color:#7a9e91;font-size:13px;line-height:1.5;margin:0 0 8px;">
              Se estiver no celular com o app instalado, abra diretamente no app:
            </p>
            <p style="margin:0 0 28px;">
              <a href="${deepLink}" style="color:#2e7d5e;font-size:13px;font-weight:600;">Abrir no app Viver &amp; Saúde</a>
            </p>

            <hr style="border:none;border-top:1px solid #e8f2ed;margin:0 0 24px;">

            <p style="color:#b0c9bf;font-size:12px;line-height:1.5;margin:0;">
              Por segurança, este link expira em 1 hora e só pode ser usado uma vez.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f9f6;padding:20px 32px;text-align:center;">
            <p style="color:#b0c9bf;font-size:12px;margin:0;">© ${new Date().getFullYear()} Viver &amp; Saúde. Todos os direitos reservados.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    await transporter.sendMail({
      from: `"Viver & Saúde" <${smtp.from}>`,
      to: params.to,
      subject: 'Redefinição de senha — Viver & Saúde',
      html,
      text: `Olá, ${firstName}!\n\nRedefina sua senha no link abaixo (válido por 1 hora):\n\n${webLink}\n\nOu, se tiver o app instalado, abra direto:\n${deepLink}\n\nSe você não solicitou a redefinição, ignore este e-mail.`,
    })

    console.log('[Email] E-mail de redefinição enviado para', params.to)
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Email] Falha ao enviar redefinição para', params.to, '—', msg)
    return { sent: false, reason: msg }
  }
}

// ── E-mails de agendamento (Módulo 5) ──────────────────────

export type AppointmentEmailKind = 'confirmed' | 'reminder' | 'declined' | 'cancelled'

const APPOINTMENT_EMAIL_COPY: Record<AppointmentEmailKind, { icon: string; subject: string; heading: string }> = {
  confirmed: { icon: '✅', subject: 'Consulta confirmada — Viver & Saúde', heading: 'Sua consulta foi confirmada!' },
  reminder: { icon: '⏰', subject: 'Sua consulta é em 30 minutos — Viver & Saúde', heading: 'Sua consulta começa em 30 minutos' },
  declined: { icon: '⚠️', subject: 'Consulta recusada — Viver & Saúde', heading: 'Seu agendamento foi recusado' },
  cancelled: { icon: 'ℹ️', subject: 'Consulta cancelada — Viver & Saúde', heading: 'Seu agendamento foi cancelado' },
}

export async function sendAppointmentEmail(params: {
  to: string
  fullName: string
  kind: AppointmentEmailKind
  peerName: string
  startsAt: Date
}): Promise<{ sent: boolean; reason?: string }> {
  const smtp = getSmtpConfig()
  if (!smtp) {
    console.warn('[Email] SMTP não configurado — e-mail de agendamento não enviado para', params.to)
    return { sent: false, reason: 'SMTP não configurado' }
  }

  const copy = APPOINTMENT_EMAIL_COPY[params.kind]
  const firstName = params.fullName.split(' ')[0]
  const dateLabel = params.startsAt.toLocaleString('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })

  const bodyText: Record<AppointmentEmailKind, string> = {
    confirmed: `Sua consulta com ${params.peerName} foi confirmada para ${dateLabel}.`,
    reminder: `Sua consulta com ${params.peerName} começa em 30 minutos (${dateLabel}). Já deixe o app aberto!`,
    declined: `Infelizmente ${params.peerName} não poderá atendê-lo(a) no horário marcado (${dateLabel}). Agende um novo horário quando puder.`,
    cancelled: `O agendamento com ${params.peerName} para ${dateLabel} foi cancelado.`,
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#2e7d5e,#56a87a);padding:36px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">${copy.icon}</div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Viver &amp; Saúde</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <h2 style="color:#1a2e26;font-size:20px;font-weight:700;margin:0 0 12px;">Olá, ${firstName}!</h2>
            <p style="color:#4a6258;font-size:15px;line-height:1.6;margin:0 0 8px;">${copy.heading}</p>
            <p style="color:#4a6258;font-size:15px;line-height:1.6;margin:0 0 24px;">${bodyText[params.kind]}</p>
            <hr style="border:none;border-top:1px solid #e8f2ed;margin:0 0 24px;">
            <p style="color:#b0c9bf;font-size:12px;line-height:1.5;margin:0;">© ${new Date().getFullYear()} Viver &amp; Saúde. Todos os direitos reservados.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    await transporter.sendMail({
      from: `"Viver & Saúde" <${smtp.from}>`,
      to: params.to,
      subject: copy.subject,
      html,
      text: `Olá, ${firstName}!\n\n${bodyText[params.kind]}`,
    })
    console.log(`[Email] E-mail de agendamento (${params.kind}) enviado para`, params.to)
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Email] Falha ao enviar e-mail de agendamento para', params.to, '—', msg)
    return { sent: false, reason: msg }
  }
}
