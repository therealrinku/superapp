import { ipcMain } from 'electron';
import pg from 'pg';

export function registerSuperApiClientIpcHandlers(
  _mainWindow: Electron.BrowserWindow | null,
) {
  ipcMain.on('send-api-request', async (event, args) => {
    const headersObj: Record<string, string> = {};
    const paramsObj: Record<string, string> = {};
    args.headers.map((header: { key: string; value: string }) => {
      headersObj[header.key] = header.value;
    });
    args.params.map((param: { key: string; value: string }) => {
      paramsObj[param.key] = param.value;
    });
    const reqUrl = `${args.reqUrl}${new URLSearchParams(paramsObj)}`;
    const reqObj: RequestInit = {
      headers: headersObj,
      body:
        !['get', 'head'].includes(args.reqType.toLowerCase()) && args.body
          ? args.body
          : null,
      method: args.reqType,
      credentials: 'include',
    };

    // add bearer token if provided
    if (args.bearerToken?.trim()) {
      reqObj.headers = {
        ...reqObj.headers,
        Authorization: `Bearer ${args.bearerToken}`,
      };
    }

    try {
      const resp = await fetch(reqUrl, reqObj);

      const headers: Record<string, string> = {};
      const cookies: Record<string, string> = {};
      resp.headers.forEach((value, key) => {
        headers[key] = value;
      });
      resp.headers.forEach((value, key) => {
        if (key === 'set-cookie') {
          const cookie = value.split(';')[0];
          const [cookieKey, cookieValue] = cookie.split('=');
          cookies[cookieKey] = cookieValue;
        }
      });

      let responseData = null;
      const contentType = resp.headers.get('Content-Type');

      if (contentType?.includes('application/json')) {
        responseData = await resp.json();
      } else if (contentType?.includes('text/html')) {
        responseData = await resp.text();
      }

      const eventReplyObj = {
        responseData: responseData,
        responseHeaders: headers,
        responseCookies: cookies,
        responseCode: resp.status,
        responseStatusText: resp.statusText,
        requestUrl: args.reqUrl,
      };

      event.reply('send-api-request', eventReplyObj);
    } catch (err) {
      console.log(err, 'err');
      // throw 404 if some weird error happens, for now at least :)
      const eventReplyObj = {
        responseData: null,
        responseHeaders: {},
        responseCookies: {},
        responseCode: '404',
        responseStatusText: 'Not Found',
        requestUrl: args.reqUrl,
      };

      event.reply('send-api-request', eventReplyObj);
    }
  });
}

export function registerSuperSqlClientIpcHandlers(
  _mainWindow: Electron.BrowserWindow | null,
) {
  let pgPool: pg.Pool;
  ipcMain.on('connect-to-db', async (event, args) => {
    try {
      pgPool = new pg.Pool({
        connectionString: args.connectionUri,
      });
      await pgPool.query('SELECT NOW()');
      event.reply('connect-to-db', { success: true });
    } catch (err: any) {
      event.reply('connect-to-db', { error: true, message: err.message });
    }
  });

  ipcMain.on('disconnect-from-db', async (event, args) => {
    try {
      await pgPool.end();
      event.reply('disconnect-from-db', { success: true });
    } catch (err: any) {
      event.reply('disconnect-from-db', { error: true, message: err.message });
    }
  });

  ipcMain.on('send-db-query', async (event, args) => {
    try {
      const resp = await pgPool.query(`${args.query}`);
      event.reply('send-db-query', {
        success: true,
        response: JSON.stringify(resp),
      });
    } catch (err: any) {
      event.reply('send-db-query', { error: true, message: err.message });
    }
  });

  ipcMain.on('get-db-tables', async (event) => {
    try {
      const resp = await pgPool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`,
      );
      event.reply('get-db-tables', {
        success: true,
        response: JSON.stringify(resp),
      });
    } catch (err: any) {
      event.reply('get-db-tables', { error: true, message: err.message });
    }
  });
}
