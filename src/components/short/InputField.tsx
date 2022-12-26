import React from 'react'
import { useRef } from "react";
import type { FC } from 'react'

type InputFieldProps = {
    handleLink: (link: string) => void,
}

const InputField: FC<InputFieldProps> = ({handleLink}) => {

    const linkRef = useRef<HTMLInputElement>(null);

    function isValidLink(link: string) {
        const expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
        const regex = new RegExp(expression);
        if (link.length <= 3) return false;
        if (link.startsWith("https://") || link.startsWith("http://") || link.startsWith("www.")) {
            return true;
        }
        if (link.match(regex)) {
            return true;
        }
        return false;
    }

    function handleSubmit() {
        if (!linkRef.current) return;
        const link = linkRef.current.value.trim();
        if (link.length === 0) return;
        if (isValidLink(link)) {
            handleLink(link);
        } else {
            alert("Invalid link: " + link);
        }
    }

    function handleFromClipboard() {
        navigator.clipboard.readText()
        .then(text => {
            // check if string is valid link with regex
            text = text.trim();
            if (text.length === 0) return;
            if (isValidLink(text)) {
                handleLink(text);
            }
        })
        .catch(err => {
            console.error('Failed to read clipboard contents: ', err);
        });
    }

    return (
    <>
    <input ref={linkRef} type="text" className="bg-gray-100 px-2 py-2 my-2 rounded-sm w-full max-w-md text-gray-700" placeholder="Paste your link here..."></input>

    <div className="flex flex-row gap-2 justify-evenly h-14">
        <button onClick={handleFromClipboard} className="border font-medium relative text-lg px-6 py-3 rounded-md text-white border-gray-700 bg-gray-800 hover:bg-gray-700 hover:text-gray-100 shadow-sm min-w-fit">From clipboard</button>
        <button onClick={handleSubmit} className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 w-full">Shorten!</button>
    </div>
    </>
    )
}

export default InputField