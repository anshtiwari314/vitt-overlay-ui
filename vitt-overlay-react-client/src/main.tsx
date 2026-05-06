import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider as ReduxProvider } from 'react-redux'
import './index.css'
import AuthContext from './context/AuthContext'
import Routing from './Routing'
import store from './redux/store/store.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReduxProvider store={store}>
      <AuthContext>
        <Routing />
      </AuthContext>
    </ReduxProvider>
  </StrictMode>
)
