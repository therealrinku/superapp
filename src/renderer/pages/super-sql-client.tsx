import { useRef, useState } from 'react';
import {
  FiClipboard,
  FiDatabase,
  FiPlay,
  FiPower,
  FiRotateCw,
  FiTable,
} from 'react-icons/fi';
import Loading from '../components/common/loading';
import useSuperApp from '../hooks/use-super-app';
import {
  ISuperSqlConnectionResponse,
  ISuperSqlDbQueryResponse,
  ISuperSqlDbTables,
  ISuperSqlGetTablesQueryResponse,
  ISuperSqlSendQueryResponse,
} from '../global';
import ConnectionForm from '../components/supersql/connection-form';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { autocompletion } from '@codemirror/autocomplete';

export default function SuperSqlClient() {
  const { quitApp } = useSuperApp();

  const [activeTab, setActiveTab] = useState<'Tables' | 'Query'>('Tables');
  const [query, setQuery] = useState('');

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingTables, setLoadingTables] = useState<boolean>(false);
  const [connectedDb, setConnectedDb] = useState<string | null>(null);
  const [dbResponse, setDbResponse] = useState<
    ISuperSqlDbQueryResponse | null | undefined
  >(null);
  const [dbTables, setDbTables] = useState<ISuperSqlDbTables>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [onHoverTableValue, setOnHoverTableValue] = useState<string | null>(
    null,
  );

  function fetchTables() {
    setLoadingTables(true);
    window.electron.ipcRenderer.sendMessage('get-db-tables');

    window.electron.ipcRenderer.once('get-db-tables', (resp) => {
      const response = resp as ISuperSqlGetTablesQueryResponse;
      if (response.error) {
        alert(response.message);
      } else if (response.response) {
        const table = JSON.parse(response.response) as {
          rows: [{ table_name: string }];
        };
        setDbTables(table.rows);
      }
      setLoadingTables(false);
    });
  }

  function disconnect() {
    setLoading(true);

    window.electron.ipcRenderer.sendMessage('disconnect-from-db');
    window.electron.ipcRenderer.once('disconnect-from-db', (resp) => {
      const response = resp as ISuperSqlConnectionResponse;
      if ('error' in response) {
        alert(response.message);
      } else {
        setConnectedDb(null);
        setDbResponse(null);
      }
      setLoading(false);
      quitApp();
    });
  }

  function sendQuery(query: string) {
    setLoading(true);

    window.electron.ipcRenderer.sendMessage('send-db-query', { query });
    window.electron.ipcRenderer.once('send-db-query', (resp) => {
      const response = resp as ISuperSqlSendQueryResponse;
      if (response.error) {
        alert(response.message);
      } else if (response.response) {
        const dbResp = JSON.parse(
          response.response,
        ) as ISuperSqlDbQueryResponse;
        setDbResponse(dbResp);
        setOnHoverTableValue(null);
      }
      setLoading(false);
    });
  }

  const rows = dbResponse ? dbResponse.rows : [];

  //@ts-expect-error
  function tableAutoCompletions(context) {
    let word = context.matchBefore(/\w*/);
    if (word.from == word.to && !context.explicit) return null;
    return {
      from: word.from,
      options: dbTables.map((table) => {
        return {
          label: table.table_name,
          type: 'keyword',
        };
      }),
    };
  }

  if (!connectedDb) {
    return (
      <div className="flex flex-col h-screen text-xs w-[50%] mx-auto">
        <ConnectionForm
          onConnectionSuccess={(dbName) => {
            setConnectedDb(dbName);
            fetchTables();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-start text-xs max-h-screen overflow-hidden">
      <div className="w-[25%] px-5 gap-3 mt-5">
        <div className="absolute bottom-0 left-0 pl-5 py-2 border-t w-[25%] flex items-center gap-2">
          <FiDatabase size={15} />
          {connectedDb}
          <button
            className="flex items-center gap-2 font-bold"
            onClick={disconnect}
          >
            <FiPower size={15} />
          </button>

          {connectedDb && activeTab === 'Query' && (
            <div className="flex items-center gap-5 ml-auto pr-5">
              <button
                disabled={loading}
                className="font-bold flex items-center gap-2"
                onClick={() => sendQuery(query)}
              >
                <FiPlay />
              </button>
            </div>
          )}
        </div>

        {connectedDb && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-5">
              <button
                className={`${activeTab === 'Tables' && 'font-bold'} flex items-center gap-2 outline-none`}
                onClick={() => setActiveTab('Tables')}
              >
                Tables
                <button
                  className="font-bold flex items-center gap-2"
                  onClick={fetchTables}
                  disabled={loadingTables}
                >
                  <FiRotateCw size={13} />
                </button>
              </button>
              <button
                className={`${activeTab === 'Query' && 'font-bold'}`}
                onClick={() => setActiveTab('Query')}
              >
                Query
              </button>
            </div>

            {activeTab === 'Tables' && (
              <div className="flex flex-col gap-2 items-start">
                {loadingTables && (
                  <p className="font-bold text-center mt-2">
                    Loading tables...
                  </p>
                )}
                {!loadingTables &&
                  dbTables.map((row) => {
                    return (
                      <button
                        className={`${selectedTable === row.table_name ? 'font-bold' : ''} py-2 w-full bg-gray-100 rounded flex items-center gap-2 outline-none pl-2`}
                        key={row.table_name}
                        onClick={() => {
                          sendQuery(`select * from ${row.table_name}`);
                          setSelectedTable(row.table_name);
                        }}
                      >
                        <FiTable />
                        {row.table_name}
                      </button>
                    );
                  })}
              </div>
            )}

            {activeTab === 'Query' && (
              <CodeMirror
                value={query}
                onChange={(e) => setQuery(e)}
                height="80vh"
                className="border outline-none"
                extensions={[
                  sql(),
                  autocompletion({ override: [tableAutoCompletions] }),
                ]}
              />
            )}
          </div>
        )}
      </div>

      <div className="w-[75%] border-l min-h-screen">
        {loading && (
          <div className="h-screen w-full flex flex-col items-center justify-center">
            <Loading />
          </div>
        )}

        {!loading && dbResponse && (
          <div>
            <div className="h-[100vh] overflow-auto pb-12">
              <table className="table-auto border-collapse border-r border-b">
                <thead>
                  <tr>
                    {Object.keys(rows[0]).map((key, colIndex) => (
                      <th
                        key={colIndex}
                        className="border border-gray-300 px-4 py-2 text-left bg-gray-200 sticky top-0"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex: number) => (
                    <tr key={rowIndex}>
                      {Object.values(row).map((col, colIndex) => (
                        <td
                          key={colIndex}
                          title={col}
                          onClick={() => setOnHoverTableValue(col)}
                          className="border border-gray-300 p-2 w-48 max-w-48 overflow-hidden truncate"
                        >
                          {col}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="absolute bottom-0 right-0 pl-5 py-2 border-t w-[75%] flex items-center gap-5 bg-white border-l">
              <span>
                <b>{rows.length}</b> rows
              </span>
              {onHoverTableValue && (
                <div className="flex items-center gap-3 pr-5 w-[85%]">
                  <span className="truncate">{onHoverTableValue}</span>
                  <button
                    className="absolute right-5"
                    onClick={() =>
                      navigator.clipboard.writeText(onHoverTableValue)
                    }
                  >
                    <FiClipboard size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
