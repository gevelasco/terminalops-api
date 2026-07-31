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

export interface PasswordResetEmailProps {
  recipientName: string;
  resetUrl: string;
}

export function PasswordResetEmail({
  recipientName,
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Restablece tu contraseña de TerminalOps</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Restablecer contraseña</Heading>
          <Text style={text}>Hola {recipientName},</Text>
          <Text style={text}>
            Recibimos una solicitud para restablecer tu contraseña. Usa el
            botón siguiente (válido por 1 hora):
          </Text>
          <Button style={button} href={resetUrl}>
            Crear nueva contraseña
          </Button>
          <Text style={text}>
            Si no solicitaste este cambio, ignora este correo. Tu contraseña
            actual seguirá funcionando.
          </Text>
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
  <PasswordResetEmail
    recipientName="Ana López"
    resetUrl="https://app.terminalops.example/reset-password?token=demo"
  />
);
