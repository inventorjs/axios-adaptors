/**
 * weapp adapter
 * @author: sunkeysun
 */
import statuses from 'statuses'
import axios, { type AxiosAdapter, type AxiosResponse, AxiosError, type CancelToken } from 'axios'

type SubsCancelToken = CancelToken & {
  subscribe: (listener: unknown) => void
  unsubscribe: (listener: unknown) => void
}

type WxRequestOption = WechatMiniprogram.RequestOption

const weappAdapter: AxiosAdapter = function weappAdapter(config) {
  return new Promise((resolve, reject) => {
    const { data, headers, method, timeout, cancelToken, validateStatus } =
      config
    const fullUrl = axios.getUri(config)
    const httpMethod =
      typeof method === 'string' ? method.toUpperCase() : method
    const subsCancelToken = cancelToken as SubsCancelToken

    // 数据格式抓换使用 axios transform 进行处理，这里默认传输普通字符串
    let request: WechatMiniprogram.RequestTask | null = wx.request({
      url: fullUrl,
      data,
      dataType: '其他',
      header: headers,
      method: httpMethod as WxRequestOption['method'],
      responseType: 'text',
      enableHttp2: true,
      enableQuic: true,
      timeout,
      success: ({ header, data, statusCode }) => {
        const response: AxiosResponse = {
          data,
          status: statusCode,
          statusText: statuses.message[statusCode] ?? '',
          headers: header,
          config,
          request,
        }
        if (!validateStatus || (validateStatus && validateStatus(statusCode))) {
          resolve(response)
        }
        reject(
          new AxiosError(
            `Request failed with status code ${statusCode}`,
            String(statusCode),
            config,
            request,
            response,
          ),
        )
      },
      fail: ({ errMsg }) => {
        reject(new AxiosError(errMsg, '0', config, request))
      },
      complete: () => {
        subsCancelToken?.unsubscribe?.(onCancel)
        request = null
      },
    })

    function onCancel(cancel: unknown) {
      if (!request) return
      reject(
        !cancel || !axios.isCancel(cancel)
          ? new axios.Cancel('canceled')
          : cancel,
      )
      request.abort()
      request = null
    }
    subsCancelToken?.subscribe?.(onCancel)
  })
}

export default weappAdapter
