import { type NextPage } from "next";
import Head from "next/head";
import { prisma } from "../../server/db/client";

import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import Link from "next/link";
import { useState } from "react";

// Import other languages
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-jsx'; // React JSX
import 'prismjs/components/prism-tsx'; // React TSX
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-typescript';

export async function getServerSideProps(context : { query: { id: string } }) {
  const bin = await prisma.pastebin.findUnique({
    where: {
      slug: context.query.id
    }
  });
  if (!bin) {
    return {
      notFound: false,
      props: {}
    }
  }
  return { props: { id: bin.id, title: bin.title, content: bin.content, language: bin.language } };
}

type ServerProps = {
  id: string
  title: string
  content: string
  language: string
};

const ShowBin: NextPage<ServerProps> = ({id, title, content, language}) => {

  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
      navigator.clipboard.writeText(content)
      .then(() => {
          console.log("Copied to clipboard!");
          setCopied(true);
      })
      .catch(err => {
          alert('Failed to copy to clipboard: '+ err);
      });
  }

  function getLanguage(lang: string) {
    const r = Prism.languages[lang];
    if (r) return r;
    console.error(`Language ${lang} not found, defaulting to plain`);
    return Prism.languages.plain;
  }

  return <>
    <Head>
      <title>Pastebin</title>
      <meta name="description" content="Jonas's Personal website" />
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <main className="bg-gray-900 min-h-screen w-full text-white flex justify-center">
        <div className="w-5/6 max-w-5xl rounded-md px-3 mb-14">
          <Link href="/paste">
            <h1 className="text-3xl font-bold ml-2 mt-3 text-blue-50 pb-6 pt-2">Pastebin</h1>
          </Link>
          <h2 className="text-1xl ml-2 mt-3 text-white pt-2">{title}</h2>

          <div>
            <div className="flex justify-end">
              <span onClick={() => copyToClipboard()} className="flex gap-2 cursor-pointer relative top-8 mr-3 z-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width={16} className="fill-sky-100 opacity-20" viewBox="0 0 384 512"><path d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM192 40c13.3 0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm144 418c0 3.3-2.7 6-6 6H54c-3.3 0-6-2.7-6-6V118c0-3.3 2.7-6 6-6h42v36c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12v-36h42c3.3 0 6 2.7 6 6z"/></svg>
                  {copied && <p className="text-gray-500">Copied!</p>}
              </span>
            </div>
            <Editor
              value={content}
              placeholder={`function add(a, b) {\n  return a + b;\n}`}
              readOnly={true}
              onValueChange={code => {return}}
              highlight={code => Prism.highlight(code, getLanguage(language), language)}
              padding={14}
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 13,
                paddingBottom: '1rem',
              }}
              className="bg-slate-800"
            />
            <div className="flex justify-end">
              <a className="text-gray-600 text-xs mt-1 hover:underline cursor-pointer" onClick={() => {
                const element = document.createElement("a");
                const file = new Blob([content], {type: 'text/plain'});
                element.href = URL.createObjectURL(file);
                element.download = `${title}`;
                if (element.download === "") {
                  element.download = "untitled.txt";
                }
                if (element.download.indexOf(".") === -1) {
                  element.download += ".txt";
                }
                document.body.appendChild(element); // Required for this to work in FireFox
                element.click();
                document.body.removeChild(element);
              }}>Download</a>
            </div>
          </div>
        </div>
      </main>
  </>
}

export default ShowBin