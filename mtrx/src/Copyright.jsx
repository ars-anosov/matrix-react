import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

import {
  Typography,
  Link
} from '@mui/material'

import { version, dependencies, devDependencies } from '../package.json'



function Copyright(props) {
  if (import.meta.env.DEV) console.log('Copyright hook')

  const {
    showFull
  } = props



  useEffect(() => {
    if (import.meta.env.DEV) console.log('Copyright MOUNT')

    return () => {
      if (import.meta.env.DEV) console.log('Copyright UNMOUNT')
    }
  }, [])



  return (
    <Typography
      variant="body2"
      align="center"
      
      sx={{
        mt: 2,
        fontSize: 11,
        color: 'text.secondary',
      }}
    >
      {showFull && (
      <span>
        Powered by
        matrix-js-sdk {dependencies['matrix-js-sdk']},
        ky {dependencies['ky']}
        <br />
        react-dom {dependencies['react-dom']},
        react-redux {dependencies['react-redux']},
        @mui/material {dependencies['@mui/material']},
        <br />
        vite {devDependencies['vite']},
        @vitejs/plugin-react {devDependencies['@vitejs/plugin-react']}
        <br /><br />
      </span>
      )}
      
      <strong>v.{version}</strong>
      {' Copyright © '}
      <Link color="inherit" href="https://github.com/ars-anosov/matrix-react">
        ars
      </Link>{' '}
      {new Date().getFullYear()}.
    </Typography>
  )
}

Copyright.propTypes = {
  showFull             : PropTypes.bool.isRequired,
}

export default Copyright