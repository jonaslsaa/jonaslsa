import React from 'react'
import type { FC } from 'react'

type ShowShortenProps = {
    link: string
}

const ShowShorten: FC<ShowShortenProps> = ({link}) => { // link example: /s/1234
    const fullLink = window.location.origin + link;
    const [copied, setCopied] = React.useState(false);

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text)
        .then(() => {
            console.log("Copied to clipboard!");
            setCopied(true);
        })
        .catch(err => {
            alert('Failed to copy to clipboard: '+ err);
        });
    }

    return (
        <>
        <div className='flex gap-3 justify-center'>
            <a href={fullLink} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-500 transition-all">
                <h2>{fullLink}</h2>
            </a>
            <a onClick={() => copyToClipboard(fullLink)} className="cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width={16} className="fill-sky-300 opacity-20" viewBox="0 0 384 512"><path d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM192 40c13.3 0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm144 418c0 3.3-2.7 6-6 6H54c-3.3 0-6-2.7-6-6V118c0-3.3 2.7-6 6-6h42v36c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12v-36h42c3.3 0 6 2.7 6 6z"/></svg>
            </a>
        </div>
        {copied && <p className="text-gray-500">Copied!</p>}
        </>
    )
}

export default ShowShorten