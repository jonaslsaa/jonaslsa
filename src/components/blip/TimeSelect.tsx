import React, { useEffect, useState } from 'react'
import type { FC } from 'react'


type TimeOption = {pretty: string, hours: number}; 

type TimeSelectProps = {
  options : TimeOption[]
  setHours: (hours: number) => void
}

const TimeSelect: FC<TimeSelectProps> = (props) => {
  const [selectedTime, setSelectedTime] = useState<TimeOption>(props.options[0]);

  useEffect(() => {
    props.setHours(selectedTime.hours)
  }, [props, selectedTime])

  const handleDecrement = () => {
    const index = props.options.indexOf(selectedTime)
    if (index > 0) {
      setSelectedTime(props.options[index - 1])
    }
  }

  const handleIncrement = () => {
    const index = props.options.indexOf(selectedTime)
    if (index < props.options.length - 1) {
      setSelectedTime(props.options[index + 1])
    }
  }
  
  return (
    <div className="flex items-center justify-center text-white h-9">
      <button className="px-3 h-full bg-gray-800 text-white focus:outline-none hover:bg-gray-700" onClick={handleDecrement}>
        -
      </button>
      <span style={{lineHeight: '2.1rem'}} className="select-none text-xl h-full bg-gray-800 text-white font-medium max-w-xl w-20 text-center">{selectedTime.pretty}</span>
      <button className="px-3 h-full bg-gray-800 text-white focus:outline-none hover:bg-gray-700" onClick={handleIncrement}>
        +
      </button>
    </div>
  )
}

export default TimeSelect