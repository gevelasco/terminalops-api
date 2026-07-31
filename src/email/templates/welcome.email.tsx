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

export interface WelcomeEmailProps {
  recipientName: string;
  companyName: string;
  loginUrl: string;
}

export function WelcomeEmail({
  recipientName,
  companyName,
  loginUrl,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Tu cuenta en TerminalOps está lista</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Bienvenido a TerminalOps</Heading>
          <Text style={text}>Hola {recipientName},</Text>
          <Text style={text}>
            Tu empresa <strong>{companyName}</strong> ya está registrada. Ya
            puedes iniciar sesión y configurar tu operación.
          </Text>
          <Button style={button} href={loginUrl}>
            Ir a TerminalOps
          </Button>
          <Hr style={hr} />
          <Text style={footer}>TerminalOps · AXOLOTL TECHNOLOGY</Text>
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
const hr = { borderColor: '#e5e7eb', margin: '24px 0' };
const footer = { fontSize: '12px', color: '#9ca3af' };

export default () => (
  <WelcomeEmail
    recipientName="Ana López"
    companyName="Transportes Demo"
    loginUrl="https://app.terminalops.example/login"
  />
);
