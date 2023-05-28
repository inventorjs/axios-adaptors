/**
 * sse 适配器
 */
import axios, { AxiosError, type AxiosAdapter } from 'axios';
const CONTENT_JSON = 'application/json';
const CONTENT_EVENT_STREAM = 'text/event-stream';

const streamAdapter: AxiosAdapter = async function streamAdapter(config) {
    const { data, headers, method, signal, validateStatus, timeout, ...rest } = config;
    const fullUrl = axios.getUri(config);
    const abortController = new AbortController();
    let timer;
    if (timeout && !signal) {
        timer = setTimeout(() => abortController.abort(), timeout);
    }
    try {
        const res = await fetch(fullUrl, {
            ...rest,
            headers,
            method,
            body: data,
            signal: (signal ?? abortController.signal) as AbortSignal,
        })
        const statusCode = res.status;
        const response = {
            data: res.body as ReadableStream<unknown>,
            status: statusCode,
            statusText: res.statusText,
            headers: Object.fromEntries([
                ...(res.headers as unknown as Map<string, string>),
            ]),
            config,
            request: null,
        };
        if (!res.ok || (validateStatus && !validateStatus(statusCode))) {
            response.data = await res.json()
            throw new AxiosError(`Request failed with status code ${statusCode}`, String(statusCode), config, null, response);
        }
        if (!res.body) {
            return response
        }

        if (res.headers.get('content-type') === CONTENT_JSON) {
            response.data = await res.json();
        } else if (res.headers.get('content-type') === CONTENT_EVENT_STREAM) {
            response.data = new ReadableStream<string | Record<string, unknown>>({
                async start(controller) {
                    if (!res.body) {
                        return controller.close()
                    }
                    const reader = res.body.getReader()
                    while (true) {
                        const { value, done } = await reader.read()
                        const decoder = new TextDecoder()
                        const lines = decoder.decode(value).split('\n\n')
                        lines.forEach((line) => {
                            const [, data] = line.split('data: ')
                            if (data && data !== '[DONE]') {
                                let parsedData = data
                                try {
                                    parsedData = JSON.parse(data)
                                } catch (err) {
                                    // empty
                                }
                                controller.enqueue(parsedData)
                            }
                        })
                        if (done) {
                            controller.close()
                            break
                        }
                    }
                }
            })
        }
        return response
    } catch (error) {
        throw new AxiosError((error as Error).message, '0', config, null)
    } finally {
        clearTimeout(timer);
    }
};
export default streamAdapter;
