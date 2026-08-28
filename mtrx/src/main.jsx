import React                from 'react'
import { createRoot }       from 'react-dom/client'
import { HashRouter }       from 'react-router-dom'
import CssBaseline          from '@mui/material/CssBaseline'
import { ThemeProvider }    from '@mui/material/styles'
import App                  from './App'
import theme                from './theme'

// Global error handling for WebSocket and connection issues
window.addEventListener('error', (event) => {
  // Log connection-related errors for debugging
  if (event.message && (event.message.includes('Could not establish connection') || event.message.includes('WebSocket'))) {
    console.error('Connection error:', event.message)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  // Log unhandled promise rejections related to connection
  if (event.reason && typeof event.reason === 'object') {
    const errorMsg = event.reason.message || String(event.reason)
    if (errorMsg.includes('Could not establish connection') || errorMsg.includes('WebSocket') || errorMsg.includes('reconnect')) {
      console.error('Unhandled rejection (connection):', errorMsg)
    }
  }
})

// Redux
import { Provider } from 'react-redux'
import configureStore from './store/configureStore'
const store = configureStore()

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </HashRouter>
    </Provider>
  </React.StrictMode>,
)