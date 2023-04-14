import Link from 'next/link'
import React, { useState } from 'react'
import type { FC } from 'react'
import type { markerFilterType } from './Map'

type DropdownPanelProps = {
  filters : Record<markerFilterType, boolean>
  setFilters: (filters: Record<markerFilterType, boolean>) => void
}

const capitalizeString = (s: string) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const markerFilterTypeToPretty = (s: markerFilterType) => {
  switch (s) {
    case 'default':
      return 'Uncategorized'
    case 'traffic':
      return 'Traffic related'
    case 'fire':
      return 'Fire'
    case 'speed':
      return 'Speeding'
    case 'missing':
      return 'Missing person'
    default:
      return capitalizeString(s)
  }
}

const DropdownPanel: FC<DropdownPanelProps> = ({filters, setFilters}) => {
  const [isOpen, setIsOpen] = useState(false)

  // check if user presses escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])
  
  return (
    <div>
      <div onClick={() => setIsOpen(true)} className='ml-12 md:ml-0 text-gray-100 font-bold'>
        <button onClick={() => setIsOpen(true)} className="bg-gray-800 max-w-[5rem] text-white px-3 py-2 rounded-sm text-sm font-medium hover:bg-gray-700" id="user-menu" aria-haspopup="true">
          More
        </button>
      </div>
      <div className={"absolute top-0 left-0 w-full h-screen transition-all bg-gray-900/95" + (isOpen ? " opacity-100 pointer-events-auto" : " opacity-0 pointer-events-none")}>
        <button onClick={() => setIsOpen(false)} className='absolute top-0 right-0 mt-4 mr-4'>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 stroke-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className='flex flex-col items-center h-full'>
          <div className='text-gray-100 p-10 font-bold text-2xl flex flex-col gap-4 max-w-3xl'>
            <div>
              <h1>Filters</h1>
              <div className='flex flex-col mt-4 gap-1'>
                {Object.entries(filters).map(([key, value]) => (
                  <div key={key} className={"flex items-center pl-4 border rounded border-gray-700 hover:border-gray-100" + (value ? " bg-gray-700/10 " : "")}
                    onClick={() => setFilters({...filters, [key]: !value})}>
                    <input id="bordered-checkbox-1" type="checkbox" name="bordered-checkbox" checked={value}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                    <label className="w-full py-4 ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">{markerFilterTypeToPretty(key)}</label>
                  </div>
                ))}
              </div>
            </div>
            <br />
            <div className='text-sm'>
              <h1 className='text-2xl'>How it works</h1>
              <p className='text-gray-300'>
                This project collects data from Norwegian police twitters, parses them using <Link href="https://www.openai.com/">OpenAI&apos;s ChatGPT</Link> and displays the results on a map of Norway. Severity is also decided by the model.
                <br />
                Coordinates are extracted from the tweets and ran thorugh Google&apos;s Text Search API to get the exact location of the crime.
                The data is then displayed on a map using <Link href="https://leafletjs.com/">Leaflet</Link>.
                <br />
                Tweets are scraped every 30 minutes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DropdownPanel