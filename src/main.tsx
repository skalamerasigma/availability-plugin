import React from 'react'
import ReactDOM from 'react-dom/client'
import { AvailabilityPlugin } from './AvailabilityPlugin'
import './styles.css'

// Initialize dark mode from localStorage before rendering
const savedDarkMode = localStorage.getItem('darkMode') === 'true'
if (savedDarkMode) {
  document.documentElement.classList.add('dark-mode')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AvailabilityPlugin />
  </React.StrictMode>,
)

