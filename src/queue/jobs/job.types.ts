export interface SmsSendJob {
  smsMessageId: string;
  otpRequestId?: string;
  tokenTransactionId?: string;
  recipientE164: string;
  message: string;
  correlationId: string;
  excludeDeviceIds?: string[];
}

export interface DeviceHealthJob {
  triggeredAt: number;
}

export interface CampaignSendJob {
  deliveryId: string;
  campaignId: string;
  correlationId: string;
}
