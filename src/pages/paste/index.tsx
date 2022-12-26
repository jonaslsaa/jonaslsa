import { type NextPage } from "next";
import Head from "next/head";
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import { useState } from "react";
import 'prismjs/themes/prism-tomorrow.css';

const Pastebin: NextPage = () => {
  const languages = {
    javascript: {grammar: Prism.languages.js!, name: "javascript"},
    plain: {grammar: Prism.languages.plain!, name: "plain"},
    html: {grammar: Prism.languages.html!, name: "html"},
    markup: {grammar: Prism.languages.markup!, name: "markup"},
    xml: {grammar: Prism.languages.xml!, name: "xml"},
    css: {grammar: Prism.languages.css!, name: "css"},
    clike: {grammar: Prism.languages.clike!, name: "clike"},
  }

  const [language, setLanguage] = useState(languages.javascript);
  const [code, setCode] = useState("");

  function handleSubmit () {
    if(code.length === 0) return;
    if(code.length > 1024*1024) return alert("Content too long");
  }

  return ( 
    <>
      <Head>
        <title>Pastebin</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="bg-gray-900 min-h-screen w-full text-white flex justify-center">
        <div className="w-5/6 max-w-5xl rounded-md px-3">
          <h1 className="text-3xl font-bold ml-2 mt-3 text-blue-50 pb-6 pt-2">Pastebin</h1>
          <Editor
            value={code}
            placeholder={`function add(a, b) {\n  return a + b;\n}`}
            onValueChange={code => setCode(code)}
            highlight={code => Prism.highlight(code, language.grammar, language.name)}
            padding={14}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              fontSize: 13,
              paddingBottom: '8rem',
            }}
            className="bg-slate-800"
          />
          
          <div className="flex flex-row justify-between">
            <select className="bg-slate-800 text-white p-2 pr-10 mt-2 rounded-sm" onChange={(e) => setLanguage(languages[e.target.value]!)}>
              {Object.keys(languages).map((key) => {
                return <option key={key} value={key}>{key}</option>
              })}
            </select>
            <button className="bg-blue-600 text-white p-2 mt-2 rounded-sm px-6" onClick={handleSubmit}>Submit</button>
          </div>
        </div>
      </main>
    </>
  );
};

export default Pastebin;
