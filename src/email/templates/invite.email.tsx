import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';

export interface InviteEmailProps {
  recipientName: string;
  companyName: string;
  inviterName?: string;
  email: string;
  setPasswordUrl: string;
  loginUrl: string;
}

export function InviteEmail({
  recipientName,
  companyName,
  inviterName,
  email,
  setPasswordUrl,
  loginUrl,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Te invitaron a {companyName} en TerminalOps</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Invitación a TerminalOps</Heading>
          <Text style={text}>Hola {recipientName},</Text>
          <Text style={text}>
            {inviterName
              ? `${inviterName} te invitó`
              : 'Te invitaron'}{' '}
            a la empresa <strong>{companyName}</strong>.
          </Text>
          <Text style={text}>
            Tu correo de acceso es <strong>{email}</strong>. Establece tu
            contraseña para entrar:
          </Text>
          <Button style={button} href={setPasswordUrl}>
            Establecer contraseña
          </Button>
          <Text style={text}>
            Si ya tienes contraseña, puedes{' '}
            <a href={loginUrl} style={link}>
              iniciar sesión
            </a>
            .
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            El enlace de contraseña caduca en 24 horas. TerminalOps · AXOLOTL
            TECHNOLOGY
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f4f6f8', fontFamily: 'sans-serif' };
const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '24px',
  borderRadius: '8px',
  maxWidth: '560px',
};
const heading = { fontSize: '22px', color: '#111827' };
const text = { fontSize: '15px', color: '#374151', lineHeight: '24px' };
const button = {
  backgroundColor: '#111827',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 18px',
  textDecoration: 'none',
};
const link = { color: '#111827', textDecoration: 'underline' };
const hr = { borderColor: '#e5e7eb', margin: '24px 0' };
const footer = { fontSize: '12px', color: '#9ca3af' };

export default () => (
  <InviteEmail
    recipientName="Carlos Ruiz"
    companyName="Transportes Demo"
    inviterName="Ana López"
    email="carlos@empresa.com"
    setPasswordUrl="https://app.terminalops.example/reset-password?token=demo"
    loginUrl="https://app.terminalops.example/login"
  />
);
