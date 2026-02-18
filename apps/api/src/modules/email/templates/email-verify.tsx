import { Heading, Section, Text } from '@react-email/components';
import { EmailLayout, sharedStyles } from './email-layout';

interface EmailVerifyProps {
  name: string;
  otp: string;
}

export function EmailVerifyEmail({ name, otp }: EmailVerifyProps) {
  return (
    <EmailLayout preview={`Your verification code: ${otp}`}>
      <Heading style={sharedStyles.heading}>Verify your email</Heading>
      <Text style={sharedStyles.subheading}>Enter this code to complete your signup</Text>

      <Text style={sharedStyles.text}>Hi {name},</Text>
      <Text style={sharedStyles.text}>
        Welcome to Grabdy! Use the code below to verify your email address:
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
        If you didn&apos;t create an account, you can safely ignore this email.
      </Text>

      <Text style={sharedStyles.signature}>
        Best regards,
        <br />
        The Grabdy Team
      </Text>
    </EmailLayout>
  );
}

EmailVerifyEmail.PreviewProps = {
  name: 'John Doe',
  otp: '847291',
} satisfies EmailVerifyProps;

export default EmailVerifyEmail;
