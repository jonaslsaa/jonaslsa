import React from 'react'
import type { FC } from 'react'

type ProjectLinkProps = {
    link: string,
    title: string,
    newTab?: boolean,
}

const ProjectLink: FC<ProjectLinkProps> = ({link, title, newTab}) => {
  return (
    <a href={link} rel="noreferrer" className="text-sky-300 hover:text-sky-500 transition-all" target={newTab ? "_blank" : "_self"} >
        <h2>{title}</h2>
    </a>
  )
}

export default ProjectLink