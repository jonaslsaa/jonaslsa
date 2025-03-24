import React from 'react'
import type { FC } from 'react'

type ProjectLinkProps = {
    link: string,
    title: string,
    newTab?: boolean,
    bold?: boolean,
}

const ProjectLink: FC<ProjectLinkProps> = ({link, title, newTab, bold}) => {
  const h2Style: React.CSSProperties = bold ? {
    fontWeight: "bold",
  } : {};
  return (
    <a href={link} rel="noreferrer" className="text-sky-300 hover:text-sky-500 transition-all" target={newTab ? "_blank" : "_self"} >
        <h2 style={h2Style}>{title}</h2>
    </a>
  )
}

export default ProjectLink