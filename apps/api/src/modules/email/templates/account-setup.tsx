import { Button, Heading, Link, Text } from '@react-email/components';
import { EmailLayout, sharedStyles } from './email-layout';

interface AccountSetupEmailProps {
  setupUrl: string;
}

export function AccountSetupEmail({ setupUrl }: AccountSetupEmailProps) {
  return (
    <EmailLayout preview="Complete your Grabdy account setup">
      <Heading style={sharedStyles.heading}>Welcome to Grabdy!</Heading>
      <Text style={sharedStyles.subheading}>You&apos;ve been invited to join the platform</Text>

      <Text style={sharedStyles.text}>Hi there,</Text>
      <Text style={sharedStyles.text}>
        You&apos;ve been invited to join Grabdy. Click the button below to set up your password and
        complete your account:
      </Text>

      <Button style={sharedStyles.button} href={setupUrl}>
        Complete Account Setup
      </Button>

      <div style={sharedStyles.highlightBox}>
        <Text style={sharedStyles.highlightText}>
          This link will expire in 7 days for security reasons.
        </Text>
      </div>

      <Text style={sharedStyles.smallText}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
      </Text>
      <Link href={setupUrl} style={sharedStyles.link}>
        {setupUrl}
      </Link>

      <Text style={sharedStyles.signature}>
        Best regards,
        <br />
        The Grabdy Team
      </Text>
    </EmailLayout>
  );
}

AccountSetupEmail.PreviewProps = {
  setupUrl: 'https://grabdy.com/auth/complete-account?token=abc123xyz',
} satisfies AccountSetupEmailProps;

export default AccountSetupEmail;
