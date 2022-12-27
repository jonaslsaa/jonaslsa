import { type NextPage } from "next";
import Head from "next/head";
import { prisma } from "../../server/db/client";

import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import Link from "next/link";

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
  return <>
    <Head>
      <title>Pastebin</title>
      <meta name="description" content="Jonas Silva personal website" />
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <main className="bg-gray-900 min-h-screen w-full text-white flex justify-center">
        <div className="w-5/6 max-w-5xl rounded-md px-3">
          <Link href="/paste">
            <h1 className="text-3xl font-bold ml-2 mt-3 text-blue-50 pb-6 pt-2">Pastebin</h1>
          </Link>
          <h2 className="text-1xl ml-2 mt-3 text-white pb-6 pt-2">{title}</h2>
          <Editor
            value={content}
            placeholder={`function add(a, b) {\n  return a + b;\n}`}
            readOnly={true}
            highlight={code => Prism.highlight(code, Prism.languages[language], language)}
            padding={14}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              fontSize: 13,
              paddingBottom: '1rem',
            }}
            className="bg-slate-800"
          />
        </div>
      </main>
  </>
}

export default ShowBin