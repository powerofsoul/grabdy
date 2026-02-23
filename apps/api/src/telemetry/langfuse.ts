import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseExporter } from 'langfuse-vercel';

let sdk: NodeSDK | null = null;

export function initTelemetry(): void {
  const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
  const secretKey = process.env['LANGFUSE_SECRET_KEY'];

  if (!publicKey || !secretKey) {
    return;
  }

  const baseUrl = process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com';

  sdk = new NodeSDK({
    traceExporter: new LangfuseExporter({
      publicKey,
      secretKey,
      baseUrl,
    }),
  });

  sdk.start();
}

export function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}
