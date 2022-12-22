import React from 'react'
import type { FC } from 'react'

type ProjectLinkProps = {
    link: string,
    title: string,
}

const ProjectLink: FC<ProjectLinkProps> = ({link, title}) => {
  return (
    <a href={link} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-500 transition-all">
        <h2>{title}</h2>
    </a>
  )
}

export default ProjectLink