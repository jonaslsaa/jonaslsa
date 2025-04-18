import Link from 'next/link'
import React, { useState } from 'react'
import type { FC } from 'react'
import type { markerFilterType, markerSeverityType } from './Map';
import type { SourceFilters } from '../../pages/blip';

type DropdownPanelProps = {
  filters : Record<markerFilterType, boolean>
  severityFilters: Record<markerSeverityType, boolean>
  sourceFilters: SourceFilters
  setFilters: (filters: Record<markerFilterType, boolean>) => void
  setSeverityFilters: (filters: Record<markerSeverityType, boolean>) => void
  setSourceFilters: (filters: SourceFilters) => void
}

const capitalizeString = (s: string) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
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

const DropdownPanel: FC<DropdownPanelProps> = ({filters, setFilters, severityFilters, setSeverityFilters, sourceFilters, setSourceFilters: setSourceFilters}) => {
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


  const selectAll = () => {
    const newFilters = {...filters}
    Object.keys(newFilters).forEach((key) => {
      newFilters[key as markerFilterType] = true
    })
    setFilters(newFilters)
  }

  const selectNone = () => {
    const newFilters = {...filters}
    Object.keys(newFilters).forEach((key) => {
      newFilters[key as markerFilterType] = false
    })
    setFilters(newFilters)
  }

  const selectAllAccounts = () => {
    const newFilters = {...sourceFilters}
    Object.keys(newFilters).forEach((key) => {
      const newHandleFilters = {...newFilters[key as markerFilterType]}
      Object.keys(newHandleFilters).forEach((handleKey) => {
        newHandleFilters[handleKey as string] = true
      })
      newFilters[key as markerFilterType] = newHandleFilters
    })
    setSourceFilters(newFilters)
  }

  const selectNoneAccounts = () => {
    const newFilters = {...sourceFilters}
    Object.keys(newFilters).forEach((key) => {
      const newHandleFilters = {...newFilters[key as markerFilterType]}
      Object.keys(newHandleFilters).forEach((handleKey) => {
        newHandleFilters[handleKey as string] = false
      })
      newFilters[key as markerFilterType] = newHandleFilters
    })
    setSourceFilters(newFilters)
  }
  

  const LowIconsUri: Record<markerFilterType, string> = {
    default: '/markers/marker-blue.png',
    traffic: '/markers/marker-blue-traffic.png',
    fire: '/markers/marker-blue-fire.png',
    speed: '/markers/marker-blue-speed.png',
    missing: '/markers/marker-blue-missing.png'
  }

  const SeverityIconsUri: Record<markerSeverityType, string> = {
    LOW: '/markers/marker-blue.png',
    MED: '/markers/marker-yellow.png',
    HIGH: '/markers/marker-red.png'
  }
  
  return (
    <div>
      <div onClick={() => setIsOpen(true)} className='ml-12 md:ml-0 text-gray-100 font-bold'>
        <button onClick={() => setIsOpen(true)} className="bg-gray-800 max-w-[5rem] text-white px-3 py-2 rounded-sm text-sm font-medium hover:bg-gray-700" id="user-menu" aria-haspopup="true">
          More
        </button>
      </div>
      <div className={"absolute top-0 left-0 w-full h-screen transition-all bg-gray-900/95" + (isOpen ? " opacity-100 pointer-events-auto" : " opacity-0 pointer-events-none")}>
        <button onClick={() => setIsOpen(false)} className='absolute top-0 right-0 mt-4 mr-8'>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 stroke-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className='flex flex-col items-center h-full overflow-y-scroll'>
          <div className='text-gray-100 p-10 font-bold text-2xl flex flex-col gap-4 max-w-3xl'>
            <div>
              <h1>Category</h1>
              <span className='text-gray-200/50 text-sm font-thin'><button className='hover:text-gray-200' onClick={selectAll}>Select all</button> | <button className='hover:text-gray-200' onClick={selectNone}>Select none</button></span>
              <div className='flex flex-col mt-4 gap-1'>
                {Object.entries(filters).map(([key, value]) => (
                  <div key={key} className={"flex items-center pl-4 border rounded border-gray-700 hover:border-gray-100" + (value ? " bg-gray-700/10 " : "")}
                    onClick={() => setFilters({...filters, [key]: !value})}>
                    <input id="bordered-checkbox-1" type="checkbox" name="bordered-checkbox" readOnly checked={value}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                    <label className="w-full py-4 ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"><img className='inline mr-1' width={20} src={LowIconsUri[key]} alt={'Filter icon'} /> {markerFilterTypeToPretty(key as markerFilterType)}</label>
                  </div>
                ))}
              </div>
              <h2 className='mt-4'>Severity</h2>
              <div className='flex flex-col mt-4 gap-1'>
                {Object.entries(severityFilters).map(([key, value]) => (
                  <div key={key} className={"flex items-center pl-4 border rounded border-gray-700 hover:border-gray-100" + (value ? " bg-gray-700/10 " : "")}
                    onClick={() => setSeverityFilters({...severityFilters, [key]: !value})}>
                    <input id="bordered-checkbox-1" type="checkbox" name="bordered-checkbox" readOnly checked={value}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                    <label className="w-full py-4 ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"><img className='inline mr-1' width={20} src={SeverityIconsUri[key as markerSeverityType]} alt={'Filter icon'} /> {capitalizeString(key as markerSeverityType)}</label>
                  </div>
                ))}
              </div>
              <h2 className='mt-4'>Sources</h2>
              <span className='text-gray-200/50 text-sm font-thin'><button className='hover:text-gray-200' onClick={selectAllAccounts}>Select all</button> | <button className='hover:text-gray-200' onClick={selectNoneAccounts}>Select none</button></span>
              <div className='flex flex-row flex-wrap gap-4 w-full'>
                {Object.entries(sourceFilters).map(([key, value]) => (
                  <div key={key}>
                    <h3 className='text-2xl text-gray-200 font-thin'>{capitalizeString(key)}</h3>
                    <div className='flex flex-col gap-1 max-h-sm'>
                      {Object.entries(value).map(([key2, value]) => (
                        <div key={key2} className={"flex items-center pl-4 border rounded border-gray-700 hover:border-gray-100" + (value ? " bg-gray-700/10 " : "")}
                          onClick={() => setSourceFilters({...sourceFilters, [key]: {...sourceFilters[key], [key2]: !value}})}>
                          <input id="bordered-checkbox-1" type="checkbox" name="bordered-checkbox" readOnly checked={value}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                          <label className="w-full py-4 ml-2 text-sm font-medium text-gray-900 dark:text-gray-300 pl-1 pr-3">{key2}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className='text-sm mt-2'>
              <h1 className='text-2xl'>How it works</h1>
              <p className='text-gray-300 font-thin'>
                This project collects data from <Link className='text-blue-200 transition-colors hover:text-blue-300' href="https://www.politiet.no/politiloggen/">Norwegian police logs</Link>, parses them using <Link className='text-blue-200 transition-colors hover:text-blue-300' href="https://www.openai.com/">OpenAI&apos;s ChatGPT</Link> and displays the results on a map of Norway. Severity is also decided by the model.
                <br />
                Coordinates are extracted from the tweets and ran thorugh Google&apos;s Text Search API to get the exact location of the crime.
                The data is then displayed on a map using <Link className='text-blue-200 transition-colors hover:text-blue-300' href="https://leafletjs.com/">Leaflet</Link>.
                <br />
                Data are scraped every 20 minutes.
                <br />
                Built using the <Link target='_blank' className='text-violet-400 font-semibold' href="https://create.t3.gg/">T3 Stack</Link>.
              </p>
            </div>
            <div className='text-sm mt-2'>
              <h1 className='text-1xl'>Contact</h1>
              <p className='text-gray-300 font-thin'>
                <Link target='_blank' className='hover:text-blue-300' href="https://www.linkedin.com/in/jonas-silva-b1a628ba/">Linkedin</Link> | <Link className='hover:text-blue-300' href="emailto:jonasvox.2014+jonaslsa@gmail.com">Email</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DropdownPanel