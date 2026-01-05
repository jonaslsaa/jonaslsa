import { type NextPage } from "next";
import Head from "next/head";
import { trpc } from "../../utils/trpc";
import { useEffect, useState } from "react";

import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import Link from "next/link";
import axios, { AxiosError } from "axios";

function getApiKeyFromLocalStorage() {
  const key = localStorage.getItem("deeplApiKey");
  const keyType = localStorage.getItem("deeplApiKeyType");
  console.log('Loaded API key from local storage', key, keyType);
  if (key === null || keyType === null) return null;
  return { key, keyType };
}

function saveApiKeyToLocalStorage(key: string, keyType: string) {
  localStorage.setItem("deeplApiKey", key);
  localStorage.setItem("deeplApiKeyType", keyType);
  console.log('Saved API key to local storage');
}

const languageMap = new Map([
  ['Bulgarian', 'BG'],
  ['Czech', 'CS'],
  ['Danish', 'DA'],
  ['German', 'DE'],
  ['Greek', 'EL'],
  ['English', 'EN'],
  ['Spanish', 'ES'],
  ['Estonian', 'ET'],
  ['Finnish', 'FI'],
  ['French', 'FR'],
  ['Hungarian', 'HU'],
  ['Indonesian', 'ID'],
  ['Italian', 'IT'],
  ['Japanese', 'JA'],
  ['Korean', 'KO'],
  ['Lithuanian', 'LT'],
  ['Latvian', 'LV'],
  ['Norwegian (Bokmål)', 'NB'],
  ['Dutch', 'NL'],
  ['Polish', 'PL'],
  ['Portuguese', 'PT'],
  ['Romanian', 'RO'],
  ['Russian', 'RU'],
  ['Slovak', 'SK'],
  ['Slovenian', 'SL'],
  ['Swedish', 'SV'],
  ['Turkish', 'TR'],
  ['Ukrainian', 'UK'],
  ['Chinese', 'ZH']
]);

const MAX_FILE_SIZE = 1024 * 1024 * 10; // 10MB

const DocumentTranslate: NextPage = () => {
  const [key, setKey] = useState({ key: "", keyType: "free" });
  const apiUrl = key.keyType === 'free' ? 'https://api-free.deepl.com/v2/document' : 'https://api.deepl.com/v2/document';
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("NB");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [formality, setFormality] = useState("default");
  const tRegisterDocument = trpc.translate.registerDocument.useMutation();
  const tSetDocumentToStatus = trpc.translate.setDocumentToStatus.useMutation();
  const tDocuments = trpc.translate.getDocumentsByKey.useQuery({ apiKey: key.key, apiType: key.keyType }, { enabled: key.key.length > 0 });

  const getDocumentStatus = async (documentId: string, documentKey: string) => {
    try {
      const config = {
        headers: {
          'Authorization': `DeepL-Auth-Key ${key.key}`,
          'Content-Type': 'multipart/json'
        },
      };

      const formData = new FormData();
      formData.append('document_key', documentKey);

      const response = await axios.post(`${apiUrl}/${documentId}`,
        formData,
        config as any);

      return response.data.status;
    } catch (error) {
      console.error('Check status failed:', error);
    }
  }

  useEffect(() => {
    //Implementing the setInterval method
    const interval = setInterval(async () => {
      if (!tDocuments.data) return;
      if (tDocuments.data.length === 0) return;
      for (const doc of tDocuments.data) {
        await new Promise(r => setTimeout(r, 1000));
        if (doc.status !== 'pending') continue;
        getDocumentStatus(doc.documentId, doc.documentKey).then((status) => {
          if (status == 'done') {
            tSetDocumentToStatus.mutateAsync({ documentId: doc.documentId, status: 'completed' }).then(() => {
              tDocuments.refetch();
            });
          }
        });
      }
    }, 1000);

    //Clearing the interval
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tDocuments.data]);

  useEffect(() => {
    const key = getApiKeyFromLocalStorage();
    if (key !== null) setKey({ key: key.key, keyType: key.keyType });
  }, []);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    setDocumentFile(file);
  }

  const uploadAndTranslateDocument = async () => {
    if (documentFile === null || documentFile?.size > MAX_FILE_SIZE) {
      alert('File is not selected or too large!');
      return;
    }
    const formData = new FormData();
    formData.append('target_lang', targetLanguage);
    if (sourceLanguage !== 'auto') formData.append('source_lang', sourceLanguage);
    formData.append('file', documentFile);
    formData.append('filename', documentFile.name);
    formData.append('formality', formality);

    try {
      const config = {
        headers: {
          'Authorization': `DeepL-Auth-Key ${key.key}`,
          'Content-Type': 'multipart/form-data'
        }
      };
      const response = await axios.post(apiUrl, formData, config);
      console.log('Upload successful:', response.data);
      saveApiKeyToLocalStorage(key.key, key.keyType);
      await tRegisterDocument.mutateAsync({
        filename: documentFile.name,
        apiKey: key.key,
        apiType: key.keyType,
        documentId: response.data.document_id,
        documentKey: response.data.document_key,
        sourceLanguage,
        targetLanguage,
      }).then(() => {
        setDocumentFile(null);
        tDocuments.refetch();
      })
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const downloadTranslatedDocument = async (orignalFileName: string, documentId: string, documentKey: string) => {
    try {
      const config = {
        headers: {
          'Authorization': `DeepL-Auth-Key ${key.key}`,
          'Content-Type': 'application/json'
        },
        responseType: 'blob', // To handle Blob data types
      };

      const formData = new FormData();
      formData.append('document_key', documentKey);

      const response = await axios.post(`${apiUrl}/${documentId}/result`,
        formData,
        config as any);

      // Create a Blob from the PDF Stream
      const file = new Blob(
        [response.data],
        { type: 'application/octet-stream' }
      );

      // Build a URL from the file
      const fileURL = URL.createObjectURL(file);

      // Open the URL on new Window
      const link = document.createElement('a');
      link.href = fileURL;
      const fileExt = orignalFileName.split('.').pop();
      const fileName = orignalFileName.replace(`.${fileExt}`, '');
      link.setAttribute('download', `${fileName}-translated.${fileExt}`);
      document.body.appendChild(link);
      link.click();

      tSetDocumentToStatus.mutateAsync({ documentId: documentId, status: 'downloaded' }).then(() => {
        tDocuments.refetch();
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 456) {
        alert('DeepL error: Quota on your API key has been exceeded!');
        return;
      }
      if (axiosError.response?.status === 403) {
        alert('DeepL error: API key is invalid!');
        return;
      }
      if (axiosError.response?.status === 404) {
        alert('DeepL error: Document not found!');
        return;
      }
      if (axiosError.response?.status === 413) {
        alert('DeepL error: Document too large!');
        return;
      }
      if (axiosError.response?.status === 429) {
        alert('DeepL error: Too many requests!');
        return;
      }
      console.error('Download failed:', error);
    }
  };

  return (
    <>
      <Head>
        <title>DeepL Document Translate via API</title>
        <meta name="description" content="Jonas's Personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="bg-gray-900 min-h-screen w-full text-white flex justify-center items-center">
        <div className="w-5/6 max-w-5xl rounded-md px-3 mb-14">
          <div className="flex flex-row justify-center gap-4 flex-wrap">
            <div className="min-w-[16rem] max-w-xl">
              <h1 className="mb-6 font-bold text-lg">DeepL Document Translate via API</h1>
              <div className="flex flex-col gap-2">
                <label>API settings</label>
                <input type="text" className="bg-gray-800 text-white p-2 rounded-md" placeholder="API Key" onChange={(e) => setKey({ ...key, key: e.target.value })} value={key.key} />
                <select className="bg-gray-800 text-white p-2 rounded-md" onChange={(e) => setKey({ ...key, keyType: e.target.value })} value={key.keyType}>
                  <option value={'free'}>Free</option>
                  <option value={'paid'}>Paid</option>
                </select>
              </div>
              <h2 className="mt-2 font-bold text-lg"><label>Translation</label></h2>
              <div className="flex flex-col gap-2">
                <label>Source Language</label>
                <select className="bg-gray-800 text-white p-2 rounded-md" onChange={(e) => setSourceLanguage(e.target.value)} value={sourceLanguage}>
                  <option value="auto">Auto</option>
                  {Array.from(languageMap.entries()).map((kv) => {
                    return <option key={kv[0]} value={kv[1]}>{kv[0]}</option>
                  })}
                </select>
                <label>Target Language</label>
                <select className="bg-gray-800 text-white p-2 rounded-md" onChange={(e) => setTargetLanguage(e.target.value)} value={targetLanguage}>
                  {Array.from(languageMap.entries()).map((kv) => {
                    return <option key={kv[0]} value={kv[1]}>{kv[0]}</option>
                  })}
                </select>
              </div>
              <p className="mt-2 text-white">Upload a document</p>
              <input type="file" className="bg-gray-800 text-white p-2 rounded-md" onChange={handleFileSelect} />
              {documentFile && documentFile?.size > MAX_FILE_SIZE && <p className="text-red-500 font-bold mt-2">Error: File too large! Max size is 10MB</p>}
              <input type="button" className="bg-blue-500 transition-colors hover:bg-blue-400 focus:bg-blue-600 cursor-pointer text-white p-2 px-4 rounded-md mt-2 ml-4" value="Translate" onClick={uploadAndTranslateDocument} />
            </div>
            <div className="min-w-[16rem] max-w-xl">
              <h2 className="mb-6 text-lg">Documents</h2>
              {tDocuments.data?.slice(0, 10).map((doc) => {
                return (
                  <div key={doc.id} className="flex flex-row justify-between items-center bg-gray-800 rounded-md p-2 mb-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{doc.filename.substring(0, 32)}</span>
                      <span className="text-xs">Source: {doc.sourceLanguage}</span>
                      <span className="text-xs">Target: {doc.targetLanguage}</span>
                      <span className="text-xs">Status: {doc.status}</span>
                    </div>
                    <div className="flex flex-row gap-2">
                      {doc.status === 'completed' &&
                        <input type="button" className="bg-blue-500 transition-colors hover:bg-blue-400 focus:bg-blue-600 cursor-pointer text-white p-2 px-4 rounded-md" value="Download" onClick={() => downloadTranslatedDocument(doc.filename, doc.documentId, doc.documentKey)} />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default DocumentTranslate;
