export interface TextBeeSendRequest {
  recipients: string[];
  message: string;
}

export interface TextBeeSendResponse {
  data?: {
    smsBatchId?: string;
    messageId?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface SendArgs {
  textbeeDeviceId: string;
  apiKey: string;
  recipients: string[];
  message: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  latencyMs: number;
}
