import React from 'react'
import ReactDOM from 'react-dom/client'
import { AvailabilityPlugin } from './AvailabilityPlugin'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AvailabilityPlugin />
  </React.StrictMode>,
)

