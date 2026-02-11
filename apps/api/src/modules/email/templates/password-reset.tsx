import { Heading, Section, Text } from '@react-email/components';
import { EmailLayout, sharedStyles } from './email-layout';

interface PasswordResetEmailProps {
  name: string;
  otp: string;
}

export function PasswordResetEmail({ name, otp }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview={`Your password reset code: ${otp}`}>
      <Heading style={sharedStyles.heading}>Password Reset</Heading>
      <Text style={sharedStyles.subheading}>Use the code below to reset your password</Text>

      <Text style={sharedStyles.text}>Hi {name},</Text>
      <Text style={sharedStyles.text}>
        You requested to reset your password. Use the code below to complete the process:
      </Text>

      <Section style={sharedStyles.codeContainer}>
        <Text style={sharedStyles.code}>{otp}</Text>
      </Section>

      <div style={sharedStyles.highlightBox}>
        <Text style={sharedStyles.highlightText}>
          This code will expire in 15 minutes for security reasons.
        </Text>
      </div>

      <Text style={sharedStyles.text}>
        If you didn&apos;t request this, you can safely ignore this email. Your password will remain
        unchanged.
      </Text>

      <Text style={sharedStyles.signature}>
        Best regards,
        <br />
        The Grabdy Team
      </Text>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  name: 'John Doe',
  otp: '847291',
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
