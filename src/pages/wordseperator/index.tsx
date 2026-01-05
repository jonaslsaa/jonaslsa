import { type NextPage } from "next";
import Head from "next/head";
import { useState, useRef, useEffect } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react'
import pako from 'pako';

const minFrequency = 40;
const wordFrequencyDataEndpoint = 'https://f003.backblazeb2.com/b2api/v1/b2_download_file_by_id?fileId=4_z4bab91d8065ab46a8a540d11_f113003e5a8b6a130_d20230301_m201959_c003_v0312007_t0018_u01677701999854';
let isFetching = false;

function bestFromMap(map: Map<string, number>) {
  let max = 0;
  let maxWord = '';
  map.forEach((value, key) => {
    if (value > max) {
      max = value;
      maxWord = key;
    }
  });
  return {max, maxWord};
}

function seperateWords(dataFreq: Map<string, number>, text: string) {
  const words = text.split(' ');
  const output: string[] = [];
  let fixedWords = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    if (word.length <= 2) {
      output.push(word);
      continue;
    }

    // extract word for split word, remove special characters except - and '
    const testWord = word.replace(/[^a-zA-ZæøåÆØÅ\-']/g, '').toLowerCase();
    if (dataFreq.has(testWord)) { // check if word is in dictionary
      output.push(word);
      continue;
    }

    // try to split word into two words
    const found = new Map<string, number>();
    for (let j = 2; j < word.length - 1; j++) {
      const word1 = word.substring(0, j);
      const word2 = word.substring(j);
      const testWord1 = word1.replace(/[^a-zA-ZæøåÆØÅ\-']/g, '').toLowerCase();
      const testWord2 = word2.replace(/[^a-zA-ZæøåÆØÅ\-']/g, '').toLowerCase();
      if (dataFreq.has(testWord1) && dataFreq.has(testWord2)) {
        found.set(word1 + ' ' + word2, (dataFreq.get(testWord1) || 0) + (dataFreq.get(testWord2) || 0) / 2);
      }
    }

    // try to split word into three words, if long word or best found word is not good enough
    if (word.length >= 12 || found.size === 0) {
      console.log('Trying to split into three words: ' + word);
      for (let j = 2; j < word.length - 2; j++) {
        for (let k = j + 1; k < word.length - 1; k++) {
          const word1 = word.substring(0, j);
          const word2 = word.substring(j, k);
          const word3 = word.substring(k);
          const testWord1 = word1.replace(/[^a-zA-ZæøåÆØÅ\-']/g, '').toLowerCase();
          const testWord2 = word2.replace(/[^a-zA-ZæøåÆØÅ\-']/g, '').toLowerCase();
          const testWord3 = word3.replace(/[^a-zA-ZæøåÆØÅ\-']/g, '').toLowerCase();
          if (dataFreq.has(testWord1) && dataFreq.has(testWord2) && dataFreq.has(testWord3)) {
            found.set(word1 + ' ' + word2 + ' ' + word3, (dataFreq.get(testWord1) || 0) + (dataFreq.get(testWord2) || 0) + (dataFreq.get(testWord3) || 0) / 3);
          }
        }
      }
    }

    if (found.size > 0) { // choose word with highest frequency
      const bestFound = bestFromMap(found);
      output.push(bestFound.maxWord);
      console.log('Fixed: ' + word + ' -> ' + bestFound.maxWord);
      fixedWords++;
    } else {
      output.push(word);
    }
  }
  return {output, fixedWords};
}


const WordSeperator: NextPage = () => {

  const inputTextRef = useRef<HTMLTextAreaElement>(null);
  const [internalMessage, setInternalMessage] = useState<string>("");
  const [outputMessage, setOutputMessage] = useState<string>("");
  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wordFrequencyData, setWordFrequencyData] = useState<Map<string, number>>(new Map<string, number>());
  // const [animationParent] = useAutoAnimate({ stagger: 0.1, duration: 0.5 });

  function copyToClipboard() {
    if (!output) return;
    navigator.clipboard.writeText(output)
      .then(() => {
        console.log("Copied to clipboard!");
        setCopied(true);
      })
      .catch(err => {
        alert('Failed to copy to clipboard: ' + err);
      });
  }

  useEffect(() => {
    if(wordFrequencyData.size > 0) return;
    if(isFetching) return;
    isFetching = true;
    console.log('Fetching word frequency data...');
    setInternalMessage('Fetching word frequency data...');
    fetch(wordFrequencyDataEndpoint, { cache: 'force-cache' }) // this file is brotli compressed with zlib (use pako to decompress):
      .then(response => response.arrayBuffer())
      .then(buffer => {
        setInternalMessage('Decompressing word frequency data...');
        const decompressed = pako.inflate(buffer);
        return new TextDecoder("utf-8").decode(decompressed);
      })
      .then(data => {
        const newWordFrequencyData = new Map<string, number>();
        setInternalMessage('Parsing word frequency data...');
        const lines = data.split('\n');
        console.log('Lines: ' + lines.length);
        lines.forEach(line => {
          const splitLine = line.split(' ');
          const word = splitLine[splitLine.length - 1];
          const frequency = splitLine[splitLine.length - 2];
          if (!frequency || !word) return;
          const parsedFrequency = parseInt(frequency);
          if(word?.length > 1 && !isNaN(parsedFrequency) && parsedFrequency >= minFrequency) {
            newWordFrequencyData.set(word, parsedFrequency);
          }
        });
        setInternalMessage('');
        console.log('Word frequency data fetched! Size: ' + newWordFrequencyData.size);
        setWordFrequencyData(newWordFrequencyData);
      })
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCopied(false);
    }, 2500);
    return () => clearTimeout(timeout);
  }, [copied]);


  const resizeTextAreaByContent = (textArea: HTMLTextAreaElement | null) => {
    if (!textArea) return;
    textArea.style.height = 'auto';
    textArea.style.height = textArea.scrollHeight + 'px';
    if (textArea.style.height >= `${window.innerHeight / 3}px`) {
      textArea.style.height = `${window.innerHeight / 3}px`;
    }
  }

  const isFetchingData = wordFrequencyData.size == 0;

  return (
    <>
      <Head>
        <title>Word seperator - Jonaslsa</title>
        <meta name="description" content="Jonas's Personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="bg-gray-900 text-white w-full min-h-screen">
        <div className="flex flex-col gap-3 p-8 w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">Jonaslsa - Word seperator</h1>
            <span className="text-gray-500 text-sm">Language: Norwegian</span>
          </div>
          {internalMessage && <p className="text-gray-white text-sm">{internalMessage}</p>}
          <textarea onChange={() => { resizeTextAreaByContent(inputTextRef.current) }} ref={inputTextRef} id="input-text" name="input-text" className="p-3 rounded-sm shadow-sm text-gray-700 w-full min-h-[10rem] resize-none" placeholder="Copy your text here..."></textarea>
          <div className="flex flex-col gap-3 items-end">
            <button onClick={() => {
              const text = inputTextRef.current?.value;
              if (!text || text.length <= 4) return;
              setInternalMessage('Processing...');
              const lines = text.split('\n');
              const output: string[] = [];
              let fixedWords = 0;
              lines.forEach(line => {
                const result = seperateWords(wordFrequencyData, line);
                output.push(result.output.join(' '));
                fixedWords += result.fixedWords;
              });
              setOutput(output.join('\n'));
              setInternalMessage('');
              setOutputMessage(`Fixed ${fixedWords} words`);
            }} disabled={isFetchingData} className="border font-medium relative text-md m-2 px-6 py-3 rounded-md text-white border-gray-700 bg-gray-800 hover:bg-gray-700 hover:text-gray-100 shadow-sm max-w-md w-48 h-auto">
              {isFetchingData ? "Fetching data..." : "Do magic!"}
              </button>
          </div>


          {output && <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Output</h2>
            <div className="flex justify-end">
              <span onClick={() => copyToClipboard()} className="flex gap-2 cursor-pointer relative top-10 mr-3 z-10">
                {copied ? <p className="text-gray-500 text-sm">Copied!</p> : <p className="text-gray-500 text-sm">Copy</p>}
                <svg xmlns="http://www.w3.org/2000/svg" width={16} className="fill-gray-700 opacity-40" viewBox="0 0 384 512"><path d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM192 40c13.3 0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm144 418c0 3.3-2.7 6-6 6H54c-3.3 0-6-2.7-6-6V118c0-3.3 2.7-6 6-6h42v36c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12v-36h42c3.3 0 6 2.7 6 6z" /></svg>
              </span>
            </div>
            <textarea readOnly={true} id="output-text" name="output-text" className="p-3 rounded-sm shadow-sm text-gray-700 w-full min-h-[10rem] resize-none read-only" value={output}></textarea>
            {outputMessage && <p className="text-gray-500 px-2 text-sm">{outputMessage}</p>}
          </div>}
        </div>
      </main>
    </>
  );
};

export default WordSeperator;
