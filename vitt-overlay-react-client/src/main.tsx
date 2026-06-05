import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider as ReduxProvider } from 'react-redux'
import './index.css'
import AuthContext from './context/AuthContext'
import { ServerUrlProvider } from './context/ServerUrlContext'
import { clearLegacyStoredPreferences } from './functions/serverUrl'
import Routing from './Routing'
import store from './redux/store/store.tsx'

clearLegacyStoredPreferences()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReduxProvider store={store}>
      <AuthContext>
        <ServerUrlProvider>
          <Routing />
        </ServerUrlProvider>
      </AuthContext>
    </ReduxProvider>
  </StrictMode>
)
