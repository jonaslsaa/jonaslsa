import { type NextPage } from "next";
import Head from "next/head";
import { prisma } from "../../server/db/client";

export async function getServerSideProps(context : { query: { id: string } }) {
  return { props: {id: context.query.id, } }
}

type ServerProps = {
  id: string
};

const ShowBin: NextPage<ServerProps> = ({id}) => {
  return <>
    <Head>
      <title>Pastebin</title>
      <meta name="description" content="Jonas Silva personal website" />
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <main className="bg-gray-900 min-h-screen w-full text-white flex justify-center">
        <div className="w-5/6 max-w-5xl rounded-md px-3">
          <h1 className="text-3xl font-bold ml-2 mt-3 text-blue-50 pb-6 pt-2">Pastebin</h1>
          <p>{id}</p>
        </div>
      </main>
  </>
}

export default ShowBin