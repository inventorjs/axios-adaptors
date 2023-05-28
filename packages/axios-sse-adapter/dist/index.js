import { __awaiter, __rest } from "tslib";
/**
 * sse 适配器
 */
import axios, { AxiosError } from 'axios';
import { fetchEventSource } from '@microsoft/fetch-event-source';
const sseAdapter = function sseAdapter(config) {
    return new Promise((resolve, reject) => {
        const { data, headers, method, signal, validateStatus, timeout } = config, rest = __rest(config, ["data", "headers", "method", "signal", "validateStatus", "timeout"]);
        const fullUrl = axios.getUri(config);
        const abortController = new AbortController();
        let timer;
        if (!signal && Number(timeout) > 0) {
            timer = setTimeout(() => abortController.abort(), timeout);
        }
        const stream = new ReadableStream({
            start(controller) {
                fetchEventSource(fullUrl, Object.assign(Object.assign({}, rest), { headers,
                    method, body: data, signal: (signal !== null && signal !== void 0 ? signal : abortController.signal), onopen(res) {
                        return __awaiter(this, void 0, void 0, function* () {
                            clearTimeout(timer);
                            const statusCode = res.status;
                            const response = {
                                data: stream,
                                status: statusCode,
                                statusText: res.statusText,
                                headers: Object.fromEntries([
                                    ...res.headers,
                                ]),
                                config,
                                request: null,
                            };
                            if (!res.ok || (validateStatus && !validateStatus(statusCode))) {
                                return reject(new AxiosError(`Request failed with status code ${statusCode}`, String(statusCode), config, null, response));
                            }
                            if (res.headers.get('content-type') === 'application/json') {
                                response.data = yield res.json();
                            }
                            resolve(response);
                        });
                    },
                    onmessage(ev) {
                        if (ev.data === '[DONE]') {
                            return;
                        }
                        controller.enqueue(ev.data);
                    },
                    onclose() {
                        controller.close();
                    },
                    onerror(error) {
                        controller.error(error);
                        // 避免自动重试
                        throw error;
                    } })).catch((error) => reject(new AxiosError(error.message, '0', config)));
            },
        });
    });
};
export default sseAdapter;
