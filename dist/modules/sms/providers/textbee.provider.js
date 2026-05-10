import axios, { isAxiosError } from 'axios';
import axiosRetry from 'axios-retry';
export class TextBeeProvider {
    logger;
    http;
    constructor(env, logger) {
        this.logger = logger;
        this.http = axios.create({
            baseURL: env.TEXTBEE_BASE_URL,
            timeout: env.TEXTBEE_TIMEOUT_MS,
            headers: { 'content-type': 'application/json' },
        });
        axiosRetry(this.http, {
            retries: env.TEXTBEE_MAX_RETRIES,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (err) => {
                const status = err.response?.status;
                return (axiosRetry.isNetworkOrIdempotentRequestError(err) ||
                    (status !== undefined && status >= 500));
            },
        });
    }
    async sendSMS(args) {
        const url = `/devices/${encodeURIComponent(args.textbeeDeviceId)}/send-sms`;
        const body = { recipients: args.recipients, message: args.message };
        const start = Date.now();
        try {
            const res = await this.http.post(url, body, {
                headers: { 'x-api-key': args.apiKey },
            });
            const messageId = res.data?.data?.messageId ??
                res.data?.data?.smsBatchId;
            return {
                ok: true,
                providerMessageId: messageId,
                latencyMs: Date.now() - start,
            };
        }
        catch (err) {
            const latencyMs = Date.now() - start;
            const errorInfo = this.normaliseError(err);
            this.logger.warn({ device: args.textbeeDeviceId, ...errorInfo, latencyMs }, 'textbee send failed');
            return {
                ok: false,
                errorCode: errorInfo.code,
                errorMessage: errorInfo.message,
                latencyMs,
            };
        }
    }
    async healthCheck(args) {
        try {
            const status = await this.getDeviceStatus(args);
            return status.online;
        }
        catch {
            return false;
        }
    }
    async getDeviceStatus(args) {
        const url = `/devices/${encodeURIComponent(args.textbeeDeviceId)}`;
        try {
            const res = await this.http.get(url, {
                headers: { 'x-api-key': args.apiKey },
            });
            const data = res.data?.data ?? {};
            const enabled = data['enabled'] ?? true;
            const battery = data['batteryLevel'] ??
                data['battery'] ??
                null;
            return { online: enabled !== false, batteryLevel: battery };
        }
        catch {
            return { online: false, batteryLevel: null };
        }
    }
    normaliseError(err) {
        if (isAxiosError(err)) {
            const ax = err;
            const status = ax.response?.status;
            const data = ax.response?.data;
            const message = data?.message ?? data?.error ?? ax.message;
            const code = status ? `HTTP_${status}` : (ax.code ?? 'NETWORK_ERROR');
            return { code, message: typeof message === 'string' ? message : 'request failed' };
        }
        return { code: 'UNKNOWN', message: err instanceof Error ? err.message : 'unknown error' };
    }
}
