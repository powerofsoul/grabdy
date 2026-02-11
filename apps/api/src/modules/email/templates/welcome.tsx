import { Button, Heading, Text } from '@react-email/components';
import { EmailLayout, sharedStyles } from './email-layout';

interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
}

export function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Your Grabdy account is ready">
      <Heading style={sharedStyles.heading}>You&apos;re All Set!</Heading>
      <Text style={sharedStyles.subheading}>Welcome aboard, your account is ready to use</Text>

      <Text style={sharedStyles.text}>Hi {name},</Text>
      <Text style={sharedStyles.text}>
        Your Grabdy account is now ready. You can log in and start uploading documents,
        searching your data, and building integrations.
      </Text>

      <Button style={sharedStyles.button} href={loginUrl}>
        Go to Login
      </Button>

      <Text style={sharedStyles.text}>
        If you have any questions, feel free to reach out to your administrator.
      </Text>

      <Text style={sharedStyles.signature}>
        Best regards,
        <br />
        The Grabdy Team
      </Text>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  name: 'Alex Johnson',
  loginUrl: 'https://grabdy.com/auth/login',
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
