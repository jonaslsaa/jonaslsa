import { type NextPage } from "next";
import Head from "next/head";
import { trpc } from "../../utils/trpc";
import { useState } from "react";

import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import Link from "next/link";


const Pastebin: NextPage = () => {
  const languages = {
    plain: {grammar: Prism.languages.plain!, name: "plain"},
    javascript: {grammar: Prism.languages.js!, name: "javascript"},
    html: {grammar: Prism.languages.html!, name: "html"},
    markup: {grammar: Prism.languages.markup!, name: "markup"},
    xml: {grammar: Prism.languages.xml!, name: "xml"},
    css: {grammar: Prism.languages.css!, name: "css"},
    clike: {grammar: Prism.languages.clike!, name: "clike"},
  }

  const [language, setLanguage] = useState(languages.plain);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const tCreateBin = trpc.paste.createPastebin.useMutation();

  function handleSubmit () {
    if(code.length === 0) return;
    if(code.length > 1024*1024) return alert("Content too long");
    const normTitle = title.length > 0 ? title : "Untitled";
    tCreateBin.mutate({title: normTitle, content: code, language: language.name}, {
      onSuccess: (slug) => {
        console.log(slug);
        window.location.href = `/paste/${slug}`;
      },
      onError: (err) => {
        console.log(err);
      }
    });
  }

  return ( 
    <>
      <Head>
        <title>Pastebin</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="bg-gray-900 min-h-screen w-full text-white flex justify-center">
        <div className="w-5/6 max-w-5xl rounded-md px-3 mb-14">
          <Link href="/paste">
            <h1 className="text-3xl font-bold ml-2 mt-3 text-blue-50 pb-6 pt-2">Pastebin</h1>
          </Link>
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
            <div className="flex gap-2">
              <select className="bg-slate-800 text-white p-2 pr-10 mt-2 rounded-sm" defaultValue={language.name} onChange={(e) => {
                const sel = e.target.value;
                Object.values(languages).forEach((lang) => {
                  if(lang.name === sel) {
                    setLanguage(lang);
                  }
                })
              }}>
                {Object.keys(languages).map((key) => {
                  return <option key={key} value={key}>{key}</option>
                })}
              </select>
              <input type={"text"} className="bg-slate-800 text-white p-2 mt-2 rounded-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <button className="bg-blue-600 text-white p-2 mt-2 rounded-sm px-6 hover:bg-blue-700" onClick={handleSubmit}>Submit</button>
          </div>
        </div>
      </main>
    </>
  );
};

export default Pastebin;
