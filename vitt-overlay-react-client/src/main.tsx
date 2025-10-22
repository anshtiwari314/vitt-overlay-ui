import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import store from './redux/store/store.tsx'
import { Provider as ReduxProvider} from 'react-redux'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReduxProvider store={store}>
        <App />
    </ReduxProvider>
  </StrictMode>,
)
